#!/usr/bin/env bash
# enable-scaling.sh - OPT-IN. Let an existing node deploy and manage OTHER
# resource groups (stamp more capped nodes across your projects). Grants the
# node's managed identity Contributor at SUBSCRIPTION scope.
#
# This is real power - the node can then create and manage any resource group in
# the subscription. Run it only when you want the node to scale itself out.
#
# Usage:
#   RG=rg-mcpnode FUNC=<functionAppName> ./enable-scaling.sh
set -euo pipefail

RG="${RG:?set RG to the node's resource group}"
FUNC="${FUNC:?set FUNC to the node's Function App name}"

PID="$(az functionapp identity show -g "${RG}" -n "${FUNC}" --query principalId -o tsv)"
SUB="$(az account show --query id -o tsv)"

echo "==> Granting node identity ${PID} Contributor at subscription scope"
az role assignment create \
  --assignee-object-id "${PID}" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/${SUB}" -o none

echo "Done. The node can now create + manage other resource groups."
echo "To revoke later:"
echo "  az role assignment delete --assignee ${PID} --role Contributor --scope /subscriptions/${SUB}"
