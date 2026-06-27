// server.js - the ai-stack service HTTP surface, run as the container entrypoint
// on Azure Container Apps. Plain Node http (no framework) to keep deps minimal.
// Endpoints:
//   GET  /health                       - unauthenticated liveness probe
//   GET  /mcp/tools                    - unauthenticated tool manifest (ToolManifest[])
//                                        so the node can discover what to register
//   POST /rag/ingest                   - bearer-protected; body { docs: [...] }
//   POST /rag/search                   - bearer-protected; body { query, ... }
//   POST /agents/reasoner              - bearer-protected; starts a job -> 202 + job_id
//   GET  /agents/reasoner/status?job_id= - bearer-protected; the job row
//   POST /agents/trainer               - bearer-protected; starts a batch job -> 202 + job_id
//   GET  /agents/trainer/status?job_id= - bearer-protected; the trainer job row
//   POST /agents/researcher            - bearer-protected; SYNC single-call -> 200 + result
//   POST /agents/drafter               - bearer-protected; SYNC single-call -> 200 + result
// Bearer check uses the same KV-secret + timing-safe compare as lib/auth.js.
const http = require("http");
const { authorized } = require("./lib/auth");
const { ingest } = require("./rag/ingest");
const { search } = require("./rag/search");
const { TOOL_MANIFEST } = require("./agents/manifest");
const jobs = require("./agents/jobs");
const reasonerRunner = require("./agents/reasoner.runner");
const trainerJobs = require("./agents/trainer-jobs");
const trainerRunner = require("./agents/trainer.runner");
const researcherRunner = require("./agents/researcher.runner");
const drafterRunner = require("./agents/drafter.runner");
const { runWorkflow, makeWorkflows, makeNodeToolCaller } = require("./agents/workflows");
const { WORKFLOWS } = require("./agents/workflows.defs");
const { WORKFLOW_LIST } = require("./agents/manifest");
const { getSecret } = require("./lib/secrets");
const llm = require("./agents/llm");

const PORT = Number(process.env.PORT || 8080);

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("body too large")); // 5 MB cap
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// The ctx the reasoner runs with: real llm + ragSearch + db persistence handle +
// logger. This is the same shape the unit tests mock - server.js just supplies
// the production wiring.
function reasonerCtx() {
  return {
    llm,
    ragSearch: (args) => search(args),
    db: jobs,
    logger: console,
  };
}

// The ctx the trainer runs with: the real llm + logger. ctx.db (the tracker
// handle, keyed to this run id) is supplied by trainerJobs.runDetached - it
// wraps this ctx with makeDb(jobId). The trainer does not survey RAG, so no
// ragSearch is wired.
function trainerCtx() {
  return {
    llm,
    logger: console,
  };
}

// The ctx the RESEARCHER (Phase 4) runs with: real llm + ragSearch + logger. The
// researcher surveys RAG once, so ragSearch is wired (same shape the unit test
// mocks). No db: the role agents are synchronous, they do not persist a job.
function researcherCtx() {
  return {
    llm,
    ragSearch: (args) => search(args),
    logger: console,
  };
}

// The ctx the DRAFTER (Phase 4) runs with: real llm + logger only. The drafter is
// PURE GENERATION - it touches no tools, so no ragSearch is wired.
function drafterCtx() {
  return {
    llm,
    logger: console,
  };
}

