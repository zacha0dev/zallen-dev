# Architecture

The components and how a request flows through them.

## Components (all in one resource group)

- **Function App** (Azure Functions, Consumption plan) - runs the Model Context
  Protocol (MCP) server. Scale-to-zero, so about $0 when idle.
- **Key Vault** - stores the Open Authorization (OAuth) client id/secret and the
  bearer token.
- **Managed identity** - attached to the Function App; how it authenticates to
  Azure with no stored secret.
- **Application Insights + Log Analytics** - logs and metrics.
- **Budget** - the monthly cost cap with alerts.

## How a request flows

1. The artificial intelligence (AI) client connects and runs the OAuth flow
   (`/authorize` then `/token`) to get a bearer token.
2. For each action the AI sends a request to `/mcp` carrying that bearer.
3. The server checks the bearer, finds the named tool, and runs its handler.
4. The handler does the work - calling Azure through the managed identity, or
   GitHub through a stored token, or reading the knowledge pack.
5. The result returns to the AI as structured output.

(A boxed topology diagram is planned; for now this list is the flow.)

## The two trust boundaries

- **Inbound:** a caller must hold the bearer. No bearer, no tool calls.
- **Outbound:** the managed identity is scoped to the one resource group (RG), so
  even a misbehaving tool cannot reach the rest of your subscription.

Understanding these two boundaries is most of understanding the node's security;
[Auth and identity](03-auth.md) goes deeper.

## Where each part lives

| Part | File |
|---|---|
| Infrastructure | `infra/node.bicep` |
| Server entry | `src/index.js` |
| OAuth endpoints | `src/functions/oauth.js` |
| MCP endpoint | `src/functions/mcp.js` |
| Secrets access | `src/lib/secrets.js` |
| Tools | `src/tools/*.js` |
| Node knowledge | `src/kb/*.md` |
