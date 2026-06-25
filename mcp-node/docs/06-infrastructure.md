← [All docs](README.md)

# Infrastructure

`infra/node.bicep`, resource by resource. One file, deployed into one resource
group (RG).

## Storage account
Azure Functions needs a storage account for its runtime state. Standard locally
redundant storage, with public blob access turned off.

## Log Analytics + Application Insights
The Log Analytics workspace stores logs and metrics; Application Insights sends
the Function App's telemetry there. A daily ingestion cap keeps logging cost
bounded.

## Function App + plan
A Consumption (Y1 Dynamic) plan - scale-to-zero. A Linux Function App on Node 20
with a system-assigned managed identity. App settings wire in the Key Vault URL,
the subscription id, and the RG name, so the tools know their own context.

## Key Vault
A standard vault in role-based access control (RBAC) mode, soft-delete on. Holds
the Open Authorization (OAuth) client id/secret and the bearer token.

## Role assignments
- node identity -> Contributor on the RG (manage its own box),
- node identity -> Key Vault Secrets Officer on the vault (read + rotate its own
  OAuth secrets),
- installer -> Key Vault Secrets Officer (so the first secret-seed works; see the
  RBAC note in [Auth and identity](03-auth.md)).

## Budget
A monthly cost budget (default about $10) with alerts at 50/80/100% of actual
spend plus a forecast alert, emailed to the address you give at install.

## Parameters worth knowing
- `nodeName` - prefix for resource names.
- `monthlyCapUsd` - the cap; raise it deliberately if you mean to run more.
- `alertEmail` - where budget alerts go.
- `installerObjectId` - your object id, so the Key Vault grant lands on you.

## Outputs
`functionAppName`, `functionHostName`, `keyVaultName`, `mcpUrl` - used by the
install to publish the server and print your connect config.
