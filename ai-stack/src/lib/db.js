// db.js - a single shared Postgres pool for the RAG data plane. Connection
// details come from env (set by the bicep stack) and the admin password from
// Key Vault via managed identity, so no credential is ever hard-coded.
//
// pgvector note: vector columns are sent/received as the text form
// '[0.1,0.2,...]'. Helpers below convert a JS number[] to that literal.
const { Pool } = require("pg");
const { getSecret } = require("./secrets");

let pool;

async function getPool() {
  if (pool) return pool;
  const host = process.env.PG_HOST;
  const database = process.env.PG_DATABASE || "rag";
  const user = process.env.PG_USER;
  if (!host || !user) {
    throw new Error("PG_HOST / PG_USER env vars are not set");
  }
  // Password secret name is configurable; defaults to what the bicep seeds.
  const password = await getSecret(process.env.PG_PASSWORD_SECRET || "pg-admin-password");
  pool = new Pool({
    host,
    database,
    user,
    password,
    port: Number(process.env.PG_PORT || 5432),
    ssl: { rejectUnauthorized: false }, // Azure PG Flexible requires TLS
    max: Number(process.env.PG_POOL_MAX || 4),
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

// Render a JS number[] as a pgvector literal: '[0.1,0.2,...]'.
function toVectorLiteral(arr) {
  if (!Array.isArray(arr)) throw new Error("embedding must be an array of numbers");
  return `[${arr.join(",")}]`;
}

module.exports = { getPool, toVectorLiteral };
