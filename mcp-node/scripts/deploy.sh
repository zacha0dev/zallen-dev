#!/usr/bin/env bash
# deploy.sh - one setup script: check prerequisites, log in, then stand up one
# mcp-node into one resource group. Creates the RG, deploys node.bicep, seeds
# OAuth secrets into the node's Key Vault, publishes the server, prints the
# connect config.
#
# Usage:
#   NODE_NAME=mcpnode REGION=eastus RG=rg-mcpnode CAP_USD=10 \
#   ALERT_EMAIL=you@example.com ./deploy.sh
set -euo pipefail

NODE_NAME="${NODE_NAME:-mcpnode}"
REGION="${REGION:-eastus}"
RG="${RG:-rg-${NODE_NAME}}"
CAP_USD="${CAP_USD:-10}"
ALERT_EMAIL="${ALERT_EMAIL:?set ALERT_EMAIL to where budget alerts should go}"
BUDGET_START="$(date -u +%Y-%m-01)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
if ! have func; then
  echo "  .. installing Azure Functions Core Tools"
  npm i -g azure-functions-core-tools@4 --unsafe-perm true || true
fi
have func || { echo "  !! func not found. npm i -g azure-functions-core-tools@4"; exit 1; }
echo "  ok  func"

# --- login -------------------------------------------------------------------
echo "==> Confirming Azure login"
if ! az account show >/dev/null 2>&1; then
  echo "  .. not logged in; launching az login"
  az login >/dev/null
fi
az account show --query '{subscription:name, id:id}' -o table
INSTALLER_OID="$(az ad signed-in-user show --query id -o tsv)"

# --- deploy ------------------------------------------------------------------
echo "==> Creating resource group ${RG} in ${REGION}"
az group create -n "${RG}" -l "${REGION}" -o none

echo "==> Deploying node.bicep"
OUT="$(az deployment group create -g "${RG}" \
  -f "${HERE}/infra/node.bicep" \
  -p nodeName="${NODE_NAME}" monthlyCapUsd="${CAP_USD}" \
     alertEmail="${ALERT_EMAIL}" budgetStartDate="${BUDGET_START}" \
     installerObjectId="${INSTALLER_OID}" installerPrincipalType=User \
  --query properties.outputs -o json)"

FUNC_NAME="$(echo "${OUT}" | jq -r '.functionAppName.value')"
KV_NAME="$(echo "${OUT}" | jq -r '.keyVaultName.value')"
HOST="$(echo "${OUT}" | jq -r '.functionHostName.value')"

# --- seed secrets (retry while the KV role assignment propagates) ------------
echo "==> Seeding OAuth secrets into ${KV_NAME}"
CLIENT_ID="$(openssl rand -hex 16)"
CLIENT_SECRET="$(openssl rand -hex 32)"
BEARER="$(openssl rand -hex 32)"
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
kv_set oauth-client-id     "${CLIENT_ID}"
kv_set oauth-client-secret "${CLIENT_SECRET}"
kv_set mcp-bearer-token    "${BEARER}"

# --- publish -----------------------------------------------------------------
echo "==> Publishing the server"
( cd "${HERE}/src" && npm ci && npm run build --if-present && func azure functionapp publish "${FUNC_NAME}" )

cat <<EOF

================ mcp-node is up ================
Resource group: ${RG}
Monthly cap:    \$${CAP_USD}  (alerts to ${ALERT_EMAIL})

Node URL: https://${HOST}
  authorize: https://${HOST}/authorize
  token:     https://${HOST}/token
  mcp:       https://${HOST}/mcp

Claude (claude.ai connector):
  OAuth Client ID:     ${CLIENT_ID}
  OAuth Client Secret: ${CLIENT_SECRET}

ChatGPT (custom MCP connector):
  MCP server URL: https://${HOST}/mcp
  Authorize URL:  https://${HOST}/authorize
  Token URL:      https://${HOST}/token
  Client ID:      ${CLIENT_ID}
  Client Secret:  ${CLIENT_SECRET}
  Scopes:         mcp

CLI clients (Claude Code / Codex / etc):
  MCP URL: https://${HOST}/mcp
  Bearer:  ${BEARER}
===============================================
EOF
