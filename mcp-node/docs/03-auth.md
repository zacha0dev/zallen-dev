# Auth and identity

Two separate mechanisms. Keeping them straight is the key to the node's security.

## Inbound: OAuth (client to node)

The client authenticates to the node with Open Authorization (OAuth) 2.0, the
authorization-code flow:

1. The client opens `/authorize?client_id=...&redirect_uri=...`. The node checks
   the client id against the `oauth-client-id` secret and returns a short-lived,
   single-use code.
2. The client posts that code plus client id and client secret to `/token`. The
   node checks both secrets and returns the bearer token (`mcp-bearer-token`).
3. The client sends that bearer on every `/mcp` call.

A discovery endpoint (`/.well-known/oauth-authorization-server`) lets clients
auto-configure the URLs.

What each client needs:

- **Claude** - client id + client secret (it runs the flow itself).
- **ChatGPT** - the full set: server URL, authorize URL, token URL, id, secret,
  scopes.
- **A command-line client** - the bearer directly.

## Outbound: managed identity (node to Azure)

The Function App has a system-assigned managed identity. Azure issues and rotates
its credential automatically; nothing is stored in the repo or app settings.
Code gets a token through `DefaultAzureCredential` and calls Azure.

This is better than a service principal (SP): there is no client secret to leak
or rotate, and the credential cannot be copied off the machine.

## The RBAC detail that bites people

The Key Vault runs in role-based access control (RBAC) mode. On an RBAC vault,
being subscription Owner does NOT let you read or write secrets - secret access
is a separate data-plane role. So the deploy explicitly grants:

- the node's identity - Key Vault Secrets Officer (read and rotate its own OAuth
  secrets),
- the installer - Key Vault Secrets Officer (so the first secret write succeeds).

Without that grant, `az keyvault secret set` returns "Forbidden" even for an
Owner. It is the most common Key Vault setup mistake; the node closes it for you
by passing your object id into the deploy.

## Scope

The node's identity has Contributor on its own resource group only. Letting it
manage other resource groups is a separate, opt-in grant - see
[Scaling](08-scaling.md).
