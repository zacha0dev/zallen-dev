// role-agents.test.js - unit tests for the Phase-4 role agents (RESEARCHER +
// DRAFTER) and the reasoner's dispatch wiring, driven entirely with a MOCKED llm
// (and a fake ragSearch for the researcher) through the ctx injection seam - no
// network, no DB, no real model. Plain-node assertions to match the repo's
// zero-dev-dep posture:
//   node src/agents/role-agents.test.js
const assert = require("assert");
const researcher = require("./researcher.runner");
const drafter = require("./drafter.runner");
const { run: reasonerRun } = require("./reasoner.runner");
const { dispatch, parseDispatch } = require("./dispatch");
const { RESEARCHER_SPEC, resolveModel: researcherModel } = require("./researcher.spec");
const { DRAFTER_SPEC, resolveModel: drafterModel } = require("./drafter.spec");
const rexamples = require("./researcher.examples");
const dexamples = require("./drafter.examples");

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`ok - ${name}`); })
    .catch((err) => { console.error(`FAIL - ${name}`); console.error(err); process.exitCode = 1; });
}
const quiet = { log: () => {} };

// A ragSearch stub returning two fake chunks.
const fakeRag = async ({ query }) => ({
  hits: [
    { id: "chunk-1", content: `evidence about ${query}`, score: 0.9 },
    { id: "chunk-2", content: "more evidence", score: 0.7 },
  ],
});

// An llm stub that returns a fixed JSON payload regardless of prompt.
function fixedLlm(payload) {
  return { complete: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)) };
}

