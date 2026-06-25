[mcp-node](../README.md) · [Docs](README.md) · [← Architecture](02-architecture.md) · [The server →](04-server.md)

# Auth and identity

Two mechanisms: how a client proves it may talk to the node (Open Authorization,
inbound), and how the node proves it may touch Azure (managed identity,
outbound).

## Inbound: OAuth, explained

### Why OAuth at all

The node's tools can spend money and change infrastructure, so not just anyone
may call them. OAuth 2.0 is the standard way for a client to obtain a token that
proves it is allowed in - without the node handing out anything permanent up
front.

### The pieces

- **Client ID** - public identifier for the connecting app. Secret name:
  `oauth-client-id`.
- **Client Secret** - the private half; proves the app is genuine. Secret name:
  `oauth-client-secret`.
- **Authorization code** - a short-lived, single-use code the node hands back
  mid-flow.
- **Bearer token** - the actual key the client sends on every tool call. Secret
  name: `mcp-bearer-token`.

### The flow, step by step

1. The client opens the **authorize URL**:
   `https://<host>/authorize?client_id=<id>&redirect_uri=<callback>&state=<x>`.
2. The node checks `client_id` against `oauth-client-id`, mints an authorization
   code, and redirects the browser back to the client's **redirect_uri
   (callback)** with `?code=...`.
3. The client posts to the **token URL** `https://<host>/token` with the code +
   client id + client secret.
4. The node checks both secrets and returns the **bearer token**.
5. The client sends `Authorization: Bearer <token>` on every `/mcp` call. The
   node compares it to `mcp-bearer-token` and runs the tool.

### The URLs a connector asks for

- **Authorize:** `https://<host>/authorize`
- **Token:** `https://<host>/token`
- **MCP endpoint:** `https://<host>/mcp`
- **Discovery:** `https://<host>/.well-known/oauth-authorization-server`
- **Redirect / callback:** the client supplies its own (claude.ai and ChatGPT
  pass their callback automatically); the node accepts what the client sends.

`<host>` is your Function App host, printed at install (and the `mcpUrl` output).

### Getting your secrets (Key Vault commands)

The install stored three secrets in your node's Key Vault. Read them back for a
connector setup:

```
az keyvault secret show --vault-name <node-kv> --name oauth-client-id     --query value -o tsv
az keyvault secret show --vault-name <node-kv> --name oauth-client-secret --query value -o tsv
az keyvault secret show --vault-name <node-kv> --name mcp-bearer-token    --query value -o tsv
```

See what is set (names only, no values):

```
az keyvault secret list --vault-name <node-kv> -o table
```

Rotate one (the node picks up the change within about a minute):

```
az keyvault secret set --vault-name <node-kv> --name mcp-bearer-token --value "$(openssl rand -hex 32)"
```

(`<node-kv>` is your node's Key Vault name, the `keyVaultName` deploy output.)

## Outbound: managed identity (node to Azure)

The Function App has a system-assigned managed identity. Azure issues and rotates
its credential automatically; nothing is stored in the repo or app settings. Code
gets a token through `DefaultAzureCredential` and calls Azure.

Better than a service principal (SP): no client secret to leak or rotate, and the
credential cannot be copied off the machine.

## The RBAC detail that bites people

The Key Vault runs in role-based access control (RBAC) mode. On an RBAC vault,
being subscription Owner does NOT let you read or write secrets - that is a
separate data-plane role. So the deploy explicitly grants Key Vault Secrets
Officer to both the node's identity (read + rotate its OAuth secrets) and the
installer (so the first secret write succeeds). Without it, `az keyvault secret
set` returns "Forbidden" even for an Owner. The node closes this by passing your
object id into the deploy.

## Scope

The node's identity has Contributor on its own resource group only. Letting it
manage other resource groups is a separate, opt-in grant - see
[Scaling](08-scaling.md).
