# Agent install instructions

You are installing mcp-node: a single-tenant, self-managing MCP server that
lives in one Azure resource group, capped at about $10/month, scaled to zero
when idle. Drive this to done. Ask the user only for inputs you cannot safely
infer, then run it all and print the connect config at the end.

1. Confirm `az account show` works (logged in to the right subscription). If
   not, tell the user to run `az login` and stop. Confirm you can read
   `mcp-node/infra/node.bicep`; if not, clone
   https://github.com/zacha0dev/zallen-dev and cd into it.

2. Ask the user for, with these defaults if they do not care:
   - node name (default mcpnode, 3-12 lowercase chars)
   - region (default eastus)
   - resource group (default rg-<nodeName>)
   - monthly cap USD (default 10)
   - alert email (required; where budget alerts go)
   Echo the set back in one line before creating anything.

3. `az group create -n <rg> -l <region>`

4. Deploy, with budgetStartDate = first of this month (YYYY-MM-01):
   ```
   az deployment group create -g <rg> -f mcp-node/infra/node.bicep \
     -p nodeName=<nodeName> monthlyCapUsd=<cap> alertEmail=<email> \
        budgetStartDate=<YYYY-MM-01>
   ```
   Capture outputs: functionAppName, keyVaultName, functionHostName.

5. Generate three random values (`openssl rand -hex 32`) and write them to the
   node's Key Vault as `oauth-client-id`, `oauth-client-secret`,
   `mcp-bearer-token`. Do not print them yet.

6. From `mcp-node/src`: `npm ci`, `npm run build --if-present`, then
   `func azure functionapp publish <functionAppName>`. If publish fails, show
   the real error and stop; do not fake success.

7. GET `https://<functionHostName>/mcp` to confirm it responds. Read the three
   secrets back and print the connect block:
   - Node URL: `https://<host>` with `/authorize`, `/token`, `/mcp`
   - Claude: client id + client secret
   - ChatGPT: server URL + authorize URL + token URL + client id + client
     secret + scopes=mcp
   - CLI (Claude Code / Codex): mcp URL + bearer

8. Tell the user the resource group, the monthly cap, and where budget alerts
   go.

Rules: deploy only into the one resource group you create; do not raise the cap
without asking; on any failure, stop and show the real error.
