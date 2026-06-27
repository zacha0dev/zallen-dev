# deploy.ps1 - one setup script for Windows: check prerequisites, log in, then
# stand up one ai-stack into one resource group ON TOP OF a running mcp-node.
# Mirror of deploy.sh: deploys stack.bicep (data plane + agent plane + Basic ACR
# + budget cap), builds the RAG image with `az acr build` (server-side; no local
# Docker), seeds the embedding/LLM key into Key Vault, applies schema.sql to the
# Postgres `rag` DB, and prints the connect block + the values to wire into the
# node (auto-wires it when NODE_RG/NODE_FUNC/NODE_KV are set).
#
# Usage:
#   $env:ALERT_EMAIL="you@example.com"; $env:EMBEDDING_API_KEY="sk-..."; ./deploy.ps1
#   (STACK_NAME, REGION, RG, CAP_USD, EMBEDDING_PROVIDER, LLM_PROVIDER,
#    MODEL_REASONER, MODEL_CHECKER, LLM_API_KEY, MCP_NODE_URL,
#    NODE_RG/NODE_FUNC/NODE_KV are optional env vars.)

$ErrorActionPreference = "Stop"

$StackName   = if ($env:STACK_NAME)         { $env:STACK_NAME }         else { "aistack" }
$Region      = if ($env:REGION)             { $env:REGION }             else { "eastus" }
$Rg          = if ($env:RG)                 { $env:RG }                 else { "rg-$StackName" }
$CapUsd      = if ($env:CAP_USD)            { $env:CAP_USD }            else { "25" }
$EmbProvider = if ($env:EMBEDDING_PROVIDER) { $env:EMBEDDING_PROVIDER } else { "openai" }
$LlmProvider = if ($env:LLM_PROVIDER)       { $env:LLM_PROVIDER }       else { "anthropic" }
$ModelReas   = if ($env:MODEL_REASONER)     { $env:MODEL_REASONER }     else { "claude-sonnet-4-5" }
$ModelCheck  = if ($env:MODEL_CHECKER)      { $env:MODEL_CHECKER }      else { "claude-haiku-4-5" }
$McpNodeUrl  = if ($env:MCP_NODE_URL)       { $env:MCP_NODE_URL }       else { "" }
$AlertEmail  = $env:ALERT_EMAIL
if (-not $AlertEmail) { throw "Set ALERT_EMAIL to where budget alerts should go." }
$BudgetStart = (Get-Date).ToString("yyyy-MM-01")
$Here = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Map each provider to the Key Vault secret the service reads.
switch ($EmbProvider) {
  "openai" { $EmbSecret = "openai-api-key" }
  "azure"  { $EmbSecret = "azure-openai-api-key" }
  "cohere" { $EmbSecret = "cohere-api-key" }
  default  { throw "EMBEDDING_PROVIDER must be openai|azure|cohere" }
}
switch ($LlmProvider) {
  "anthropic" { $LlmSecret = "anthropic-api-key" }
  "openai"    { $LlmSecret = "openai-api-key" }
  default     { throw "LLM_PROVIDER must be anthropic|openai" }
}

# CSPRNG hex generator (PS 5.1-safe) for the secrets we mint at install.
function New-HexSecret($bytes) {
  $buf = New-Object 'System.Byte[]' $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buf) } finally { $rng.Dispose() }
  -join ($buf | ForEach-Object { $_.ToString("x2") })
}

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
Need az      "Microsoft.AzureCLI"          "Install Azure CLI."
Need node    "OpenJS.NodeJS.LTS"           "Install Node.js 20+."
Need psql    "PostgreSQL.PostgreSQL"       "Install the PostgreSQL client (psql)."
# Docker is NOT required: the image is built server-side with `az acr build`.

# --- login -------------------------------------------------------------------
Write-Host "==> Confirming Azure login"
az account show 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "  .. not logged in; launching az login"; az login | Out-Null }
az account show --query "{subscription:name, id:id}" -o table
$InstallerOid = az ad signed-in-user show --query id -o tsv

