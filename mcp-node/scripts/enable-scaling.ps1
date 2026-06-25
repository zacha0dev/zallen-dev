# enable-scaling.ps1 - OPT-IN. Let an existing node deploy and manage OTHER
# resource groups (stamp more capped nodes). Grants the node's managed identity
# Contributor at SUBSCRIPTION scope. Run only when you want the node to scale
# itself out.
#
# Usage:
#   $env:RG="rg-mcpnode"; $env:FUNC="<functionAppName>"; ./enable-scaling.ps1

$ErrorActionPreference = "Stop"
$Rg   = $env:RG;   if (-not $Rg)   { throw "Set RG to the node's resource group." }
$Func = $env:FUNC; if (-not $Func) { throw "Set FUNC to the node's Function App name." }

$Pid_ = az functionapp identity show -g $Rg -n $Func --query principalId -o tsv
$Sub  = az account show --query id -o tsv

Write-Host "==> Granting node identity $Pid_ Contributor at subscription scope"
az role assignment create `
  --assignee-object-id $Pid_ `
  --assignee-principal-type ServicePrincipal `
  --role Contributor `
  --scope "/subscriptions/$Sub" -o none

Write-Host "Done. The node can now create + manage other resource groups."
Write-Host "To revoke later:"
Write-Host "  az role assignment delete --assignee $Pid_ --role Contributor --scope /subscriptions/$Sub"
