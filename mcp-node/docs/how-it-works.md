# How mcp-node works

Technical reference for every component and how they connect.

Acronyms are spelled out on first use, then used short.

## The shape

One Azure resource group (RG) holds everything:

- a **Function App** - the Model Context Protocol (MCP) server an artificial
  intelligence (AI) client connects to
- a **Key Vault** - the Open Authorization (OAuth) and bearer secrets
- a **managed identity** on the Function App - how it talks to Azure
- **Application Insights + Log Analytics** - logs and metrics
- a **budget** - the cost cap

An AI client (Claude, ChatGPT, any MCP client) connects to the Function App over
OAuth, then calls tools. The tools operate that same RG and the node's GitHub
repo. That is the whole loop: AI -> MCP server -> tools -> your cloud and code.

## 1. The install

You paste one line into an agent command-line interface (CLI); it reads
`install/agent.md` and runs the deploy. Steps: check and install prerequisites,
`az login`, create the RG, deploy `infra/node.bicep`, seed the OAuth secrets into
the node's Key Vault, publish the server from `src/`, then print your connect
config.

- `install/agent.md` - the canonical steps the agent follows
- `install/prereqs.md` - the one-line installs you need first
- `scripts/deploy.sh` / `deploy.ps1` - the same steps as a plain script

## 2. The infrastructure - `infra/node.bicep`

One file, deployed into one RG:

- **Storage** - required backing for a Function App.
- **Log Analytics + Application Insights** - where logs and metrics go (with a
  daily ingestion cap as a cost knob).
- **Function App** on a Consumption plan - scale-to-zero, so it is ~$0 idle.
  It has a system-assigned managed identity.
- **Key Vault** in role-based access control (RBAC) mode - holds the secrets.
- **Role assignments** - the node's identity gets Contributor on this RG only,
  and Key Vault Secrets Officer on the vault; the installer also gets Secrets
  Officer so the first secret write succeeds (on an RBAC vault, being
  subscription Owner does not grant secret access - this closes that gap).
- **Budget** - a monthly cap (default ~$10) with alerts at 50/80/100% + forecast.

## 3. The server - `src/`

An Azure Functions app (Node 20). `host.json` sets `routePrefix ""` so the
endpoints serve at the root.

- `index.js` - entry point; loads the function modules.
- `functions/oauth.js` - the OAuth flow: `/authorize` mints a short-lived code,
  `/token` exchanges it for the node's bearer, plus a discovery endpoint.
- `functions/mcp.js` - the `/mcp` endpoint. Speaks MCP over JSON remote procedure
  call (JSON-RPC): `initialize`, `tools/list`, `tools/call`; every call must
  carry the bearer.
- `lib/secrets.js` - reads Key Vault via the managed identity, with a short
  time-to-live (TTL) cache so a rotated secret is picked up quickly.
- `tools/` - the tool modules and the registry (see part 5).
- `kb/` - the node's baked-in knowledge, searchable by the `kb_search` tool.

## 4. The auth and identity model

Two layers, do not confuse them:

- **Client to node: OAuth.** The AI runs the authorization-code flow against
  `/authorize` + `/token` and gets a bearer. Every MCP call carries it.
- **Node to Azure: managed identity.** No service principal, no secret to store
  or rotate - Azure binds the credential to the Function App, scoped to this one
  RG. That is why the node can manage its own cloud and nothing else.

## 5. The tools

Each tool is `{ name, description, inputSchema, handler }`; a module exports a
list of them and the registry (`tools/index.js`) stitches them together.

- `tools/self.js` - `node_status`, `kb_search`.
- `tools/azure.js` - `azure_resources`, `azure_spend` (via the managed identity).
- `tools/github.js` - `github_get_file`, `github_put_file`,
  `github_dispatch_workflow` (token from Key Vault).
- `tools/scale.js` - `azure_rg_create`, `azure_budget_set`,
  `azure_deploy_template` (need scaling enabled; see part 7).

## 6. Cost control

- The Consumption plan scales to zero, so an idle node is near $0.
- The AI is yours (Claude / ChatGPT), so there is no large language model (LLM)
  cost to the node.
- The budget cap + alerts bound the RG.
- New infra follows `kb/infra.md`: smallest sensible size tier, cost shown before
  deploy, clean naming + tags for easy teardown.

## 7. Scaling

One node to start. For another: re-run the install (new name, its own capped RG),
or run `scripts/enable-scaling.sh` once to grant the node subscription-scope
rights so it can stamp siblings itself via the `scale` tools. Off by default.

## 8. Extending

The node grows by prompting: ask the AI to add a tool, it edits `src/tools` and a
GitHub Action redeploys. The full lifecycle - fork, continuous integration (CI)
wiring, the update + debug loop, and adding a tool's application programming
interface (API) key - is in `kb/extending.md` and `kb/operating.md`, so the AI
can follow it from inside the connector.

## File map

| Concept | File |
|---|---|
| Install steps | `install/agent.md` |
| Prereqs | `install/prereqs.md` |
| Plain-script install | `scripts/deploy.sh`, `scripts/deploy.ps1` |
| Infrastructure | `infra/node.bicep` |
| OAuth flow | `src/functions/oauth.js` |
| MCP endpoint | `src/functions/mcp.js` |
| Secrets access | `src/lib/secrets.js` |
| Tools + registry | `src/tools/*.js` |
| Node knowledge | `src/kb/*.md` |
| Self-deploy workflow | `deploy/deploy.yml` |
| Enable self-scaling | `scripts/enable-scaling.sh` |

## Reading order

`README.md` -> this file -> `src/functions/mcp.js` -> `src/tools/self.js` ->
`src/kb/`.
