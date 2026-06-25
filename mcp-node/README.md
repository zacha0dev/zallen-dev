# mcp-node

A single-tenant, self-managing MCP node: one Azure resource group running an MCP
server an AI connects to, with the tools for that AI to operate the node's own
cloud and code. Scoped to one resource group, capped at about $10/month, scaled
to zero when idle.

## Install

Prereq: `az login` (Azure CLI logged in to the subscription you want).

Paste this one line into an agentic CLI (Claude Code, Codex, Copilot, Gemini):

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

The agent reads the instructions, asks only for what it needs (node name,
region, cost cap, alert email), deploys the whole thing, and prints your connect
config. Run it again with a different node name to stand up another node.

Prefer no agent? `scripts/deploy.sh` (bash) or `scripts/deploy.ps1` (PowerShell)
run the same steps directly.

## What it does

An AI client (Claude, ChatGPT, any MCP client) connects over OAuth and can:

- deploy and update the node itself
- read its own status and spend
- manage its resource group (Azure) and its repo (GitHub)
- stand up new nodes, each with its own cost cap

## Architecture

- **Function App** (Consumption, scale-to-zero) - the MCP server. Serves the
  OAuth endpoints (`/authorize`, `/token`) and the MCP tool endpoint (`/mcp`).
- **Tools**
  - Azure: resources, spend (via managed identity, scoped to this RG)
  - GitHub: read, commit, dispatch deploy (so the node updates itself)
  - self: node status, knowledge (kb)
- **Key Vault** - OAuth client id/secret, bearer token, secrets.
- **Managed Identity** - scoped to this resource group only.
- **Cost guard** - per-RG monthly budget (default ~$10) with 50/80/100% +
  forecast alerts. App Insights for logs and metrics.

## Layout

```
mcp-node/
  infra/node.bicep        one resource group: Function App + KV + identity + budget
  src/                    the MCP server (Azure Functions, Node 20)
    index.js              entry point
    host.json             routePrefix "" so /authorize /token /mcp serve directly
    functions/oauth.js    /authorize + /token + discovery
    functions/mcp.js      /mcp JSON-RPC endpoint (initialize, tools/list, tools/call)
    lib/secrets.js        Key Vault access via managed identity
    tools/                self, azure, github tool modules + registry
    kb/                   baked-in knowledge pack (kb_search reads this)
  install/agent.md        the instructions the install line points the agent to
  install/one-shot.md     the same steps as a walkthrough you can read
  scripts/deploy.sh       deterministic installer (bash)
  scripts/deploy.ps1      deterministic installer (PowerShell)
  deploy/deploy.yml       self-deploy workflow template
```

## Connect

- **Claude** (claude.ai connector): OAuth client id + client secret.
- **ChatGPT** (custom MCP connector): server URL, authorize URL, token URL,
  client id, client secret, scopes.
- **CLI** (Claude Code / Codex): MCP URL + bearer token.

## Cost

One resource group, one budget. Default ~$10/month, set via `monthlyCapUsd`.
Alerts at 50/80/100% plus a forecast alert. Scale-to-zero means an idle node
costs next to nothing.

## Version

v1.0
