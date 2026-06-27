// reasoner.runner.js - the RUNNER half of the reasoner (the "Option B" pattern:
// SPEC constant in reasoner.spec.js + this runner). One exported function,
//   run(task, ctx) -> result
// driving a BOUNDED loop:
//
//   survey   -> ragSearch(task) to gather evidence (the grounding step)
//   dispatch -> decide what to do with it (this reasoner produces directly; the
//               seam is here for picking a tool/sub-agent or a linked workflow)
//   produce  -> ask the reasoner model for a {answer, citations} object
//   gate     -> output-checker.check(): deterministic gates first, then a cheap
//               Haiku grade; pass => persist + return, fail => feed the
//               structuredDiff back into the next produce as correction
//   ceiling  -> after maxIterations failures, dead-letter (DLQ)
//
// ctx IS the injection seam so this is unit-testable with a mocked llm:
//   ctx = { llm, ragSearch, db, logger }
//   - llm.complete({ system, prompt, model, maxTokens }) -> string
//   - ragSearch({ query, topK }) -> { hits: [{id, content, score}] }
//   - db: a persistence handle with markRunning/markDone/markDlq (see jobs.js)
//   - logger: anything with .log (defaults to console)
// In production server.js wires the real ./llm, ../rag/search, and ./jobs; a
// test passes fakes (see reasoner.runner.test.js).

const { check } = require("./output-checker");
const { REASONER_SPEC, resolveModel, resolveMaxIterations } = require("./reasoner.spec");
const { dispatch, parseDispatch } = require("./dispatch");

const PRODUCE_SYSTEM =
  "You are a careful reasoning agent. Answer the TASK using ONLY the supplied " +
  "EVIDENCE chunks. Cite the chunk ids you used. If a CORRECTION is supplied, " +
  "fix exactly what it calls out. Reply with ONLY a JSON object: " +
  '{"answer": "<your answer>", "citations": ["<chunk id>", ...]}. ' +
  "Do not include any prose outside the JSON.";

function log(ctx, obj) {
  const logger = (ctx && ctx.logger) || console;
  try {
    logger.log(JSON.stringify(obj));
  } catch {
    /* logging must never throw */
  }
}

function safeParseResult(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function evidenceBlock(hits) {
  if (!hits || !hits.length) return "(no evidence found)";
  return hits
    .map((h) => `- [${h.id}] (score ${Number(h.score).toFixed(3)}) ${h.content}`)
    .join("\n");
}

// produce - one model call: build the prompt from the task, the surveyed
// evidence, and (on a retry) the prior failure's structuredDiff.
async function produce({ task, hits, correction, model, ctx }) {
  const parts = [
    `TASK:\n${task}`,
    `EVIDENCE:\n${evidenceBlock(hits)}`,
  ];
  if (correction) {
    parts.push(
      `CORRECTION (the previous attempt failed the gate - fix this):\n${JSON.stringify(correction)}`
    );
  }
  const raw = await ctx.llm.complete({
    system: PRODUCE_SYSTEM,
    prompt: parts.join("\n\n"),
    model,
    maxTokens: 1024,
  });
  return safeParseResult(raw);
}

// run - the bounded reasoning loop. Returns the gated result, or throws after
// the loop dead-letters (the caller / job layer records the DLQ state).
async function run(task, ctx = {}) {
  if (!task || (typeof task !== "string" && typeof task.task !== "string")) {
    throw new Error("reasoner.run requires a task (string) or { task }");
  }
  const taskText = typeof task === "string" ? task : task.task;
  const topK = (typeof task === "object" && task.topK) || 8;

  if (!ctx.llm || typeof ctx.llm.complete !== "function") {
    throw new Error("reasoner.run requires ctx.llm.complete");
  }
  if (typeof ctx.ragSearch !== "function") {
    throw new Error("reasoner.run requires ctx.ragSearch");
  }

  const model = resolveModel(REASONER_SPEC, process.env);
  const maxIterations = resolveMaxIterations(REASONER_SPEC, process.env);

  // SURVEY - gather grounding evidence once up front. Re-surveying per-iteration
  // is a future knob; for now evidence is stable and only the produce changes.
  const { hits } = await ctx.ragSearch({ query: taskText, topK });
  log(ctx, { event: "reasoner_survey", task: taskText, hits: (hits || []).length });

  let correction = null;
  const attempts = [];

  for (let i = 1; i <= maxIterations; i++) {
    // DISPATCH seam: this reasoner produces directly. A richer deployer agent
    // could branch here to call a tool, hand off to a sub-agent, or trigger a
    // linked workflow based on the survey - the loop scaffolding is unchanged.
    const output = await produce({ task: taskText, hits, correction, model, ctx });

    // GATE - deterministic checks first, then the cheap LLM grade.
    const verdict = await check(
      taskText,
      output,
      { schema: REASONER_SPEC.outputSchema, requireCitations: REASONER_SPEC.requireCitations },
      ctx
    );
    attempts.push({ iteration: i, pass: verdict.pass, reason: verdict.reason, stage: verdict.stage });
    log(ctx, {
      event: "reasoner_iteration",
      iteration: i,
      max: maxIterations,
      pass: verdict.pass,
      stage: verdict.stage,
      reason: verdict.reason,
    });

    if (verdict.pass) {
      return {
        status: "done",
        result: output,
        iterations: i,
        attempts,
      };
    }

    // FAIL - feed the structuredDiff forward as the next attempt's correction.
    correction = verdict.structuredDiff || { reason: verdict.reason };
  }

  // CEILING hit -> dead-letter. The caller (jobs layer) records status=dlq.
  log(ctx, { event: "reasoner_dlq", task: taskText, iterations: maxIterations });
  const err = new Error(`reasoner dead-lettered after ${maxIterations} iterations`);
  err.dlq = true;
  err.attempts = attempts;
  err.iterations = maxIterations;
  throw err;
}

module.exports = { run, SPEC: REASONER_SPEC };
