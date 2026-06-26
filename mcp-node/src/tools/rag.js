// rag.js - the node's bridge to ai-stack's RAG data plane. Calls the RAG
// service's /rag/search over HTTP so a connected AI can ask questions grounded
// in the vector store from the same MCP connector.
//
// AI_STACK_URL points at the RAG service base URL (e.g.
// https://<app>.<region>.azurecontainerapps.io). The service is bearer-
// protected; the token is read from the node's Key Vault (secret:
// rag-bearer-token). Both are fail-closed: missing config returns a clear
// message instead of a hard crash.
//
// Phase 1 scope: a single static rag_search tool. Dynamic manifest
// registration (the node discovering ai-stack's tool list at runtime) is
// deferred to Phase 2.
const { getSecret } = require("../lib/secrets");

function baseUrl() {
  const url = process.env.AI_STACK_URL;
  if (!url) {
    throw new Error(
      "AI_STACK_URL is not set; point it at the ai-stack RAG service to enable rag_search."
    );
  }
  return url.replace(/\/$/, "");
}

async function ragToken() {
  try {
    return await getSecret("rag-bearer-token");
  } catch {
    return null;
  }
}

const ragSearch = {
  name: "rag_search",
  description:
    "Search the ai-stack RAG store (hybrid vector + keyword) and return the top matching chunks.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The natural-language query to search for." },
      topK: { type: "number", description: "How many hits to return (default 10)." },
      vectorWeight: { type: "number", description: "Weight for vector similarity (default 0.6)." },
      bm25Weight: { type: "number", description: "Weight for keyword rank (default 0.4)." },
    },
    required: ["query"],
  },
  handler: async ({ query, topK, vectorWeight, bm25Weight }) => {
    const token = await ragToken();
    if (!token) {
      throw new Error("rag-bearer-token not set in Key Vault; add it to enable rag_search.");
    }
    const res = await fetch(`${baseUrl()}/rag/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, topK, vectorWeight, bm25Weight }),
    });
    if (!res.ok) {
      throw new Error(`ai-stack /rag/search ${res.status}: ${await res.text()}`);
    }
    return res.json();
  },
};

module.exports = { tools: [ragSearch] };