# --- generate secrets --------------------------------------------------------
$PgPassword = New-HexSecret 24
$Bearer = if ($env:RAG_BEARER_TOKEN) { $env:RAG_BEARER_TOKEN } else { New-HexSecret 32 }

# --- deploy (pass 1: infra incl. ACR, placeholder app images) ----------------
Write-Host "==> Creating resource group $Rg in $Region"
az group create -n $Rg -l $Region -o none

Write-Host "==> Deploying stack.bicep (infra + ACR)"
$OutJson = az deployment group create -g $Rg `
  -f "$Here/infra/stack.bicep" `
  -p stackName=$StackName monthlyCapUsd=$CapUsd alertEmail=$AlertEmail budgetStartDate=$BudgetStart installerObjectId=$InstallerOid installerPrincipalType=User pgAdminPassword=$PgPassword ragBearerToken=$Bearer embeddingProvider=$EmbProvider llmProvider=$LlmProvider modelReasoner=$ModelReas modelChecker=$ModelCheck mcpNodeUrl=$McpNodeUrl `
  --query properties.outputs -o json
$Out = $OutJson | ConvertFrom-Json
$AcrName = $Out.acrName.value
$KvName  = $Out.keyVaultName.value
$PgHost  = $Out.postgresHost.value
$PgDb    = $Out.ragDatabase.value

# --- build & push the RAG image into the ACR (server-side; no local Docker) ---
Write-Host "==> Building the RAG image in ACR $AcrName (az acr build)"
$ImageTag = (Get-Date).ToString("yyyyMMddHHmmss")
$RagImageRef = "$AcrName.azurecr.io/ai-stack-rag:$ImageTag"
az acr build --registry $AcrName --image "ai-stack-rag:$ImageTag" --file "$Here/src/Dockerfile" "$Here/src" -o none

# --- deploy (pass 2: point the apps at the freshly-built image) --------------
Write-Host "==> Re-deploying stack.bicep with the built image"
$OutJson = az deployment group create -g $Rg `
  -f "$Here/infra/stack.bicep" `
  -p stackName=$StackName monthlyCapUsd=$CapUsd alertEmail=$AlertEmail budgetStartDate=$BudgetStart installerObjectId=$InstallerOid installerPrincipalType=User pgAdminPassword=$PgPassword ragBearerToken=$Bearer embeddingProvider=$EmbProvider llmProvider=$LlmProvider modelReasoner=$ModelReas modelChecker=$ModelCheck mcpNodeUrl=$McpNodeUrl ragImage=$RagImageRef agentImage=$RagImageRef `
  --query properties.outputs -o json
$Out = $OutJson | ConvertFrom-Json
$RagUrl   = $Out.ragServiceUrl.value
$ToolsUrl = $Out.toolsManifestUrl.value

# --- seed the embedding / LLM keys (retry while role assignment propagates) ---
Write-Host "==> Seeding API keys into $KvName"
function KvSet($name, $value) {
  for ($i = 1; $i -le 6; $i++) {
    az keyvault secret set --vault-name $KvName --name $name --value $value -o none 2>$null
    if ($LASTEXITCODE -eq 0) { return }
    Write-Host "  .. waiting for Key Vault access to propagate (attempt $i)"
    Start-Sleep -Seconds 10
  }
  throw "  !! could not write $name to $KvName"
}

