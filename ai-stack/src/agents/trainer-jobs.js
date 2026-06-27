// trainer-jobs.js - async-persist for TRAINER runs. Mirrors jobs.js (the
// reasoner's async-persist), but for the trainer's BATCH model it adds a second
// table: trainer_jobs holds the job envelope (the batch input + summary result),
// and enrichment_tracker holds ONE ROW PER NODE (the x10 per-dimension grades).
//
// This is a PARALLEL path to jobs.js rather than a generalization of it: the
// reasoner_jobs table + jobs.js are stacked from Phase 2 and changing their shape
// would ripple into the reasoner runner/server/tests. A parallel trainer path is
// the low-risk choice (noted in the Phase-3 plan). If a future phase wants ONE
// generic agent_jobs table, both paths collapse into it then.
//
// Job lifecycle (same as the reasoner): pending -> running -> done | dlq | error.
// Tables are defined in src/db/schema.sql.
const { randomUUID } = require("crypto");
const { getPool } = require("../lib/db");

// createJob - insert a pending trainer job row; record the batch input (nodes).
async function createJob(input) {
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO trainer_jobs (id, status, input) VALUES ($1, 'pending', $2::jsonb)`,
    [id, JSON.stringify(input)]
  );
  return id;
}

async function markRunning(id) {
  const pool = await getPool();
  await pool.query(
    `UPDATE trainer_jobs SET status = 'running', updated_at = now() WHERE id = $1`,
    [id]
  );
}

async function markDone(id, result, iterations) {
  const pool = await getPool();
  await pool.query(
    `UPDATE trainer_jobs
       SET status = 'done', result = $2::jsonb, iterations = $3, updated_at = now()
     WHERE id = $1`,
    [id, JSON.stringify(result), iterations || null]
  );
}

async function markFailed(id, error, status = "error", iterations) {
  const pool = await getPool();
  await pool.query(
    `UPDATE trainer_jobs
       SET status = $2, error = $3, iterations = $4, updated_at = now()
     WHERE id = $1`,
    [id, status, String(error && error.message ? error.message : error), iterations || null]
  );
}

// getJob - read a trainer job row back for the status endpoint.
async function getJob(id) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT id, status, input, result, error, iterations, created_at, updated_at
       FROM trainer_jobs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// upsertNode - persist ONE node's enrichments + grades to the enrichment_tracker.
// Keyed by (run_id, node_id) so a re-run of the same job replaces the prior row
// rather than duplicating it. This is the x10 per-node persistence seam the
// runner calls once per node.
async function upsertNode(runId, node) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO enrichment_tracker
       (id, run_id, node_id, context, enrichments, grades, status, attempts, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, now())
     ON CONFLICT (run_id, node_id) DO UPDATE SET
       context     = EXCLUDED.context,
       enrichments = EXCLUDED.enrichments,
       grades      = EXCLUDED.grades,
       status      = EXCLUDED.status,
       attempts    = EXCLUDED.attempts,
       updated_at  = now()`,
    [
      runId,
      node.id,
      node.context,
      JSON.stringify(node.enrichments || {}),
      JSON.stringify(node.grades || {}),
      node.status,
      node.attempts || 0,
    ]
  );
}

// listNodes - read the tracker rows for a run (used by a status endpoint / report).
async function listNodes(runId) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT node_id, context, enrichments, grades, status, attempts, updated_at
       FROM enrichment_tracker WHERE run_id = $1 ORDER BY updated_at ASC`,
    [runId]
  );
  return rows;
}

// makeDb - build the per-job persistence handle the runner receives as ctx.db.
// It carries the runId (so upsertNode keys tracker rows to this run) and the
// tracker writers. createJob returns the id used here.
function makeDb(runId) {
  return {
    runId,
    upsertNode: (rid, node) => upsertNode(rid || runId, node),
    listNodes: () => listNodes(runId),
  };
}

// runDetached - kick off the trainer for a created job WITHOUT awaiting it, so the
// HTTP handler returns 202 right away. Mirrors jobs.runDetached but writes to
// trainer_jobs and wires a tracker-aware ctx.db. `runner.run(input, ctx)` is
// injected so this is testable.
function runDetached(id, input, runner, ctx) {
  // Ensure the runner's ctx.db is the tracker handle for THIS run id.
  const runCtx = Object.assign({}, ctx, { db: makeDb(id) });
  // Deliberately not awaited by the caller.
  (async () => {
    try {
      await markRunning(id);
      const out = await runner.run(input, runCtx);
      await markDone(id, out.result, out.iterations);
    } catch (err) {
      const status = err && err.dlq ? "dlq" : "error";
      await markFailed(id, err, status, err && err.iterations).catch(() => {});
      const logger = (ctx && ctx.logger) || console;
      try {
        logger.log(JSON.stringify({ event: "trainer_job_failed", id, status, error: String(err.message || err) }));
      } catch {
        /* logging must never throw */
      }
    }
  })();
  return id;
}

module.exports = {
  createJob,
  markRunning,
  markDone,
  markFailed,
  getJob,
  upsertNode,
  listNodes,
  makeDb,
  runDetached,
};
