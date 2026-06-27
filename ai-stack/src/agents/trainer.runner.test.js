// trainer.runner.test.js - unit tests for the trainer batch loop + its reuse of
// the shared output-checker, driven entirely with a MOCKED llm and a fake tracker
// db (the ctx injection seam) so no network, no DB, no real model is touched.
// Plain-node assertions (no test framework), matching the repo's zero-dev-dep
// posture and reasoner.runner.test.js:
//   node src/agents/trainer.runner.test.js
const assert = require("assert");
const { run } = require("./trainer.runner");
const { TRAINER_SPEC, ENRICHMENT_DIMENSIONS } = require("./trainer.spec");

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`ok - ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL - ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

const quiet = { log: () => {} };

// A full enrichments object (one entry per dimension) - a schema-valid enrich.
function fullEnrichments() {
  const e = {};
  for (const dim of ENRICHMENT_DIMENSIONS) e[dim] = `enriched: ${dim}`;
  return e;
}

// fakeDb - an in-memory enrichment_tracker. Records upserts so a test can assert
// the per-node rows were written + that checker reuse drove the grades.
function fakeDb() {
  const rows = [];
  return {
    runId: "run-test",
    rows,
    upsertNode: async (runId, node) => {
      rows.push({ runId, node: JSON.parse(JSON.stringify(node)) });
    },
  };
}

// scriptedLlm - the enrich call returns scripted outputs per call; the grader
// call (system mentions "output grader") returns a scripted verdict. `grade`
// controls whether the soft grade passes.
function scriptedLlm(enrichOutputs, { gradePass = true, gradeDiff = {} } = {}) {
  let i = 0;
  return {
    complete: async ({ system }) => {
      if (/output grader/i.test(system)) {
        return JSON.stringify({ pass: gradePass, reason: gradePass ? "ok" : "needs work", diff: gradePass ? {} : gradeDiff });
      }
      const out = enrichOutputs[Math.min(i, enrichOutputs.length - 1)];
      i++;
      return typeof out === "string" ? out : JSON.stringify(out);
    },
  };
}

(async () => {
  // 1. Per-node pass-first: a valid full enrichment passes on attempt 1.
  await test("node passes on first valid enrichment", async () => {
    const db = fakeDb();
    const ctx = {
      llm: scriptedLlm([{ enrichments: fullEnrichments() }], { gradePass: true }),
      db,
      logger: quiet,
    };
    const out = await run({ nodes: [{ id: "n1", context: "ctx" }] }, ctx);
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.result.summary.done, 1);
    assert.strictEqual(out.result.summary.failed, 0);
    const node = out.result.nodes[0];
    assert.strictEqual(node.status, "done");
    assert.strictEqual(node.attempts, 1);
    // all 10 dimensions graded pass
    assert.strictEqual(Object.values(node.grades).filter((g) => g.pass).length, ENRICHMENT_DIMENSIONS.length);
  });

  // 2. Retry-then-pass: attempt 1 is incomplete (wrong shape -> completeness
  //    gate fails), attempt 2 is valid -> node done on attempt 2.
  await test("node retries with structuredDiff then passes", async () => {
    const db = fakeDb();
    const ctx = {
      llm: scriptedLlm(
        [
          { notEnrichments: "wrong shape" }, // -> empty enrichments -> completeness fail
          { enrichments: fullEnrichments() }, // valid
        ],
        { gradePass: true }
      ),
      db,
      logger: quiet,
    };
    const out = await run({ nodes: [{ id: "n2", context: "ctx" }] }, ctx);
    const node = out.result.nodes[0];
    assert.strictEqual(node.status, "done");
    assert.strictEqual(node.attempts, 2);
  });

  // 3. Fail-after-2-attempts: enrich never yields a complete+gradable output ->
  //    node failed after maxAttemptsPerNode, BATCH still completes (a second,
  //    good node passes).
  await test("node fails after maxAttemptsPerNode, batch continues", async () => {
    const db = fakeDb();
    const out = await run(
      { nodes: [{ id: "bad", context: "c" }, { id: "good", context: "c" }] },
      {
        db,
        logger: quiet,
        llm: {
          complete: async ({ system, prompt }) => {
            if (/output grader/i.test(system)) return JSON.stringify({ pass: true, reason: "ok", diff: {} });
            // bad node prompt -> refusal/empty; good node prompt -> valid
            if (/NODE id: bad/.test(prompt)) return JSON.stringify({ enrichments: {}, answer: "I cannot help with that" });
            return JSON.stringify({ enrichments: fullEnrichments() });
          },
        },
      }
    );
    assert.strictEqual(out.result.summary.total, 2);
    assert.strictEqual(out.result.summary.failed, 1);
    assert.strictEqual(out.result.summary.done, 1);
    const bad = out.result.nodes.find((n) => n.id === "bad");
    assert.strictEqual(bad.status, "failed");
    assert.strictEqual(bad.attempts, TRAINER_SPEC.maxAttemptsPerNode);
  });

  // 4. Tracker rows written: one upsert per node, carrying enrichments + grades.
  await test("tracker rows are written per node", async () => {
    const db = fakeDb();
    const ctx = {
      llm: scriptedLlm([{ enrichments: fullEnrichments() }], { gradePass: true }),
      db,
      logger: quiet,
    };
    await run({ nodes: [{ id: "a", context: "c" }, { id: "b", context: "c" }] }, ctx);
    assert.strictEqual(db.rows.length, 2);
    assert.strictEqual(db.rows[0].node.id, "a");
    assert.ok(db.rows[0].node.enrichments.factual_accuracy);
    assert.ok(db.rows[0].node.grades.factual_accuracy);
  });

  // 5. Checker reuse fires: the soft LLM grade (output-checker) is reached when
  //    the completeness + deterministic gates pass, and a graded FAIL is honored
  //    -> the node retries and (grade still failing) ends failed, with grades
  //    reflecting the named-dimension diff.
  await test("output-checker grade reuse fires and a graded fail is honored", async () => {
    const db = fakeDb();
    const ctx = {
      llm: scriptedLlm([{ enrichments: fullEnrichments() }], {
        gradePass: false,
        gradeDiff: { factual_accuracy: "claim is wrong" },
      }),
      db,
      logger: quiet,
    };
    const out = await run({ nodes: [{ id: "n", context: "c" }] }, ctx);
    const node = out.result.nodes[0];
    assert.strictEqual(node.status, "failed");
    assert.strictEqual(node.attempts, TRAINER_SPEC.maxAttemptsPerNode);
    // the named dimension is graded failing; an unnamed one passes
    assert.strictEqual(node.grades.factual_accuracy.pass, false);
    assert.strictEqual(node.grades.conciseness.pass, true);
  });

  // 6. Empty / bad input throws (guard).
  await test("empty nodes input throws", async () => {
    let threw = null;
    try {
      await run({ nodes: [] }, { llm: scriptedLlm([{}]), logger: quiet });
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, "expected a throw on empty nodes");
  });

  // 7. Array input form is accepted (run(nodes, ctx) per the Phase-3 signature).
  await test("array-of-nodes input form is accepted", async () => {
    const ctx = { llm: scriptedLlm([{ enrichments: fullEnrichments() }], { gradePass: true }), logger: quiet };
    const out = await run([{ id: "x", context: "c" }], ctx);
    assert.strictEqual(out.result.summary.done, 1);
  });

  console.log(`\n${passed} test(s) passed`);
})();
