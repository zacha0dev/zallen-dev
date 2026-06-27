// researcher.examples.js - a KICKSTART artifact for the RESEARCHER role agent.
// It pairs with researcher.spec.js (the editable identity): the spec says WHO
// the agent is, this file shows HOW you call it - a couple of sample inputs and
// the SHAPE of the result each should return. A deployer forking the researcher
// edits both files together.
//
// It doubles as a SMOKE FIXTURE: the unit test imports EXAMPLES to drive the
// runner with a mocked llm, so the examples are exercised, not just documented.
// There is no live call here - this module is pure data + a tiny shape helper.

const { RESEARCHER_SPEC } = require("./researcher.spec");

// EXAMPLES - sample input -> the expected result SHAPE (not exact text; the LLM
// output varies, but the structure is the contract the runner guarantees).
const EXAMPLES = [
  {
    name: "shallow lookup",
    input: {
      question: "What database does ai-stack use for vector search?",
      depth: "shallow",
    },
    // The runner returns { status, result, model, depth }; result matches the
    // spec outputSchema: a summary + grounded citations + a confidence band.
    expectedShape: {
      status: "done",
      depth: "shallow",
      result: {
        summary: "<a concise grounded answer>",
        citations: [{ chunkId: "<an id from the surveyed hits>", excerpt: "<short quote>" }],
        confidence: "low|medium|high",
      },
    },
  },
  {
    name: "deep synthesis",
    input: {
      question: "How does the reasoner bound its cost and avoid runaway loops?",
      depth: "deep",
      topK: 12,
    },
    expectedShape: {
      status: "done",
      depth: "deep",
      result: {
        summary: "<a concise grounded answer>",
        citations: [{ chunkId: "<an id from the surveyed hits>", excerpt: "<short quote>" }],
        confidence: "low|medium|high",
      },
    },
  },
];

// assertShape - a tiny, dependency-free checker the smoke test uses to confirm a
// runner result matches the example's expected shape (keys + types, not values).
// Returns { ok, errors[] }.
function assertShape(actual) {
  const errors = [];
  if (!actual || typeof actual !== "object") errors.push("result is not an object");
  if (actual && actual.status !== "done") errors.push(`status: expected 'done', got ${actual && actual.status}`);
  const r = actual && actual.result;
  if (!r || typeof r !== "object") {
    errors.push("result.result missing");
    return { ok: errors.length === 0, errors };
  }
  if (typeof r.summary !== "string") errors.push("result.summary not a string");
  if (!Array.isArray(r.citations)) errors.push("result.citations not an array");
  for (const c of r.citations || []) {
    if (!c || typeof c.chunkId !== "string") errors.push("a citation is missing a string chunkId");
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { EXAMPLES, assertShape, SPEC: RESEARCHER_SPEC };
