// workflows.js - the WORKFLOWS engine (Phase 5). A workflow is a NAMED, ORDERED
// chain of steps; each step calls a role agent, a node tool, or an inline fn, and
// its output is threaded forward so a later step can read an earlier one. This is
// what `ctx.workflows` resolves to (the dispatch seam reserved the "workflow:"
// prefix in Phase 4; this fills it in).
//
// It is deliberately ~LINEAR + SIMPLE - no graph engine, no branching, no
// parallel fan-out. Steps run in order; each reads prior outputs; the runner
// returns the final step's output PLUS a per-step trace. That covers the founder
// intent ("a small workflows set... runnable either as a single, or in various
// patterns") without the cost+surface of a DAG executor. If a future phase wants
// branches, it forks this - the SET stays the copy-me artifact.
//
// A workflow definition:
//   {
//     name: "research_and_draft",
//     description: "...",
//     steps: [
//       { id, run|agent|tool, inputFrom?, with?, optional? },
//       ...
//     ]
//   }
// A STEP is exactly one of:
//   - run:   async (input, { ctx, outputs, step }) => output    (inline fn)
//   - agent: "researcher" | "drafter" | <name in ctx.roles>     (a role agent)
//   - tool:  "github_get_file" | <name in ctx.tools>            (a node/project-1 tool)
// inputFrom shapes what the step receives:
//   - undefined        -> the workflow's top-level input (the first step's default)
//   - "<stepId>"       -> the named prior step's output
//   - (outputs, input) => any  -> a mapper computing the step input from all
//                                 prior outputs + the workflow input (the
//                                 general output-threading seam)
// `with` is a static object merged over the resolved input (handy for constants
// like a format or a repo path without writing a mapper).
//
// ctx IS the injection seam (same shape the agents use), so a workflow is
// unit-testable with mocked llm + stubbed agents/tools:
//   ctx = { llm, ragSearch, db, logger, roles?, tools?, callAgent?, callTool? }
//   - roles:    { <name>: run|{run,spec} }  merged over the engine's defaults
//                (researcher, drafter) - the role registry the agent steps use.
//   - tools:    { <name>: async (args, ctx) => result }  the PROJECT-1 (node)
//                tool surface a `tool` step calls. In production server.js wires
//                a small adapter that proxies to the node (see makeNodeToolCaller
//                + docs/architecture.md "the combined 1+2 pattern"). In a test it
//                is just a stub. A missing tools registry => a tool step throws a
//                clear error.
//   - callAgent/callTool: optional overrides if a deployer wants to intercept
//                every agent/tool invocation (logging, budget, etc).

const researcher = require("./researcher.runner");
const drafter = require("./drafter.runner");

// DEFAULT_ROLES - the built-in role agents a workflow `agent` step can call,
// mirroring dispatch.js's registry. A deployer adds a role by registering it on
// ctx.roles (same { run, spec } shape).
const DEFAULT_ROLES = {
  researcher: { run: researcher.run, spec: researcher.SPEC },
  drafter: { run: drafter.run, spec: drafter.SPEC },
};

function log(ctx, obj) {
  const logger = (ctx && ctx.logger) || console;
  try {
    logger.log(JSON.stringify(obj));
  } catch {
    /* logging must never throw */
  }
}

// normalizeRole - accept a bare run fn or a { run, spec } pair (same as dispatch.js).
function normalizeRole(entry) {
  if (typeof entry === "function") return { run: entry, spec: null };
  if (entry && typeof entry.run === "function") return { run: entry.run, spec: entry.spec || null };
  return null;
}

// unwrap - role runners return { status, result, ... }; inline fns + tools may
// return a bare value. Thread the meaningful payload forward: prefer `.result`
// when present, else the value itself. (Same convention dispatch.js uses.)
function unwrap(out) {
  return out && typeof out === "object" && out.result !== undefined ? out.result : out;
}

