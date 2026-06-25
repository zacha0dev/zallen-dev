# mcp-node

A single-tenant, self-managing MCP node: one Azure resource group running an MCP
server an AI connects to, with the tools for that AI to operate the node's own
cloud and code. Scoped to one resource group, capped at about $10/month, scaled
to zero when idle.

## Install

Paste this one line into an agentic CLI (Claude Code, Codex, Copilot, Gemini):

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

The agent checks your tools (and installs anything missing), runs `az login` if
you are not signed in, asks only for what it needs, deploys it, and prints your
connect config.

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
