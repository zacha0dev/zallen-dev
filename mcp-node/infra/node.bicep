// node.bicep - the mcp-node, deployed into ONE resource group.
// Creates: storage (Functions backing), Log Analytics + App Insights, a
// Consumption Function App (scale-to-zero) running the MCP server, a Key Vault
// for OAuth + secrets, a system-assigned identity scoped to THIS resource group,
// and a monthly budget cap. Single-tenant: no RBAC matrix, one owner, one node.
targetScope = 'resourceGroup'

@description('Azure region.')
param location string = resourceGroup().location

@description('Short name for this node; used as a prefix for resource names.')
@minLength(3)
@maxLength(12)
param nodeName string = 'mcpnode'

@description('Monthly cost cap in USD for this resource group.')
param monthlyCapUsd int = 10

@description('First of the current month (YYYY-MM-01) for the budget start.')
param budgetStartDate string

@description('Email for budget threshold alerts.')
param alertEmail string

@description('Daily Log Analytics ingestion cap (GB) - cost knob.')
param logDailyQuotaGb int = 1

@description('Object id of the principal running this deploy: az ad signed-in-user show --query id -o tsv. Granted Key Vault Secrets Officer so it can seed/rotate the OAuth secrets. On an RBAC vault, subscription Owner alone does NOT grant data-plane secret access - this is the reader-role wall.')
param installerObjectId string

@description('Principal type of installerObjectId: User for a person, ServicePrincipal for an SP/CI.')
@allowed([ 'User', 'ServicePrincipal' ])
param installerPrincipalType string = 'User'

var suffix = take(uniqueString(resourceGroup().id), 6)
var saName = toLower('${nodeName}${suffix}')
var kvName = '${nodeName}-kv-${suffix}'
var funcName = '${nodeName}-func-${suffix}'
var planName = '${nodeName}-plan-${suffix}'
var kvSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aa7b-9d8c4f9b8e4a' // Key Vault Secrets Officer (read + write/rotate)

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${nodeName}-law-${suffix}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: logDailyQuotaGb }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${nodeName}-ai-${suffix}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: law.id }
}

resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: saName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' } // Consumption = scale-to-zero
  properties: { reserved: true }
}

resource func 'Microsoft.Web/sites@2023-12-01' = {
  name: funcName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${sa.name};AccountKey=${sa.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'KEY_VAULT_URL', value: kv.properties.vaultUri }
        { name: 'AZURE_SUBSCRIPTION_ID', value: subscription().subscriptionId }
        { name: 'AZURE_RESOURCE_GROUP', value: resourceGroup().name }
      ]
    }
  }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

// The node's identity may READ AND ROTATE secrets in THIS vault (Secrets
// Officer, not the read-only Secrets User) so the node can self-update its own
// OAuth secrets. Scoped to this vault only.
resource kvNodeRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, func.id, kvSecretsOfficerRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsOfficerRoleId)
    principalId: func.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The installer (the person/SP running the deploy) also gets Secrets Officer on
// the vault so the next step - seeding oauth-client-id / -secret /
// mcp-bearer-token - works. On an RBAC vault, subscription Owner does NOT carry
// data-plane secret access; without this, `az keyvault secret set` returns
// Forbidden. This is the reader-role wall, closed here.
resource kvInstallerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, installerObjectId, kvSecretsOfficerRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsOfficerRoleId)
    principalId: installerObjectId
    principalType: installerPrincipalType
  }
}

// The node manages its OWN resource group: Contributor scoped to THIS RG only.
// Full control inside its box; zero rights anywhere else in the subscription.
// (Deploying this assignment requires the installer to be Owner / User Access
// Administrator on the RG, which the subscription owner running the install is.)
var contributorRoleId = 'b24988ac-6180-42a0-bb6f-0d3e8c0e7c0e' // Contributor
resource rgRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, func.id, contributorRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRoleId)
    principalId: func.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The cost cap: monthly budget on this resource group, alerts + forecast.
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: '${nodeName}-monthly-cap'
  properties: {
    category: 'Cost'
    amount: monthlyCapUsd
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate }
    notifications: {
      actual_50: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 50, thresholdType: 'Actual', contactEmails: [ alertEmail ] }
      actual_80: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 80, thresholdType: 'Actual', contactEmails: [ alertEmail ] }
      actual_100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Actual', contactEmails: [ alertEmail ] }
      forecast_100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Forecasted', contactEmails: [ alertEmail ] }
    }
  }
}

output functionAppName string = func.name
output functionHostName string = func.properties.defaultHostName
output keyVaultName string = kv.name
output mcpUrl string = 'https://${func.properties.defaultHostName}/mcp'