// The ctx a WORKFLOW (Phase 5) runs with. It is the union of what its steps need:
//   - llm + ragSearch  -> for the role-agent steps (researcher surveys RAG)
//   - workflows         -> the named registry (so a step or the reasoner can chain
//                          to ANOTHER workflow via "workflow:<name>")
//   - tools             -> the PROJECT-1 (node) tool surface a COMBINED workflow
//                          calls. Opt-in: makeNodeToolCaller(MCP_NODE_URL + the rag
//                          bearer). If MCP_NODE_URL is unset, a tool step throws a
//                          clear error only when it actually runs - project-2-only
//                          workflows are unaffected.
function workflowCtx() {
  const nodeUrl = process.env.MCP_NODE_URL || "";
  const nodeTool = makeNodeToolCaller({
    url: nodeUrl,
    // The bearer is read from KV lazily, per call, so a missing secret fails the
    // tool step (not server boot) and an unused (project-2-only) workflow needs none.
    bearer: undefined,
    fetchImpl: async (url, opts) => {
      const token = await getSecret("rag-bearer-token").catch(() => null);
      if (token) {
        opts.headers = Object.assign({}, opts.headers, { Authorization: `Bearer ${token}` });
      }
      return fetch(url, opts);
    },
  });
  return {
    llm,
    ragSearch: (args) => search(args),
    workflows: makeWorkflows(WORKFLOWS),
    tools: { github_get_file: (args) => nodeTool("github_get_file", args) },
    logger: console,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const fullUrl = req.url || "";
    const url = fullUrl.split("?")[0];
    const query = new URLSearchParams(fullUrl.split("?")[1] || "");

    // --- unauthenticated routes ---
    if (req.method === "GET" && url === "/health") {
      return send(res, 200, { name: "ai-stack", status: "ok" });
    }
    if (req.method === "GET" && url === "/mcp/tools") {
      // The manifest is non-secret discovery metadata (no data, no actions), so
      // it is unauthenticated - the node fetches it before it holds the bearer.
      return send(res, 200, { tools: TOOL_MANIFEST });
    }

    // --- everything below is bearer-protected ---
    const KNOWN = [
      "/rag/ingest",
      "/rag/search",
      "/agents/reasoner",
      "/agents/reasoner/status",
      "/agents/trainer",
      "/agents/trainer/status",
      "/agents/researcher",
      "/agents/drafter",
    ];
    if (!KNOWN.includes(url)) {
      return send(res, 404, { error: "not found" });
    }
    if (!(await authorized(req.headers["authorization"]))) {
      return send(res, 401, { error: "unauthorized" });
    }

    // GET /agents/reasoner/status?job_id=
    if (req.method === "GET" && url === "/agents/reasoner/status") {
      const jobId = query.get("job_id");
      if (!jobId) return send(res, 400, { error: "job_id is required" });
      const job = await jobs.getJob(jobId);
      if (!job) return send(res, 404, { error: "job not found" });
      return send(res, 200, { job });
    }

    // GET /agents/trainer/status?job_id=
    if (req.method === "GET" && url === "/agents/trainer/status") {
      const jobId = query.get("job_id");
      if (!jobId) return send(res, 400, { error: "job_id is required" });
      const job = await trainerJobs.getJob(jobId);
      if (!job) return send(res, 404, { error: "job not found" });
      return send(res, 200, { job });
    }

    if (req.method !== "POST") {
      return send(res, 405, { error: "method not allowed" });
    }

    const body = await readBody(req);

    if (url === "/rag/ingest") {
      const docs = body.docs || body.documents || body;
      return send(res, 200, await ingest(docs));
    }
    if (url === "/rag/search") {
      return send(res, 200, await search(body));
    }
    if (url === "/agents/reasoner") {
      // Async-persist: create the job, kick off the loop detached, return 202.
      const task = { task: body.task, topK: body.topK };
      if (!task.task || typeof task.task !== "string") {
        return send(res, 400, { error: "task (string) is required" });
      }
      const jobId = await jobs.createJob(task);
      jobs.runDetached(jobId, task, reasonerRunner, reasonerCtx());
      return send(res, 202, { job_id: jobId, status: "pending" });
    }
    if (url === "/agents/trainer") {
      // Async-persist: create the batch job, kick off the enrichment loop
      // detached (trainerJobs.runDetached wires the per-run tracker into ctx.db),
      // return 202. The batch can outlast a request (N nodes x enrich+check).
      const input = { nodes: body.nodes };
      if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
        return send(res, 400, { error: "nodes (a non-empty array of { id, context }) is required" });
      }
      const jobId = await trainerJobs.createJob(input);
      trainerJobs.runDetached(jobId, input, trainerRunner, trainerCtx());
      return send(res, 202, { job_id: jobId, status: "pending" });
    }
    if (url === "/agents/researcher") {
      // Single-call worker: run inline + return the result directly (no 202 job).
      if (!body.question || typeof body.question !== "string") {
        return send(res, 400, { error: "question (string) is required" });
      }
      const out = await researcherRunner.run(
        { question: body.question, depth: body.depth, topK: body.topK },
        researcherCtx()
      );
      return send(res, 200, out);
    }
    if (url === "/agents/drafter") {
      // Single-call worker: run inline + return the result directly (no 202 job).
      if (body.context === undefined || typeof body.context !== "string") {
        return send(res, 400, { error: "context (string) is required" });
      }
      const out = await drafterRunner.run(
        { context: body.context, format: body.format, instruction: body.instruction },
        drafterCtx()
      );
      return send(res, 200, out);
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(JSON.stringify({ event: "ai_stack_service_start", port: PORT }));
  });
}

module.exports = { server };
