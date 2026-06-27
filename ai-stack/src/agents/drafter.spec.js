// drafter.spec.js - the SPEC half of the DRAFTER role agent (same SPEC + runner
// pattern). The EDITABLE IDENTITY: a deployer wanting a domain drafter copies
// this file, edits the role + formats, and ships - the runner is reused.
//
// DRAFTER is a GENERALIZED single-call worker: given some context and a target
// format (markdown | json | plaintext) it produces a structured draft matching
// the output schema. PURE GENERATION - it runs NO tools (no rag_search), so it
// is the cheapest worker on the fleet. Haiku-class by default; FORMAT_DEPTH=deep
// promotes it to Sonnet. Its `warnings[]` surface a "thin context" signal so a
// caller can re-run the RESEARCHER first and feed richer context back in.

const DRAFTER_SPEC = {
  // Stable tool/agent name the manifest advertises + the node registers.
  name: "drafter_run",

  // Human-facing role description (also the manifest tool description).
  role:
    "A single-call drafting worker: turns supplied context into a structured " +
    "draft in a target format (markdown | json | plaintext). Pure generation, " +
    "no tools. Emits a 'thin context' warning when the input is too sparse to " +
    "draft well, so the caller can research first. Haiku by default; " +
    "FORMAT_DEPTH=deep promotes to Sonnet.",

  // The model tier for the GENERATE step. MODEL_DRAFTER overrides the tier
  // outright (the I-COST-1 knob); FORMAT_DEPTH=deep promotes the default to the
  // deep tier. Both knobs are env-only - no code change to swap models.
  modelEnv: "MODEL_DRAFTER",
  defaultModel: "claude-haiku-4-5", // default
  deepModel: "claude-sonnet-4-5", // FORMAT_DEPTH=deep

  // The formats the drafter knows how to emit.
  formats: ["markdown", "json", "plaintext"],
  defaultFormat: "markdown",

  // The minimum context length (chars) below which we flag "thin context".
  thinContextChars: 80,

  // What a valid result looks like. Deterministic-gated before any LLM grade.
  outputSchema: {
    type: "object",
    required: ["draft", "format"],
    properties: {
      draft: { type: "string" },
      format: { type: "string" },
      wordCount: { type: "number" },
      warnings: { type: "array", items: { type: "string" } },
    },
  },

  // The drafter is pure generation - it does not cite, so no citation gate.
  requireCitations: false,

  // Cost class: one chat call, no embed, no tools - the cheapest worker.
  costClass: "cheap",

  // The input the agent accepts (advertised in the manifest inputSchema).
  inputSchema: {
    type: "object",
    properties: {
      context: { type: "string", description: "The source material to draft from." },
      format: {
        type: "string",
        description: "markdown (default) | json | plaintext.",
        enum: ["markdown", "json", "plaintext"],
      },
      instruction: {
        type: "string",
        description: "Optional steer, e.g. 'a release note' or 'a config object'.",
      },
    },
    required: ["context"],
  },
};

// resolveModel - pick the model, applying FORMAT_DEPTH + the MODEL_DRAFTER knob.
// MODEL_DRAFTER (if set) wins outright; otherwise FORMAT_DEPTH=deep promotes to
// the deep tier, else the cheap default.
function resolveModel(spec = DRAFTER_SPEC, env = process.env) {
  const override = env[spec.modelEnv];
  if (override) return override;
  const deep = String(env.FORMAT_DEPTH || "").toLowerCase().trim() === "deep";
  return deep ? spec.deepModel : spec.defaultModel;
}

// resolveFormat - normalize the requested format to a known one (default markdown).
function resolveFormat(format, spec = DRAFTER_SPEC) {
  const f = String(format || "").toLowerCase().trim();
  return spec.formats.includes(f) ? f : spec.defaultFormat;
}

module.exports = { DRAFTER_SPEC, resolveModel, resolveFormat };
