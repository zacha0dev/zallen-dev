// workflows.test.js - unit tests for the Phase-5 WORKFLOWS engine, driven with a
// MOCKED llm + STUBBED agents/tools through the ctx injection seam - no network,
// no DB, no real model. Plain-node assertions to match the repo's zero-dev-dep
// posture:
//   node src/agents/workflows.test.js
const assert = require("assert");
const {
  runWorkflow,
  makeWorkflows,
  listWorkflows,
  makeNodeToolCaller,
} = require("./workflows");
const { WORKFLOWS } = require("./workflows.defs");
const examples = require("./workflows.examples");

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`ok - ${name}`); })
    .catch((err) => { console.error(`FAIL - ${name}`); console.error(err); process.exitCode = 1; });
}
const quiet = { log: () => {} };

// An llm stub that returns a fixed payload (string or JSON) regardless of prompt.
function fixedLlm(payload) {
  return { complete: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)) };
}
// A ragSearch stub returning two fake chunks (for any researcher steps).
const fakeRag = async ({ query }) => ({
  hits: [
    { id: "chunk-1", content: `evidence about ${query}`, score: 0.9 },
    { id: "chunk-2", content: "more evidence", score: 0.7 },
  ],
});

(async () => {
  // 1. a SINGLE-STEP workflow runs and returns the stable envelope.
  await test("single-step workflow returns result + trace", async () => {
    const def = {
      name: "echo",
      steps: [{ id: "only", run: async (input) => ({ echoed: input }) }],
    };
    const out = await runWorkflow(def, { hello: "world" }, { logger: quiet });
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.workflow, "echo");
    assert.deepStrictEqual(out.result, { echoed: { hello: "world" } });
    assert.deepStrictEqual(out.outputs.only, { echoed: { hello: "world" } });
    assert.strictEqual(out.trace.length, 1);
    assert.strictEqual(out.trace[0].ok, true);
    assert.strictEqual(out.trace[0].kind, "run");
  });

  // 2. MULTI-STEP output threading: a later step reads an earlier step's output
  //    via inputFrom (string + mapper forms).
  await test("multi-step workflow threads outputs forward", async () => {
    const def = {
      name: "chain",
      steps: [
        { id: "a", run: async (input) => ({ n: input.n + 1 }) },
        { id: "b", run: async (a) => ({ n: a.n * 10 }), inputFrom: "a" },
        {
          id: "c",
          run: async (mixed) => ({ sum: mixed.a + mixed.b }),
          inputFrom: (outputs) => ({ a: outputs.a.n, b: outputs.b.n }),
        },
      ],
    };
    const out = await runWorkflow(def, { n: 1 }, { logger: quiet });
    assert.strictEqual(out.outputs.a.n, 2);
    assert.strictEqual(out.outputs.b.n, 20);
    assert.strictEqual(out.result.sum, 22); // a.n(2) + b.n(20)
    assert.strictEqual(out.trace.length, 3);
  });

  // 3. an AGENT step routes through the role registry (built-in researcher).
  await test("agent step routes to a built-in role agent", async () => {
    const def = {
      name: "just-research",
      steps: [{ id: "research", agent: "researcher" }],
    };
    const ctx = {
      ragSearch: fakeRag,
      llm: fixedLlm({ summary: "grounded", citations: [{ chunkId: "chunk-1" }] }),
      logger: quiet,
    };
    const out = await runWorkflow(def, { question: "what db?" }, ctx);
    // role runner returns { status, result, ... }; the engine unwraps to .result.
    assert.strictEqual(out.result.summary, "grounded");
    assert.strictEqual(out.result.citations.length, 1);
  });

  // 4. the built-in research_and_draft def threads researcher -> drafter.
  await test("research_and_draft composes researcher then drafter", async () => {
    const ctx = {
      ragSearch: fakeRag,
      // researcher returns a JSON summary; drafter returns a prose draft. Both
      // come off the same stub, distinguished by the system prompt isn't needed -
      // we route by what each runner asks for, so return a value valid for both:
      // researcher safeParses JSON, drafter takes the raw string as the draft.
      llm: {
        complete: async ({ system }) => {
          if (/research worker/i.test(system)) {
            return JSON.stringify({ summary: "the db is postgres+pgvector", citations: [{ chunkId: "chunk-1" }] });
          }
          return "# Summary\n\nai-stack uses Postgres with pgvector for vector search.";
        },
      },
      logger: quiet,
    };
    const out = await runWorkflow(WORKFLOWS.research_and_draft, { question: "what db?", format: "markdown" }, ctx);
    assert.strictEqual(out.status, "done");
    assert.ok(out.outputs.research.summary, "research step produced a summary");
    assert.strictEqual(out.result.format, "markdown");
    assert.ok(out.result.draft.length > 0, "drafter produced a draft");
    assert.strictEqual(out.trace.length, 2);
  });

  // 5. a COMBINED project-1+2 workflow: a STUBBED node tool feeds an agent.
  await test("combined workflow runs a stubbed node tool then an agent", async () => {
    const ctx = {
      // ctx.tools is the project-1 (node) surface; here a stub returns a base64 file.
      tools: {
        github_get_file: async (args) => ({
          path: args.path,
          content: Buffer.from("the file body to summarize").toString("base64"),
          encoding: "base64",
        }),
      },
      llm: fixedLlm("A concise summary of the file."),
      logger: quiet,
    };
    const out = await runWorkflow(
      WORKFLOWS.summarize_repo_file,
      { repo: "zacha0dev/zallen-dev", path: "README.md", format: "markdown" },
      ctx
    );
    assert.strictEqual(out.status, "done");
    assert.strictEqual(out.outputs.fetch.path, "README.md");
    assert.ok(out.result.draft.length > 0, "drafter summarized the fetched file");
    assert.strictEqual(out.trace[0].kind, "tool");
    assert.strictEqual(out.trace[1].kind, "agent");
  });

  // 6. an UNKNOWN workflow / missing definition throws cleanly.
  await test("runWorkflow throws on an empty/invalid definition", async () => {
    let threw = null;
    try { await runWorkflow({ name: "bad", steps: [] }, {}, { logger: quiet }); }
    catch (e) { threw = e; }
    assert.ok(threw, "expected a throw on empty steps");
    assert.match(String(threw.message), /non-empty steps/i);

    // makeWorkflows -> the registry; an unknown name is simply absent.
    const reg = makeWorkflows(WORKFLOWS);
    assert.strictEqual(typeof reg.research_and_draft, "function");
    assert.strictEqual(reg.does_not_exist, undefined);
  });

  // 7. a FAILING step surfaces cleanly: the error names the workflow + step and
  //    carries the partial trace; the failed entry is recorded ok:false.
  await test("a failing step surfaces the workflow + step + trace", async () => {
    const def = {
      name: "breaks",
      steps: [
        { id: "ok-step", run: async () => ({ fine: true }) },
        { id: "boom", run: async () => { throw new Error("kaboom"); }, inputFrom: "ok-step" },
        { id: "never", run: async () => ({ reached: true }) },
      ],
    };
    let threw = null;
    try { await runWorkflow(def, {}, { logger: quiet }); }
    catch (e) { threw = e; }
    assert.ok(threw, "expected a throw");
    assert.strictEqual(threw.workflow, "breaks");
    assert.strictEqual(threw.step, "boom");
    assert.match(String(threw.message), /failed at step 'boom'/);
    assert.ok(Array.isArray(threw.trace), "error carries the trace");
    assert.strictEqual(threw.trace.length, 2, "trace stops at the failing step");
    assert.strictEqual(threw.trace[0].ok, true);
    assert.strictEqual(threw.trace[1].ok, false);
  });

  // 8. inputFrom referencing a non-existent prior step throws a clear error.
  await test("inputFrom to an unknown prior step throws", async () => {
    const def = {
      name: "badref",
      steps: [{ id: "a", run: async () => ({}), inputFrom: "nope" }],
    };
    let threw = null;
    try { await runWorkflow(def, {}, { logger: quiet }); }
    catch (e) { threw = e; }
    assert.ok(threw, "expected a throw");
    assert.match(String(threw.message), /no prior output/i);
  });

  // 9. a tool step with no ctx.tools wired throws a clear, actionable error.
  await test("a tool step without a tools registry throws an actionable error", async () => {
    const def = { name: "needs-tool", steps: [{ id: "t", tool: "github_get_file" }] };
    let threw = null;
    try { await runWorkflow(def, { repo: "x", path: "y" }, { logger: quiet }); }
    catch (e) { threw = e; }
    assert.ok(threw, "expected a throw");
    assert.match(String(threw.message), /no tool 'github_get_file' wired/i);
  });

  // 10. listWorkflows returns discovery metadata for every defined workflow.
  await test("listWorkflows describes every workflow + its steps", () => {
    const list = listWorkflows(WORKFLOWS);
    assert.strictEqual(list.length, Object.keys(WORKFLOWS).length);
    const byName = Object.fromEntries(list.map((w) => [w.name, w]));
    assert.ok(byName.research_and_draft.description);
    assert.strictEqual(byName.research_and_draft.steps.length, 2);
    assert.strictEqual(byName.summarize_repo_file.steps[0].kind, "tool");
    assert.strictEqual(byName.summarize_repo_file.steps[0].target, "github_get_file");
  });

  // 11. makeNodeToolCaller posts an MCP-style envelope + fails clearly when unset.
  await test("makeNodeToolCaller builds a node-tool proxy and fails closed when unset", async () => {
    // unset url -> throws only when called.
    const noUrl = makeNodeToolCaller({ url: "" });
    let threw = null;
    try { await noUrl("github_get_file", {}); } catch (e) { threw = e; }
    assert.ok(threw, "expected a throw with no MCP_NODE_URL");
    assert.match(String(threw.message), /MCP_NODE_URL/);

    // with a fake fetch -> posts { name, arguments } + bearer.
    let seen = null;
    const fakeFetch = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, json: async () => ({ ok: true }) };
    };
    const caller = makeNodeToolCaller({ url: "https://node/mcp", bearer: "tok", fetchImpl: fakeFetch });
    const r = await caller("github_get_file", { repo: "a/b", path: "x" });
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(seen.url, "https://node/mcp");
    assert.strictEqual(seen.opts.headers.Authorization, "Bearer tok");
    const body = JSON.parse(seen.opts.body);
    assert.strictEqual(body.name, "github_get_file");
    assert.strictEqual(body.arguments.repo, "a/b");
  });

  // 12. examples smoke: each example drives the engine to the documented shape.
  await test("workflows examples match the documented run shape", async () => {
    // a stub node tool + an llm that satisfies both researcher (JSON) + drafter (prose)
    const ctx = {
      ragSearch: fakeRag,
      tools: {
        github_get_file: async (args) => ({ path: args.path, content: "plain file body", encoding: "utf8" }),
      },
      llm: {
        complete: async ({ system }) => {
          if (/research worker/i.test(system)) return JSON.stringify({ summary: "s", citations: [{ chunkId: "chunk-1" }] });
          if (/output grader/i.test(system)) return JSON.stringify({ pass: true, reason: "ok", diff: {} });
          return "a generated draft body";
        },
      },
      logger: quiet,
    };
    for (const ex of examples.EXAMPLES) {
      const out = await runWorkflow(WORKFLOWS[ex.name], ex.input, ctx);
      const { ok, errors } = examples.assertShape(out, ex.name);
      assert.ok(ok, `example '${ex.name}' shape: ${errors.join("; ")}`);
    }
  });

  console.log(`\n${passed} test(s) passed`);
})();
