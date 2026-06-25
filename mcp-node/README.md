# mcp-node

A single-tenant, self-managing MCP node: one Azure resource group running an MCP
server an AI connects to, with the tools for that AI to operate the node's own
cloud and code. Scoped to one resource group, capped at about $10/month, scaled
to zero when idle.

## Install

You do not run an installer by hand. You paste one prompt into an agentic CLI
and it deploys the whole thing, then prints your connect config.

Works in any agent CLI that runs shell commands: Claude Code (`claude`), OpenAI
Codex (`codex`), GitHub Copilot (`copilot`), Gemini (`gemini`).

First, two prereqs on the machine the agent runs on:

1. `az login` (Azure CLI logged in to the subscription you want).
2. This repo available locally, or let the agent clone it.

Then copy this whole block and paste it into your agent CLI:

```
Install "mcp-node" from https://github.com/zacha0dev/zallen-dev (folder
mcp-node). It is a single-tenant, self-managing MCP server that lives in one
Azure resource group, capped at about $10/month, scaled to zero when idle.
Drive this to done; ask me only for inputs you cannot safely infer, then run it
all and print the connect config at the end.

1. Confirm `az account show` works (I am logged in to the right subscription).
   Confirm you can read mcp-node/infra/node.bicep here; if not, clone the repo
   above and cd in.
2. Ask me for: node name (default mcpnode, 3-12 lowercase chars), region
   (default eastus), resource group (default rg-<nodeName>), monthly cap USD
   (default 10), and alert email (required). Echo the set back in one line.
3. az group create -n <rg> -l <region>
4. Deploy with budgetStartDate = first of this month (YYYY-MM-01):
   az deployment group create -g <rg> -f mcp-node/infra/node.bicep \
     -p nodeName=<nodeName> monthlyCapUsd=<cap> alertEmail=<email> \
        budgetStartDate=<YYYY-MM-01>
   Capture outputs: functionAppName, keyVaultName, functionHostName.
5. Generate three random values (openssl rand -hex 32) and write them to the
   node's Key Vault as oauth-client-id, oauth-client-secret, mcp-bearer-token.
   Do not print them yet.
6. From mcp-node/src: npm ci, npm run build --if-present, then
   func azure functionapp publish <functionAppName>. If publish fails, show me
   the real error and stop.
7. GET https://<functionHostName>/mcp to confirm it responds. Read the three
   secrets back and print the connect block: node URL + /authorize + /token +
   /mcp; Claude (client id + secret); ChatGPT (URL + authorize + token + id +
   secret + scopes=mcp); CLI (mcp URL + bearer).
8. Tell me the resource group, the monthly cap, and where budget alerts go.

Rules: deploy only into the one resource group you create; do not raise the cap
without asking; on any failure, stop and show the real error.
```

That is the install. Same prompt again with a different node name stands up
another node.

Prefer a plain script? `scripts/deploy.sh` (bash) and `scripts/deploy.ps1`
(PowerShell) run the identical steps. The longer walkthrough is in
`install/one-shot.md`.

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
  install/one-shot.md     the install prompt, with the walkthrough
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
