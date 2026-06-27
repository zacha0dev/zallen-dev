// researcher.spec.js - the SPEC half of the RESEARCHER role agent (the same
// "Option B" SPEC + runner pattern as reasoner.spec.js). This is the EDITABLE
// IDENTITY of the agent: a deployer who wants a domain researcher copies this
// file, changes the role text + model knobs, and ships - the runner scaffolding
// is reused unchanged (see docs/extending.md).
//
// RESEARCHER is a GENERALIZED single-call worker (a worker, not an orchestrator):
// given a question it runs rag_search ONCE for grounding, synthesizes a concise
// answer, and CITES every claim with a chunk id - it never fabricates a source.
// One model call, no loop. Contrast with the reasoner, which loops + self-checks;
// the researcher is the cheap, fast "answer-from-the-store" worker the reasoner
// (or any caller) can dispatch to.

const RESEARCHER_SPEC = {
  // Stable tool/agent name the manifest advertises + the node registers.
  name: "researcher_run",

  // Human-facing role description (also the manifest tool description).
  role:
    "A single-call research worker: runs rag_search once over the knowledge " +
    "store, synthesizes a concise grounded answer, and cites every claim with " +
    "a chunk id - never fabricating a source. The 'depth' flag trades cost for " +
    "rigor: shallow uses a Haiku-class model, deep uses Sonnet.",

  // The model tier for the SYNTHESIZE step. Two tiers selected by `depth`:
  //   shallow -> defaultModel (Haiku-class, cheap, the default)
  //   deep    -> deepModel    (Sonnet-class)
  // The I-COST-1 knob MODEL_RESEARCHER can only LOWER the tier (it overrides the
  // shallow default; deep still honors the env if set). See resolveModel below.
  modelEnv: "MODEL_RESEARCHER",
  defaultModel: "claude-haiku-4-5", // shallow
  deepModel: "claude-sonnet-4-5", // deep

  // What a valid result looks like. The output-checker's deterministic stage
  // enforces this BEFORE any LLM grade, and the manifest advertises it.
  outputSchema: {
    type: "object",
    required: ["summary", "citations"],
    properties: {
      summary: { type: "string" },
      citations: {
        type: "array",
        items: {
          type: "object",
          required: ["chunkId"],
          properties: {
            chunkId: { type: "string" },
            excerpt: { type: "string" },
          },
        },
      },
      confidence: { type: "string" },
    },
  },

  // The researcher must ground its answer in retrieved evidence: a non-empty
  // citations[] is required. (hasCitations in output-checker reads .citations.)
  requireCitations: true,

  // Cost class for the manifest + budgeting: one embed + one chat call.
  costClass: "cheap",

  // The input the agent accepts (advertised in the manifest inputSchema).
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question to research." },
      depth: {
        type: "string",
        description: "shallow (Haiku, default) | deep (Sonnet).",
        enum: ["shallow", "deep"],
      },
      topK: { type: "number", description: "RAG hits to survey (default 8)." },
    },
    required: ["question"],
  },
};

// resolveModel - pick the model for the requested depth, applying the env knob.
// The MODEL_RESEARCHER knob can only LOWER cost: it overrides the shallow tier
// outright, and for deep it is honored only when set (so a deployer can force a
// cheaper deep model, never a more expensive shallow one).
function resolveModel(depth = "shallow", spec = RESEARCHER_SPEC, env = process.env) {
  const override = env[spec.modelEnv];
  if (depth === "deep") return override || spec.deepModel;
  // shallow: the env override (if any) wins, else the cheap default.
  return override || spec.defaultModel;
}

// resolveDepth - normalize the requested depth to a known tier (default shallow).
function resolveDepth(depth) {
  return depth === "deep" ? "deep" : "shallow";
}

module.exports = { RESEARCHER_SPEC, resolveModel, resolveDepth };
