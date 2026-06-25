← [All docs](README.md)

# Architecture and runtime

This page traces what actually happens, from a client connecting to a tool
running. Read [Concepts](01-concepts.md) first for the vocabulary.

## The components (one resource group)

- **Function App** (Consumption) - the Model Context Protocol (MCP) server.
- **Key Vault** - the Open Authorization (OAuth) and bearer secrets.
- **Managed identity** - the node's credential to Azure.
- **Application Insights + Log Analytics** - logs and metrics.
- **Budget** - the cost cap.

## Step 1 - the client connects (sign-in)

Before any tool call, the artificial intelligence (AI) client signs in and gets a
**bearer token** - think of it as a private pass it shows on every request. This
uses the Open Authorization (OAuth) sign-in flow (full detail in
[Auth](03-auth.md)).

## Step 2 - the handshake (initialize)

The client opens a session against `/mcp` and says hello (`initialize`). The
server (`functions/mcp.js`) checks the pass, then replies with what it is and
that it has tools. A wrong or missing pass is rejected right here, and the
session never starts.

## Step 3 - discovering tools (tools/list)

The client sends `tools/list`. The server asks the tool registry
(`tools/index.js`) for every tool's name, description, and input schema, and
returns them. The model now has a menu of what it can do, in its context.

## Step 4 - the model decides to call

This part is the model, not the server. As you chat, the model weighs your
request against the tool descriptions from step 3. When one fits, it emits a tool
call - the tool name plus arguments it constructs to match the input schema.

## Step 5 - the call runs (tools/call)

The client sends `tools/call` with that name and arguments. The server
(`functions/mcp.js`):

1. re-checks the bearer,
2. looks the tool up in the registry,
3. runs its `handler(args)`,
4. wraps the return value as the call result.

## Step 6 - the handler does the work

What it does depends on the tool:

- an **azure** tool uses the node's built-in Azure credential (its managed
  identity) to ask Azure to do something,
- a **github** tool reads its access token from the vault and calls GitHub,
- a **self** tool reads the node's own status or its knowledge pack.

The result returns up the chain to the model, which uses it to answer you.

## The two boundaries (why this is safe)

- **Inbound:** every step past `initialize` requires the bearer.
- **Outbound:** the managed identity is scoped to this one resource group (RG),
  so a handler cannot reach anything else in your subscription.

## Where each part lives

| Part | File |
|---|---|
| Infrastructure | `infra/node.bicep` |
| Server entry | `src/index.js` |
| OAuth endpoints | `src/functions/oauth.js` |
| MCP endpoint | `src/functions/mcp.js` |
| Secrets access | `src/lib/secrets.js` |
| Tools + registry | `src/tools/*.js` |
| Node knowledge | `src/kb/*.md` |
