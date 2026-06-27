[← ai-stack](../README.md)

# ai-stack architecture

How the two-project system fits together, and how a request flows from "an AI
asks a question" to "a checked, cited answer."

## The two projects

```
        you / any MCP client (Claude Code, Codex, Copilot, Gemini, claude.ai)
                                  │  (MCP over HTTP, bearer-auth)
                                  ▼
        ┌─────────────────────────────────────────┐
        │  mcp-node   (Project 1 — control plane)  │
        │  Azure Functions. Speaks MCP JSON-RPC.   │
        │  Tools: static (self/azure/github/scale/ │
        │  rag) + DYNAMIC (discovered from         │
        │  ai-stack's manifest).                   │
        └─────────────────────────────────────────┘
                                  │  HTTPS, rag-bearer-token
                                  ▼
        ┌─────────────────────────────────────────┐
        │  ai-stack   (Project 2 — the brains)     │
        │  Azure Container Apps + Postgres/pgvector│
        │                                          │
        │   HTTP surface (server.js):              │
        │     GET  /health                         │
        │     GET  /mcp/tools     ← the manifest   │
        │     POST /rag/ingest                     │
        │     POST /rag/search                     │
        │     POST /agents/reasoner  → 202 job_id  │
        │     GET  /agents/reasoner/status         │
        │     POST /agents/trainer   → 202 job_id  │
        │     GET  /agents/trainer/status          │
        └─────────────────────────────────────────┘
```

- **mcp-node** is the control plane — the thing an AI actually connects to. It is
  thin: auth, the MCP protocol, and a tool registry.
- **ai-stack** is the brains — the RAG data plane and the agents. It does the
  expensive work and owns the data.

The node never holds your data; ai-stack never speaks MCP. They meet at two
seams: the **bearer-authed HTTP calls** (node → ai-stack) and the **tool
manifest** (ai-stack → node, for discovery).

## The RAG plane

A single Postgres Flexible Server with `pgvector`. One table, `rag_chunks`, holds
the content, its metadata, and a 1536-dim embedding, plus a generated `tsvector`
for keyword search. `hybrid_search()` blends the two:

```
score = vector_weight · (1 − cosine_distance) + bm25_weight · ts_rank
```

Ingest chunks text (~400 tokens, 50 overlap), embeds each chunk through a
provider-agnostic adapter (OpenAI / Azure OpenAI / Cohere), and upserts. Search
embeds the query and runs `hybrid_search`. Every search emits one structured log
line — the **evidence gate** — so retrieval is observable.

## The reasoner → output loop

The reasoner is the orchestration brain. It follows the **SPEC + runner** pattern
(see [extending.md](./extending.md)): a declarative `reasoner.spec.js` (role,
`maxIterations`, `outputSchema`, `costClass`) and a `reasoner.runner.js` that
drives a **bounded loop**:

```
  survey   ── ragSearch(task) ─────────► evidence chunks (grounding)
     │
     ▼
  dispatch ── pick a tool / sub-agent / linked workflow ─┐
     │        (this reasoner produces directly; the seam │
     │         is here for richer deployer agents)        │
     ▼                                                    │
  produce  ── one model call ──► { answer, citations }   ◄┘
     │
     ▼
  gate     ── output-checker.check() ──────────────────────────────┐
     │         1. deterministic gates  (free, instant)             │
     │            schema-valid? cited? not refused?                │
     │         2. cheap Haiku grade    (ONLY if 1 passes)          │
     │            does it actually answer the task?                │
     ▼                                                             │
  pass? ──► persist result + return                                │
  fail? ──► feed the structuredDiff back as a correction ──────────┘
            (re-produce, up to maxIterations)
     │
     ▼
  ceiling hit (maxIterations failures) ──► dead-letter (DLQ)
```

### The output-checker (the gate)

`output-checker.js` is a shared library — the reasoner uses it, and the trainer
reuses it **unchanged** (the trainer adds only its own free completeness pre-gate
for the 10-dimension contract). Its discipline: **deterministic gates first, LLM
grade only if they pass.** We never spend a model call grading something a schema already
proves is broken, and we never blindly trust a float — the grader must return a
parseable JSON verdict. On failure it returns a `structuredDiff` describing what
to fix, which the loop feeds into the next attempt.

