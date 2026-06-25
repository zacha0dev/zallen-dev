[← zallen-dev](../README.md)

# mcp-node

An open, single-tenant MCP node: stand one up and let an AI deploy and explore
freely in your own Azure, safely. One resource group, capped at ~$10/month,
scaled to zero when idle. Each node is the same base, and a node can stamp the
next.

## Install

**1.** Get an Azure account and an agent CLI (Claude Code, Codex, Copilot,
Gemini): [Prereqs](install/prereqs.md).

**2.** Paste this into your agent CLI:

```
Install mcp-node: read and follow https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md
```

**3.** Answer the few questions. It installs the rest, logs into Azure, deploys,
and prints your connect config.

No agent CLI? Run `scripts/deploy.sh` (or `scripts/deploy.ps1`) instead.

## What it does

A connected AI (Claude, ChatGPT, any MCP client) can:

- **deploy infra in one shot** - "deploy a small VM" and it does, cleanly named
  and tagged
- **add its own tools / 3rd-party connectors** - wrap an API as a tool; a GitHub
  Action redeploys the node with it
- read its status and spend, manage its resource group and repo
- update itself, and stamp more capped nodes

Day one is the floor, not the ceiling.

## Connect

After install you get a connect block. Step-by-step per client (Claude / ChatGPT
/ CLI): [Connecting a client](docs/connect.md).

## Docs

[How it works](docs/) - concepts, architecture, auth, the server, tools,
infrastructure, cost, scaling, extending.

## Version

v1.0
