// dispatch.js - the reasoner's DISPATCH seam, made real. The reasoner's loop has
// always had a "dispatch" comment where it could hand off to a tool, a role
// agent, or a linked workflow instead of producing directly. This module turns
// that comment into a small, explicit, testable registry: a map of role name ->
// runner, plus a dispatch() that routes a task to one of them.
//
// It is deliberately MINIMAL and BACKWARD-COMPATIBLE:
//   - The reasoner only dispatches when a task explicitly asks for it
//     (task.dispatch === "researcher" | "drafter" | "workflow:<name>"). With no
//     such field the reasoner produces directly, exactly as before - so every
//     existing reasoner test still passes untouched.
//   - Each role runner is invoked through the SAME ctx injection seam, so a test
//     can route to a mocked runner without any network or model.
//
// Registry shape: { researcher: run(input, ctx), drafter: run(input, ctx), ... }.
// A "linked workflow" is just a named runner registered the same way; the
// "workflow:" prefix is reserved for chaining (Phase 5 fills in the workflow
// set - here a workflow name routes through ctx.workflows if the caller wired one).

const researcher = require("./researcher.runner");
const drafter = require("./drafter.runner");

// DEFAULT_ROLES - the built-in role agents the reasoner can dispatch to. Each
// entry carries the runner AND its spec, so the reasoner can gate a dispatched
// result against the ROLE's own outputSchema (a researcher returns {summary,
// citations}, a drafter {draft,...} - not the reasoner's {answer, citations}). A
// deployer adds a role by registering another { run, spec } pair (see
// docs/extending.md "wire a role into the reasoner").
const DEFAULT_ROLES = {
  researcher: { run: researcher.run, spec: researcher.SPEC },
  drafter: { run: drafter.run, spec: drafter.SPEC },
};

// parseDispatch - read the dispatch directive off a task. Returns null (produce
// directly) or { kind: 'role'|'workflow', name, input }. Accepts either a string
// task (always produce-direct) or an object task carrying a `dispatch` field.
function parseDispatch(task) {
  if (!task || typeof task !== "object") return null;
  const d = task.dispatch;
  if (!d || typeof d !== "string") return null;
  if (d.startsWith("workflow:")) {
    return { kind: "workflow", name: d.slice("workflow:".length), input: task.dispatchInput || task };
  }
  return { kind: "role", name: d, input: task.dispatchInput || task };
}

// normalizeRole - accept either a bare run function or a { run, spec } pair so a
// test can override a role with just a function and still work.
function normalizeRole(entry) {
  if (typeof entry === "function") return { run: entry, spec: null };
  if (entry && typeof entry.run === "function") return { run: entry.run, spec: entry.spec || null };
  return null;
}

// dispatch - route a parsed directive to a role runner or a linked workflow.
//   directive: from parseDispatch()
//   ctx:       the reasoner ctx; may carry { roles, workflows } overrides for tests
// Roles resolve from ctx.roles (test override) merged over DEFAULT_ROLES;
// workflows resolve from ctx.workflows (the caller wires these). Returns
// { result, spec } - the runner's `.result` plus the role's spec (or null for a
// workflow) so the reasoner can gate against the right outputSchema.
async function dispatch(directive, ctx = {}) {
  if (!directive) throw new Error("dispatch requires a directive (use parseDispatch)");

  if (directive.kind === "workflow") {
    const workflows = (ctx && ctx.workflows) || {};
    const wf = workflows[directive.name];
    if (typeof wf !== "function") {
      throw new Error(`dispatch: no linked workflow '${directive.name}' is wired (ctx.workflows)`);
    }
    const out = await wf(directive.input, ctx);
    return { result: out && out.result !== undefined ? out.result : out, spec: null };
  }

  // role
  const roles = Object.assign({}, DEFAULT_ROLES, (ctx && ctx.roles) || {});
  const role = normalizeRole(roles[directive.name]);
  if (!role) {
    throw new Error(
      `dispatch: no role agent '${directive.name}' (known: ${Object.keys(roles).join(", ")})`
    );
  }
  const out = await role.run(directive.input, ctx);
  return { result: out && out.result !== undefined ? out.result : out, spec: role.spec };
}

module.exports = { dispatch, parseDispatch, DEFAULT_ROLES };
