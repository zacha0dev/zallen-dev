// server.js - the RAG service HTTP surface, run as the container entrypoint on
// Azure Container Apps. Plain Node http (no framework) to keep deps minimal.
// Endpoints:
//   GET  /health        - unauthenticated liveness probe
//   POST /rag/ingest    - bearer-protected; body { docs: [{content, metadata}] }
//   POST /rag/search    - bearer-protected; body { query, topK?, vectorWeight?, bm25Weight? }
// Bearer check uses the same KV-secret + timing-safe compare as lib/auth.js.
const http = require("http");
const { authorized } = require("./lib/auth");
const { ingest } = require("./rag/ingest");
const { search } = require("./rag/search");

const PORT = Number(process.env.PORT || 8080);

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("body too large")); // 5 MB cap
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = (req.url || "").split("?")[0];

    if (req.method === "GET" && url === "/health") {
      return send(res, 200, { name: "ai-stack-rag", status: "ok" });
    }

    if (req.method !== "POST" || (url !== "/rag/ingest" && url !== "/rag/search")) {
      return send(res, 404, { error: "not found" });
    }

    if (!(await authorized(req.headers["authorization"]))) {
      return send(res, 401, { error: "unauthorized" });
    }

    const body = await readBody(req);

    if (url === "/rag/ingest") {
      const docs = body.docs || body.documents || body;
      const result = await ingest(docs);
      return send(res, 200, result);
    }

    // url === "/rag/search"
    const result = await search(body);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 500, { error: String(err.message || err) });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(JSON.stringify({ event: "rag_service_start", port: PORT }));
  });
}

module.exports = { server };