// resolveStepInput - compute what a step receives, from its inputFrom + with.
//   inputFrom undefined -> the workflow input (lets a first step default to it)
//   inputFrom string    -> the named prior step's (unwrapped) output
//   inputFrom function  -> mapper(outputs, workflowInput) for the general case
// `with` (a static object) is shallow-merged OVER the resolved input when both
// are objects; otherwise `with` wins if the resolved input is not an object.
function resolveStepInput(step, { outputs, workflowInput }) {
  let base;
  if (step.inputFrom === undefined || step.inputFrom === null) {
    base = workflowInput;
  } else if (typeof step.inputFrom === "function") {
    base = step.inputFrom(outputs, workflowInput);
  } else if (typeof step.inputFrom === "string") {
    if (!Object.prototype.hasOwnProperty.call(outputs, step.inputFrom)) {
      throw new Error(
        `workflow step '${step.id}': inputFrom '${step.inputFrom}' has no prior output (known: ${Object.keys(outputs).join(", ") || "none"})`
      );
    }
    base = outputs[step.inputFrom];
  } else {
    base = workflowInput;
  }
  if (step.with && typeof step.with === "object") {
    if (base && typeof base === "object" && !Array.isArray(base)) {
      return Object.assign({}, base, step.with);
    }
    return Object.assign({}, step.with);
  }
  return base;
}

// callRole - run a role agent step through the (possibly overridden) registry.
async function callRole(name, input, ctx) {
  if (typeof ctx.callAgent === "function") return ctx.callAgent(name, input, ctx);
  const roles = Object.assign({}, DEFAULT_ROLES, (ctx && ctx.roles) || {});
  const role = normalizeRole(roles[name]);
  if (!role) {
    throw new Error(`workflow agent step: no role '${name}' (known: ${Object.keys(roles).join(", ")})`);
  }
  return role.run(input, ctx);
}

// callTool - run a PROJECT-1 (node) tool step. ctx.tools is the surface; in
// production it is an adapter that proxies to the node over HTTP (see
// makeNodeToolCaller), in a test it is a stub map. This is the seam through which
// a COMBINED project-1+2 workflow reaches the node's github_get_file etc.
async function callTool(name, args, ctx) {
  if (typeof ctx.callTool === "function") return ctx.callTool(name, args, ctx);
  const tools = (ctx && ctx.tools) || {};
  const tool = tools[name];
  if (typeof tool !== "function") {
    throw new Error(
      `workflow tool step: no tool '${name}' wired (ctx.tools). For a combined ` +
        "project-1+2 workflow, wire ctx.tools to a node-tool caller - see " +
        "makeNodeToolCaller / docs/architecture.md."
    );
  }
  return tool(args, ctx);
}

// runStep - execute exactly one step and return its (unwrapped) output. Exactly
// one of run | agent | tool must be set.
async function runStep(step, { ctx, outputs, workflowInput }) {
  const input = resolveStepInput(step, { outputs, workflowInput });
  const kinds = ["run", "agent", "tool"].filter((k) => step[k] !== undefined);
  if (kinds.length !== 1) {
    throw new Error(
      `workflow step '${step.id}': must declare exactly one of run|agent|tool (found: ${kinds.join(", ") || "none"})`
    );
  }
  if (typeof step.run === "function") {
    return unwrap(await step.run(input, { ctx, outputs, step }));
  }
  if (step.agent) {
    return unwrap(await callRole(step.agent, input, ctx));
  }
  // tool
  return unwrap(await callTool(step.tool, input, ctx));
}

