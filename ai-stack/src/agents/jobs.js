// jobs.js - async-persist for agent runs. The reasoner loop can take longer
// than an HTTP request should hold open (LLM calls x up to maxIterations), so
// POST /agents/reasoner returns 202 + job_id immediately and the work runs
// detached, writing its result into the reasoner_jobs table. GET .../status
// reads the row back. This sidesteps the 60s ingress/request timeout.
//
// Lifecycle: pending -> running -> done | dlq (dead-letter on the loop ceiling)
// or -> error (an unexpected throw). The table is defined in src/db/schema.sql.
const { randomUUID } = require("crypto");
const { getPool } = require("../lib/db");

// createJob - insert a pending row and return its id. Records the input task.
async function createJob(task) {
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO reasoner_jobs (id, status, task) VALUES ($1, 'pending', $2::jsonb)`,
    [id, JSON.stringify(task)]
  );
  return id;
}

async function markRunning(id) {
  const pool = await getPool();
  await pool.query(
    `UPDATE reasoner_jobs SET status = 'running', updated_at = now() WHERE id = $1`,
    [id]
  );
}

async function markDone(id, result, iterations) {
  const pool = await getPool();
  await pool.query(
    `UPDATE reasoner_jobs
       SET status = 'done', result = $2::jsonb, iterations = $3, updated_at = now()
     WHERE id = $1`,
    [id, JSON.stringify(result), iterations || null]
  );
}

async function markFailed(id, error, status = "error", iterations) {
  const pool = await getPool();
  await pool.query(
    `UPDATE reasoner_jobs
       SET status = $2, error = $3, iterations = $4, updated_at = now()
     WHERE id = $1`,
    [id, status, String(error && error.message ? error.message : error), iterations || null]
  );
}

// getJob - read a job row back for the status endpoint.
async function getJob(id) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT id, status, task, result, error, iterations, created_at, updated_at
       FROM reasoner_jobs WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// runDetached - kick off the runner for a created job WITHOUT awaiting it, so the
// HTTP handler can return 202 right away. `runner.run(task, ctx)` is injected so
// this is testable; on success markDone, on a DLQ throw markFailed(status=dlq),
// on any other throw markFailed(status=error). Persistence handle is also exposed
// on ctx.db for runners that want to stream progress.
function runDetached(id, task, runner, ctx) {
  // Deliberately not awaited by the caller.
  (async () => {
    try {
      await markRunning(id);
      const out = await runner.run(task, ctx);
      await markDone(id, out.result, out.iterations);
    } catch (err) {
      const status = err && err.dlq ? "dlq" : "error";
      await markFailed(id, err, status, err && err.iterations).catch(() => {});
      const logger = (ctx && ctx.logger) || console;
      try {
        logger.log(JSON.stringify({ event: "reasoner_job_failed", id, status, error: String(err.message || err) }));
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
  runDetached,
};
