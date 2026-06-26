-- schema.sql - the RAG data plane. Run once against the `rag` database on the
-- ai-stack Postgres Flexible Server (idempotent: safe to re-run). Sets up
-- pgvector, the chunk store, and a hybrid (vector + keyword) search function.
--
-- Embedding dimension is 1536 (OpenAI text-embedding-3-small / Azure ada-002 /
-- Cohere embed-english-v3.0 truncated). If you switch to a provider with a
-- different native dimension, change vector(1536) here AND re-ingest - mixed
-- dimensions cannot coexist in one column.

CREATE EXTENSION IF NOT EXISTS vector;

-- The chunk store: one row per chunk of source text.
CREATE TABLE IF NOT EXISTS rag_chunks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content   text NOT NULL,
  metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  -- Generated keyword-search column: kept in sync with content automatically.
  tsv       tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Approximate-nearest-neighbour index for the vector half of the search.
-- ivfflat needs ANALYZE after the first bulk load to pick good lists; cosine
-- ops match the distance used in hybrid_search.
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- GIN index for the keyword (BM25-style ts_rank) half of the search.
CREATE INDEX IF NOT EXISTS rag_chunks_tsv_idx
  ON rag_chunks USING gin (tsv);

-- hybrid_search - blend vector similarity and keyword rank into one score.
--   score = vector_weight * (1 - cosine_distance) + bm25_weight * ts_rank
-- Returns the top match_count rows by blended score. Weights default to the
-- locked 0.6 / 0.4 split but are overridable per call.
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text      text,
  match_count     int   DEFAULT 10,
  vector_weight   float DEFAULT 0.6,
  bm25_weight     float DEFAULT 0.4
)
RETURNS TABLE (id uuid, content text, score float)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.content,
    (vector_weight * (1 - (c.embedding <=> query_embedding))
      + bm25_weight * ts_rank(c.tsv, plainto_tsquery('english', query_text)))::float
      AS score
  FROM rag_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY score DESC
  LIMIT match_count;
$$;