(async () => {
  // ---- RESEARCHER ---------------------------------------------------------

  // 1. cites from rag hits + keeps only real citations.
  await test("researcher cites from rag hits and grounds citations", async () => {
    const ctx = {
      ragSearch: fakeRag,
      llm: fixedLlm({
        summary: "an answer",
        citations: [{ chunkId: "chunk-1", excerpt: "a quote" }],
        confidence: "high",
      }),
      logger: quiet,
    };
    const out = await researcher.run({ question: "what db?" }, ctx);
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.result.summary, "an answer");
    assert.strictEqual(out.result.citations.length, 1);
    assert.strictEqual(out.result.citations[0].chunkId, "chunk-1");
    assert.strictEqual(out.result.confidence, "high");
  });

  // 2. anti-fabrication: a citation to a chunk NOT in the hits is dropped.
  await test("researcher drops fabricated (non-retrieved) citations", async () => {
    const ctx = {
      ragSearch: fakeRag,
      llm: fixedLlm({
        summary: "an answer",
        citations: [
          { chunkId: "chunk-1" }, // real -> kept (excerpt backfilled)
          { chunkId: "made-up-99", excerpt: "hallucinated" }, // not in hits -> dropped
        ],
      }),
      logger: quiet,
    };
    const out = await researcher.run({ question: "q" }, ctx);
    assert.strictEqual(out.result.citations.length, 1);
    assert.strictEqual(out.result.citations[0].chunkId, "chunk-1");
    assert.ok(out.result.citations[0].excerpt, "excerpt should be backfilled from the hit");
  });

  // 3. honors depth: shallow -> Haiku default, deep -> Sonnet (via resolveModel).
  await test("researcher honors depth for model tier", async () => {
    const clean = {}; // no env override
    assert.strictEqual(researcherModel("shallow", RESEARCHER_SPEC, clean), RESEARCHER_SPEC.defaultModel);
    assert.strictEqual(researcherModel("deep", RESEARCHER_SPEC, clean), RESEARCHER_SPEC.deepModel);
    // env knob can only lower: it overrides the shallow tier.
    assert.strictEqual(researcherModel("shallow", RESEARCHER_SPEC, { MODEL_RESEARCHER: "cheapo" }), "cheapo");
    // and the runner reports the depth it ran.
    const ctx = { ragSearch: fakeRag, llm: fixedLlm({ summary: "a", citations: [{ chunkId: "chunk-1" }] }), logger: quiet };
    const out = await researcher.run({ question: "q", depth: "deep" }, ctx);
    assert.strictEqual(out.depth, "deep");
    assert.strictEqual(out.model, RESEARCHER_SPEC.deepModel);
  });

  // 4. researcher examples smoke: each example drives the runner to its shape.
  await test("researcher examples match the documented shape", async () => {
    for (const ex of rexamples.EXAMPLES) {
      const ctx = { ragSearch: fakeRag, llm: fixedLlm({ summary: "s", citations: [{ chunkId: "chunk-1" }] }), logger: quiet };
      const out = await researcher.run(ex.input, ctx);
      const { ok, errors } = rexamples.assertShape(out);
      assert.ok(ok, `example '${ex.name}' shape: ${errors.join("; ")}`);
    }
  });

  // ---- DRAFTER ------------------------------------------------------------

  // 5. respects format + reports wordCount, no warnings on rich context.
  await test("drafter respects format and counts words", async () => {
    const ctx = { llm: fixedLlm("# Title\n\nA solid markdown draft body with several words."), logger: quiet };
    const out = await drafter.run(
      { context: "a".repeat(200), format: "markdown", instruction: "a note" },
      ctx
    );
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.result.format, "markdown");
    assert.ok(out.result.wordCount > 3);
    assert.strictEqual(out.result.warnings.length, 0);
  });

  // 6. thin-context warning when the input is too sparse.
  await test("drafter emits a thin-context warning", async () => {
    const ctx = { llm: fixedLlm("ok"), logger: quiet };
    const out = await drafter.run({ context: "ship it", format: "plaintext" }, ctx);
    assert.ok(out.result.warnings.some((w) => /thin context/i.test(w)), "expected a thin-context warning");
  });

  // 7. json format warns (not throws) on an unparseable draft + strips fences.
  await test("drafter warns on invalid json and strips code fences", async () => {
    const ctx = { llm: fixedLlm("```json\nnot valid json at all\n```"), logger: quiet };
    const out = await drafter.run({ context: "x".repeat(200), format: "json" }, ctx);
    assert.strictEqual(out.result.format, "json");
    assert.ok(!/```/.test(out.result.draft), "fences should be stripped");
    assert.ok(out.result.warnings.some((w) => /json/i.test(w)), "expected an invalid-json warning");
  });

  // 8. drafter examples smoke.
  await test("drafter examples match the documented shape", async () => {
    for (const ex of dexamples.EXAMPLES) {
      const ctx = { llm: fixedLlm(ex.input.format === "json" ? '{"ok":true}' : "a draft body"), logger: quiet };
      const out = await drafter.run(ex.input, ctx);
      const { ok, errors } = dexamples.assertShape(out);
      assert.ok(ok, `example '${ex.name}' shape: ${errors.join("; ")}`);
    }
  });

  // 9. FORMAT_DEPTH=deep promotes the drafter model (no MODEL_DRAFTER override).
  await test("drafter FORMAT_DEPTH=deep promotes to the deep model", () => {
    assert.strictEqual(drafterModel(DRAFTER_SPEC, {}), DRAFTER_SPEC.defaultModel);
    assert.strictEqual(drafterModel(DRAFTER_SPEC, { FORMAT_DEPTH: "deep" }), DRAFTER_SPEC.deepModel);
    assert.strictEqual(drafterModel(DRAFTER_SPEC, { MODEL_DRAFTER: "x" }), "x");
  });

  // ---- DISPATCH (reasoner -> role agent) ----------------------------------

  // 10. parseDispatch reads the directive off a task.
  await test("parseDispatch reads role + workflow directives", () => {
    assert.strictEqual(parseDispatch("a string"), null);
    assert.strictEqual(parseDispatch({ task: "x" }), null);
    assert.deepStrictEqual(parseDispatch({ task: "x", dispatch: "researcher" }).kind, "role");
    assert.strictEqual(parseDispatch({ task: "x", dispatch: "workflow:foo" }).kind, "workflow");
    assert.strictEqual(parseDispatch({ task: "x", dispatch: "workflow:foo" }).name, "foo");
  });

  // 11. dispatch routes to the built-in researcher role and returns its result + spec.
  await test("dispatch routes to a built-in role agent", async () => {
    const ctx = { ragSearch: fakeRag, llm: fixedLlm({ summary: "s", citations: [{ chunkId: "chunk-1" }] }), logger: quiet };
    const directive = parseDispatch({ task: "q", dispatch: "researcher", dispatchInput: { question: "q" } });
    const { result, spec } = await dispatch(directive, ctx);
    assert.strictEqual(result.summary, "s");
    assert.strictEqual(spec.name, "researcher_run");
  });

  // 12. the reasoner dispatches end-to-end: it routes to a role and gates the
  //     result against the ROLE's schema, returning dispatchedTo + iterations 0.
  await test("reasoner dispatches to a role agent and gates it", async () => {
    const ctx = {
      ragSearch: fakeRag,
      // one llm shared: researcher synthesize returns a valid researcher result;
      // the output-checker grader (if reached) passes.
      llm: {
        complete: async ({ system }) => {
          if (/output grader/i.test(system)) return JSON.stringify({ pass: true, reason: "ok", diff: {} });
          return JSON.stringify({ summary: "grounded answer", citations: [{ chunkId: "chunk-1", excerpt: "q" }] });
        },
      },
      logger: quiet,
    };
    const out = await reasonerRun({ task: "research the db", dispatch: "researcher", dispatchInput: { question: "what db?" } }, ctx);
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.dispatchedTo, "researcher");
    assert.strictEqual(out.iterations, 0);
    assert.ok(out.result.summary, "carries the researcher's summary");
  });

  // 13. a custom role can be injected through ctx.roles (the test-override seam),
  //     and a linked workflow routes through ctx.workflows.
  await test("dispatch honors ctx.roles override and ctx.workflows", async () => {
    const ctx = {
      roles: { custom: async (input) => ({ status: "done", result: { ok: true, echo: input } }) },
      workflows: { wf: async (input) => ({ status: "done", result: { workflow: true } }) },
      logger: quiet,
    };
    const r1 = await dispatch(parseDispatch({ task: "x", dispatch: "custom", dispatchInput: { a: 1 } }), ctx);
    assert.strictEqual(r1.result.ok, true);
    const r2 = await dispatch(parseDispatch({ task: "x", dispatch: "workflow:wf" }), ctx);
    assert.strictEqual(r2.result.workflow, true);
    assert.strictEqual(r2.spec, null);
  });

  // 14. dispatch to an unknown role throws a clear error.
  await test("dispatch to an unknown role throws", async () => {
    let threw = null;
    try { await dispatch(parseDispatch({ task: "x", dispatch: "nope" }), { logger: quiet }); }
    catch (e) { threw = e; }
    assert.ok(threw, "expected a throw");
    assert.match(String(threw.message), /no role agent/i);
  });

  console.log(`\n${passed} test(s) passed`);
})();
