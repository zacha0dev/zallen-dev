// trainer.runner.js - the RUNNER half of the TRAINER (Phase 3), mirroring the
// reasoner's SPEC + runner + ctx-injection pattern. Where the reasoner drives a
// bounded loop over ONE task, the trainer drives a bounded loop over a BATCH of
// nodes - the x10 Multi-Node Enrichment Framework:
//
//   for each NODE (capped at MAX_BATCH_NODES):
//     attempt loop (<= maxAttemptsPerNode):
//       enrich  -> one Sonnet call producing enrichments across the 10 dims
//       check   -> the SHARED output-checker.check() (deterministic-first, then
//                  a cheap Haiku grade) - REUSED, not re-implemented
//       pass?   -> mark the node done, persist, next node
//       fail?   -> feed the structuredDiff back, re-enrich ONCE
//     ceiling -> mark the node failed (per-node dead-letter; the batch continues)
//     persist -> upsert the node's enrichments + grades to the enrichment_tracker
//
// One structured log line is emitted per node. The whole batch never throws on a
// single node failure - a failed node is recorded and the batch proceeds, so one
// bad unit can't sink a training run.
//
// ctx IS the injection seam so this is unit-testable with a mocked llm:
//   ctx = { llm, db, logger }
//   - llm.complete({ system, prompt, model, maxTokens }) -> string
//   - db: the trainer persistence handle (upsertNode(runId, node) -> void).
//         Optional in tests; when absent, persistence is skipped (the runner
//         still returns the in-memory result).
//   - logger: anything with .log (defaults to console)
// In production server.js wires the real ./llm + ./trainer-jobs; a test passes
// fakes (see trainer.runner.test.js).

const { check } = require("./output-checker");
const {
  TRAINER_SPEC,
  ENRICHMENT_DIMENSIONS,
  makeNode,
  resolveEnricherModel,
  resolveMaxAttempts,
  resolveMaxBatchNodes,
} = require("./trainer.spec");

const ENRICH_SYSTEM =
  "You are a training-data enrichment agent. You are given a NODE (a unit of " +
  "training context) and must enrich it across EXACTLY these 10 dimensions: " +
  ENRICHMENT_DIMENSIONS.join(", ") +
  ". For each dimension, write a concise, grounded enrichment. If a CORRECTION " +
  "is supplied, fix exactly what it calls out. Reply with ONLY a JSON object: " +
  '{"enrichments": {"<dimension>": "<text>", ...}}, one key per dimension. ' +
  "Do not include any prose outside the JSON.";

function log(ctx, obj) {
  const logger = (ctx && ctx.logger) || console;
  try {
    logger.log(JSON.stringify(obj));
  } catch {
    /* logging must never throw */
  }
}

function safeParse(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// enrich - one model call: build the prompt from the node's context, the 10
// dimensions, and (on a retry) the prior failure's structuredDiff. Returns the
// candidate enriched-node object the checker will grade.
async function enrich({ node, correction, model, ctx }) {
  const parts = [
    `NODE id: ${node.id}`,
    `CONTEXT:\n${node.context}`,
    `DIMENSIONS (enrich across all of these):\n${ENRICHMENT_DIMENSIONS.join("\n")}`,
  ];
  if (correction) {
    parts.push(
      `CORRECTION (the previous attempt failed the gate - fix this):\n${JSON.stringify(correction)}`
    );
  }
  const raw = await ctx.llm.complete({
    system: ENRICH_SYSTEM,
    prompt: parts.join("\n\n"),
    model,
    maxTokens: 1500,
  });
  const parsed = safeParse(raw);
  // Unwrap the enrichments map. Prefer the explicit { enrichments: {...} } wrapper;
  // otherwise accept a bare map IFF it actually looks like a dimension map (carries
  // at least one known dimension key). A malformed/unrelated object yields {} so
  // the completeness gate in runNode catches it (rather than passing junk through).
  let enrichments = {};
  if (parsed && typeof parsed === "object") {
    if (parsed.enrichments && typeof parsed.enrichments === "object") {
      enrichments = parsed.enrichments;
    } else if (ENRICHMENT_DIMENSIONS.some((d) => Object.prototype.hasOwnProperty.call(parsed, d))) {
      enrichments = parsed;
    }
  }
  // Build the candidate node the checker grades against the SPEC outputSchema.
  return {
    id: node.id,
    context: node.context,
    enrichments: enrichments || {},
    grades: {},
    status: "enriched",
    attempts: node.attempts,
  };
}

// gradePerDimension - derive a per-dimension grades{} map from a checker verdict.
// On pass, every dimension is marked pass. On fail, dimensions the structuredDiff
// names (or, if it names none, ALL dimensions) are marked failing with the
// verdict reason - this is what gets persisted as the node's per-dimension grades.
function gradePerDimension(verdict) {
  const grades = {};
  if (verdict.pass) {
    for (const dim of ENRICHMENT_DIMENSIONS) {
      grades[dim] = { pass: true, reason: "graded pass" };
    }
    return grades;
  }
  const diff = verdict.structuredDiff || {};
  const named = ENRICHMENT_DIMENSIONS.filter((d) => Object.prototype.hasOwnProperty.call(diff, d));
  const failing = named.length ? named : ENRICHMENT_DIMENSIONS;
  for (const dim of ENRICHMENT_DIMENSIONS) {
    grades[dim] = failing.includes(dim)
      ? { pass: false, reason: verdict.reason || "graded fail" }
      : { pass: true, reason: "graded pass" };
  }
  return grades;
}

// runNode - the bounded per-node enrich->check->re-enrich loop. Never throws:
// returns the final node (status done | failed) with its enrichments + grades.
async function runNode(rawNode, { model, maxAttempts, ctx }) {
  const node = makeNode(rawNode);
  let correction = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    node.attempts = attempt;

    // ENRICH (Sonnet). On a parse failure the candidate carries empty
    // enrichments, which the completeness gate then flags - no special-casing.
    const candidate = await enrich({ node, correction, model, ctx });
    node.enrichments = candidate.enrichments;
    node.status = "enriched";

    // COMPLETENESS GATE (the trainer's own deterministic, free pre-check): the
    // x10 contract requires an enrichment for EVERY dimension. A missing
    // dimension is caught here for free - before we spend a checker LLM grade -
    // and its diff feeds the same retry loop. This is the trainer-specific gate;
    // the cross-cutting quality gate below stays the shared output-checker.
    const missing = ENRICHMENT_DIMENSIONS.filter(
      (d) => !candidate.enrichments[d] || !String(candidate.enrichments[d]).trim()
    );
    if (missing.length) {
      node.grades = gradePerDimension({
        pass: false,
        reason: `missing enrichment for: ${missing.join(", ")}`,
        structuredDiff: Object.fromEntries(missing.map((d) => [d, "enrich this dimension"])),
      });
      node.status = "checked";
      correction = { issue: "incomplete", missing };
      continue;
    }

    // CHECK - the SHARED output-checker. Deterministic gates (schema/refusal)
    // run first for free; only then the cheap Haiku grade.
    const verdict = await check(
      `Enrich the node "${node.id}" across the 10 dimensions: ${ENRICHMENT_DIMENSIONS.join(", ")}.`,
      candidate,
      { schema: TRAINER_SPEC.outputSchema },
      ctx
    );
    node.grades = gradePerDimension(verdict);
    node.status = "checked";

    if (verdict.pass) {
      node.status = "done";
      return node;
    }

    // FAIL - feed the structuredDiff forward as the next attempt's correction.
    correction = verdict.structuredDiff || { reason: verdict.reason };
  }

  // CEILING hit -> per-node dead-letter. The BATCH continues (we do not throw).
  node.status = "failed";
  return node;
}

