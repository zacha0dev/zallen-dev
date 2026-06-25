# Agent install instructions

You are installing mcp-node: a single-tenant, self-managing MCP server that
lives in one Azure resource group, capped at about $10/month, scaled to zero
when idle. Drive this to done. Check the machine has what it needs, handle the
logins, ask the user only for inputs you cannot safely infer, then run it all
and print the connect config at the end.

## 0. Prerequisites - check, install what is missing, then log in

Check each tool; if it is missing, install it (use the platform's package
manager: `brew` on macOS, `apt`/`dnf` on Linux, `winget` on Windows), then
re-check. Do not continue past a tool you could not get working; tell the user
the one command they need to run and stop.

- **Azure CLI** (`az`): `az version`. If missing, install it
  (macOS `brew install azure-cli`; Windows `winget install Microsoft.AzureCLI`;
  Linux per https://learn.microsoft.com/cli/azure/install-azure-cli).
- **Node.js 20+ and npm**: `node -v` (need >= 20). If missing, install Node 20.
- **Azure Functions Core Tools** (`func`): `func --version` (need v4). If
  missing: `npm i -g azure-functions-core-tools@4 --unsafe-perm true`.
- **openssl**: `openssl version` (used to generate the OAuth secrets). Usually
  present; install if missing.
- **git**: needed only if you must clone this repo. `git --version`.
- **GitHub CLI** (`gh`): optional, only if the user wants the node's GitHub
  self-manage tools (see step 6b). `gh --version`.

Then handle Azure login:
- Run `az account show`. If it errors, run `az login` and let the user complete
  it in the browser.
- If the user has more than one subscription, list them
  (`az account list -o table`) and confirm which one to use; set it with
  `az account set --subscription <id>`.

Confirm you can read `mcp-node/infra/node.bicep`. If not, clone
https://github.com/zacha0dev/zallen-dev and cd into it.

## 1. Collect inputs

Ask the user for, with these defaults if they do not care:
- node name (default mcpnode, 3-12 lowercase chars)
- region (default eastus)
- resource group (default rg-<nodeName>)
- monthly cap USD (default 10)
- alert email (required; where budget alerts go)

Echo the set back in one line before creating anything.

## 2. Create the resource group

`az group create -n <rg> -l <region>`

## 3. Deploy the infrastructure

Get the installer's object id (needed so the deploy can grant Key Vault data
access; on an RBAC vault, subscription Owner does NOT include secret access -
this is the reader-role wall):
```
INSTALLER_OID=$(az ad signed-in-user show --query id -o tsv)
```
Then deploy with budgetStartDate = first of this month (YYYY-MM-01):
```
az deployment group create -g <rg> -f mcp-node/infra/node.bicep \
  -p nodeName=<nodeName> monthlyCapUsd=<cap> alertEmail=<email> \
     budgetStartDate=<YYYY-MM-01> \
     installerObjectId=$INSTALLER_OID installerPrincipalType=User
```
Capture outputs: functionAppName, keyVaultName, functionHostName. This grants
the node's identity Contributor on this resource group only, and grants both the
node and the installer Key Vault Secrets Officer (read + rotate) on the vault.

## 4. Seed the OAuth secrets

Generate three random values (`openssl rand -hex 32`) and write them to the
node's Key Vault as `oauth-client-id`, `oauth-client-secret`,
`mcp-bearer-token`. Do not print them yet. The role assignment from step 3 can
take a minute to propagate, so if `az keyvault secret set` returns Forbidden,
wait ~10s and retry (up to a minute) before treating it as a real failure.

## 5. Deploy the server code

From `mcp-node/src`: `npm ci`, `npm run build --if-present`, then
`func azure functionapp publish <functionAppName>`. If publish fails, show the
real error and stop; do not fake success.

## 6. (Optional) GitHub self-manage

If the user wants the node to manage its own repo (read/commit/dispatch deploy),
get a GitHub token (the user can paste a fine-grained PAT, or run
`gh auth token` if `gh` is logged in) and write it to the node's Key Vault as
`github-token`. Skip this if they do not want the GitHub tools yet; the rest of
the node works without it.

## 7. Verify and print the connect config

GET `https://<functionHostName>/mcp` to confirm it responds. Read the three
secrets back and print:
- Node URL: `https://<host>` with `/authorize`, `/token`, `/mcp`
- Claude (claude.ai connector): client id + client secret
- ChatGPT (custom MCP connector): server URL + authorize URL + token URL +
  client id + client secret + scopes=mcp
- CLI (Claude Code / Codex): mcp URL + bearer

## 8. Report

Tell the user the resource group, the monthly cap, and where budget alerts go.

Rules: deploy only into the one resource group you create; do not raise the cap
without asking; on any failure, stop and show the real error.
