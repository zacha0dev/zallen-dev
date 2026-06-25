# One-shot install prompt

This is the installer. You do not run a long script by hand; you paste the
prompt below into an agentic CLI and it drives the deploy to done, asking only
for what it genuinely needs.

Works in any agent CLI that can run shell commands:

- Claude Code CLI (`claude`)
- OpenAI Codex CLI (`codex`)
- GitHub Copilot CLI (`gh copilot` / `copilot`)
- Gemini CLI (`gemini`)

## Before you paste

You need two things on the machine the agent runs on:

1. Azure CLI logged in: `az login` (and `az account set --subscription <id>` if
   you have more than one).
2. This repo available, so the agent can read `mcp-node/infra/node.bicep` and
   the server source. Either run the agent from inside a clone, or let it clone
   `https://github.com/zacha0dev/zallen-dev` first.

That is it. The agent does the rest.

## The prompt

Copy everything in the block and paste it into your agent CLI.

```
You are installing "mcp-node": a single-tenant, self-managing MCP server that
lives in one Azure resource group, capped at about $10/month, scaled to zero
when idle. Drive this to done. Ask me only for inputs you cannot safely infer,
then run the whole thing yourself and print the connect config at the end.

Steps:

1. Confirm prerequisites. Run `az account show` to confirm I am logged in and on
   the subscription I want. If `az` is not logged in, stop and tell me to run
   `az login`. Confirm you can read `mcp-node/infra/node.bicep` in this repo; if
   not, clone https://github.com/zacha0dev/zallen-dev and cd into it.

2. Collect inputs. Ask me for (with these defaults if I do not care):
   - node name (default: mcpnode), 3-12 lowercase chars
   - Azure region (default: eastus)
   - resource group name (default: rg-<nodeName>)
   - monthly cost cap in USD (default: 10)
   - alert email (required; where budget alerts go)
   Confirm the set back to me in one line before you create anything.

3. Create the resource group:
   az group create -n <rg> -l <region>

4. Deploy the infrastructure. Use the budget start date of the first of the
   current month (format YYYY-MM-01):
   az deployment group create -g <rg> -f mcp-node/infra/node.bicep \
     -p nodeName=<nodeName> monthlyCapUsd=<cap> alertEmail=<email> \
        budgetStartDate=<YYYY-MM-01>
   Capture the outputs: functionAppName, keyVaultName, functionHostName, mcpUrl.

5. Seed the OAuth secrets into the node's own Key Vault. Generate three random
   values (use `openssl rand -hex 32` or equivalent) and write them:
   - oauth-client-id
   - oauth-client-secret
   - mcp-bearer-token
   az keyvault secret set --vault-name <keyVaultName> --name <secret> --value <value>
   Do NOT print the secret values to the terminal yet; you will fetch them back
   in step 7 for the connect block.

6. Deploy the server code. From mcp-node/src:
   npm ci && npm run build (if a build step exists), then
   func azure functionapp publish <functionAppName>
   (install Azure Functions Core Tools first if `func` is missing). If the
   publish fails, report the exact error and stop; do not fake success.

7. Verify and print the connect config. Hit https://<functionHostName>/mcp once
   to confirm it responds. Then read the three secrets back from Key Vault and
   print this, filled in:

   Node URL: https://<functionHostName>
     authorize: https://<functionHostName>/authorize
     token:     https://<functionHostName>/token
     mcp:       https://<functionHostName>/mcp

   Claude (claude.ai connector):
     OAuth Client ID:     <oauth-client-id>
     OAuth Client Secret: <oauth-client-secret>

   ChatGPT (custom MCP connector):
     MCP server URL: https://<functionHostName>/mcp
     Authorize URL:  https://<functionHostName>/authorize
     Token URL:      https://<functionHostName>/token
     Client ID:      <oauth-client-id>
     Client Secret:  <oauth-client-secret>
     Scopes:         mcp

   CLI clients (Claude Code / Codex / etc):
     MCP URL:   https://<functionHostName>/mcp
     Bearer:    <mcp-bearer-token>

8. Report the resource group name, the monthly cap, and where the budget alerts
   will go, so I know the cost guard is live.

Rules: do not deploy anything outside the one resource group you created. Do not
raise the cost cap without asking. If a step fails, stop and show me the real
error rather than continuing.
```

## What you get

One resource group, one Function App MCP server, one Key Vault, one budget cap.
Connect your AI client with the block the agent prints. To stand up another
node, run the prompt again with a different node name and resource group.

## Deterministic fallback

If you would rather not use an agent, `mcp-node/scripts/deploy.sh` (bash) and
`mcp-node/scripts/deploy.ps1` (PowerShell) run the same steps directly.
