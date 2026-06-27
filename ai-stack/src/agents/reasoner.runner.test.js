// reasoner.runner.test.js - unit tests for the reasoner loop + output-checker,
// driven entirely with a MOCKED llm and ragSearch (the ctx injection seam) so no
// network, no DB, no real model is touched. Plain-node assertions (no test
// framework) to match the repo's zero-dev-dep posture:
//   node src/agents/reasoner.runner.test.js
const assert = require("assert");
const { run } = require("./reasoner.runner");
const { check, deterministicGates } = require("./output-checker");
const { REASONER_SPEC } = require("./reasoner.spec");

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

// A logger that swallows output so test runs stay quiet.
const quiet = { log: () => {} };

// A ragSearch stub that returns one fake evidence chunk.
const fakeRag = async ({ query }) => ({
  hits: [{ id: "chunk-1", content: `evidence about ${query}`, score: 0.9 }],
});

// llm stub factory: produce returns scripted outputs per call; grade always passes.
function scriptedLlm(produceOutputs) {
  let i = 0;
  return {
    complete: async ({ system }) => {
      if (/output grader/i.test(system)) {
        return JSON.stringify({ pass: true, reason: "looks good", diff: {} });
      }
      const out = produceOutputs[Math.min(i, produceOutputs.length - 1)];
      i++;
      return typeof out === "string" ? out : JSON.stringify(out);
    },
  };
}

(async () => {
  // 1. Deterministic gate: schema-invalid output fails BEFORE any LLM grade.
  await test("deterministic gate rejects missing citations", () => {
    const r = deterministicGates(
      { answer: "hi" },
      { schema: REASONER_SPEC.outputSchema, requireCitations: true }
    );
    assert.strictEqual(r.pass, false);
    assert.match(r.reason, /cited|citations/i);
  });

  // 2. Deterministic gate: refusal text fails.
  await test("deterministic gate rejects a refusal", () => {
    const r = deterministicGates({ answer: "I cannot help with that", citations: ["x"] }, {});
    assert.strictEqual(r.pass, false);
    assert.match(r.reason, /refusal/i);
  });

  // 3. Happy path: a valid cited output passes on iteration 1.
  await test("reasoner passes on first valid output", async () => {
    const ctx = {
      llm: scriptedLlm([{ answer: "the answer", citations: ["chunk-1"] }]),
      ragSearch: fakeRag,
      logger: quiet,
    };
    const out = await run("what is x?", ctx);
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.iterations, 1);
    assert.deepStrictEqual(out.result.citations, ["chunk-1"]);
  });

  // 4. Retry path: first output is uncited (det-fail), second is valid -> pass on 2.
  await test("reasoner retries with structuredDiff then passes", async () => {
    const ctx = {
      llm: scriptedLlm([
        { answer: "no cites" }, // fails deterministic (no citations)
        { answer: "now cited", citations: ["chunk-1"] }, // passes
      ]),
      ragSearch: fakeRag,
      logger: quiet,
    };
    const out = await run("what is x?", ctx);
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.iterations, 2);
    assert.strictEqual(out.attempts[0].pass, false);
    assert.strictEqual(out.attempts[1].pass, true);
  });

  // 5. DLQ path: never produces a valid output -> dead-letters after maxIterations.
  await test("reasoner dead-letters after maxIterations", async () => {
    const ctx = {
      llm: scriptedLlm([{ answer: "never cited" }]), // always fails det gate
      ragSearch: fakeRag,
      logger: quiet,
    };
    let threw = null;
    try {
      await run("what is x?", ctx);
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, "expected a throw");
    assert.strictEqual(threw.dlq, true);
    assert.strictEqual(threw.iterations, REASONER_SPEC.maxIterations);
    assert.strictEqual(threw.attempts.length, REASONER_SPEC.maxIterations);
  });

  // 6. LLM grade is reached only when deterministic gates pass, and a graded
  //    FAIL is honored (output-checker integration).
  await test("llm grade fail is honored after deterministic pass", async () => {
    const failingGrader = {
      complete: async ({ system }) => {
        if (/output grader/i.test(system)) {
          return JSON.stringify({ pass: false, reason: "off-topic", diff: { answer: "address the task" } });
        }
        return JSON.stringify({ answer: "valid shape", citations: ["chunk-1"] });
      },
    };
    const verdict = await check(
      "task",
      { answer: "valid shape", citations: ["chunk-1"] },
      { schema: REASONER_SPEC.outputSchema, requireCitations: true },
      { llm: failingGrader, logger: quiet }
    );
    assert.strictEqual(verdict.pass, false);
    assert.strictEqual(verdict.stage, "llm_grade");
    assert.ok(verdict.structuredDiff);
  });

  // 7. No grader configured -> soft stage fails open (pass) once det gates pass.
  await test("missing llm grader fails open on the soft stage only", async () => {
    const verdict = await check(
      "task",
      { answer: "ok", citations: ["chunk-1"] },
      { schema: REASONER_SPEC.outputSchema, requireCitations: true },
      { logger: quiet } // no llm
    );
    assert.strictEqual(verdict.pass, true);
  });

  console.log(`\n${passed} test(s) passed`);
})();
