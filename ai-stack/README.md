[← zallen-dev](../README.md)

# ai-stack

Project 2. The brains and the agents, stacked on top of [mcp-node](../mcp-node).

ai-stack adds the service side: a RAG data plane (Postgres + pgvector) and a set
of agents on Azure Container Apps, all in one capped resource group. It requires
a running mcp-node (Project 1) as the control plane - the node is what you talk
to; ai-stack is the brains it uses.

## Requires

A deployed mcp-node. Stand that up first (see [../mcp-node](../mcp-node)).

## Install

First, a one-time check: [install/prereqs.md](./install/prereqs.md) (an Azure
account, a running mcp-node, and an agent CLI).

Then paste this into an agent CLI (Claude Code, Codex, Copilot, Gemini):

```
Install ai-stack: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/ai-stack/install/agent.md
```

The agent checks prerequisites, deploys the resource group + data plane + agents,
builds the container image server-side (`az acr build` — no local Docker), seeds
the API keys, applies the database schema, and wires the mcp-node. No agent CLI?
Run the script directly:

```
# macOS / Linux
ALERT_EMAIL=you@example.com EMBEDDING_API_KEY=sk-... scripts/deploy.sh

# Windows (PowerShell)
$env:ALERT_EMAIL="you@example.com"; $env:EMBEDDING_API_KEY="sk-..."; scripts/deploy.ps1
```

Set `NODE_RG` / `NODE_FUNC` / `NODE_KV` (the mcp-node's resource group, function
app, and Key Vault) to wire the node automatically; otherwise the script prints
the exact wiring commands at the end.

## What it deploys

**Data plane (RAG):**
- **Postgres + pgvector** - documents, metadata, and vectors in one database.
- **Blob storage** - the raw documents and data sources.
- **Ingest + embed** - the path that fills the vector store from the data sources.

**Agent plane (Azure Container Apps):**
- **Reasoner (the orchestrator)** - grounds in the RAG store, dispatches to an
  agent or a workflow, and gates every result before returning. Async-job:
  `reasoner_run` / `reasoner_status`.
- **Trainer** - the batch sibling that enriches a batch of training-context
  nodes across the same 10 graded dimensions (the x10 enrichment framework).
  Async-job: `trainer_run` / `trainer_status`.
- **Role agents** - single-call workers, shipped as the copy-me templates:
  **researcher** (`researcher_run`, grounded + cited) and **drafter**
  (`drafter_run`, formatted generation).
- **Workflows** - named, ordered chains that compose the workers (and, in the
  combined pattern, a node tool): `workflow_run` / `workflow_list`.

Plus Key Vault, a managed identity scoped to the resource group, Application
Insights, a Basic Azure Container Registry (the image store `az acr build` builds
the container into), and a monthly cost cap.

## How it stacks

mcp-node is the control plane an AI connects to. ai-stack registers with it: the
node gains tools to query the RAG store and to talk to the agents, so from the
same connector you can ask questions grounded in your data and hand work to the
agents.

## Cost

One resource group, one budget (default ~$25). Container Apps scale to zero, but
two line items have a standing floor: Postgres Flexible (smallest Burstable tier,
~$13/mo — it does not scale to zero like Functions) and the Basic Azure Container
Registry that holds the container image (~$5/mo, a flat Basic-tier fee). Both sit
under the default cap. Raise `monthlyCapUsd` deliberately if you scale up.

The reasoner loop is bounded by `maxIterations` (default 3): at most 3 produce
calls (model: `MODEL_REASONER`) plus a cheap grade each (`MODEL_CHECKER`,
Haiku-class) — and the grade only runs after the free deterministic gates pass.
Swap models or lower the ceiling without a code change via those env knobs (plus
`REASONER_MAX_ITERATIONS`). See the cost & safety model in the docs.

## Docs

- **[docs/architecture.md](./docs/architecture.md)** — how the two-project system
  works: the reasoner → agents → output loop, async-persist, the RAG plane, the
  manifest-registration seam, and the cost/safety model.
- **[docs/extending.md](./docs/extending.md)** — the repeatable "add your own
  agent" guide: the SPEC + runner pattern, manifest auto-discovery, and the
  build-test discipline (bicep build + `node --check` + mocked unit tests, no
  live deploy).

## Version

v0.5 (RAG plane, the reasoner orchestrator loop with async-persist, the trainer
x10 enrichment batch, the researcher + drafter role agents, the workflow set
including the combined project-1+2 pattern, and the manifest-registration seam)

---

[zallen.dev](https://zallen.dev/) · [github.com/zacha0dev](https://github.com/zacha0dev)