Return shape (stable): `{ pass, reason, structuredDiff, stage }`.

## The trainer → x10 enrichment loop (Phase 3)

The **trainer** is the batch sibling of the reasoner. Where the reasoner answers
ONE task, the trainer takes a BATCH of training-context **nodes** and enriches
each to a graded standard — the **x10 Multi-Node Enrichment Framework**: treat
every training-context unit as a NODE and enrich each across the **same 10
dimensions**, grading each dimension so the output is a comparable, auditable
training corpus.

The 10 dimensions (the contract, in `trainer.spec.js`):
`factual_accuracy`, `source_cited`, `tone_consistency`, `schema_compliance`,
`edge_case_coverage`, `conciseness`, `actionability`, `ambiguity_removed`,
`cross_node_coherence`, `deployer_fit`.

It follows the **same SPEC + runner pattern** as the reasoner and **reuses the
same `output-checker`** — nothing about the gate is re-implemented:

```
  for each NODE (capped at MAX_BATCH_NODES):              ← the batch cost ceiling
     attempt loop (≤ maxAttemptsPerNode = 2):
        enrich   ── one Sonnet call across the 10 dims ──► { enrichments }
           │
           ▼
        complete?── free, deterministic: one entry per dimension? ──┐ (trainer gate)
           │                                                        │
           ▼                                                        │
        gate    ── output-checker.check() (SHARED) ────────────────┤
           │        deterministic-first, then cheap Haiku grade     │
           ▼                                                        │
        pass? ──► node.status = done, persist                       │
        fail? ──► feed the structuredDiff back, re-enrich ONCE ─────┘
     ceiling ──► node.status = failed   (per-node dead-letter; the BATCH continues)
     persist ──► upsert the node's enrichments + per-dimension grades
                 to the enrichment_tracker (one row per node)
```

Two properties matter:

- **A failed node never sinks the batch.** Each node has its own bounded attempt
  loop; one bad unit is marked `failed` and the run proceeds, so a single
  un-enrichable node can't fail the whole training set.
- **Per-node persistence is independent of the job envelope.** `trainer_jobs`
  holds the batch (status + summary); `enrichment_tracker` holds **one row per
  node** keyed `(run_id, node_id)` with the per-dimension `enrichments` +
  `grades` — so a deployer can query node-level quality without unpacking the job
  blob, and a re-run upserts rather than duplicates.

### Kickstart artifacts (the two the trainer ships)

- **`trainer-matrix.spec.js`** — a `STARTER_MATRIX` of example enrichment nodes a
  deployer edits for their domain, plus `toBatch()` to turn it into the
  `POST /agents/trainer` payload.
- **`checker-calibration.js`** — 5 known-good + 3 known-bad example outputs the
  deployer runs (`node src/agents/checker-calibration.js`) to **trust the
  output-checker before relying on its grades**. It reports per-case
  agree/disagree and exits non-zero on a disagreement, so it doubles as a CI gate.

## Async-persist (sidestepping the timeout)

The loop can take longer than an HTTP request should hold open (LLM calls × up to
`maxIterations`). So `POST /agents/reasoner`:

1. inserts a `pending` row in `reasoner_jobs`,
2. kicks the loop off **detached**, and
3. returns **`202 { job_id }`** immediately.

The detached run flips the row `running` → `done | dlq | error`. The caller polls
`GET /agents/reasoner/status?job_id=` (proxied through the node as
`reasoner_status`). Lifecycle: `pending → running → done | dlq | error`.

The **trainer uses the same async-persist shape** via a parallel path
(`trainer-jobs.js` → `trainer_jobs` + `enrichment_tracker`) rather than
generalizing the reasoner's `jobs.js`/`reasoner_jobs` — the low-risk choice that
leaves the stacked reasoner path untouched. `POST /agents/trainer` → `202
{ job_id }`; `GET /agents/trainer/status` (proxied as `trainer_status`) reads the
batch row back, and the per-node grades live in `enrichment_tracker`. If a future
phase wants ONE generic `agent_jobs` table, both paths collapse into it then.

## The manifest-registration seam

This is what makes the system extensible without redeploying the node.

1. ai-stack declares everything it offers in `agents/manifest.js` as a
   `ToolManifest[]`: `{ name, description, inputSchema, costClass, route }`.
