# Operating and updating your node

How to own, build on, and update a node after it is deployed. This is the
self-service loop: get your own copy, change it by prompting, let CI build and
push the update, debug a round if needed, and wire any new tool's API key.

## 1. Own the code (fork it)

To build on the node you need your own copy. Fork `zacha0dev/zallen-dev` into
your GitHub account. Your fork has the node source (`mcp-node/src`) and the
deploy workflow template (`mcp-node/deploy/deploy.yml`). Copy that file to
`.github/workflows/deploy.yml` in your fork so Actions can run it.

## 2. Wire the deploy workflow (build + push updates)

The workflow builds `src/` and publishes to your Function App. Set two repo
secrets in your fork:

- `AZURE_CREDENTIALS` - an SP scoped to your node's resource group:
  `az ad sp create-for-rbac --sdk-auth --role contributor --scopes /subscriptions/<sub>/resourceGroups/<rg>`
- `FUNCTION_APP_NAME` - your node's Function App name (from the deploy output).

Then point the node at your fork: set its `github-token` secret (in the node's
Key Vault) to a token that can write your fork and dispatch its workflows. Now
the node's github tools act on your repo.

## 3. The update loop (prompt -> build -> deploy)

1. Ask your connected AI to add or change a tool.
2. It commits to your fork (`github_put_file`) and updates the registry
   (`src/tools/index.js`).
3. It dispatches the workflow (`github_dispatch_workflow` on `deploy.yml`).
4. The Action builds `src/` and publishes to your Function App.
5. Reconnect your AI client - the MCP tool list is fixed at connect, so a new
   tool shows up only after a reconnect or fresh session.

## 4. The debug loop (expect a round or two)

If a build or deploy fails, the AI reads the Action run logs (via the github
tools), finds the error, fixes the module, and redeploys. Common cases:

- a syntax error in a tool module,
- a missing dependency in `package.json` (add it; the Action runs `npm ci`),
- a tool throwing at runtime (check App Insights / the node logs).

One or two iterations to green is normal for a new tool.

## 5. Adding a tool that needs an API key (the custom setup)

Most new tools call an external service that needs a key. The pattern:

1. Store the key in the node's Key Vault:
   `az keyvault secret set --vault-name <node-kv> --name <service>-api-key --value <key>`
   (or ask the node to do it - it has Secrets Officer on its own vault).
2. In the tool, read it via `lib/secrets.js`:
   `const key = await getSecret("<service>-api-key")`.
3. Fail clean if it is missing - return a clear "set `<service>-api-key` in Key
   Vault" message, the way `tools/github.js` handles `github-token`. That keeps
   the tool safe to ship before the key exists.

## 6. Checking whether a key is set

List secret names (not values) to see what is wired:
`az keyvault secret list --vault-name <node-kv>`. A tool can also report a key as
present or absent without ever exposing its value.
