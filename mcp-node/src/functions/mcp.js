// mcp.js - the MCP endpoint. Speaks JSON-RPC 2.0 over HTTP: initialize,
// tools/list, tools/call. Every request must carry the node's bearer token
// (Authorization: Bearer <mcp-bearer-token>), which clients obtain from the
// OAuth flow in oauth.js. On initialize the server also hands the client the
// node's custom instructions (src/instructions.md).
const { app } = require("@azure/functions");
const fs = require("fs");
const path = require("path");
const { getSecret } = require("../lib/secrets");
const registry = require("../tools");

const PROTOCOL_VERSION = "2024-11-05";

// The node's custom instructions - standing guidance the client receives on
// connect. Edit src/instructions.md and redeploy to change how the AI behaves.
let instructionsCache;
function nodeInstructions() {
  if (instructionsCache !== undefined) return instructionsCache;
  try {
    instructionsCache = fs.readFileSync(
      path.join(__dirname, "..", "instructions.md"),
      "utf8"
    );
  } catch {
    instructionsCache = "";
  }
  return instructionsCache;
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function authorized(request) {
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "");
  if (!bearer) return false;
  const expected = await getSecret("mcp-bearer-token");
  return bearer === expected;
}

app.http("mcp", {
  methods: ["POST", "GET"],
  authLevel: "anonymous",
  route: "mcp",
  handler: async (request, context) => {
    if (request.method === "GET") {
      // health probe
      return { status: 200, jsonBody: { name: "mcp-node", version: "1.0", protocol: PROTOCOL_VERSION } };
    }

    if (!(await authorized(request))) {
      return { status: 401, jsonBody: rpcError(null, -32001, "unauthorized") };
    }

    let msg;
    try {
      msg = await request.json();
    } catch {
      return { status: 400, jsonBody: rpcError(null, -32700, "parse error") };
    }

    const { id, method, params } = msg || {};
    try {
      switch (method) {
        case "initialize":
          return {
            status: 200,
            jsonBody: rpcResult(id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: { name: "mcp-node", version: "1.0" },
              instructions: nodeInstructions(),
            }),
          };

        case "notifications/initialized":
          return { status: 202, body: "" };

        case "tools/list":
          return { status: 200, jsonBody: rpcResult(id, { tools: registry.list() }) };

        case "tools/call": {
          const { name, arguments: args } = params || {};
          const out = await registry.call(name, args);
          return {
            status: 200,
            jsonBody: rpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
            }),
          };
        }

        default:
          return { status: 200, jsonBody: rpcError(id, -32601, `method not found: ${method}`) };
      }
    } catch (err) {
      context.error(err);
      return { status: 200, jsonBody: rpcError(id, -32000, String(err.message || err)) };
    }
  },
});

module.exports = {};
