// dynamic.js - the manifest-registration seam on the node side. On cold start
// (and every 5 minutes after) the node fetches ai-stack's GET /mcp/tools, caches
// the manifest in Key Vault, and turns each manifest entry into a node tool whose
// handler PROXIES the call to ai-stack over HTTP (with the rag/agent bearer).
//
// This is what lets a deployer add an agent to ai-stack and have it appear in the
// node's tool list WITHOUT redeploying the node - the node discovers it.
//
// Config:
//   AI_STACK_TOOLS_URL - the manifest endpoint, e.g. https://<rag-app>/mcp/tools
//   AI_STACK_URL       - the ai-stack base URL the proxy handlers call back into
//                        (falls back to AI_STACK_TOOLS_URL minus /mcp/tools)
// Fail-closed + graceful fallback: if AI_STACK_TOOLS_URL is unset, dynamic
// registration is simply skipped and the Phase-1 static rag_search still works.
// If the fetch fails, we serve the last KV-cached manifest; if there is none, we
// register nothing (and log) rather than crash the tool list.
const { getSecret } = require("../lib/secrets");

const TTL_MS = 5 * 60_000; // 5 minutes
const KV_CACHE_SECRET = "ai-stack-tools-manifest"; // where we cache the manifest

let memo = { tools: [], at: 0 }; // in-process cache to avoid hammering KV/HTTP

function toolsUrl() {
  return process.env.AI_STACK_TOOLS_URL || "";
}

function baseUrl() {
  if (process.env.AI_STACK_URL) return process.env.AI_STACK_URL.replace(/\/$/, "");
  // Derive from the tools URL by stripping the /mcp/tools path.
  const t = toolsUrl();
  return t ? t.replace(/\/mcp\/tools\/?$/, "") : "";
}

async function ragToken() {
  try {
    return await getSecret("rag-bearer-token");
  } catch {
    return null;
  }
}

// fetchManifest - GET ai-stack's /mcp/tools. Returns the ToolManifest[] or null.
async function fetchManifest() {
  const url = toolsUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`/mcp/tools ${res.status}`);
    const data = await res.json();
    const tools = Array.isArray(data) ? data : data.tools;
    if (!Array.isArray(tools)) throw new Error("manifest is not an array");
    return tools;
  } catch (err) {
    console.log(JSON.stringify({ event: "dynamic_manifest_fetch_failed", error: String(err.message || err) }));
    return null;
  }
}

// cacheManifest / readCachedManifest - persist the last good manifest in KV so a
// transient ai-stack outage does not drop the dynamic tools. Best-effort: a KV
// write/read failure is logged, never thrown.
async function cacheManifest(tools) {
  try {
    // secrets.js only exposes getSecret; caching is best-effort and optional.
    // If a setSecret is wired later, use it here. For now the in-process memo is
    // the primary cache and KV is the cross-instance fallback when available.
    if (typeof require("../lib/secrets").setSecret === "function") {
      await require("../lib/secrets").setSecret(KV_CACHE_SECRET, JSON.stringify(tools));
    }
  } catch (err) {
    console.log(JSON.stringify({ event: "dynamic_manifest_cache_failed", error: String(err.message || err) }));
  }
}

async function readCachedManifest() {
  try {
    const raw = await getSecret(KV_CACHE_SECRET);
    const tools = JSON.parse(raw);
    return Array.isArray(tools) ? tools : null;
  } catch {
    return null;
  }
}

// buildProxyTool - turn one manifest entry into a node tool. The handler calls
// ai-stack over HTTP using the entry's route, carrying the rag bearer. For an
// async tool (route.async), the proxy returns ai-stack's 202 {job_id} as-is;
// the caller then polls the matching status tool.
function buildProxyTool(entry) {
  const method = (entry.route && entry.route.method) || "POST";
  const path = (entry.route && entry.route.path) || `/${entry.name}`;
  return {
    name: entry.name,
    description: entry.description + (entry.costClass ? ` [cost: ${entry.costClass}]` : ""),
    inputSchema: entry.inputSchema || { type: "object", properties: {} },
    handler: async (args) => {
      const base = baseUrl();
      if (!base) throw new Error("AI_STACK_URL / AI_STACK_TOOLS_URL not set; cannot proxy.");
      const token = await ragToken();
      if (!token) throw new Error("rag-bearer-token not set in Key Vault; cannot proxy.");

      let url = `${base}${path}`;
      const opts = { method, headers: { Authorization: `Bearer ${token}` } };
      if (method === "GET") {
        const qs = new URLSearchParams(args || {}).toString();
        if (qs) url += `?${qs}`;
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(args || {});
      }
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`ai-stack ${path} ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}

// getDynamicTools - the public entry the registry calls. Returns the current set
// of proxy tools, refreshing from ai-stack when the memo is stale. Never throws:
// on any failure it returns the last-known tools (memo or KV) or [].
async function getDynamicTools() {
  if (!toolsUrl()) return []; // graceful fallback: feature off

  const now = Date.now();
  if (memo.tools.length && now - memo.at < TTL_MS) return memo.tools;

  let manifest = await fetchManifest();
  if (manifest) {
    await cacheManifest(manifest);
  } else {
    // fall back to KV cache, then to the stale memo
    manifest = (await readCachedManifest()) || null;
  }
  if (!manifest) {
    return memo.tools; // could be [] on first cold start with ai-stack down
  }

  const tools = manifest.map(buildProxyTool);
  memo = { tools, at: now };
  console.log(JSON.stringify({ event: "dynamic_tools_registered", count: tools.length }));
  return tools;
}

module.exports = { getDynamicTools, buildProxyTool, fetchManifest, _reset: () => (memo = { tools: [], at: 0 }) };
