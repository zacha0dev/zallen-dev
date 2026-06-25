# mcp-node

An open, single-tenant MCP node: stand one up and let an AI explore and deploy
freely in your own Azure, safely. It is one resource group running an MCP server
the AI connects to, with the tools for it to operate that group's cloud and
code. Scoped to the one group, capped at about $10/month, scaled to zero when
idle - so "explore freely" can't run away or touch anything else.

It is also the base things stack on: each node is the same foundation, and a
node can stamp the next one, so deployments build up from here.

## Install

Paste this into an agentic CLI (Claude Code, Codex, Copilot, Gemini):

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

That is the whole install. It installs any missing tools, logs you into Azure,
asks a few questions, deploys, and prints your connect config.

No agent CLI? Run `./scripts/deploy.sh` (or `scripts/deploy.ps1` on Windows)
instead - it does the same thing.

New to this? [Prereqs - do this first](install/prereqs.md) has the one-line
installs for an agent CLI and Azure, with links.

## What it does

It is an open box, not a fixed product. An AI client (Claude, ChatGPT, any MCP
client) connects over OAuth and can:

- **deploy infra in one shot** - "deploy a small VM" and it does, straight into
  your capped Azure sandbox. No template library; you describe it, it deploys it,
  following a clean naming + tagging convention so the group stays human-readable
  and easy to tear down (`src/kb/infra.md`)
- **add your own tools and 3rd-party connectors** - wrap an API as a tool and a
  GitHub Action redeploys the node with it, the same way larger MCP toolsets are
  built up; that is how the box grows on Azure
- read its own status and spend, manage its resource group and its repo
- update and redeploy itself, and stamp more capped nodes

What it does on day one is the floor, not the ceiling - you expand it by using
it.

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

## Scaling

Start with one node. As you take on more projects, the node can stamp more -
each a fresh resource group with its own cost cap. Two ways:

- **Default (safe):** run the install again with a new node name. Each node is
  isolated in its own RG; the node's rights stay scoped to its own box.
- **Self-replicating (opt-in):** run `scripts/enable-scaling.sh` once to grant
  the node's identity subscription-scope rights. Then the connected AI can do it
  from inside the connector via `azure_rg_create`, `azure_budget_set`, and
  `azure_deploy_template` - create a capped RG and deploy a sibling node into it.
  Off until you run it; revoke any time with the command the script prints.

## Extend it

The node is yours to grow. Fork the repo so you own it, then ask the connected AI
to add a tool - it edits the Function App's tool modules and a GitHub Action
builds and pushes the update to your node. Same loop that built it: prompt, build,
deploy, reconnect (with a debug round or two as needed). Tools are small modules
under `src/tools`; the full lifecycle - fork, CI deploy, the update + debug loop,
and adding a tool's API key + custom setup - lives in the node's own context
(`src/kb/extending.md`, `src/kb/operating.md`) so the AI can follow it when you
prompt. Open by design - the base set is just the start.

## Cost

One resource group, one budget. Default ~$10/month, set via `monthlyCapUsd`.
Alerts at 50/80/100% plus a forecast alert. Scale-to-zero means an idle node
costs next to nothing.

## Version

v1.0
