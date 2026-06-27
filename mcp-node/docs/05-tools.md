← [All docs](README.md)

# The tools

How a tool is defined, how a call is triggered and dispatched, and what ships
built in.

## The shape of a tool

A tool is a plain object:

```
{
  name: "node_status",
  description: "what it does, one line",
  inputSchema: { type: "object", properties: { ... }, required: [ ... ] },
  handler: async (args) => { /* return JSON */ },
}
```

Three of these fields are how the artificial intelligence (AI) model interacts
with the tool:

- **name** - the identifier the model calls.
- **description** - this is how the model *decides* to use the tool. A vague
  description means the model never picks it; a clear one ("current month-to-date
  Azure cost for this resource group") gets used at the right time.
- **inputSchema** - a JSON Schema. The model reads it to build the arguments;
  `required` fields are the ones it must supply. Tight schemas mean correct calls.
- **handler** - runs server-side in the Function App, with the node's identity.

## How a call is triggered and dispatched

1. On connect, the server sent the model every tool's name + description + schema
   (`tools/list`).
2. Mid-conversation, the model matches your request to a description and emits a
   `tools/call` with the name and arguments built from the schema. (This choice
   is the model's; the server does not drive it.)
3. `functions/mcp.js` receives it, re-checks the bearer, and calls
   `registry.call(name, args)`.
4. The registry looks the tool up and runs `handler(args)`.
5. The return value is wrapped as the call result and sent back; the model reads
   it and answers.

## The registry

`tools/index.js` imports each tool module, concatenates their `.tools` lists, and
exposes `list()` (for `tools/list`) and `call(name, args)` (for `tools/call`).
Adding a tool is: drop a module, add it to the registry.

## Built-in tools

### self - `tools/self.js`
- `node_status` - identity: subscription, resource group, host.
- `kb_search` - keyword search over the `kb/` knowledge pack.

### azure - `tools/azure.js`
- `azure_resources` - list resources in the node's resource group.
- `azure_spend` - month-to-date cost.

Both call Azure Resource Manager through the managed identity, so they see only
the node's own resource group.

### github - `tools/github.js`
- `github_get_file`, `github_put_file`, `github_dispatch_workflow`.

The token comes from Key Vault (`github-token`); if absent, the tools return a
clear "set github-token" message instead of failing hard.

### scale - `tools/scale.js`
- `azure_rg_create`, `azure_budget_set`, `azure_deploy_template`.

These manage OTHER resource groups, so they need the opt-in subscription grant
([Scaling](08-scaling.md)); without it they return a clear 403.

### rag - `tools/rag.js`
- `rag_search` - search the ai-stack RAG store (hybrid vector plus keyword) and
  return the top matching chunks.

This is the node's static bridge into the ai-stack data plane. It calls the RAG
service's `/rag/search` over HTTP, using `AI_STACK_URL` for the base and the
`rag-bearer-token` Key Vault secret for auth. Both are fail-closed: if either is
unset the tool returns a clear message instead of crashing, so a base node
(no ai-stack wired) still lists every other tool.

## Dynamically discovered tools - `tools/dynamic.js`

The static tools above always ship. On top of them the node can ALSO discover
tools from a connected ai-stack at runtime - no node redeploy. On cold start (and
every 5 minutes after) `tools/dynamic.js` fetches ai-stack's `GET /mcp/tools`
manifest and registers each entry as a proxy tool whose handler forwards the call
back to ai-stack over HTTP (carrying the `rag-bearer-token`). So adding an agent
to ai-stack makes it appear in this node's tool list automatically.

- Turned on by setting `AI_STACK_TOOLS_URL` (the manifest endpoint) on the node;
  unset = discovery is a graceful no-op and only the static tools are served.
- A dynamic tool whose name collides with a static one is ignored (static wins),
  so the static `rag_search` above keeps working even when the manifest also
  advertises one.
- On an ai-stack outage the node serves the last good manifest (in-process memo,
  then the Key Vault cache), never crashing the tool list.

The agents this surfaces (reasoner, trainer, researcher, drafter, workflows) and
how to wire the two stacks are covered in `instructions.md` and the ai-stack docs
(`ai-stack/docs/architecture.md`, the manifest-registration seam).

## Writing a good tool

- a clear **name** and **description** (the model chooses by these),
- a tight **inputSchema** with the right `required` fields,
- a **handler** that returns JSON and throws a clear message on failure.

A worked example of adding one - including a 3rd-party application programming
interface (API) key - is in [Extending](09-extending.md).
