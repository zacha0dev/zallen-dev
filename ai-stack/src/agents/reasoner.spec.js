// reasoner.spec.js - the SPEC half of the reasoner agent (the "Option B"
// pattern: a declarative SPEC constant + a separate runner). A SPEC is data: it
// says WHO the agent is, HOW HARD it may try (maxIterations), WHAT a valid
// result looks like (outputSchema), and WHAT IT COSTS (costClass). The runner
// (reasoner.runner.js) reads this spec; the manifest (server.js GET /mcp/tools)
// advertises it. Keeping the spec separate from the runner is the extensibility
// seam: a deployer adds an agent by writing a new <name>.spec.js + runner and
// listing it - see docs/extending.md.

const REASONER_SPEC = {
  // Stable tool/agent name - this is what the manifest advertises and what the
  // node registers. Snake_case to match the rag_search convention.
  name: "reasoner_run",

  // Human-facing role description (also used as the manifest tool description).
  role:
    "A bounded reasoning agent: surveys the RAG store for evidence, dispatches " +
    "to a tool or linked workflow, produces a cited answer, and self-checks it " +
    "through the output-checker before returning. Retries with structured " +
    "feedback up to maxIterations, then dead-letters.",

  // The loop ceiling. The single most important cost + safety knob: the loop can
  // never run more than this many produce->gate cycles. Overridable per deploy
  // via REASONER_MAX_ITERATIONS, but capped here as the hard default.
  maxIterations: 3,

  // The model tier the runner uses for the PRODUCE step. The cost knob:
  // MODEL_REASONER swaps the tier without a code change (e.g. drop to a cheaper
  // model to cut cost). The checker uses its own MODEL_CHECKER (Haiku-class).
  modelEnv: "MODEL_REASONER",
  defaultModel: "claude-sonnet-4-5",

  // What a valid result looks like. The output-checker's deterministic stage
  // enforces this BEFORE any LLM grade, and the manifest advertises it so
  // callers know the shape they get back.
  outputSchema: {
    type: "object",
    required: ["answer", "citations"],
    properties: {
      answer: { type: "string" },
      citations: { type: "array", items: { type: "string" } },
    },
  },

  // The checker requires a non-empty citations[] - the reasoner must ground its
  // answer in retrieved evidence.
  requireCitations: true,

  // Cost class for the manifest + budgeting. Free text but conventionally one
  // of: free | cheap | moderate | expensive. The reasoner is "moderate": up to
  // maxIterations Sonnet produce calls + a Haiku check each.
  costClass: "moderate",

  // The input the agent accepts (advertised in the manifest inputSchema).
  inputSchema: {
    type: "object",
    properties: {
      task: { type: "string", description: "The natural-language task to reason about." },
      topK: { type: "number", description: "RAG hits to survey (default 8)." },
    },
    required: ["task"],
  },
};

// resolveModel - the spec's model after applying the env override knob.
function resolveModel(spec = REASONER_SPEC, env = process.env) {
  return env[spec.modelEnv] || spec.defaultModel;
}

// resolveMaxIterations - the loop ceiling after applying the env override, hard-
// capped at the spec default so a misconfigured env can never raise the ceiling.
function resolveMaxIterations(spec = REASONER_SPEC, env = process.env) {
  const raw = Number(env.REASONER_MAX_ITERATIONS);
  if (!Number.isFinite(raw) || raw < 1) return spec.maxIterations;
  return Math.min(raw, spec.maxIterations);
}

module.exports = { REASONER_SPEC, resolveModel, resolveMaxIterations };
