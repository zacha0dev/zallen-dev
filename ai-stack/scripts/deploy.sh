#!/usr/bin/env bash
# deploy.sh - one setup script: check prerequisites, log in, then stand up one
# ai-stack into one resource group, ON TOP OF a running mcp-node. Creates the RG,
# deploys stack.bicep (data plane + agent plane + Key Vault + a Basic ACR +
# budget cap), builds & pushes the RAG container image into that ACR with
# `az acr build` (server-side, so no local Docker), seeds the embedding/LLM key,
# applies schema.sql to the Postgres `rag` DB, and prints the connect block plus
# the exact values to wire into the node. If NODE_RG/NODE_FUNC/NODE_KV are set it
# wires the node automatically; otherwise it prints the commands.
#
# Usage:
#   ALERT_EMAIL=you@example.com EMBEDDING_API_KEY=sk-... ./deploy.sh
#
# Optional env:
#   STACK_NAME (default aistack)   REGION (default eastus)   RG (default rg-<stack>)
#   CAP_USD (default 25)
#   EMBEDDING_PROVIDER (openai|azure|cohere, default openai)
#   LLM_PROVIDER (anthropic|openai, default anthropic)
#   MODEL_REASONER (default claude-sonnet-4-5)  MODEL_CHECKER (default claude-haiku-4-5)
#   EMBEDDING_API_KEY  - seeded to the per-provider KV secret (else you are prompted)
#   LLM_API_KEY        - seeded to the per-provider LLM KV secret (optional; the
#                        reasoner needs it, RAG search does not)
#   MCP_NODE_URL       - the node's /mcp URL recorded on the stack for registration
#   NODE_RG / NODE_FUNC / NODE_KV - if all set, the node is wired automatically
set -euo pipefail

STACK_NAME="${STACK_NAME:-aistack}"
REGION="${REGION:-eastus}"
RG="${RG:-rg-${STACK_NAME}}"
CAP_USD="${CAP_USD:-25}"
EMBEDDING_PROVIDER="${EMBEDDING_PROVIDER:-openai}"
LLM_PROVIDER="${LLM_PROVIDER:-anthropic}"
MODEL_REASONER="${MODEL_REASONER:-claude-sonnet-4-5}"
MODEL_CHECKER="${MODEL_CHECKER:-claude-haiku-4-5}"
MCP_NODE_URL="${MCP_NODE_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:?set ALERT_EMAIL to where budget alerts should go}"
BUDGET_START="$(date -u +%Y-%m-01)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Map each provider to the Key Vault secret the service reads (see
# src/rag/embeddings.js and src/agents/llm.js).
case "${EMBEDDING_PROVIDER}" in
  openai) EMBED_SECRET="openai-api-key" ;;
  azure)  EMBED_SECRET="azure-openai-api-key" ;;
  cohere) EMBED_SECRET="cohere-api-key" ;;
  *) echo "  !! EMBEDDING_PROVIDER must be openai|azure|cohere"; exit 1 ;;
esac
case "${LLM_PROVIDER}" in
  anthropic) LLM_SECRET="anthropic-api-key" ;;
  openai)    LLM_SECRET="openai-api-key" ;;
  *) echo "  !! LLM_PROVIDER must be anthropic|openai"; exit 1 ;;
esac

# --- prerequisites -----------------------------------------------------------
# Check each tool; if missing, try the platform package manager, then re-check.
have() { command -v "$1" >/dev/null 2>&1; }
pkg_install() {
  if have brew;    then brew install "$1"
  elif have apt-get; then sudo apt-get update -y && sudo apt-get install -y "$1"
  elif have dnf;   then sudo dnf install -y "$1"
  else return 1; fi
}
need() {
  local cmd="$1" hint="$2"
  if have "$cmd"; then echo "  ok  ${cmd}"; return; fi
  echo "  .. installing ${cmd}"
  pkg_install "$cmd" || true
  have "$cmd" || { echo "  !! ${cmd} not found. ${hint}"; exit 1; }
}

echo "==> Checking prerequisites"
need az      "Install Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli"
need node    "Install Node.js 20+: https://nodejs.org"
need openssl "Install openssl via your package manager."
need jq      "Install jq via your package manager."
need psql    "Install the PostgreSQL client (psql). e.g. apt-get install postgresql-client"
# Docker is NOT required: the image is built server-side with `az acr build`.

# --- login -------------------------------------------------------------------
echo "==> Confirming Azure login"
if ! az account show >/dev/null 2>&1; then
  echo "  .. not logged in; launching az login"
  az login >/dev/null
fi
az account show --query '{subscription:name, id:id}' -o table
INSTALLER_OID="$(az ad signed-in-user show --query id -o tsv)"

