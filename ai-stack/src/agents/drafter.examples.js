// drafter.examples.js - a KICKSTART artifact for the DRAFTER role agent, the
// pair to drafter.spec.js. The spec is the editable identity; this shows how you
// call it - sample inputs + the result SHAPE each returns. It also doubles as a
// SMOKE FIXTURE (the unit test drives the runner with a mocked llm using these),
// and it includes the canonical THIN-CONTEXT example so the warning path is
// covered. Pure data + a tiny shape helper - no live call.

const { DRAFTER_SPEC } = require("./drafter.spec");

const EXAMPLES = [
  {
    name: "markdown release note",
    input: {
      context:
        "Phase 4 adds two generalized role agents - a single-call researcher " +
        "that cites every claim, and a pure-generation drafter with format + " +
        "thin-context warnings. Both auto-discover via the manifest.",
      format: "markdown",
      instruction: "a short release note",
    },
    expectedShape: {
      status: "done",
      format: "markdown",
      result: {
        draft: "<markdown body>",
        format: "markdown",
        wordCount: 0, // a number
        warnings: [], // empty when context is rich enough
      },
    },
  },
  {
    name: "json config object",
    input: {
      context:
        "We need a config object with the two cost knobs MODEL_DRAFTER and " +
        "FORMAT_DEPTH and a default format of markdown.",
      format: "json",
      instruction: "a config object",
    },
    expectedShape: {
      status: "done",
      format: "json",
      result: { draft: "<valid JSON string>", format: "json", wordCount: 0, warnings: [] },
    },
  },
  {
    name: "thin context (warns)",
    input: { context: "ship it", format: "plaintext" },
    // Context is below thinContextChars -> the runner emits a thin-context
    // warning so the caller knows to research first, then re-draft.
    expectedShape: {
      status: "done",
      format: "plaintext",
      result: { draft: "<plaintext body>", format: "plaintext", wordCount: 0, warnings: ["thin context: ..."] },
    },
  },
];

// assertShape - dependency-free shape checker used by the smoke test.
function assertShape(actual) {
  const errors = [];
  if (!actual || typeof actual !== "object") errors.push("result is not an object");
  if (actual && actual.status !== "done") errors.push(`status: expected 'done', got ${actual && actual.status}`);
  const r = actual && actual.result;
  if (!r || typeof r !== "object") {
    errors.push("result.result missing");
    return { ok: errors.length === 0, errors };
  }
  if (typeof r.draft !== "string") errors.push("result.draft not a string");
  if (typeof r.format !== "string") errors.push("result.format not a string");
  if (typeof r.wordCount !== "number") errors.push("result.wordCount not a number");
  if (!Array.isArray(r.warnings)) errors.push("result.warnings not an array");
  return { ok: errors.length === 0, errors };
}

module.exports = { EXAMPLES, assertShape, SPEC: DRAFTER_SPEC };