// run - the batch enrichment loop. Accepts an array of nodes OR { nodes }.
// Returns a batch summary compatible with jobs.runDetached:
//   { status, result: { nodes, summary }, iterations }
// where iterations = total attempts across the batch (a useful, bounded metric).
async function run(input, ctx = {}) {
  const rawNodes = Array.isArray(input) ? input : input && input.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new Error("trainer.run requires nodes (a non-empty array) or { nodes }");
  }
  if (!ctx.llm || typeof ctx.llm.complete !== "function") {
    throw new Error("trainer.run requires ctx.llm.complete");
  }

  const model = resolveEnricherModel(TRAINER_SPEC, process.env);
  const maxAttempts = resolveMaxAttempts(TRAINER_SPEC, process.env);
  const maxBatch = resolveMaxBatchNodes(TRAINER_SPEC, process.env);

  // Enforce the batch cap (cost ceiling). Excess nodes are dropped, not silently
  // half-processed; we record how many were skipped in the summary.
  const batch = rawNodes.slice(0, maxBatch);
  const skipped = rawNodes.length - batch.length;
  const runId = (ctx.db && ctx.db.runId) || null;

  log(ctx, {
    event: "trainer_batch_start",
    nodes: batch.length,
    skipped,
    maxAttempts,
    model,
  });

  const outNodes = [];
  let totalAttempts = 0;

  for (const raw of batch) {
    const node = await runNode(raw, { model, maxAttempts, ctx });
    totalAttempts += node.attempts;
    outNodes.push(node);

    // PERSIST per-node to the enrichment_tracker (best-effort: a persistence
    // failure on one node must not sink the batch).
    if (ctx.db && typeof ctx.db.upsertNode === "function") {
      try {
        await ctx.db.upsertNode(runId, node);
      } catch (err) {
        log(ctx, { event: "trainer_node_persist_failed", node_id: node.id, error: String(err.message || err) });
      }
    }

    // One structured log line per node.
    log(ctx, {
      event: "trainer_node",
      node_id: node.id,
      status: node.status,
      attempts: node.attempts,
      passed_dimensions: Object.values(node.grades).filter((g) => g && g.pass).length,
      total_dimensions: ENRICHMENT_DIMENSIONS.length,
    });
  }

  const done = outNodes.filter((n) => n.status === "done").length;
  const failed = outNodes.filter((n) => n.status === "failed").length;
  const summary = { total: outNodes.length, done, failed, skipped, dimensions: ENRICHMENT_DIMENSIONS.length };

  log(ctx, { event: "trainer_batch_done", ...summary });

  return {
    status: "done",
    result: { nodes: outNodes, summary },
    iterations: totalAttempts,
  };
}

module.exports = { run, runNode, gradePerDimension, SPEC: TRAINER_SPEC };
