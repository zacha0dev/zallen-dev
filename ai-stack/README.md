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

## Version

v0.1 (foundation; agent images and ingest path are being built out)
