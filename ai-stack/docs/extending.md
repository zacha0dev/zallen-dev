[← ai-stack](../README.md)

# Extending ai-stack — add your own agent

This is the repeatable pattern. ai-stack is built so you add capability by
**following a shape**, not by rewiring the system. An agent you add the right way
is bounded, self-checking, async-persisted, and auto-discovered by the control
plane — for free.

Everything here is plain JavaScript (CommonJS), matches the existing files, and
is **build-tested without a live deploy** (see the last section).

## The pattern in one sentence

> A new agent is a **SPEC** (data: who it is, how hard it may try, what a valid
> result looks like, what it costs) plus a **runner** (a function that drives the
> bounded loop), exposed in the **manifest** so the node auto-discovers it.

## Step 1 — write the SPEC

Create `src/agents/<name>.spec.js`. Copy `reasoner.spec.js` and change the data.
A SPEC is declarative; it carries no logic:

```js
const MYAGENT_SPEC = {
  name: "myagent_run",            // stable, snake_case; what the manifest advertises
  role: "One sentence: what this agent does.",
  maxIterations: 3,                // the hard loop ceiling (cost + safety cap)
  modelEnv: "MODEL_MYAGENT",       // the I-COST-1 knob: swap the model via env
  defaultModel: "claude-sonnet-4-5",
  outputSchema: {                  // what a valid result looks like
    type: "object",
    required: ["answer"],
    properties: { answer: { type: "string" } },
  },
  requireCitations: false,         // set true to force grounded, cited output
  costClass: "moderate",           // free | cheap | moderate | expensive
  inputSchema: {                   // what the agent accepts (advertised too)
    type: "object",
    properties: { task: { type: "string" } },
    required: ["task"],
  },
};
```

Why a SPEC and not just code: the limits (`maxIterations`), the contract
(`outputSchema`), and the cost (`costClass`) are **data the rest of the system
reads** — the runner enforces them, the output-checker gates on them, the
manifest advertises them. Keep them declarative and they stay honest.

## Step 2 — write the runner

Create `src/agents/<name>.runner.js`, exporting `run(task, ctx)`. The runner
drives the bounded loop. The cheapest way is to copy `reasoner.runner.js` and
change the **produce** step; the survey → gate → retry → DLQ scaffolding stays.

`ctx` is the **injection seam** — everything the runner touches comes in through
it, so the runner is unit-testable with fakes:

```js
ctx = {
  llm,        // llm.complete({ system, prompt, model, maxTokens }) -> string
  ragSearch,  // ({ query, topK }) -> { hits: [{ id, content, score }] }
  db,         // the jobs persistence handle (markRunning/markDone/...)
  logger,     // anything with .log (defaults to console)
}
```

The loop shape every agent shares:

```
survey  → ctx.ragSearch(task)         (grounding evidence)
dispatch→ pick a tool / sub-agent / linked workflow   ← your seam
produce → ctx.llm.complete(...)        (the model call)
gate    → check(task, output, opts, ctx)  ← the shared output-checker
pass    → return { status:'done', result, iterations, attempts }
fail    → feed verdict.structuredDiff back as the next correction
ceiling → throw an error with err.dlq = true   (the jobs layer records DLQ)
```

**Always gate through `output-checker.check()`.** Do not hand-roll quality
checks — you get the deterministic-first / cheap-grade discipline for free, and
the trainer (Phase 3) understands the same verdict shape.

## Step 3 — expose it in the manifest

Add one entry to `src/agents/manifest.js`:

```js
{
  name: MYAGENT_SPEC.name,
  description: MYAGENT_SPEC.role,
  inputSchema: MYAGENT_SPEC.inputSchema,
  costClass: MYAGENT_SPEC.costClass,
  route: { method: "POST", path: "/agents/myagent", async: true },
}
```

…and add the matching route to `src/server.js` (copy the `/agents/reasoner`
block: create a job, `runDetached`, return `202 { job_id }`). For a synchronous
tool, return the result directly instead.

That is the whole registration. The node's `tools/dynamic.js` fetches
`GET /mcp/tools` on its next refresh (≤5 min) and registers your agent as a proxy
tool. **No node redeploy** — the control plane discovers it.

## Step 4 — add a tool or connection (optional)

- **A new RAG-style data source / external connection:** read its key from Key
  Vault via `lib/secrets.js` (`getSecret('<your-secret>')`) — never hard-code a
  credential. Seed the secret into the vault at install time.
- **A new model provider:** add it to `agents/llm.js`'s `PROVIDERS` map (key
  secret name + a `complete*` function). Match the existing fetch-only pattern;
  add no SDK.
