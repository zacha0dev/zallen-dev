// ingest.js - fill the vector store: chunk source text (~400 tokens, 50
// overlap) -> embed each chunk -> upsert into rag_chunks. Embedding provider is
// pluggable (see embeddings.js); the DB pool reads its password from Key Vault.
//
// Token estimate: we chunk on words using a ~0.75 words/token heuristic, so
// ~400 tokens ~= ~300 words, ~50 tokens overlap ~= ~38 words. Good enough for
// retrieval chunking without pulling in a tokenizer dependency.
const { randomUUID } = require("crypto");
const { embed } = require("./embeddings");
const { getPool, toVectorLiteral } = require("../lib/db");

const WORDS_PER_TOKEN = 0.75;
const CHUNK_TOKENS = Number(process.env.CHUNK_TOKENS || 400);
const OVERLAP_TOKENS = Number(process.env.CHUNK_OVERLAP_TOKENS || 50);
const EMBED_BATCH = Number(process.env.EMBED_BATCH || 32);

function tokensToWords(t) {
  return Math.max(1, Math.round(t * WORDS_PER_TOKEN));
}

// chunkText - split text into overlapping word windows.
function chunkText(text, chunkTokens = CHUNK_TOKENS, overlapTokens = OVERLAP_TOKENS) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const size = tokensToWords(chunkTokens);
  const overlap = Math.min(tokensToWords(overlapTokens), size - 1);
  const step = Math.max(1, size - overlap);
  const chunks = [];
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + size);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (i + size >= words.length) break;
  }
  return chunks;
}

// ingest - chunk + embed + upsert one or more documents.
//   docs: [{ content, metadata }] OR a single { content, metadata }
// Returns { documents, chunks } counts.
async function ingest(docs) {
  const list = Array.isArray(docs) ? docs : [docs];
  const pool = await getPool();

  // Build the flat list of chunks with their source metadata.
  const rows = [];
  for (const doc of list) {
    if (!doc || typeof doc.content !== "string" || !doc.content.trim()) continue;
    const pieces = chunkText(doc.content);
    pieces.forEach((content, idx) => {
      rows.push({
        id: randomUUID(),
        content,
        metadata: { ...(doc.metadata || {}), chunk_index: idx, chunk_count: pieces.length },
      });
    });
  }
  if (rows.length === 0) return { documents: list.length, chunks: 0 };

  // Embed in batches to respect provider request limits.
  for (let i = 0; i < rows.length; i += EMBED_BATCH) {
    const batch = rows.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map((r) => r.content));
    batch.forEach((r, j) => {
      r.embedding = vectors[j];
    });
  }

  // Upsert each chunk. id is the conflict target so a re-ingest is idempotent
  // when the caller supplies stable ids in metadata-driven workflows.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `INSERT INTO rag_chunks (id, content, metadata, embedding)
         VALUES ($1, $2, $3::jsonb, $4::vector)
         ON CONFLICT (id) DO UPDATE
           SET content = EXCLUDED.content,
               metadata = EXCLUDED.metadata,
               embedding = EXCLUDED.embedding`,
        [r.id, r.content, JSON.stringify(r.metadata), toVectorLiteral(r.embedding)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { documents: list.length, chunks: rows.length };
}

module.exports = { ingest, chunkText };
