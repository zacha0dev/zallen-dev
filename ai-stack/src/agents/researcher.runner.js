// researcher.runner.js - the RUNNER half of the RESEARCHER role agent. Mirrors
// the reasoner runner's SPEC + runner + ctx-injection shape, but is a SINGLE
// CALL (no produce->gate->retry loop): a research worker, not an orchestrator.
//
//   run(input, ctx) -> { status, result, model, depth }
//
// Flow:
//   survey      -> ctx.ragSearch(question) ONCE to gather grounding evidence
//   synthesize  -> ONE ctx.llm.complete() asking for { summary, citations[], confidence }
//   ground      -> drop any citation whose chunkId is not in the surveyed hits
//                  (the anti-fabrication guard: the worker can only cite what it
//                  actually retrieved) and backfill the excerpt from the hit
//   one structured log line per run (the evidence gate, like rag/search.js)
//
// ctx IS the injection seam so this is unit-testable with a mocked llm:
//   ctx = { llm, ragSearch, logger }
//   - llm.complete({ system, prompt, model, maxTokens }) -> string
//   - ragSearch({ query, topK }) -> { hits: [{ id, content, score }] }
//   - logger: anything with .log (defaults to console)
// server.js wires the real ./llm + ../rag/search; tests pass fakes.

const { RESEARCHER_SPEC, resolveModel, resolveDepth } = require("./researcher.spec");

const SYNTHESIZE_SYSTEM =
  "You are a careful research worker. Answer the QUESTION using ONLY the " +
  "supplied EVIDENCE chunks. Write a concise summary, and CITE every claim " +
  "with the chunk id it came from. NEVER cite a chunk id that is not in the " +
  "EVIDENCE, and never invent a source. Reply with ONLY a JSON object: " +
  '{"summary": "<concise answer>", "citations": [{"chunkId": "<id from EVIDENCE>", ' +
  '"excerpt": "<short supporting quote>"}], "confidence": "low|medium|high"}. ' +
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

// groundCitations - the anti-fabrication guard. Keep only citations whose
// chunkId is one of the surveyed hit ids; backfill a missing excerpt from the
// hit's content so every citation is real + traceable. Returns the cleaned list.
function groundCitations(citations, hits) {
  const byId = new Map((hits || []).map((h) => [String(h.id), h]));
  const out = [];
  for (const c of Array.isArray(citations) ? citations : []) {
    const id = c && (c.chunkId || c.id || c.chunk_id);
    if (id === undefined || id === null) continue;
    const hit = byId.get(String(id));
    if (!hit) continue; // fabricated / hallucinated source -> dropped
    out.push({
      chunkId: String(id),
      excerpt:
        (c.excerpt && String(c.excerpt)) ||
        String(hit.content || "").slice(0, 240),
    });
  }
  return out;
}

// run - the single-call research path. Returns the grounded result. Throws on a
// missing ctx seam or an unparseable model reply (the caller / job layer records
// the failure); there is no retry loop - a worker either answers or fails fast.
async function run(input, ctx = {}) {
  const question =
    typeof input === "string" ? input : input && (input.question || input.task);
  if (!question || typeof question !== "string") {
    throw new Error("researcher.run requires a question (string) or { question }");
  }
  if (!ctx.llm || typeof ctx.llm.complete !== "function") {
    throw new Error("researcher.run requires ctx.llm.complete");
  }
  if (typeof ctx.ragSearch !== "function") {
    throw new Error("researcher.run requires ctx.ragSearch");
  }

  const depth = resolveDepth(typeof input === "object" ? input.depth : undefined);
  const topK = (typeof input === "object" && input.topK) || 8;
  const model = resolveModel(depth, RESEARCHER_SPEC, process.env);

  // SURVEY - grounding evidence, once.
  const { hits } = await ctx.ragSearch({ query: question, topK });

  // SYNTHESIZE - one model call.
  const raw = await ctx.llm.complete({
    system: SYNTHESIZE_SYSTEM,
    prompt: `QUESTION:\n${question}\n\nEVIDENCE:\n${evidenceBlock(hits)}`,
    model,
    maxTokens: 1024,
  });
  const parsed = safeParseResult(raw);
  if (!parsed) {
    log(ctx, { event: "researcher_run", question, depth, model, hits: (hits || []).length, ok: false, reason: "unparseable" });
    const err = new Error("researcher: model returned an unparseable result");
    err.unparseable = true;
    throw err;
  }

  // GROUND - drop any fabricated citation, backfill excerpts from real hits.
  const citations = groundCitations(parsed.citations, hits);
  const result = {
    summary: String(parsed.summary || ""),
    citations,
    confidence: parsed.confidence || "medium",
  };

  // One structured log line per run (the evidence gate).
  log(ctx, {
    event: "researcher_run",
    question,
    depth,
    model,
    hits: (hits || []).length,
    citations: citations.length,
    confidence: result.confidence,
    ok: true,
  });

  return { status: "done", result, model, depth };
}

module.exports = { run, SPEC: RESEARCHER_SPEC };
