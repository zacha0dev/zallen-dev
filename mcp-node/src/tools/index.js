// index.js - the node's tool registry. Add a STATIC tool by dropping a module
// that exports { tools: [...] } and listing it here. DYNAMIC tools are discovered
// at runtime from ai-stack's manifest (see dynamic.js) - the node fetches
// ai-stack's GET /mcp/tools and registers each entry as a proxy tool, so a
// deployer can add an agent to ai-stack and have it appear here without a node
// redeploy.
//
// list()/call() are async because dynamic discovery is async. If
// AI_STACK_TOOLS_URL is unset, dynamic discovery is a no-op and only the static
// tools (incl. the Phase-1 static rag_search) are served - graceful fallback.
const self = require("./self");
const azure = require("./azure");
const github = require("./github");
const scale = require("./scale");
const rag = require("./rag");
const { getDynamicTools } = require("./dynamic");

const staticTools = [...self.tools, ...azure.tools, ...github.tools, ...scale.tools, ...rag.tools];

// mergedTools - static tools plus any dynamically-discovered ai-stack tools.
// A dynamic tool with the same name as a static one is ignored (static wins),
// so the Phase-1 static rag_search keeps working even when the manifest also
// advertises a rag_search.
async function mergedTools() {
  const dynamic = await getDynamicTools().catch(() => []);
  const staticNames = new Set(staticTools.map((t) => t.name));
  const extras = dynamic.filter((t) => !staticNames.has(t.name));
  return [...staticTools, ...extras];
}

// The MCP tools/list shape: name, description, inputSchema (no handler).
async function list() {
  const all = await mergedTools();
  return all.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

async function call(name, args) {
  const all = await mergedTools();
  const tool = all.find((t) => t.name === name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return tool.handler(args || {});
}

module.exports = { list, call };
