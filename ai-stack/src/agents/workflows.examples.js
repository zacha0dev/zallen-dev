// workflows.examples.js - a KICKSTART artifact for the WORKFLOWS set (Phase 5).
// It pairs with workflows.defs.js the way *.examples.js pairs with each role spec:
// the defs say WHAT each workflow chains, this file shows HOW you call one - a
// sample input per workflow and the SHAPE of the run result it returns.
//
// It doubles as a SMOKE FIXTURE: the unit test imports EXAMPLES to drive the
// engine with mocked agents/tools, so the examples are exercised, not just
// documented. Pure data + a tiny shape helper - no live call here.

const { WORKFLOWS } = require("./workflows.defs");

// EXAMPLES - one per workflow: a sample input + the expected result SHAPE. The
// engine always returns { status, workflow, result, outputs, trace }; `result`
// is the LAST step's output, which varies per workflow (noted below).
const EXAMPLES = [
  {
    name: "research_and_draft",
    input: {
      question: "What database does ai-stack use for vector search?",
      depth: "shallow",
      format: "markdown",
    },
    // result = the DRAFTER output (the last step).
    expectedShape: {
      status: "done",
      workflow: "research_and_draft",
      result: { draft: "<string>", format: "markdown", wordCount: 0, warnings: [] },
      outputs: { research: "{ summary, citations }", draft: "{ draft, ... }" },
    },
  },
  {
    name: "enrich_and_check",
    input: {
      context: "x".repeat(300),
      format: "markdown",
      instruction: "Draft a short release note.",
    },
    // result = { draft, verdict } (the combine step).
    expectedShape: {
      status: "done",
      workflow: "enrich_and_check",
      result: { draft: "{ draft, ... }", verdict: "{ pass, reason, stage }" },
    },
  },
  {
    name: "summarize_repo_file",
    input: {
      repo: "zacha0dev/zallen-dev",
      path: "README.md",
      format: "markdown",
    },
    // result = the DRAFTER output; outputs.fetch holds the node tool result.
    expectedShape: {
      status: "done",
      workflow: "summarize_repo_file",
      result: { draft: "<string>", format: "markdown" },
      outputs: { fetch: "{ path, content, encoding }", draft: "{ draft, ... }" },
    },
  },
];

// assertShape - dependency-free shape check the smoke test uses: every workflow
// run returns the stable envelope (status/workflow/result/outputs/trace), and the
// trace has one ok entry per step. Returns { ok, errors[] }.
function assertShape(actual, expectedWorkflowName) {
  const errors = [];
  if (!actual || typeof actual !== "object") {
    errors.push("run result is not an object");
    return { ok: false, errors };
  }
  if (actual.status !== "done") errors.push(`status: expected 'done', got ${actual.status}`);
  if (expectedWorkflowName && actual.workflow !== expectedWorkflowName) {
    errors.push(`workflow: expected '${expectedWorkflowName}', got ${actual.workflow}`);
  }
  if (actual.result === undefined) errors.push("result missing");
  if (!actual.outputs || typeof actual.outputs !== "object") errors.push("outputs missing");
  if (!Array.isArray(actual.trace)) errors.push("trace not an array");
  for (const t of actual.trace || []) {
    if (!t || typeof t.id !== "string") errors.push("a trace entry is missing a string id");
    if (t && t.ok !== true) errors.push(`trace entry '${t && t.id}' is not ok`);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { EXAMPLES, assertShape, WORKFLOWS };
