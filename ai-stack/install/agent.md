# Agent install instructions

You are installing ai-stack: "the brains" — a RAG data plane (Postgres +
pgvector + blob) and an agent plane (Azure Container Apps) that stand up into one
capped Azure resource group, on top of a running mcp-node. Drive this to done.
Check the machine has what it needs, handle the logins, ask the user only for
inputs you cannot safely infer, run it all, then print the connect config and
wire it into the node.

## 0. Requires a running mcp-node first

ai-stack is Project 2 — the brains the node uses. The user must already have a
deployed **mcp-node** (Project 1). If they do not, send them to
https://github.com/zacha0dev/zallen-dev/blob/main/mcp-node/install/agent.md and
stop. You will need the node's resource group, function-app name, and Key Vault
name at the end (step 8) to wire the two together.

## 1. Prerequisites - check, install what is missing, then log in

Check each tool; if it is missing, install it (use the platform's package
manager: `brew` on macOS, `apt`/`dnf` on Linux, `winget` on Windows), then
re-check. Do not continue past a tool you could not get working; tell the user
the one command they need and stop.

- **Azure CLI** (`az`): `az version`. If missing, install it
  (macOS `brew install azure-cli`; Windows `winget install Microsoft.AzureCLI`;
  Linux per https://learn.microsoft.com/cli/azure/install-azure-cli).
- **Node.js 20+ and npm**: `node -v` (need >= 20).
- **psql** (PostgreSQL client): `psql --version`. Used to apply the schema. On
  macOS `brew install libpq`; Debian/Ubuntu `apt-get install postgresql-client`;
  Windows `winget install PostgreSQL.PostgreSQL`.
- **openssl**: `openssl version` (mints the secrets). Usually present.
- **jq**: `jq --version` (parses deploy outputs).
- **Docker is NOT needed.** The container image is built server-side by
  `az acr build` in the stack's Azure Container Registry.

Then handle Azure login:
- Run `az account show`. If it errors, run `az login`.
- If the user has more than one subscription, list them
  (`az account list -o table`) and confirm which one to use; set it with
  `az account set --subscription <id>`.

Confirm you can read `ai-stack/infra/stack.bicep` and `ai-stack/scripts/`. If
not, clone https://github.com/zacha0dev/zallen-dev and cd into it.

## 2. Collect inputs

Ask the user for, with these defaults if they do not care:
- stack name (default `aistack`, 3-12 lowercase chars)
- region (default `eastus`)
- resource group (default `rg-<stackName>`)
- monthly cap USD (default 25 — higher than the node because Postgres has an
  hourly floor)
- alert email (required; where budget alerts go)
- embedding provider (default `openai`; or `azure` | `cohere`) + its API key
- LLM provider (default `anthropic`; or `openai`) + its API key (optional — RAG
  search works without it; the reasoner agent needs it)

Echo the set back in one line before creating anything. **Never print the API
keys or generated secrets back to the user mid-run.**

## 3. The one-shot path: run the deploy script

Everything below (RG, bicep, ACR image build, key seeding, schema apply, node
wiring) is scripted. Prefer running the script and reading its output:

```
ALERT_EMAIL=<email> EMBEDDING_API_KEY=<key> [LLM_API_KEY=<key>] \
  STACK_NAME=<name> REGION=<region> CAP_USD=<cap> \
  EMBEDDING_PROVIDER=<openai|azure|cohere> LLM_PROVIDER=<anthropic|openai> \
  NODE_RG=<node rg> NODE_FUNC=<node func app> NODE_KV=<node key vault> \
  ai-stack/scripts/deploy.sh
```
On Windows use `ai-stack/scripts/deploy.ps1` with the same names as `$env:`
variables. If `NODE_RG`/`NODE_FUNC`/`NODE_KV` are supplied, the script wires the
node automatically; otherwise it prints the exact commands to run (step 8).

If you would rather drive it step by step (or a step failed), do steps 4-8.

## 4. Deploy the infrastructure

Get the installer's object id (needed so the deploy can grant Key Vault data
access — on an RBAC vault, subscription Owner does NOT include secret access):
```
INSTALLER_OID=$(az ad signed-in-user show --query id -o tsv)
```
Mint the Postgres password and the RAG bearer token (`openssl rand -hex 24` /
`-hex 32`), then deploy with budgetStartDate = first of this month (YYYY-MM-01):
```
az deployment group create -g <rg> -f ai-stack/infra/stack.bicep \
  -p stackName=<name> monthlyCapUsd=<cap> alertEmail=<email> \
     budgetStartDate=<YYYY-MM-01> installerObjectId=$INSTALLER_OID \
     installerPrincipalType=User pgAdminPassword=<pw> ragBearerToken=<bearer> \
     embeddingProvider=<provider> llmProvider=<provider> \
     modelReasoner=<model> modelChecker=<model> mcpNodeUrl=<node /mcp url>
```
Capture outputs: `acrName`, `keyVaultName`, `postgresHost`, `ragServiceUrl`,
`toolsManifestUrl`. This creates the data plane, the agent apps, Key Vault, a
Basic Azure Container Registry, and the budget cap. The first deploy uses a
placeholder app image (the ACR has nothing in it yet).

## 5. Build the container image into the ACR

`az acr build` builds + pushes server-side, so no local Docker:
```
az acr build --registry <acrName> --image ai-stack-rag:<tag> \
  --file ai-stack/src/Dockerfile ai-stack/src
```
Then re-run the same `az deployment group create` from step 4 adding
`ragImage=<acrName>.azurecr.io/ai-stack-rag:<tag>` and
`agentImage=<same ref>` so the container apps pull the real image.

## 6. Seed the API keys

Write the embedding key to Key Vault under the per-provider secret name
(`openai-api-key` | `azure-openai-api-key` | `cohere-api-key`), and the LLM key
under `anthropic-api-key` | `openai-api-key`. The role assignment from step 4 can
take a minute to propagate, so if `az keyvault secret set` returns Forbidden,
wait ~10s and retry (up to a minute) before treating it as a real failure.

## 7. Apply the database schema

Open Postgres to your IP (`az postgres flexible-server firewall-rule create`),
then apply the schema with the admin password from step 4:
```
PGPASSWORD=<pw> psql "host=<postgresHost> dbname=rag user=pgadmin sslmode=require" \
  -v ON_ERROR_STOP=1 -f ai-stack/src/db/schema.sql
```
This enables pgvector and creates `rag_chunks` (the hybrid-search store) and
`reasoner_jobs` (the agent queue). It is idempotent — safe to re-run.

## 8. Wire the node and print the connect config

GET `<ragServiceUrl>/health` to confirm the service responds. Then point the
mcp-node at the stack so its `rag_search` tool works:
```
az functionapp config appsettings set -g <NODE_RG> -n <NODE_FUNC> \
  --settings "AI_STACK_URL=<ragServiceUrl>" "AI_STACK_TOOLS_URL=<toolsManifestUrl>"
az keyvault secret set --vault-name <NODE_KV> --name rag-bearer-token --value <bearer>
```
Print to the user: the resource group, the monthly cap + alert email, the RAG
service URL + tools URL, and confirmation the node is wired. Do not print the
Postgres password or API keys.

Rules: deploy only into the one resource group you create; do not raise the cap
without asking; never print secrets; on any failure, stop and show the real
error.
