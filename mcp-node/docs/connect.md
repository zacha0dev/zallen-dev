← [All docs](README.md)

# Connecting a client

After install, your node prints a connect block. Each artificial intelligence
(AI) client wants those values in a slightly different shape - ChatGPT needs the
endpoints spelled out, Claude does not. Pick yours below.

Your connect block has:

- **Node URL** - `https://<host>`, with `/authorize`, `/token`, `/mcp`
- **OAuth Client ID** and **OAuth Client Secret**
- **Bearer token** - for command-line clients

Lost it? Read the values back from your node's Key Vault (`<node-kv>` is the
`keyVaultName` deploy output):

```
az keyvault secret show --vault-name <node-kv> --name oauth-client-id     --query value -o tsv
az keyvault secret show --vault-name <node-kv> --name oauth-client-secret --query value -o tsv
az keyvault secret show --vault-name <node-kv> --name mcp-bearer-token    --query value -o tsv
```

## Claude (claude.ai connector)

Claude runs the Open Authorization (OAuth) flow itself, so it only needs the
server URL plus the id and secret.

1. claude.ai -> Settings -> Connectors -> Add custom connector.
2. **Server URL:** `https://<host>/mcp`
3. **OAuth Client ID** and **Client Secret:** paste from your connect block.
4. Save, then approve when Claude prompts you to authorize.

## ChatGPT (custom MCP connector)

ChatGPT wants every endpoint listed.

1. Settings -> Connectors -> create a custom MCP connector.
2. Fill in:
   - **MCP server URL:** `https://<host>/mcp`
   - **Authorization URL:** `https://<host>/authorize`
   - **Token URL:** `https://<host>/token`
   - **Client ID** and **Client Secret:** from your connect block
   - **Scopes:** `mcp`
3. Save, then authorize.

## Grok (custom MCP connector)

Grok takes the same endpoints as ChatGPT:

- **MCP server URL:** `https://<host>/mcp`
- **Authorization URL:** `https://<host>/authorize`
- **Token URL:** `https://<host>/token`
- **Client ID** and **Client Secret:** from your connect block
- **Scopes:** `mcp`

## Command-line clients (Claude Code, Codex, GitHub Copilot CLI)

These use the bearer directly - no OAuth dance.

1. Add an MCP server entry pointing at `https://<host>/mcp`.
2. Set its Authorization to `Bearer <your bearer token>`.

## Verify

Ask the connected client to run `node_status`. It returns your subscription,
resource group, and host - if you see those, you are connected.

(Client menus move over time; the fields above are what each one needs.)
