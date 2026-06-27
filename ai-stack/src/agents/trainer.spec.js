// trainer.spec.js - the SPEC half of the TRAINER agent (Phase 3), following the
// same "Option B" pattern as reasoner.spec.js: a declarative SPEC constant + a
// separate runner (trainer.runner.js). Where the reasoner answers ONE task, the
// trainer ENRICHES a BATCH of training-context units ("nodes") so a deployer can
// build a high-quality, graded training corpus.
//
// The x10 model (the Multi-Node / Multi-Network Enrichment Framework, generalized
// here): treat every training-context unit as a NODE; enrich each node across the
// SAME 10 dimensions; grade each dimension; an all-pass node is "done". The
// framework is REUSED, not reinvented - the 10 dimensions below are the contract
// every node is enriched and graded against.
//
// A SPEC is data: WHO the agent is, the 10 ENRICHMENT_DIMENSIONS, the shape of a
// node, HOW HARD it may try per node (maxAttemptsPerNode), WHAT a valid enriched
// node looks like (outputSchema), and WHAT IT COSTS (costClass). The runner reads
// this spec; the manifest advertises it.

// The 10 enrichment dimensions every node is enriched + graded across. This is
// the x10 framework's contract - keep it stable so grades are comparable across
// nodes and across runs. Each dimension is a named axis the enricher must satisfy
// and the checker grades pass/fail on.
const ENRICHMENT_DIMENSIONS = [
  "factual_accuracy",     // claims are correct and verifiable
  "source_cited",         // assertions are grounded in / cite a source
  "tone_consistency",     // voice matches the deployer's house style
  "schema_compliance",    // the enriched node matches the required shape
  "edge_case_coverage",   // boundary / failure cases are addressed
  "conciseness",          // no filler; says it once, clearly
  "actionability",        // a reader can act on it without more context
  "ambiguity_removed",    // no undefined terms or dangling references
  "cross_node_coherence", // consistent with its sibling nodes in the batch
  "deployer_fit",         // tailored to THIS deployer's domain + audience
];

// The status lifecycle of a single EnrichmentNode as the runner works it:
//   pending  - queued, not yet enriched
//   enriched - the enricher produced enrichments across the 10 dimensions
//   checked  - the output-checker has graded it (may still be failing)
//   done     - all dimensions pass (or the soft grade passed) - terminal success
//   failed   - exhausted maxAttemptsPerNode without an all-pass - terminal failure
const NODE_STATUSES = ["pending", "enriched", "checked", "done", "failed"];

// makeNode - the canonical EnrichmentNode shape. A deployer hands the trainer an
// array of { id, context } (the training-context units); the runner fills in the
// rest. enrichments{} is keyed by dimension; grades{} is keyed by dimension.
function makeNode({ id, context } = {}) {
  return {
    id: id != null ? String(id) : null,
    context: context != null ? context : "",
    enrichments: {}, // { [dimension]: "<enriched text for this dimension>" }
    grades: {},      // { [dimension]: { pass: boolean, reason: string } }
    status: "pending",
    attempts: 0,
  };
}