# --- generate secrets --------------------------------------------------------
# Never committed; generated fresh at install time.
PG_PASSWORD="$(openssl rand -hex 24)"
BEARER="${RAG_BEARER_TOKEN:-$(openssl rand -hex 32)}"

# --- deploy (pass 1: infra incl. ACR, placeholder app images) ----------------
echo "==> Creating resource group ${RG} in ${REGION}"
az group create -n "${RG}" -l "${REGION}" -o none

echo "==> Deploying stack.bicep (infra + ACR)"
OUT="$(az deployment group create -g "${RG}" \
  -f "${HERE}/infra/stack.bicep" \
  -p stackName="${STACK_NAME}" monthlyCapUsd="${CAP_USD}" \
     alertEmail="${ALERT_EMAIL}" budgetStartDate="${BUDGET_START}" \
     installerObjectId="${INSTALLER_OID}" installerPrincipalType=User \
     pgAdminPassword="${PG_PASSWORD}" ragBearerToken="${BEARER}" \
     embeddingProvider="${EMBEDDING_PROVIDER}" llmProvider="${LLM_PROVIDER}" \
     modelReasoner="${MODEL_REASONER}" modelChecker="${MODEL_CHECKER}" \
     mcpNodeUrl="${MCP_NODE_URL}" \
  --query properties.outputs -o json)"

ACR_NAME="$(echo "${OUT}" | jq -r '.acrName.value')"
KV_NAME="$(echo "${OUT}" | jq -r '.keyVaultName.value')"
PG_HOST="$(echo "${OUT}" | jq -r '.postgresHost.value')"
PG_DB="$(echo "${OUT}" | jq -r '.ragDatabase.value')"

# --- build & push the RAG image into the ACR (server-side; no local Docker) ---
echo "==> Building the RAG image in ACR ${ACR_NAME} (az acr build)"
IMAGE_TAG="$(date -u +%Y%m%d%H%M%S)"
RAG_IMAGE_REF="${ACR_NAME}.azurecr.io/ai-stack-rag:${IMAGE_TAG}"
az acr build --registry "${ACR_NAME}" \
  --image "ai-stack-rag:${IMAGE_TAG}" \
  --file "${HERE}/src/Dockerfile" "${HERE}/src" -o none

# --- deploy (pass 2: point the apps at the freshly-built image) --------------
echo "==> Re-deploying stack.bicep with the built image"
OUT="$(az deployment group create -g "${RG}" \
  -f "${HERE}/infra/stack.bicep" \
  -p stackName="${STACK_NAME}" monthlyCapUsd="${CAP_USD}" \
     alertEmail="${ALERT_EMAIL}" budgetStartDate="${BUDGET_START}" \
     installerObjectId="${INSTALLER_OID}" installerPrincipalType=User \
     pgAdminPassword="${PG_PASSWORD}" ragBearerToken="${BEARER}" \
     embeddingProvider="${EMBEDDING_PROVIDER}" llmProvider="${LLM_PROVIDER}" \
     modelReasoner="${MODEL_REASONER}" modelChecker="${MODEL_CHECKER}" \
     mcpNodeUrl="${MCP_NODE_URL}" \
     ragImage="${RAG_IMAGE_REF}" agentImage="${RAG_IMAGE_REF}" \
  --query properties.outputs -o json)"

RAG_URL="$(echo "${OUT}" | jq -r '.ragServiceUrl.value')"
TOOLS_URL="$(echo "${OUT}" | jq -r '.toolsManifestUrl.value')"

# --- seed the embedding / LLM keys (retry while role assignment propagates) ---
echo "==> Seeding API keys into ${KV_NAME}"
kv_set() {
  local name="$1" value="$2" i
  for i in 1 2 3 4 5 6; do
    if az keyvault secret set --vault-name "${KV_NAME}" --name "${name}" --value "${value}" -o none 2>/dev/null; then
      return 0
    fi
    echo "  .. waiting for Key Vault access to propagate (attempt ${i})"
    sleep 10
  done
  echo "  !! could not write ${name} to ${KV_NAME}"; exit 1
}

if [ -z "${EMBEDDING_API_KEY:-}" ]; then
  read -r -s -p "Embedding API key for provider '${EMBEDDING_PROVIDER}' (stored as ${EMBED_SECRET}): " EMBEDDING_API_KEY
  echo
fi
[ -n "${EMBEDDING_API_KEY:-}" ] && kv_set "${EMBED_SECRET}" "${EMBEDDING_API_KEY}" \
  || echo "  .. no embedding key provided; ingest/search will 500 until ${EMBED_SECRET} is seeded"