// runWorkflow - execute a workflow definition top-to-bottom, threading outputs.
//   def:   a workflow definition { name, description, steps:[...] }
//   input: the workflow's top-level input (the default for the first step)
//   ctx:   the injection seam (llm, ragSearch, roles, tools, logger, ...)
// Returns { status:"done", workflow, result, outputs, trace } where:
//   - result  = the LAST step's output (the workflow's product)
//   - outputs = { <stepId>: output } for every step (the threaded surface)
//   - trace   = [{ id, kind, name, ok, ms }] one entry per step (observability)
// A failing step surfaces cleanly: the error carries .workflow, .step, .trace so
// the caller knows exactly where the chain broke (no silent partial result).
async function runWorkflow(def, input, ctx = {}) {
  if (!def || typeof def !== "object" || !Array.isArray(def.steps) || def.steps.length === 0) {
    throw new Error("runWorkflow requires a definition with a non-empty steps[] array");
  }
  const seen = new Set();
  for (const s of def.steps) {
    if (!s || typeof s.id !== "string" || !s.id) {
      throw new Error(`workflow '${def.name}': every step needs a string id`);
    }
    if (seen.has(s.id)) throw new Error(`workflow '${def.name}': duplicate step id '${s.id}'`);
    seen.add(s.id);
  }

  log(ctx, { event: "workflow_start", workflow: def.name, steps: def.steps.length });

  const outputs = {};
  const trace = [];
  let last;

  for (const step of def.steps) {
    const kind = step.run ? "run" : step.agent ? "agent" : "tool";
    const name = step.agent || step.tool || step.id;
    const startedAt = Date.now();
    try {
      const out = await runStep(step, { ctx, outputs, workflowInput: input });
      outputs[step.id] = out;
      last = out;
      const entry = { id: step.id, kind, name, ok: true, ms: Date.now() - startedAt };
      trace.push(entry);
      log(ctx, { event: "workflow_step", workflow: def.name, ...entry });
    } catch (err) {
      const entry = { id: step.id, kind, name, ok: false, ms: Date.now() - startedAt, error: String(err.message || err) };
      trace.push(entry);
      log(ctx, { event: "workflow_step", workflow: def.name, ...entry });
      const wrapped = new Error(`workflow '${def.name}' failed at step '${step.id}': ${err.message || err}`);
      wrapped.workflow = def.name;
      wrapped.step = step.id;
      wrapped.trace = trace;
      wrapped.cause = err;
      throw wrapped;
    }
  }

  log(ctx, { event: "workflow_done", workflow: def.name, steps: trace.length });
  return { status: "done", workflow: def.name, result: last, outputs, trace };
}

// makeWorkflows - turn a DEFINITION MAP ({ name: def }) into the `ctx.workflows`
// registry the dispatch seam expects: { <name>: (input, ctx) => Promise<run result> }.
// This is what server.js / the reasoner ctx wires so `dispatch:"workflow:<name>"`
// resolves. The returned fns close over the definition but take ctx at call time,
// so the same registry works across requests with different ctx wiring.
function makeWorkflows(defs) {
  const map = defs || {};
  const out = {};
  for (const [name, def] of Object.entries(map)) {
    out[name] = (input, ctx) => runWorkflow(def, input, ctx);
  }
  return out;
}

// listWorkflows - a small discovery helper: name + description + the ordered step
// shape, for a workflow_list manifest entry / the GET list route. Pure metadata,
// no execution.
function listWorkflows(defs) {
  const map = defs || {};
  return Object.entries(map).map(([name, def]) => ({
    name,
    description: def.description || "",
    steps: (def.steps || []).map((s) => ({
      id: s.id,
      kind: s.run ? "run" : s.agent ? "agent" : "tool",
      target: s.agent || s.tool || "(inline)",
      inputFrom: typeof s.inputFrom === "function" ? "(mapper)" : s.inputFrom || "(workflow input)",
    })),
  }));
}

// makeNodeToolCaller - the production adapter for `tool` steps in a COMBINED
// project-1+2 workflow. ai-stack reaches the node's tools (github_get_file, etc.)
// by calling the node's MCP HTTP surface. This builds a ctx.tools-shaped caller
// that POSTs { name, arguments } to MCP_NODE_URL with the node bearer.
//
// It is OPT-IN: if MCP_NODE_URL is unset the caller throws a clear error only
// when a tool step actually runs, so project-2-only workflows are unaffected. The
// fetch shape is intentionally generic (an MCP tools/call-style envelope); a
// deployer whose node speaks a different protocol swaps this one function.
//
//   env.MCP_NODE_URL   - the node endpoint a tool call POSTs to
//   bearer             - the bearer the node expects (from KV; passed in, never
//                        read from the repo/env here)
function makeNodeToolCaller({ url, bearer, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
  return async function nodeTool(name, args) {
    if (!url) {
      throw new Error(
        "combined workflow needs MCP_NODE_URL to reach project-1 (node) tools; it is unset"
      );
    }
    if (!doFetch) throw new Error("no fetch implementation available for the node tool caller");
    const headers = { "Content-Type": "application/json" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await doFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, arguments: args || {} }),
    });
    if (!res.ok) {
      const body = typeof res.text === "function" ? await res.text() : "";
      throw new Error(`node tool '${name}' ${res.status}: ${body}`);
    }
    return res.json();
  };
}

module.exports = {
  runWorkflow,
  makeWorkflows,
  listWorkflows,
  makeNodeToolCaller,
  resolveStepInput,
  DEFAULT_ROLES,
};
