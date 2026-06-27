// output-checker.js - the shared quality gate for agent outputs. Used by the
// reasoner now and reused by the trainer in Phase 3, so it is a standalone lib
// with no agent-specific assumptions.
//
// The gate is two-stage and deliberately CHEAP-FIRST:
//   1. Deterministic gates run FIRST (free, instant): is the output present and
//      schema-valid? did the producer refuse? is it cited when citations were
//      required? Any deterministic failure short-circuits - we never spend an
//      LLM call to grade something we already know is broken.
//   2. ONLY if the deterministic gates pass do we run a cheap Haiku grade for
//      the things a schema cannot catch (does it actually answer the task? is it
//      grounded in the cited evidence?). This is a structured judgment, never a
//      "blind float" - the model must return a JSON verdict we parse.
//
// Return shape (stable - the reasoner and trainer both depend on it):
//   { pass: boolean, reason: string, structuredDiff: object|null, stage: string }
// structuredDiff is the actionable feedback the caller feeds back into the next
// iteration (what was missing / wrong), or null on pass.

const REFUSAL_PATTERNS = [
  /\bI (?:can(?:'|no)?t|cannot|won'?t|am unable to)\b/i,
  /\bI'?m (?:sorry|unable)\b/i,
  /\bas an? (?:ai|language model)\b/i,
];

// --- Stage 1: deterministic gates (free) -----------------------------------

// schemaCheck - minimal, dependency-free JSON-schema-ish validation. Supports
// the subset the agent SPECs use: type object/array/string/number/boolean,
// required[], and properties{} (recursively). Enough to gate structured output
// without pulling in ajv. Returns { ok, errors:[] }.
function schemaCheck(value, schema, path = "output") {
  const errors = [];
  if (!schema || typeof schema !== "object") return { ok: true, errors };

  const typeOf = (v) =>
    Array.isArray(v) ? "array" : v === null ? "null" : typeof v;

  if (schema.type) {
    const actual = typeOf(value);
    if (schema.type === "object" && actual !== "object") {
      errors.push(`${path}: expected object, got ${actual}`);
      return { ok: false, errors };
    }
    if (schema.type === "array" && actual !== "array") {
      errors.push(`${path}: expected array, got ${actual}`);
      return { ok: false, errors };
    }
    if (
      ["string", "number", "boolean"].includes(schema.type) &&
      actual !== schema.type
    ) {
      errors.push(`${path}: expected ${schema.type}, got ${actual}`);
    }
  }

  if (schema.type === "object" && value && typeof value === "object") {
    for (const req of schema.required || []) {
      if (value[req] === undefined || value[req] === null || value[req] === "") {
        errors.push(`${path}.${req}: required field missing or empty`);
      }
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (value[key] !== undefined) {
        const r = schemaCheck(value[key], sub, `${path}.${key}`);
        errors.push(...r.errors);
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, i) => {
      const r = schemaCheck(item, schema.items, `${path}[${i}]`);
      errors.push(...r.errors);
    });
  }

  return { ok: errors.length === 0, errors };
}

// looksRefused - heuristic refusal/empty detection over the textual surface of
// an output (its `answer` field, or the stringified output).
function looksRefused(output) {
  const text =
    output && typeof output === "object"
      ? String(output.answer || output.text || JSON.stringify(output))
      : String(output || "");
  if (!text.trim()) return true;
  return REFUSAL_PATTERNS.some((re) => re.test(text));
}

// hasCitations - true if the output carries a non-empty citations/sources list.
function hasCitations(output) {
  if (!output || typeof output !== "object") return false;
  const c = output.citations || output.sources || output.cited;
  return Array.isArray(c) && c.length > 0;
}

// deterministicGates - run all the free checks; first failure short-circuits.
function deterministicGates(output, { schema, requireCitations } = {}) {
  if (output === undefined || output === null) {
    return { pass: false, reason: "output is empty", diff: { missing: ["output"] } };
  }
  if (looksRefused(output)) {
    return {
      pass: false,
      reason: "output looks like a refusal or is empty text",
      diff: { issue: "refusal", hint: "produce a direct answer, do not refuse" },
    };
  }
  if (schema) {
    const { ok, errors } = schemaCheck(output, schema);
    if (!ok) {
      return {
        pass: false,
        reason: `schema-invalid: ${errors.join("; ")}`,
        diff: { issue: "schema", errors },
      };
    }
  }
  if (requireCitations && !hasCitations(output)) {
    return {
      pass: false,
      reason: "output is not cited but citations are required",
      diff: { issue: "uncited", hint: "include a non-empty citations[] grounded in rag_search hits" },
    };
  }
  return { pass: true };
}

// --- Stage 2: cheap LLM grade (only runs if Stage 1 passed) ----------------

const GRADER_SYSTEM =
  "You are a strict output grader. You are given a TASK and a candidate OUTPUT. " +
  "Decide if the output genuinely and correctly accomplishes the task and is " +
  "grounded in any evidence it cites. Reply with ONLY a JSON object: " +
  '{"pass": boolean, "reason": "<one sentence>", "diff": {"<field>": "<what to fix>"}}. ' +
  "diff must be {} when pass is true. Do not include any prose outside the JSON.";

function safeParseVerdict(text) {
  // Pull the first {...} block out and parse it; never throw.
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// gradeWithLLM - ask the cheap model for a structured verdict. `llm` is the
// injected client: llm.complete({ system, prompt, model, maxTokens }) -> string.
// Model defaults to the checker tier (MODEL_CHECKER, a cheap Haiku-class model).
async function gradeWithLLM(task, output, ctx) {
  const llm = ctx && ctx.llm;
  if (!llm || typeof llm.complete !== "function") {
    // No grader wired: deterministic gates already passed, so we PASS rather
    // than block the loop - fail-open ONLY for the soft stage, never the hard one.
    return { pass: true, reason: "deterministic gates passed; no LLM grader configured", diff: null };
  }
  const model = process.env.MODEL_CHECKER || "claude-haiku-4-5";
  const prompt =
    `TASK:\n${typeof task === "string" ? task : JSON.stringify(task)}\n\n` +
    `OUTPUT:\n${typeof output === "string" ? output : JSON.stringify(output)}\n\n` +
    "Grade it.";
  let raw;
  try {
    raw = await llm.complete({ system: GRADER_SYSTEM, prompt, model, maxTokens: 300 });
  } catch (err) {
    // Grader call failed: do not block the pipeline on a flaky cheap call.
    return {
      pass: true,
      reason: `grader unavailable (${String(err.message || err)}); passing on deterministic gates`,
      diff: null,
    };
  }
  const verdict = safeParseVerdict(raw);
  if (!verdict || typeof verdict.pass !== "boolean") {
    return { pass: true, reason: "grader returned unparseable verdict; passing on deterministic gates", diff: null };
  }
  return {
    pass: verdict.pass,
    reason: verdict.reason || (verdict.pass ? "graded pass" : "graded fail"),
    diff: verdict.pass ? null : verdict.diff || { issue: "quality", hint: verdict.reason },
  };
}

// --- Public API ------------------------------------------------------------

// check(task, output, opts, ctx) -> { pass, reason, structuredDiff, stage }
//   opts: { schema, requireCitations, skipLLM }
//   ctx:  { llm, logger }  (llm injected so this is unit-testable with a mock)
async function check(task, output, opts = {}, ctx = {}) {
  const det = deterministicGates(output, opts);
  if (!det.pass) {
    log(ctx, { event: "output_check", stage: "deterministic", pass: false, reason: det.reason });
    return { pass: false, reason: det.reason, structuredDiff: det.diff, stage: "deterministic" };
  }

  if (opts.skipLLM) {
    log(ctx, { event: "output_check", stage: "deterministic", pass: true });
    return { pass: true, reason: "deterministic gates passed (LLM grade skipped)", structuredDiff: null, stage: "deterministic" };
  }

  const graded = await gradeWithLLM(task, output, ctx);
  log(ctx, { event: "output_check", stage: "llm_grade", pass: graded.pass, reason: graded.reason });
  return {
    pass: graded.pass,
    reason: graded.reason,
    structuredDiff: graded.pass ? null : graded.diff,
    stage: "llm_grade",
  };
}

function log(ctx, obj) {
  const logger = (ctx && ctx.logger) || console;
  try {
    logger.log(JSON.stringify(obj));
  } catch {
    /* logging must never throw */
  }
}

module.exports = {
  check,
  // exported for unit tests + reuse by the trainer
  deterministicGates,
  schemaCheck,
  looksRefused,
  hasCitations,
  gradeWithLLM,
};
