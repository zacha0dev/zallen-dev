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

Paste this into an agent CLI (Claude Code, Codex, Copilot, Gemini):

```
Install ai-stack: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/ai-stack/install/agent.md
```

It deploys the resource group, the data plane, and the agents, then prints how to
connect. No agent CLI? Run `scripts/deploy.sh`.

## What it deploys

**Data plane (RAG):**
- **Postgres + pgvector** - documents, metadata, and vectors in one database.
- **Blob storage** - the raw documents and data sources.
- **Ingest + embed** - the path that fills the vector store from the data sources.

**Agent plane (Azure Container Apps):**
- **System app** - the trainer and the manager/orchestrator agent.
- **Agents app** - role-based agents; ships with two examples: a solution-architect
  agent and a delivery/engagement agent.

Plus Key Vault, a managed identity scoped to the resource group, Application
Insights, and a monthly cost cap.

## How it stacks

mcp-node is the control plane an AI connects to. ai-stack registers with it: the
node gains tools to query the RAG store and to talk to the agents, so from the
same connector you can ask questions grounded in your data and hand work to the
agents.

## Cost

One resource group, one budget (default ~$25). Container Apps scale to zero, but
Postgres Flexible has an hourly floor (it does not scale to zero like Functions),
so the cap is set a bit higher than mcp-node's. The default uses the smallest
Burstable Postgres tier; raise `monthlyCapUsd` deliberately if you scale up.

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

v0.2 (RAG plane + the reasoner agent loop, async-persist, and the
manifest-registration seam; agent container images are built out next)

---

[zallen.dev](https://zallen.dev/) · [github.com/zacha0dev](https://github.com/zacha0dev)
