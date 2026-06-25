# Extending this node by prompting

This node is yours to grow. You do not edit it by hand if you do not want to -
you ask the connected AI to add a tool, and it does it through the node's own
GitHub tools, then redeploys. Same loop we used to build the node in the first
place.

## The shape of a tool

A tool is an object:

```
{
  name: "my_tool",
  description: "what it does, one line",
  inputSchema: { type: "object", properties: { ... }, required: [ ... ] },
  handler: async (args) => { /* return any JSON-serializable result */ },
}
```

A tool module exports a list of them: `module.exports = { tools: [ ... ] }`.

## The prompt-driven flow (what the AI does)

When you ask the node to add a capability, the connected AI:

1. Reads `src/tools/index.js` to see the registry, and an existing module like
   `src/tools/self.js` as a pattern (`github_get_file`).
2. Writes a new module, e.g. `src/tools/<name>.js`, exporting `{ tools: [...] }`
   (`github_put_file`).
3. Adds it to the registry in `src/tools/index.js` (require it, spread its
   `.tools` into `all`).
4. Triggers a redeploy (`github_dispatch_workflow` on `deploy.yml`).

## After a redeploy

The MCP tool list is fixed when a client connects. So a brand-new tool shows up
only after the client reconnects (or you start a fresh session). Deploy, then
reconnect, then the new tool is callable.

## Keep it safe

- New tools inherit the node's permissions: its managed identity (its own
  resource group, its Key Vault) plus whatever scaling rights you granted.
- Read secrets through `lib/secrets.js`; never hard-code them.
- A tool that calls an external API should fail with a clear message if its
  token/secret is not present, the way `tools/github.js` does.

This is the open part: build and explore as far as you want. The base set is
just a starting point.

For the full lifecycle - forking the repo so you own it, wiring the CI deploy,
the update + debug loop, and adding a tool's API key + custom setup - see
`operating.md`.
