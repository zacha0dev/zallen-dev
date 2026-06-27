// stack.bicep - ai-stack (Project 2), deployed into ONE resource group on top of
// a running mcp-node. Creates the RAG data plane (Postgres + pgvector, blob, the
// RAG search service) and the agent plane (Azure Container Apps), plus Key Vault,
// a scoped managed identity, App Insights, and a monthly budget cap. Kept
// deliberately cheap: smallest Burstable Postgres, container apps scale to zero.
targetScope = 'resourceGroup'

@description('Azure region.')
param location string = resourceGroup().location

@description('Short name for this stack; prefix for resource names.')
@minLength(3)
@maxLength(12)
param stackName string = 'aistack'

@description('Monthly cost cap in USD. Higher than mcp-node because Postgres has an hourly floor.')
param monthlyCapUsd int = 25

@description('First of the current month (YYYY-MM-01) for the budget start.')
param budgetStartDate string

@description('Email for budget threshold alerts.')
param alertEmail string

@description('Object id of the principal running the deploy (az ad signed-in-user show --query id -o tsv). Granted Key Vault Secrets Officer so the deploy can seed secrets.')
param installerObjectId string

@description('Principal type of installerObjectId.')
@allowed([ 'User', 'ServicePrincipal' ])
param installerPrincipalType string = 'User'

@description('Postgres admin login.')
param pgAdminLogin string = 'pgadmin'

@description('Postgres admin password. Generate at install and store in Key Vault.')
@secure()
param pgAdminPassword string

@description('Bearer token protecting the RAG service HTTP surface. Generate at install and store in Key Vault.')
@secure()
param ragBearerToken string

@description('Container image for the agents. Defaults to a placeholder until the real agent image is published.')
param agentImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Container image for the RAG search service. Defaults to a placeholder until the real image is published.')
param ragImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Embedding provider for the RAG plane: openai | azure | cohere. The matching API key must be seeded into Key Vault before ingest/search work.')
@allowed([ 'openai', 'azure', 'cohere' ])
param embeddingProvider string = 'openai'

@description('LLM provider for the agent plane (reasoner produce + output-checker grade): anthropic | openai. The matching API key (anthropic-api-key | openai-api-key) must be seeded into Key Vault before the reasoner works.')
@allowed([ 'anthropic', 'openai' ])
param llmProvider string = 'anthropic'

@description('Model tier for the reasoner PRODUCE step (the I-COST-1 knob). Swap to a cheaper model to cut cost without a code change.')
param modelReasoner string = 'claude-sonnet-4-5'

@description('Model tier for the output-checker GRADE step. A cheap Haiku-class model keeps the gate inexpensive.')
param modelChecker string = 'claude-haiku-4-5'

@description('The mcp-node MCP URL this stack registers with (Project 1 control plane).')
param mcpNodeUrl string = ''

@description('Daily Log Analytics ingestion cap (GB).')
param logDailyQuotaGb int = 1

var suffix = take(uniqueString(resourceGroup().id), 6)
var kvName = '${stackName}-kv-${suffix}'
var pgName = '${stackName}-pg-${suffix}'
var saName = toLower('${stackName}${suffix}')
var caeName = '${stackName}-cae-${suffix}'
var kvSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aa7b-9d8c4f9b8e4a' // Key Vault Secrets Officer
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
var contributorRoleId = 'b24988ac-6180-42a0-bb6f-0d3e8c0e7c0e' // Contributor

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${stackName}-law-${suffix}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: logDailyQuotaGb }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${stackName}-ai-${suffix}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: law.id }
}

// Blob storage - the raw documents / data sources for RAG.
resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: saName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false }
}
resource docs 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${sa.name}/default/documents'
}

// Postgres Flexible Server, smallest Burstable tier, with pgvector allowlisted.
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdminLogin
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}
resource pgVector 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: 'VECTOR', source: 'user-override' }
}
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: pg
  name: 'rag'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}
resource pgAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: pg
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
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
// Store the Postgres password in the vault so the agents read it, never hard-code it.
resource pgSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'pg-admin-password'
  properties: { value: pgAdminPassword }
}
// Bearer token for the RAG service HTTP surface; the node's rag_search tool
// reads the same value from its own vault to call the service.
resource ragTokenSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'rag-bearer-token'
  properties: { value: ragBearerToken }
}
resource kvInstaller 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, installerObjectId, kvSecretsOfficerRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsOfficerRoleId)
    principalId: installerObjectId
    principalType: installerPrincipalType
  }
}

// Container Apps environment - logs to the workspace above.
resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: caeName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

var agentEnv = [
  { name: 'KEY_VAULT_URL', value: kv.properties.vaultUri }
  { name: 'AZURE_SUBSCRIPTION_ID', value: subscription().subscriptionId }
  { name: 'AZURE_RESOURCE_GROUP', value: resourceGroup().name }
  { name: 'PG_HOST', value: pg.properties.fullyQualifiedDomainName }
  { name: 'PG_DATABASE', value: 'rag' }
  { name: 'PG_USER', value: pgAdminLogin }
  { name: 'DOCS_STORAGE_ACCOUNT', value: sa.name }
  { name: 'MCP_NODE_URL', value: mcpNodeUrl }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
]

// RAG search service - the data-plane HTTP surface (/rag/ingest, /rag/search).
// External ingress so the mcp-node's rag_search tool can reach it; it is bearer-
// protected (rag-bearer-token) at the app layer.
resource ragApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${stackName}-rag'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: { ingress: { external: true, targetPort: 8080 } }
    template: {
      containers: [
        {
          name: 'rag'
          image: ragImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: concat(agentEnv, [
            { name: 'EMBEDDING_PROVIDER', value: embeddingProvider }
            { name: 'PORT', value: '8080' }
          ])
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

// System app - the trainer + manager/orchestrator agent.
resource systemApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${stackName}-system'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: { ingress: { external: false, targetPort: 8080 } }
    template: {
      containers: [
        {
          name: 'system'
          image: agentImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: concat(agentEnv, [ { name: 'AGENT_ROLE', value: 'system' } ])
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

// Agents app - role-based example agents (solution-architect + delivery/engagement).
resource agentsApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${stackName}-agents'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: { ingress: { external: false, targetPort: 8080 } }
    template: {
      containers: [
        {
          name: 'agents'
          image: agentImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: concat(agentEnv, [ { name: 'AGENT_ROLE', value: 'agents' } ])
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

// All three apps may read secrets from the vault (PG password, embedding key,
// RAG bearer token).
resource kvRag 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, ragApp.id, kvSecretsUserRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: ragApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource kvSystem 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, systemApp.id, kvSecretsUserRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: systemApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
resource kvAgents 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, agentsApp.id, kvSecretsUserRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: agentsApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The cost cap for this resource group.
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: '${stackName}-monthly-cap'
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

output postgresHost string = pg.properties.fullyQualifiedDomainName
output ragDatabase string = 'rag'
output ragServiceUrl string = 'https://${ragApp.properties.configuration.ingress.fqdn}'
output storageAccount string = sa.name
output keyVaultName string = kv.name
output systemAppName string = systemApp.name
output agentsAppName string = agentsApp.name
