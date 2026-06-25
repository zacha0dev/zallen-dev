// self.js - the node's tools for reasoning about itself: who it is, and a
// search over its baked-in knowledge pack (the kb/ folder shipped with it).
const fs = require("fs");
const path = require("path");

const KB_DIR = path.join(__dirname, "..", "kb");

function nodeStatus() {
  return {
    name: "node_status",
    description: "Report this node's identity: subscription, resource group, host.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || null,
      resourceGroup: process.env.AZURE_RESOURCE_GROUP || null,
      host: process.env.WEBSITE_HOSTNAME || null,
      keyVaultUrl: process.env.KEY_VAULT_URL || null,
      version: "1.0",
    }),
  };
}

function kbSearch() {
  return {
    name: "kb_search",
    description: "Search this node's baked-in knowledge pack by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for." },
      },
      required: ["query"],
    },
    handler: async ({ query }) => {
      if (!fs.existsSync(KB_DIR)) return { matches: [], note: "no kb pack shipped" };
      const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
      const matches = [];
      for (const file of fs.readdirSync(KB_DIR)) {
        if (!file.endsWith(".md")) continue;
        const text = fs.readFileSync(path.join(KB_DIR, file), "utf8");
        const lower = text.toLowerCase();
        const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
        if (score > 0) {
          const idx = lower.indexOf(terms[0]);
          const snippet = text.slice(Math.max(0, idx - 120), idx + 240).trim();
          matches.push({ file, score, snippet });
        }
      }
      matches.sort((a, b) => b.score - a.score);
      return { matches: matches.slice(0, 5) };
    },
  };
}

module.exports = { tools: [nodeStatus(), kbSearch()] };
