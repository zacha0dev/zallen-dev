← [All docs](README.md)

# The server

Inside `src/` - the Azure Functions app that is the Model Context Protocol (MCP)
server.

## Runtime

Node 20 on Azure Functions (v4 programming model). `host.json` sets
`routePrefix ""`, so routes serve at the root (`/authorize`, not
`/api/authorize`).

## The files

### `index.js`
The entry point. `package.json`'s `main` points here; it requires the function
modules so they register on startup.

### `functions/oauth.js`
The Open Authorization (OAuth) endpoints - `/authorize`, `/token`, and a
discovery endpoint. The flow is covered in [Auth and identity](03-auth.md). Auth
codes are short-lived and single-use.

### `functions/mcp.js`
The `/mcp` endpoint. It:

- requires the bearer token (returns 401 otherwise),
- handles `initialize` (the handshake), `tools/list` (advertise tools), and
  `tools/call` (run one),
- returns failures as JSON remote procedure call (JSON-RPC) error objects.

### `lib/secrets.js`
Reads Key Vault through the managed identity, with a short time-to-live (TTL)
cache (about a minute) so a rotated secret is picked up quickly without a fresh
read on every single call.

### `tools/` and `kb/`
The tools have their own page ([The tools](05-tools.md)); `kb/` is the node's
baked-in knowledge that the `kb_search` tool reads.

## Running it locally

`local.settings.json.example` shows the settings to run with `func start` against
your node's Key Vault, if you want to develop a tool before deploying.
