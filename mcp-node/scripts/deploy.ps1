# deploy.ps1 - stand up one mcp-node into one resource group (PowerShell).
# Mirror of deploy.sh for Windows.
#
# Usage:
#   $env:ALERT_EMAIL="you@example.com"; ./deploy.ps1
#   (NODE_NAME, REGION, RG, CAP_USD are optional env vars.)
#
# Prereqs: az (logged in), Azure Functions Core Tools (func), node/npm.

$ErrorActionPreference = "Stop"

$NodeName   = if ($env:NODE_NAME)   { $env:NODE_NAME }   else { "mcpnode" }
$Region     = if ($env:REGION)      { $env:REGION }      else { "eastus" }
$Rg         = if ($env:RG)          { $env:RG }          else { "rg-$NodeName" }
$CapUsd     = if ($env:CAP_USD)     { $env:CAP_USD }     else { "10" }
$AlertEmail = $env:ALERT_EMAIL
if (-not $AlertEmail) { throw "Set ALERT_EMAIL to where budget alerts should go." }
$BudgetStart = (Get-Date).ToString("yyyy-MM-01")
$Here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "==> Confirming Azure login"
az account show --query "{subscription:name, id:id}" -o table

Write-Host "==> Creating resource group $Rg in $Region"
az group create -n $Rg -l $Region -o none

Write-Host "==> Deploying node.bicep"
$OutJson = az deployment group create -g $Rg `
  -f "$Here/infra/node.bicep" `
  -p nodeName=$NodeName monthlyCapUsd=$CapUsd alertEmail=$AlertEmail budgetStartDate=$BudgetStart `
  --query properties.outputs -o json
$Out = $OutJson | ConvertFrom-Json
$FuncName = $Out.functionAppName.value
$KvName   = $Out.keyVaultName.value
$Host_    = $Out.functionHostName.value

Write-Host "==> Seeding OAuth secrets into $KvName"
$ClientId     = -join ((1..32)  | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
$ClientSecret = -join ((1..64)  | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
$Bearer       = -join ((1..64)  | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
az keyvault secret set --vault-name $KvName --name oauth-client-id     --value $ClientId     -o none
az keyvault secret set --vault-name $KvName --name oauth-client-secret --value $ClientSecret -o none
az keyvault secret set --vault-name $KvName --name mcp-bearer-token    --value $Bearer       -o none

Write-Host "==> Publishing the server"
Push-Location "$Here/src"
npm ci
npm run build --if-present
func azure functionapp publish $FuncName
Pop-Location

Write-Host ""
Write-Host "================ mcp-node is up ================"
Write-Host "Resource group: $Rg"
Write-Host "Monthly cap:    `$$CapUsd  (alerts to $AlertEmail)"
Write-Host ""
Write-Host "Node URL: https://$Host_"
Write-Host "  authorize: https://$Host_/authorize"
Write-Host "  token:     https://$Host_/token"
Write-Host "  mcp:       https://$Host_/mcp"
Write-Host ""
Write-Host "Claude (claude.ai connector):"
Write-Host "  OAuth Client ID:     $ClientId"
Write-Host "  OAuth Client Secret: $ClientSecret"
Write-Host ""
Write-Host "ChatGPT (custom MCP connector):"
Write-Host "  MCP server URL: https://$Host_/mcp"
Write-Host "  Authorize URL:  https://$Host_/authorize"
Write-Host "  Token URL:      https://$Host_/token"
Write-Host "  Client ID:      $ClientId"
Write-Host "  Client Secret:  $ClientSecret"
Write-Host "  Scopes:         mcp"
Write-Host ""
Write-Host "CLI clients (Claude Code / Codex / etc):"
Write-Host "  MCP URL: https://$Host_/mcp"
Write-Host "  Bearer:  $Bearer"
Write-Host "==============================================="
