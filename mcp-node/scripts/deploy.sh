#!/usr/bin/env bash
# deploy.sh - stand up one mcp-node into one resource group.
# Creates the RG, deploys node.bicep, seeds OAuth secrets into the node's Key
# Vault, publishes the server, and prints the connect config.
#
# Usage:
#   NODE_NAME=mcpnode REGION=eastus RG=rg-mcpnode CAP_USD=10 \
#   ALERT_EMAIL=you@example.com ./deploy.sh
#
# Prereqs: az (logged in), openssl, Azure Functions Core Tools (func), node/npm.
set -euo pipefail

NODE_NAME="${NODE_NAME:-mcpnode}"
REGION="${REGION:-eastus}"
RG="${RG:-rg-${NODE_NAME}}"
CAP_USD="${CAP_USD:-10}"
ALERT_EMAIL="${ALERT_EMAIL:?set ALERT_EMAIL to where budget alerts should go}"
BUDGET_START="$(date -u +%Y-%m-01)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Confirming Azure login"
az account show --query '{subscription:name, id:id}' -o table

echo "==> Creating resource group ${RG} in ${REGION}"
az group create -n "${RG}" -l "${REGION}" -o none

echo "==> Deploying node.bicep"
OUT="$(az deployment group create -g "${RG}" \
  -f "${HERE}/infra/node.bicep" \
  -p nodeName="${NODE_NAME}" monthlyCapUsd="${CAP_USD}" \
     alertEmail="${ALERT_EMAIL}" budgetStartDate="${BUDGET_START}" \
  --query properties.outputs -o json)"

FUNC_NAME="$(echo "${OUT}" | jq -r '.functionAppName.value')"
KV_NAME="$(echo "${OUT}" | jq -r '.keyVaultName.value')"
HOST="$(echo "${OUT}" | jq -r '.functionHostName.value')"

echo "==> Seeding OAuth secrets into ${KV_NAME}"
CLIENT_ID="$(openssl rand -hex 16)"
CLIENT_SECRET="$(openssl rand -hex 32)"
BEARER="$(openssl rand -hex 32)"
az keyvault secret set --vault-name "${KV_NAME}" --name oauth-client-id     --value "${CLIENT_ID}"     -o none
az keyvault secret set --vault-name "${KV_NAME}" --name oauth-client-secret --value "${CLIENT_SECRET}" -o none
az keyvault secret set --vault-name "${KV_NAME}" --name mcp-bearer-token    --value "${BEARER}"        -o none

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
