// secrets.js - read secrets from the node's own Key Vault using the Function
// App's managed identity. Short TTL cache so a rotated secret is picked up
// quickly instead of being served stale from a warm instance.
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const TTL_MS = 60_000; // 1 minute; rotation is picked up within a minute
const cache = new Map(); // name -> { value, at }

// Some secrets must NEVER be cached - they are the credentials a deployer
// rotates to revoke access, so a warm instance serving a stale cached value
// would keep a revoked credential alive for up to TTL_MS. Bypassing the cache
// on these (both read and store) makes rotation/revocation immediate.
// Rotatable credentials (bearer, OAuth secret) are never cached, so a rotation
// or revoke takes effect immediately instead of being served stale from a warm
// instance.
const NO_CACHE = new Set(["mcp-bearer-token", "oauth-client-secret", "oauth-client-id"]);

let client;
function getClient() {
  if (client) return client;
  const url = process.env.KEY_VAULT_URL;
  if (!url) throw new Error("KEY_VAULT_URL app setting is not set");
  client = new SecretClient(url, new DefaultAzureCredential());
  return client;
}

async function getSecret(name) {
  const now = Date.now();
  if (!NO_CACHE.has(name)) {
    const hit = cache.get(name);
    if (hit && now - hit.at < TTL_MS) return hit.value;
  }
  const secret = await getClient().getSecret(name);
  if (!NO_CACHE.has(name)) cache.set(name, { value: secret.value, at: now });
  return secret.value;
}

module.exports = { getSecret };
