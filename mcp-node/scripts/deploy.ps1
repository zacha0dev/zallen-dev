# deploy.ps1 - one setup script for Windows: check prerequisites, log in, then
# stand up one mcp-node into one resource group. Mirror of deploy.sh.
#
# Usage:
#   $env:ALERT_EMAIL="you@example.com"; ./deploy.ps1
#   (NODE_NAME, REGION, RG, CAP_USD are optional env vars.)

$ErrorActionPreference = "Stop"

$NodeName   = if ($env:NODE_NAME)   { $env:NODE_NAME }   else { "mcpnode" }
$Region     = if ($env:REGION)      { $env:REGION }      else { "eastus" }
$Rg         = if ($env:RG)          { $env:RG }          else { "rg-$NodeName" }
$CapUsd     = if ($env:CAP_USD)     { $env:CAP_USD }     else { "10" }
$AlertEmail = $env:ALERT_EMAIL
if (-not $AlertEmail) { throw "Set ALERT_EMAIL to where budget alerts should go." }
$BudgetStart = (Get-Date).ToString("yyyy-MM-01")
$Here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# --- prerequisites -----------------------------------------------------------
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Need($cmd, $wingetId, $hint) {
  if (Have $cmd) { Write-Host "  ok  $cmd"; return }
  if (Have winget) {
    Write-Host "  .. installing $cmd"
    winget install --id $wingetId --silent --accept-package-agreements --accept-source-agreements
  }
  if (-not (Have $cmd)) { throw "  !! $cmd not found. $hint" }
}

Write-Host "==> Checking prerequisites"
Need az   "Microsoft.AzureCLI"               "Install Azure CLI."
Need node "OpenJS.NodeJS.LTS"                "Install Node.js 20+."
if (-not (Have func)) {
  Write-Host "  .. installing Azure Functions Core Tools"
  winget install --id Microsoft.AzureFunctionsCoreTools --silent --accept-package-agreements --accept-source-agreements
  if (-not (Have func)) { npm i -g azure-functions-core-tools@4 --unsafe-perm true }
}
if (-not (Have func)) { throw "  !! func not found. npm i -g azure-functions-core-tools@4" }
Write-Host "  ok  func"

# --- login -------------------------------------------------------------------
Write-Host "==> Confirming Azure login"
az account show 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "  .. not logged in; launching az login"; az login | Out-Null }
az account show --query "{subscription:name, id:id}" -o table
$InstallerOid = az ad signed-in-user show --query id -o tsv

# --- deploy ------------------------------------------------------------------
Write-Host "==> Creating resource group $Rg in $Region"
az group create -n $Rg -l $Region -o none

Write-Host "==> Deploying node.bicep"
$OutJson = az deployment group create -g $Rg `
  -f "$Here/infra/node.bicep" `
  -p nodeName=$NodeName monthlyCapUsd=$CapUsd alertEmail=$AlertEmail budgetStartDate=$BudgetStart installerObjectId=$InstallerOid installerPrincipalType=User `
  --query properties.outputs -o json
$Out = $OutJson | ConvertFrom-Json
$FuncName = $Out.functionAppName.value
$KvName   = $Out.keyVaultName.value
$Host_    = $Out.functionHostName.value

# --- seed secrets (retry while the KV role assignment propagates) ------------
Write-Host "==> Seeding OAuth secrets into $KvName"
# Cryptographically secure random hex (CSPRNG) - NOT System.Random/Get-Random,
# which is not suitable for secrets. nHexChars must be even (1 byte = 2 hex).
function New-SecretHex($nHexChars) {
  $bytes = New-Object byte[] ($nHexChars / 2)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
}
$ClientId     = New-SecretHex 32
$ClientSecret = New-SecretHex 64
$Bearer       = New-SecretHex 64
function KvSet($name, $value) {
  for ($i = 1; $i -le 6; $i++) {
    az keyvault secret set --vault-name $KvName --name $name --value $value -o none 2>$null
    if ($LASTEXITCODE -eq 0) { return }
    Write-Host "  .. waiting for Key Vault access to propagate (attempt $i)"
    Start-Sleep -Seconds 10
  }
  throw "  !! could not write $name to $KvName"
}
KvSet oauth-client-id     $ClientId
KvSet oauth-client-secret $ClientSecret
KvSet mcp-bearer-token    $Bearer

# --- publish -----------------------------------------------------------------
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
