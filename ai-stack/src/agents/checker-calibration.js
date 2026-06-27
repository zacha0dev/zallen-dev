// checker-calibration.js - the second kickstart artifact: a CALIBRATION SET for
// the shared output-checker. Before a deployer relies on the checker's grades to
// gate a real training run, they run this set - 5 KNOWN-GOOD + 3 KNOWN-BAD
// example outputs with their expected verdicts - and confirm the checker agrees.
// It's the "trust but verify the gate" step: if the checker passes a known-bad or
// fails a known-good, the calibration surfaces it before any spend.
//
// The cases are graded against the TRAINER spec's outputSchema (the enriched-node
// shape), so they exercise the same deterministic gate the real run uses. Run it:
//   node src/agents/checker-calibration.js
// It reports per-case agree/disagree and a final tally; exit code is non-zero if
// any case disagrees, so it doubles as a CI gate.

const { check } = require("./output-checker");
const { TRAINER_SPEC, ENRICHMENT_DIMENSIONS } = require("./trainer.spec");

// A fully-enriched node has one enrichment per dimension. Helper to build one.
function fullEnrichments(text = "concise, grounded, on-tone enrichment") {
  const e = {};
  for (const dim of ENRICHMENT_DIMENSIONS) e[dim] = text;
  return e;
}

// CALIBRATION_SET - each case: { name, output, expectPass, note }.
// expectPass is what a correct checker should return at the DETERMINISTIC stage
// (we calibrate the free gate; the LLM grade is exercised separately when a
// grader is wired). KNOWN-GOOD cases are schema-valid enriched nodes; KNOWN-BAD
// cases each violate the contract in one clear way.
const CALIBRATION_SET = [
  // ---- 5 KNOWN-GOOD (should PASS the deterministic gate) ----
  {
    name: "good: fully enriched node, all dimensions present",
    output: { id: "n1", context: "ctx", enrichments: fullEnrichments(), grades: {}, status: "enriched", attempts: 1 },
    expectPass: true,
    note: "canonical valid enriched node",
  },
  {
    name: "good: minimal required fields (id, enrichments, status)",
    output: { id: "n2", enrichments: { factual_accuracy: "x" }, status: "enriched" },
    expectPass: true,
    note: "only the required fields, still valid",
  },
  {
    name: "good: rich multi-sentence enrichments",
    output: {
      id: "n3",
      context: "onboarding",
      enrichments: fullEnrichments("First, do X. This matters because Y. Example: Z."),
      grades: {},
      status: "enriched",
      attempts: 2,
    },
    expectPass: true,
    note: "longer enrichment text is fine",
  },
  {
    name: "good: status done with full grades",
    output: {
      id: "n4",
      context: "pricing",
      enrichments: fullEnrichments(),
      grades: Object.fromEntries(ENRICHMENT_DIMENSIONS.map((d) => [d, { pass: true, reason: "ok" }])),
      status: "done",
      attempts: 1,
    },
    expectPass: true,
    note: "a completed node round-trips through the gate",
  },
  {
    name: "good: extra unknown field is tolerated",
    output: { id: "n5", enrichments: { conciseness: "tight" }, status: "enriched", note_extra: "ignored" },
    expectPass: true,
    note: "the minimal schema does not forbid extra keys",
  },

  // ---- 3 KNOWN-BAD (should FAIL the deterministic gate) ----
  {
    name: "bad: missing required 'enrichments'",
    output: { id: "b1", context: "ctx", status: "enriched" },
    expectPass: false,
    note: "required field absent -> schema fail",
  },
  {
    name: "bad: enrichments is a string, not an object",
    output: { id: "b2", enrichments: "not an object", status: "enriched" },
    expectPass: false,
    note: "wrong type for enrichments -> schema fail",
  },
  {
    name: "bad: refusal text in the output",
    output: { id: "b3", enrichments: { factual_accuracy: "x" }, status: "enriched", answer: "I cannot help with that." },
    expectPass: false,
    note: "refusal heuristic should trip on the answer surface",
  },
];

// runCalibration - grade every case through the checker's DETERMINISTIC stage
// (skipLLM:true so it is free + offline) and compare to the expected verdict.
// Returns { results, agreed, disagreed }.
async function runCalibration(ctx = { logger: { log: () => {} } }) {
  const results = [];
  for (const c of CALIBRATION_SET) {
    const verdict = await check(
      "calibration",
      c.output,
      { schema: TRAINER_SPEC.outputSchema, skipLLM: true },
      ctx
    );
    const agree = verdict.pass === c.expectPass;
    results.push({ name: c.name, expectPass: c.expectPass, gotPass: verdict.pass, agree, reason: verdict.reason });
  }
  const agreed = results.filter((r) => r.agree).length;
  return { results, agreed, disagreed: results.length - agreed };
}

module.exports = { CALIBRATION_SET, runCalibration, fullEnrichments };

// Runnable as a script: print the report + a tally; non-zero exit on disagreement.
if (require.main === module) {
  (async () => {
    const { results, agreed, disagreed } = await runCalibration();
    for (const r of results) {
      const mark = r.agree ? "ok  " : "MISS";
      console.log(`${mark} - ${r.name} (expect pass=${r.expectPass}, got pass=${r.gotPass})`);
    }
    console.log(`\ncalibration: ${agreed}/${results.length} agreed, ${disagreed} disagreed`);
    if (disagreed > 0) process.exitCode = 1;
  })();
}