const TRAINER_SPEC = {
  // Stable tool/agent name - what the manifest advertises and the node registers.
  // Snake_case to match the rag_search / reasoner_run convention.
  name: "trainer_run",

  // Human-facing role description (also the manifest tool description).
  role:
    "A batch enrichment + grading agent (the x10 framework): takes a set of " +
    "training-context NODES and enriches each across 10 dimensions " +
    "(factual_accuracy, source_cited, tone_consistency, schema_compliance, " +
    "edge_case_coverage, conciseness, actionability, ambiguity_removed, " +
    "cross_node_coherence, deployer_fit), self-checks each node through the " +
    "shared output-checker, re-enriches once with the structured diff on a " +
    "miss, and persists per-node grades to the enrichment tracker.",

  // The 10 dimensions (the x10 contract). Exposed on the spec so the runner,
  // the manifest, and tests all read ONE source of truth.
  ENRICHMENT_DIMENSIONS,

  // Node lifecycle statuses (exposed for the runner + tracker + tests).
  NODE_STATUSES,

  // Per-node attempt ceiling: the single most important cost + safety knob for
  // the trainer. Each node gets at most this many enrich->check cycles
  // (1 enrich + 1 re-enrich on a miss). Hard default; an env override may LOWER
  // it but never raise it (see resolveMaxAttempts).
  maxAttemptsPerNode: 2,

  // Batch ceiling: the most nodes one trainer_run will process. Caps the worst-
  // case cost of a single run (<= MAX_BATCH_NODES * maxAttemptsPerNode Sonnet
  // calls). Overridable down via MAX_BATCH_NODES.
  maxBatchNodes: 50,

  // The model tier for the ENRICH step (sonnet-class). The I-COST-1 knob:
  // MODEL_TRAINER swaps the tier without a code change.
  enricherModelEnv: "MODEL_TRAINER",
  defaultEnricherModel: "claude-sonnet-4-5",

  // The CHECK step reuses the output-checker, which reads MODEL_CHECKER
  // (haiku-class) itself. Named here for documentation + the manifest cost note.
  checkerModelEnv: "MODEL_CHECKER",
  defaultCheckerModel: "claude-haiku-4-5",

  // What a valid ENRICHED node looks like, enforced by the output-checker's
  // deterministic stage BEFORE any LLM grade. enrichments must be an object and
  // grades an object; id + status round it out.
  outputSchema: {
    type: "object",
    required: ["id", "enrichments", "status"],
    properties: {
      id: { type: "string" },
      context: { type: "string" },
      enrichments: { type: "object" },
      grades: { type: "object" },
      status: { type: "string" },
      attempts: { type: "number" },
    },
  },

  // Cost class for the manifest + budgeting. The trainer is "expensive": it runs
  // over a BATCH (per-node <=2 Sonnet enrich + <=2 Haiku checks), so the run
  // cost scales with batch size - hence the MAX_BATCH_NODES cap.
  costClass: "expensive",

  // The input the agent accepts (advertised in the manifest inputSchema). A
  // deployer posts { nodes: [{ id, context }, ...] }.
  inputSchema: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        description: "Training-context units to enrich. Each: { id, context }.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            context: { type: "string" },
          },
          required: ["context"],
        },
      },
    },
    required: ["nodes"],
  },
};

// resolveEnricherModel - the enrich-step model after applying the env knob.
function resolveEnricherModel(spec = TRAINER_SPEC, env = process.env) {
  return env[spec.enricherModelEnv] || spec.defaultEnricherModel;
}

// resolveMaxAttempts - the per-node attempt ceiling after the env override,
// hard-capped at the spec default so a misconfigured env can never RAISE it.
function resolveMaxAttempts(spec = TRAINER_SPEC, env = process.env) {
  const raw = Number(env.TRAINER_MAX_ATTEMPTS);
  if (!Number.isFinite(raw) || raw < 1) return spec.maxAttemptsPerNode;
  return Math.min(raw, spec.maxAttemptsPerNode);
}

// resolveMaxBatchNodes - the batch ceiling after the env override, hard-capped at
// the spec default (env may only lower it - the cost cap can never be raised).
function resolveMaxBatchNodes(spec = TRAINER_SPEC, env = process.env) {
  const raw = Number(env.MAX_BATCH_NODES);
  if (!Number.isFinite(raw) || raw < 1) return spec.maxBatchNodes;
  return Math.min(raw, spec.maxBatchNodes);
}

module.exports = {
  TRAINER_SPEC,
  ENRICHMENT_DIMENSIONS,
  NODE_STATUSES,
  makeNode,
  resolveEnricherModel,
  resolveMaxAttempts,
  resolveMaxBatchNodes,
};
