# mcp-node

A single-tenant, self-managing MCP node: one Azure resource group running an MCP
server an AI connects to, with the tools for that AI to operate the node's own
cloud and code. Scoped to one resource group, capped at about $10/month, scaled
to zero when idle.

## What it does

An AI client (Claude, ChatGPT, any MCP client) connects over OAuth and can:

- deploy and update the node itself
- read its own logs and status
- manage its resource group (Azure) and its repo (GitHub)
- stand up new nodes, each with its own cost cap

## Architecture

- **Function App** (Consumption, scale-to-zero) - the MCP server. Serves the
  OAuth endpoints (`/authorize`, `/token`) and the MCP tool endpoint (`/mcp`).
- **Tools**
  - Azure: deploy, resource-group create, app settings, spend
  - GitHub: read, commit, PR, dispatch deploy
  - self: logs, status, knowledge (kb)
- **Key Vault** - OAuth client id/secret, bearer token, secrets.
- **Managed Identity** - scoped to this resource group only.
- **Cost guard** - per-RG monthly budget (default ~$10) with 50/80/100% + forecast
  alerts and a throttle at 100%. App Insights for logs and metrics.

## Deploy

1. Run the setup script: provisions the resource group, the Function App, the Key
   Vault, the managed identity, and the budget cap.
2. Connect your AI client (see Connect).

## Connect

- **Claude** (claude.ai connector): OAuth client id + client secret.
- **ChatGPT** (custom MCP connector): server URL, authorize URL, token URL, client
  id, client secret, scopes.

## Cost

One resource group, one budget. Default ~$10/month, set via `amountUsd`. Alerts at
50/80/100% plus a forecast alert; a scheduled guard throttles the node at 100%.
Scale-to-zero means an idle node costs next to nothing.

## Version

v1.0