# The LLM key is optional here (RAG search works without it); seed it if given,
# or if the LLM provider shares the same secret as the embedding provider.
if [ -n "${LLM_API_KEY:-}" ]; then
  kv_set "${LLM_SECRET}" "${LLM_API_KEY}"
elif [ "${LLM_SECRET}" = "${EMBED_SECRET}" ] && [ -n "${EMBEDDING_API_KEY:-}" ]; then
  echo "  ok  ${LLM_SECRET} already seeded (same key as embedding provider)"
else
  echo "  .. no LLM key provided; the reasoner agent will 500 until ${LLM_SECRET} is seeded (RAG search still works)"
fi

# --- open Postgres to this client + apply schema.sql -------------------------
echo "==> Applying schema.sql to ${PG_DB} on ${PG_HOST}"
MY_IP="$(curl -fsS https://api.ipify.org || echo "")"
FW_RULE="installer-$(date -u +%s)"
if [ -n "${MY_IP}" ]; then
  az postgres flexible-server firewall-rule create -g "${RG}" \
    --name "$(echo "${PG_HOST}" | cut -d. -f1)" --rule-name "${FW_RULE}" \
    --start-ip-address "${MY_IP}" --end-ip-address "${MY_IP}" -o none || true
fi
export PGPASSWORD="${PG_PASSWORD}"
psql_try() {
  local i
  for i in 1 2 3 4 5 6; do
    if psql "host=${PG_HOST} port=5432 dbname=${PG_DB} user=pgadmin sslmode=require" \
        -v ON_ERROR_STOP=1 -f "${HERE}/src/db/schema.sql"; then
      return 0
    fi
    echo "  .. Postgres not reachable yet (attempt ${i})"; sleep 10
  done
  return 1
}
if psql_try; then
  echo "  ok  schema applied (pgvector enabled, rag_chunks + reasoner_jobs created)"
else
  echo "  !! could not apply schema.sql. Re-run after the firewall rule propagates:"
  echo "     PGPASSWORD=<pg-admin-password from ${KV_NAME}> \\"
  echo "       psql \"host=${PG_HOST} dbname=${PG_DB} user=pgadmin sslmode=require\" -f src/db/schema.sql"
fi
unset PGPASSWORD

# --- wire the node (automatic if its coordinates are provided) ----------------
NODE_WIRED="no"
if [ -n "${NODE_RG:-}" ] && [ -n "${NODE_FUNC:-}" ] && [ -n "${NODE_KV:-}" ]; then
  echo "==> Wiring the mcp-node (${NODE_FUNC})"
  az functionapp config appsettings set -g "${NODE_RG}" -n "${NODE_FUNC}" --settings \
    "AI_STACK_URL=${RAG_URL}" "AI_STACK_TOOLS_URL=${TOOLS_URL}" -o none
  for i in 1 2 3 4 5 6; do
    if az keyvault secret set --vault-name "${NODE_KV}" --name rag-bearer-token --value "${BEARER}" -o none 2>/dev/null; then
      NODE_WIRED="yes"; break
    fi
    echo "  .. waiting for node Key Vault access (attempt ${i})"; sleep 10
  done
fi

cat <<EOF

================ ai-stack is up ================
Resource group: ${RG}
Monthly cap:    \$${CAP_USD}  (alerts to ${ALERT_EMAIL})
Image registry: ${ACR_NAME}.azurecr.io  (image ai-stack-rag:${IMAGE_TAG})

RAG service:
  url:    ${RAG_URL}
  tools:  ${TOOLS_URL}
  bearer: ${BEARER}

Postgres:
  host:     ${PG_HOST}
  database: ${PG_DB}
  (admin password is in Key Vault ${KV_NAME} as pg-admin-password)

Wire these into the mcp-node so its rag_search tool can reach the stack:
  AI_STACK_URL        = ${RAG_URL}
  AI_STACK_TOOLS_URL  = ${TOOLS_URL}
  rag-bearer-token (node Key Vault) = ${BEARER}
EOF

if [ "${NODE_WIRED}" = "yes" ]; then
  echo "  -> node wired automatically (${NODE_FUNC})."
else
  cat <<EOF

  Node not auto-wired (set NODE_RG / NODE_FUNC / NODE_KV to automate). Run:
    az functionapp config appsettings set -g <NODE_RG> -n <NODE_FUNC> \\
      --settings "AI_STACK_URL=${RAG_URL}" "AI_STACK_TOOLS_URL=${TOOLS_URL}"
    az keyvault secret set --vault-name <NODE_KV> --name rag-bearer-token --value ${BEARER}
EOF
fi
echo "==============================================="
