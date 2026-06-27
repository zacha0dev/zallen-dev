// auth.js - bearer-token check for the RAG HTTP surface. Same shape as
// mcp-node's mcp.js authorized(): pull the Bearer token, compare to the secret
// from Key Vault. Hardened with a timing-safe compare so the check does not leak
// the secret length/prefix through response timing.
const crypto = require("crypto");
const { getSecret } = require("./secrets");

// Constant-time string compare that does not early-return on length mismatch.
function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  if (ab.length !== bb.length) {
    // Still run a compare against a same-length buffer to keep timing flat.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

// Returns true if the request carries the expected Bearer token.
// secretName defaults to the RAG service token; reuses the KV-via-MSI path.
async function authorized(authHeader, secretName = "rag-bearer-token") {
  const bearer = String(authHeader || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return false;
  let expected;
  try {
    expected = await getSecret(secretName);
  } catch {
    return false;
  }
  if (!expected) return false;
  return timingSafeEqual(bearer, expected);
}

module.exports = { authorized, timingSafeEqual };
