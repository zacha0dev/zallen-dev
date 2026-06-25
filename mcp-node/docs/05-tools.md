# The tools

How the tool system works and what ships built in.

## The shape

A tool is a plain object:

```
{
  name: "node_status",
  description: "what it does, one line",
  inputSchema: { type: "object", properties: { ... } },
  handler: async (args) => { /* return JSON */ },
}
```

A module exports a list of them: `module.exports = { tools: [ ... ] }`. The
registry (`tools/index.js`) imports each module, concatenates the lists, and
exposes `list()` (for `tools/list`) and `call(name, args)` (for `tools/call`).
Adding a tool is dropping a module and listing it in the registry.

## Built-in tools

### self - `tools/self.js`
- `node_status` - the node's identity: subscription, resource group, host.
- `kb_search` - keyword search over the `kb/` knowledge pack.

### azure - `tools/azure.js`
- `azure_resources` - list resources in the node's resource group.
- `azure_spend` - month-to-date cost for that resource group.

Both call Azure Resource Manager through the managed identity, so they only see
the node's own resource group.

### github - `tools/github.js`
- `github_get_file`, `github_put_file`, `github_dispatch_workflow`.

The GitHub token comes from Key Vault (`github-token`). If it is absent, these
tools return a clear "set github-token" message rather than failing hard, so the
node still works without them.

### scale - `tools/scale.js`
- `azure_rg_create`, `azure_budget_set`, `azure_deploy_template`.

These manage OTHER resource groups, so they need the opt-in subscription grant
([Scaling](08-scaling.md)); without it they return a clear 403 telling you to
enable scaling.

## Adding your own

See [Extending](09-extending.md) - you can do it by prompting the connected AI.
