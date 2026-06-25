# Extending

Add your own tools and 3rd-party connectors. This is the point of the open box.

## The loop

1. Fork the repo so you own the code and the deploy workflow.
2. Ask the connected artificial intelligence (AI) to add a tool. It writes a
   module under `src/tools`, registers it in `tools/index.js`, and commits
   through its GitHub tools.
3. It dispatches the deploy workflow; a GitHub Action builds `src/` and publishes
   to your Function App.
4. Reconnect your client - the tool list is fixed at connect, so a new tool shows
   up only after a reconnect or fresh session.

## Wiring the deploy (one-time)

Set two repository secrets in your fork:

- `AZURE_CREDENTIALS` - a service principal scoped to your node's resource group,
- `FUNCTION_APP_NAME` - your node's Function App name.

Then point the node's `github-token` (in Key Vault) at your fork.

## A tool that needs an API key

1. Store the key in the node's Key Vault:
   `az keyvault secret set --vault-name <kv> --name <service>-api-key --value <key>`.
2. Read it in the tool via `lib/secrets.js`.
3. Fail clean if it is missing, the way `tools/github.js` handles its token. That
   keeps the tool safe to ship before the key exists.

## Debugging

Expect a round or two. If a build or deploy fails, the AI reads the Action logs,
fixes the module, and redeploys. Common causes: a syntax error, a missing
dependency in `package.json`, or a runtime throw (check Application Insights).

## The node knows this too

The same process is baked into the node's knowledge (`src/kb/extending.md`,
`src/kb/operating.md`), so the AI can follow it from inside the connector when
you prompt.