- **A new env knob:** add the param to `infra/stack.bicep`, thread it into
  `agentLlmEnv` (or the app's `env`), and document it as an I-COST-1 knob if it
  affects spend.

## Step 5 — keep it bounded and cheap

Every agent you add inherits the safety model **only if you keep the shape**:

- a hard `maxIterations` in the SPEC (an env override may lower it, never raise);
- gate through the output-checker (deterministic-first, cheap-grade);
- one expensive model call per iteration, capped by `maxIterations`;
- expose a `MODEL_<NAME>` env knob so the tier is swappable without code;
- declare a `costClass` so callers and budgets can reason about it.

## Variant — a batch / training-style agent (how the trainer differs)

The reasoner answers ONE task; the **trainer** (Phase 3) enriches a BATCH of
nodes. If your agent is batch-shaped, the SPEC + runner + manifest + gate pattern
is identical — only four things change, and the trainer is the worked example:

1. **The SPEC carries a batch ceiling, not just a per-item one.** Alongside
   `maxAttemptsPerNode` (the per-item loop cap), add `maxBatchNodes` (the per-run
   cost ceiling) and a `resolveMaxBatchNodes()` env knob (`MAX_BATCH_NODES`),
   hard-capped so env can only lower it. See `trainer.spec.js`.
2. **`run(items, ctx)` loops over the batch and never throws on one bad item.**
   Each item gets its own bounded attempt loop; a failed item is marked `failed`
   and the batch continues. Return a `{ result: { items, summary }, iterations }`
   shape so it still plugs into the async-persist job layer.
3. **Per-item persistence is a second table.** Beyond the job envelope, write ONE
   ROW PER ITEM (the trainer's `enrichment_tracker`, upserted via `ctx.db`) so
   item-level results are queryable without unpacking the job blob.
4. **Async-persist is a parallel path, not a rewrite.** Copy `jobs.js` to
   `<name>-jobs.js` against your own tables rather than generalizing the shared
   `jobs.js`/`reasoner_jobs` — the low-risk choice. (Collapse to one generic
   `agent_jobs` table later if it earns its keep.)

Everything else — the SPEC, gating through the shared `output-checker`, the
manifest entry, the `MODEL_<NAME>` knob, the build-test discipline below — is the
same. The trainer also ships two **kickstart artifacts** worth copying for any
training-style agent: a starter matrix (`trainer-matrix.spec.js`, the example
input set a deployer edits) and a checker calibration set
(`checker-calibration.js`, known-good/known-bad cases to trust the gate before
relying on its grades).

## Variant — a single-call ROLE agent (RESEARCHER / DRAFTER, the copy-me templates)

The reasoner LOOPS and the trainer BATCHES; the two Phase-4 **role agents** are
the simplest shape — a **single-call WORKER**. They are the GENERALIZED templates
to copy when you want "an agent that does one job well": **RESEARCHER**
(`researcher.spec.js` + `researcher.runner.js`) and **DRAFTER** (`drafter.spec.js`
+ `drafter.runner.js`). Same SPEC + runner + ctx pattern; only the differences:

1. **One call, no loop.** `run(input, ctx)` does survey→synthesize (researcher) or
   just generate (drafter) and returns `{ status:"done", result, ... }`. There is
   no produce→gate→retry loop, so there is no `maxIterations`. A worker either
   answers or fails fast.
2. **A SYNC route, not an async job.** In the manifest the entry has **no**
   `route.async` and **no** status tool; in `server.js` the handler runs the
   runner inline and `send(res, 200, out)` — the node's `dynamic.js` proxy returns
   the body directly. (Copy the `/agents/researcher` handler, not the
   `/agents/reasoner` 202 block.)
3. **Two kickstart artifacts per role.** Ship `<name>.spec.js` (the editable
   identity) **and** `<name>.examples.js` (sample input → expected-shape pairs).
   The examples double as the SMOKE FIXTURE the unit test drives the runner with —
   so the examples are exercised, not just documented (`assertShape` is the tiny
   dependency-free shape checker each examples file exports).
4. **Pick your tools via ctx.** RESEARCHER wires `ctx.ragSearch` (it grounds in
   the store and `groundCitations` drops any citation not in the surveyed hits —
   the anti-fabrication guard you copy if your role cites). DRAFTER wires only
   `ctx.llm` (pure generation, no tools). The `MODEL_<NAME>` env knob + a depth/
   format flag are how the tier is swapped without code.

### Wiring a role into the reasoner's dispatch

Roles are also reachable FROM the reasoner. `agents/dispatch.js` is the registry:
add your role to `DEFAULT_ROLES` as `{ run, spec }` and the reasoner can hand off
to it when a task carries `dispatch: "<yourrole>"` (the reasoner gates the
dispatched result against your role's `outputSchema`). A "linked workflow" is the
same shape under `ctx.workflows` with a `dispatch: "workflow:<name>"` directive —
the seam Phase 5's workflow set fills in. With no `dispatch` field the reasoner
produces directly, so adding a role never changes the default path.

## Build-test discipline (no live deploy)

You validate an agent **without deploying** anything. Three checks:

1. **Bicep compiles** (if you touched infra):
   ```
   bicep build ai-stack/infra/stack.bicep
   ```
   Exit 0 = the resource group still templates cleanly.

2. **Syntax check every file you touched:**
   ```
   node --check ai-stack/src/agents/<name>.spec.js
   node --check ai-stack/src/agents/<name>.runner.js
   node --check ai-stack/src/server.js
   ```

3. **Mocked unit tests** — drive the runner with a fake `llm` and `ragSearch`
   through `ctx`, no network, no DB, no real model. Copy
   `agents/reasoner.runner.test.js` (plain-node `assert`, no test framework) and
   assert the four behaviours every agent should have:
   - passes on a first valid output,
   - retries with the `structuredDiff` then passes,
   - dead-letters after `maxIterations`,
   - honors a graded fail after the deterministic gates pass.
   ```
   node ai-stack/src/agents/<name>.runner.test.js
   ```

When all three are green, the agent is correct by construction. Deploy is a
separate, deliberate step — building and extending never requires it.

---

[zallen.dev](https://zallen.dev/) · [github.com/zacha0dev](https://github.com/zacha0dev)
