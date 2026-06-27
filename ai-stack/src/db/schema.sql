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

-- ---------------------------------------------------------------------------
-- Phase 2: the agent plane's async-persist queue.
--
-- reasoner_jobs - one row per agent run. The reasoner loop can outlast an HTTP
-- request (LLM calls x up to maxIterations), so POST /agents/reasoner returns
-- 202 + job_id and the work runs detached, writing here; GET .../status reads
-- the row back. Lifecycle: pending -> running -> done | dlq | error.
--   task    - the input { task, topK } the job was created with
--   result  - the gated { answer, citations } once status = done
--   error   - the failure message when status = dlq (loop ceiling) or error
--   iterations - how many produce->gate cycles the loop ran
CREATE TABLE IF NOT EXISTS reasoner_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'running', 'done', 'dlq', 'error')),
  task       jsonb NOT NULL,
  result     jsonb,
  error      text,
  iterations int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for sweeping by status (e.g. a future reaper finding stuck 'running'
-- jobs, or listing the DLQ for inspection).
CREATE INDEX IF NOT EXISTS reasoner_jobs_status_idx
  ON reasoner_jobs (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 3: the TRAINER plane (the x10 Multi-Node Enrichment Framework).
--
-- trainer_jobs - one row per trainer BATCH run (parallel to reasoner_jobs). The
-- trainer enriches a batch of nodes across 10 dimensions, which can outlast an
-- HTTP request, so POST /agents/trainer returns 202 + job_id and the work runs
-- detached, writing here; GET .../status reads the row back.
--   input   - the { nodes: [{ id, context }] } batch the job was created with
--   result  - the { nodes, summary } once status = done
--   error   - the failure message when status = dlq | error
--   iterations - total enrich->check attempts summed across the batch
CREATE TABLE IF NOT EXISTS trainer_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'running', 'done', 'dlq', 'error')),
  input      jsonb NOT NULL,
  result     jsonb,
  error      text,
  iterations int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainer_jobs_status_idx
  ON trainer_jobs (status, created_at DESC);

-- enrichment_tracker - ONE ROW PER NODE (the x10 per-node persistence). The
-- runner upserts each node here as it finishes it, so per-dimension grades are
-- queryable independent of the job envelope. Keyed (run_id, node_id) so a re-run
-- of the same job replaces the node's row rather than duplicating it.
--   run_id      - the trainer_jobs.id this node belongs to
--   node_id     - the deployer-supplied node id (stable across runs)
--   context     - the raw training-context unit that was enriched
--   enrichments - { <dimension>: "<enriched text>" } across the 10 dimensions
--   grades      - { <dimension>: { pass, reason } } per-dimension grades
--   status      - pending | enriched | checked | done | failed
--   attempts    - how many enrich->check cycles this node took
CREATE TABLE IF NOT EXISTS enrichment_tracker (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid REFERENCES trainer_jobs (id) ON DELETE CASCADE,
  node_id     text NOT NULL,
  context     text,
  enrichments jsonb NOT NULL DEFAULT '{}'::jsonb,
  grades      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'enriched', 'checked', 'done', 'failed')),
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, node_id)
);

-- Index for sweeping the tracker by run (the common read: all nodes in a run)
-- and by status (e.g. listing failed nodes for inspection / re-enrichment).
CREATE INDEX IF NOT EXISTS enrichment_tracker_run_idx
  ON enrichment_tracker (run_id, status);
