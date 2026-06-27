// manifest.js - the single source of truth for what tools ai-stack offers the
// control plane. GET /mcp/tools serves this array; the mcp-node fetches it on
// cold start and registers each entry dynamically (proxying calls back over
// HTTP). A ToolManifest entry is: { name, description, inputSchema, costClass }.
//
// Adding a tool to ai-stack's surface = adding an entry here (and the matching
// HTTP route in server.js). The node auto-discovers it - no node redeploy. This
// is the manifest-registration seam; see docs/extending.md.
const { REASONER_SPEC } = require("./reasoner.spec");
const { TRAINER_SPEC } = require("./trainer.spec");
const { RESEARCHER_SPEC } = require("./researcher.spec");
const { DRAFTER_SPEC } = require("./drafter.spec");
const { listWorkflows } = require("./workflows");
const { WORKFLOWS } = require("./workflows.defs");

const TOOL_MANIFEST = [
  {
    name: "rag_search",
    description:
      "Search the ai-stack RAG store (hybrid vector + keyword) and return the top matching chunks.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The natural-language query to search for." },
        topK: { type: "number", description: "How many hits to return (default 10)." },
        vectorWeight: { type: "number", description: "Weight for vector similarity (default 0.6)." },
        bm25Weight: { type: "number", description: "Weight for keyword rank (default 0.4)." },
      },
      required: ["query"],
    },
    costClass: "cheap",
    // How the node should proxy this tool back to ai-stack.
    route: { method: "POST", path: "/rag/search" },
  },
  {
    name: REASONER_SPEC.name, // reasoner_run
    description: REASONER_SPEC.role,
    inputSchema: REASONER_SPEC.inputSchema,
    costClass: REASONER_SPEC.costClass,
    route: { method: "POST", path: "/agents/reasoner", async: true },
  },
  {
    name: "reasoner_status",
    description: "Fetch the status + result of a reasoner job started by reasoner_run.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", description: "The job id returned by reasoner_run." } },
      required: ["job_id"],
    },
    costClass: "free",
    route: { method: "GET", path: "/agents/reasoner/status" },
  },
  {
    name: TRAINER_SPEC.name, // trainer_run
    description: TRAINER_SPEC.role,
    inputSchema: TRAINER_SPEC.inputSchema,
    costClass: TRAINER_SPEC.costClass,
    route: { method: "POST", path: "/agents/trainer", async: true },
  },
  {
    name: "trainer_status",
    description: "Fetch the status + result (per-node grades) of a trainer batch job started by trainer_run.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", description: "The job id returned by trainer_run." } },
      required: ["job_id"],
    },
    costClass: "free",
    route: { method: "GET", path: "/agents/trainer/status" },
  },
  {
    // RESEARCHER (Phase 4) - a fast single-call worker, so it is a SYNCHRONOUS
    // route (no route.async, no status tool): the handler runs the loop and
    // returns the result directly. The node's dynamic.js proxy returns that body
    // as-is. Contrast the reasoner/trainer above, which are async-job (202).
    name: RESEARCHER_SPEC.name, // researcher_run
    description: RESEARCHER_SPEC.role,
    inputSchema: RESEARCHER_SPEC.inputSchema,
    costClass: RESEARCHER_SPEC.costClass,
    route: { method: "POST", path: "/agents/researcher" },
  },
  {
    // DRAFTER (Phase 4) - also a fast single-call SYNC worker (no async/status).
    name: DRAFTER_SPEC.name, // drafter_run
    description: DRAFTER_SPEC.role,
    inputSchema: DRAFTER_SPEC.inputSchema,
    costClass: DRAFTER_SPEC.costClass,
    route: { method: "POST", path: "/agents/drafter" },
  },
  {
    // WORKFLOWS (Phase 5) - run a NAMED, ORDERED chain of agent/tool steps. A
    // workflow composes the single-call workers (researcher/drafter), the shared
    // gate, and (for a combined pattern) a project-1 node tool. It is a SYNC route
    // (the steps are themselves bounded single calls); a long workflow could be
    // promoted to the async-job envelope later. The node proxies the body as-is.
    name: "workflow_run",
    description:
      "Run a named workflow from the ai-stack set: an ordered chain of agent/tool " +
      "steps whose outputs thread forward. Returns the final result + a per-step trace. " +
      `Available: ${Object.keys(WORKFLOWS).join(", ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The workflow to run.",
          enum: Object.keys(WORKFLOWS),
        },
        input: {
          type: "object",
          description: "The workflow's top-level input (shape depends on the workflow; see workflow_list).",
        },
      },
      required: ["name"],
    },
    costClass: "moderate", // sum of the chained steps' costs; each step is bounded.
    route: { method: "POST", path: "/agents/workflow" },
  },
  {
    name: "workflow_list",
    description:
      "List the available ai-stack workflows: each name, description, and its ordered step shape.",
    inputSchema: { type: "object", properties: {} },
    costClass: "free",
    route: { method: "GET", path: "/agents/workflow/list" },
  },
];

// Surface the workflow set in the module for callers that want the metadata
// without an HTTP round-trip (server.js's list route returns this).
const WORKFLOW_LIST = listWorkflows(WORKFLOWS);

module.exports = { TOOL_MANIFEST, WORKFLOW_LIST };
