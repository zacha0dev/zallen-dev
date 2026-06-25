# About this node

This is an mcp-node: a single-tenant MCP server running in one Azure resource
group. One owner, one connection, full access to this node's own tools. No RBAC.

## What it can do

- Operate its own Azure resource group through a managed identity scoped to that
  group only (list resources, read month-to-date spend).
- Manage its own code on GitHub (read files, commit, dispatch its deploy
  workflow) so it can update itself.
- Report its own identity and search this knowledge pack.

## Cost

The resource group has a monthly budget cap (default about $10) with alerts at
50/80/100% and a forecast alert. The Function App scales to zero when idle, so
an unused node costs almost nothing.

## Extending it

Add a tool by creating a module under src/tools that exports
`{ tools: [...] }`, each tool being `{ name, description, inputSchema, handler }`,
then list it in src/tools/index.js. Drop a markdown file in src/kb to grow what
kb_search can answer.