2. ai-stack serves it at `GET /mcp/tools` (unauthenticated discovery metadata —
   no data, no actions).
3. On cold start (and every 5 minutes), the node's `tools/dynamic.js` fetches the
   manifest, caches it, and turns each entry into a **proxy tool** whose handler
   calls the matching ai-stack route over HTTP with the bearer.
4. The node's registry merges these dynamic tools with its static ones (static
   wins on a name clash, so the Phase-1 static `rag_search` always works).

Add an agent to ai-stack's manifest → it appears as a node tool on the next
refresh. **No node redeploy.** If `AI_STACK_TOOLS_URL` is unset, dynamic
discovery is skipped entirely and the static tools still work — graceful
fallback.

## Cost & safety model

- **Bounded everything.** The reasoner can never exceed `maxIterations`
  produce→gate cycles, and the trainer can never exceed `maxAttemptsPerNode`
  per node × `maxBatchNodes` nodes (all hard-capped in the spec; an env override
  can only lower them). A runaway loop is structurally impossible. The trainer
  also runs a **free deterministic gate first** (deterministic schema/refusal +
  its own dimension-completeness check) so a malformed enrich never reaches the
  paid Haiku grade.
- **Cheap-first gating.** Deterministic checks are free; the LLM grade (a
  Haiku-class model) runs only after they pass. The expensive produce model is
  the only costly call, and it is capped by `maxIterations`.
- **The I-COST-1 knobs** (change a model or cut cost with no code change):
  | Knob | What it does |
  |---|---|
  | `MODEL_REASONER` | the reasoner produce-step model tier |
  | `MODEL_TRAINER` | the trainer enrich-step model tier (sonnet-class) |
  | `MODEL_CHECKER` | the grade-step model tier (keep it cheap; shared by both) |
  | `REASONER_MAX_ITERATIONS` | lower the reasoner loop ceiling (cannot raise above the spec cap) |
  | `TRAINER_MAX_ATTEMPTS` | lower the trainer per-node attempt ceiling (cannot raise above the spec cap) |
  | `MAX_BATCH_NODES` | cap the trainer batch size (the per-run cost ceiling) |
  | `LLM_PROVIDER` | `anthropic` \| `openai` |
- **Fail-closed auth.** Every data/agent route is bearer-protected with a
  timing-safe compare; secrets come from Key Vault via managed identity, never
  from the repo or env.
- **One capped resource group.** Container Apps scale to zero; a monthly budget
  with threshold alerts caps spend. Postgres has an hourly floor (it does not
  scale to zero), which is why the cap is set a little higher than mcp-node's.

## Where the pieces live

| File | Role |
|---|---|
| `src/server.js` | HTTP surface: health, manifest, rag, agent routes |
| `src/rag/{ingest,search,embeddings}.js` | the RAG data plane |
| `src/agents/reasoner.spec.js` | the reasoner SPEC (role, limits, schema, cost) |
| `src/agents/reasoner.runner.js` | the bounded reasoner loop |
| `src/agents/trainer.spec.js` | the trainer SPEC (10 dimensions, node shape, limits, cost) |
| `src/agents/trainer.runner.js` | the batch x10 enrich→check→retry loop |
| `src/agents/trainer-jobs.js` | trainer async-persist (`trainer_jobs` + `enrichment_tracker`) |
| `src/agents/trainer-matrix.spec.js` | the starter training matrix (kickstart) |
| `src/agents/checker-calibration.js` | the 5-good/3-bad checker calibration set (kickstart) |
| `src/agents/output-checker.js` | the shared two-stage gate (reasoner + trainer) |
| `src/agents/jobs.js` | async-persist over `reasoner_jobs` |
| `src/agents/manifest.js` | the `ToolManifest[]` served at `/mcp/tools` |
| `src/agents/llm.js` | provider-agnostic chat client (no SDK) |
| `src/db/schema.sql` | `rag_chunks` + `reasoner_jobs` + `trainer_jobs` + `enrichment_tracker` |
| `infra/stack.bicep` | the whole resource group |
| `mcp-node/src/tools/dynamic.js` | node-side manifest discovery + proxy tools |

---

[zallen.dev](https://zallen.dev/) · [github.com/zacha0dev](https://github.com/zacha0dev)
