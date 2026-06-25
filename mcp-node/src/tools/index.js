// index.js - the node's tool registry. Add a tool by dropping a module that
// exports { tools: [...] } and listing it here.
const self = require("./self");
const azure = require("./azure");
const github = require("./github");
const scale = require("./scale");

const all = [...self.tools, ...azure.tools, ...github.tools, ...scale.tools];
const byName = new Map(all.map((t) => [t.name, t]));

// The MCP tools/list shape: name, description, inputSchema (no handler).
function list() {
  return all.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

async function call(name, args) {
  const tool = byName.get(name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return tool.handler(args || {});
}

module.exports = { list, call };