$EmbKey = $env:EMBEDDING_API_KEY
if (-not $EmbKey) {
  $sec = Read-Host -AsSecureString "Embedding API key for provider '$EmbProvider' (stored as $EmbSecret)"
  $EmbKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
if ($EmbKey) { KvSet $EmbSecret $EmbKey }
else { Write-Host "  .. no embedding key provided; ingest/search will 500 until $EmbSecret is seeded" }

$LlmKey = $env:LLM_API_KEY
if ($LlmKey) { KvSet $LlmSecret $LlmKey }
elseif (($LlmSecret -eq $EmbSecret) -and $EmbKey) { Write-Host "  ok  $LlmSecret already seeded (same key as embedding provider)" }
else { Write-Host "  .. no LLM key provided; the reasoner agent will 500 until $LlmSecret is seeded (RAG search still works)" }

# --- open Postgres to this client + apply schema.sql -------------------------
Write-Host "==> Applying schema.sql to $PgDb on $PgHost"
$MyIp = ""
try { $MyIp = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim() } catch { $MyIp = "" }
$PgServer = $PgHost.Split(".")[0]
if ($MyIp) {
  $FwRule = "installer-" + [int][double]::Parse((Get-Date -UFormat %s))
  az postgres flexible-server firewall-rule create -g $Rg --name $PgServer --rule-name $FwRule --start-ip-address $MyIp --end-ip-address $MyIp -o none 2>$null
}
$env:PGPASSWORD = $PgPassword
$applied = $false
for ($i = 1; $i -le 6; $i++) {
  psql "host=$PgHost port=5432 dbname=$PgDb user=pgadmin sslmode=require" -v ON_ERROR_STOP=1 -f "$Here/src/db/schema.sql"
  if ($LASTEXITCODE -eq 0) { $applied = $true; break }
  Write-Host "  .. Postgres not reachable yet (attempt $i)"
  Start-Sleep -Seconds 10
}
$env:PGPASSWORD = ""
if ($applied) {
  Write-Host "  ok  schema applied (pgvector enabled, rag_chunks + reasoner_jobs created)"
} else {
  Write-Host "  !! could not apply schema.sql. Re-run after the firewall rule propagates:"
  Write-Host "     `$env:PGPASSWORD=<pg-admin-password from $KvName>"
  Write-Host "     psql `"host=$PgHost dbname=$PgDb user=pgadmin sslmode=require`" -f src/db/schema.sql"
}

# --- wire the node (automatic if its coordinates are provided) ----------------
$NodeWired = "no"
if ($env:NODE_RG -and $env:NODE_FUNC -and $env:NODE_KV) {
  Write-Host "==> Wiring the mcp-node ($($env:NODE_FUNC))"
  az functionapp config appsettings set -g $env:NODE_RG -n $env:NODE_FUNC --settings "AI_STACK_URL=$RagUrl" "AI_STACK_TOOLS_URL=$ToolsUrl" -o none
  for ($i = 1; $i -le 6; $i++) {
    az keyvault secret set --vault-name $env:NODE_KV --name rag-bearer-token --value $Bearer -o none 2>$null
    if ($LASTEXITCODE -eq 0) { $NodeWired = "yes"; break }
    Write-Host "  .. waiting for node Key Vault access (attempt $i)"
    Start-Sleep -Seconds 10
  }
}

Write-Host ""
Write-Host "================ ai-stack is up ================"
Write-Host "Resource group: $Rg"
Write-Host "Monthly cap:    `$$CapUsd  (alerts to $AlertEmail)"
Write-Host "Image registry: $AcrName.azurecr.io  (image ai-stack-rag:$ImageTag)"
Write-Host ""
Write-Host "RAG service:"
Write-Host "  url:    $RagUrl"
Write-Host "  tools:  $ToolsUrl"
Write-Host "  bearer: $Bearer"
Write-Host ""
Write-Host "Postgres:"
Write-Host "  host:     $PgHost"
Write-Host "  database: $PgDb"
Write-Host "  (admin password is in Key Vault $KvName as pg-admin-password)"
Write-Host ""
Write-Host "Wire these into the mcp-node so its rag_search tool can reach the stack:"
Write-Host "  AI_STACK_URL        = $RagUrl"
Write-Host "  AI_STACK_TOOLS_URL  = $ToolsUrl"
Write-Host "  rag-bearer-token (node Key Vault) = $Bearer"
if ($NodeWired -eq "yes") {
  Write-Host "  -> node wired automatically ($($env:NODE_FUNC))."
} else {
  Write-Host ""
  Write-Host "  Node not auto-wired (set NODE_RG / NODE_FUNC / NODE_KV to automate). Run:"
  Write-Host "    az functionapp config appsettings set -g <NODE_RG> -n <NODE_FUNC> --settings `"AI_STACK_URL=$RagUrl`" `"AI_STACK_TOOLS_URL=$ToolsUrl`""
  Write-Host "    az keyvault secret set --vault-name <NODE_KV> --name rag-bearer-token --value $Bearer"
}
Write-Host "==============================================="
