// drafter.runner.js - the RUNNER half of the DRAFTER role agent. Same SPEC +
// runner + ctx-injection shape as the researcher, also a SINGLE CALL (no loop)
// and PURE GENERATION (no ragSearch, no tools):
//
//   run(input, ctx) -> { status, result, model, format }
//
// Flow:
//   pre-check  -> measure the context; if it is below thinContextChars, queue a
//                 "thin context" warning so the caller can re-run RESEARCHER first
//   generate   -> ONE ctx.llm.complete() producing the draft in the target format
//   shape      -> wrap into { draft, format, wordCount, warnings[] }; for the
//                 json format, validate the draft parses (else warn, don't throw)
//   one structured log line per run
//
// ctx IS the injection seam (unit-testable with a mock):
//   ctx = { llm, logger }     // NB: no ragSearch - the drafter touches no tools
//   - llm.complete({ system, prompt, model, maxTokens }) -> string

const { DRAFTER_SPEC, resolveModel, resolveFormat } = require("./drafter.spec");

function generateSystem(format) {
  const base =
    "You are a focused drafting worker. Produce a clean draft of the requested " +
    "TYPE from the supplied CONTEXT and INSTRUCTION. Output ONLY the draft body " +
    "- no preamble, no explanation, no code fences. ";
  if (format === "json")
    return base + "The draft MUST be a single valid JSON value and nothing else.";
  if (format === "plaintext")
    return base + "The draft MUST be plain text only - no markdown, no markup.";
  return base + "The draft should be well-structured markdown.";
}

function log(ctx, obj) {
  const logger = (ctx && ctx.logger) || console;
  try {
    logger.log(JSON.stringify(obj));
  } catch {
    /* logging must never throw */
  }
}

function wordCount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

// stripFences - models sometimes wrap output in ``` despite instructions; peel a
// single leading/trailing fence so the draft body is clean.
function stripFences(text) {
  const t = String(text || "").trim();
  const m = t.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```$/);
  return m ? m[1].trim() : t;
}

// run - the single-call generation path. Returns the shaped draft. Throws only
// on a missing ctx seam; a thin context or a malformed json draft are SURFACED
// as warnings (the caller decides whether to re-research), never thrown.
async function run(input, ctx = {}) {
  const context =
    typeof input === "string" ? input : input && (input.context || input.task);
  if (context === undefined || context === null || typeof context !== "string") {
    throw new Error("drafter.run requires a context (string) or { context }");
  }
  if (!ctx.llm || typeof ctx.llm.complete !== "function") {
    throw new Error("drafter.run requires ctx.llm.complete");
  }

  const format = resolveFormat(typeof input === "object" ? input.format : undefined);
  const instruction = (typeof input === "object" && input.instruction) || "(none)";
  const model = resolveModel(DRAFTER_SPEC, process.env);

  const warnings = [];
  // PRE-CHECK - thin context. The warning is the value: it tells the caller the
  // draft will be weak and they should run RESEARCHER first, then re-draft.
  if (context.trim().length < DRAFTER_SPEC.thinContextChars) {
    warnings.push(
      `thin context: only ${context.trim().length} chars (< ${DRAFTER_SPEC.thinContextChars}); ` +
        "consider running researcher_run first and drafting from richer context"
    );
  }

  // GENERATE - one model call.
  const raw = await ctx.llm.complete({
    system: generateSystem(format),
    prompt:
      `TYPE: ${format}\nINSTRUCTION: ${instruction}\n\nCONTEXT:\n${context}`,
    model,
    maxTokens: 2048,
  });
  const draft = stripFences(raw);

  // SHAPE - for json, validate parseability and warn (don't throw) if invalid.
  if (format === "json") {
    try {
      JSON.parse(draft);
    } catch {
      warnings.push("draft does not parse as valid JSON despite json format");
    }
  }
  if (!draft) warnings.push("model returned an empty draft");

  const result = {
    draft,
    format,
    wordCount: wordCount(draft),
    warnings,
  };

  log(ctx, {
    event: "drafter_run",
    format,
    model,
    chars: context.trim().length,
    wordCount: result.wordCount,
    warnings: warnings.length,
    ok: true,
  });

  return { status: "done", result, model, format };
}

module.exports = { run, SPEC: DRAFTER_SPEC };
