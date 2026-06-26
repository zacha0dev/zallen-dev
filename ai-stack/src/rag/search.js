// search.js - answer a query against the vector store: embed the query, run the
// SQL hybrid_search (vector + keyword blend), return the top-k hits, and emit
// ONE structured log line per search (the evidence gate) so every retrieval is
// observable in Application Insights / Log Analytics.
const { embed } = require("./embeddings");
const { getPool, toVectorLiteral } = require("../lib/db");

// search - { query, topK?, vectorWeight?, bm25Weight? } -> { hits: [{id, content, score}] }
async function search({ query, topK = 10, vectorWeight = 0.6, bm25Weight = 0.4 } = {}) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("search requires a non-empty 'query' string");
  }
  const started = Date.now();
  const pool = await getPool();

  const [queryVec] = await embed([query]);
  const { rows } = await pool.query(
    `SELECT id, content, score
       FROM hybrid_search($1::vector, $2, $3, $4, $5)`,
    [toVectorLiteral(queryVec), query, topK, vectorWeight, bm25Weight]
  );

  const hits = rows.map((r) => ({ id: r.id, content: r.content, score: Number(r.score) }));
  const durationMs = Date.now() - started;

  // The evidence gate: one structured line capturing what was asked, how many
  // hits came back, the best score, and how long it took.
  console.log(
    JSON.stringify({
      event: "rag_search",
      query,
      hits: hits.length,
      top_score: hits.length ? hits[0].score : null,
      duration_ms: durationMs,
    })
  );

  return { hits };
}

module.exports = { search };
