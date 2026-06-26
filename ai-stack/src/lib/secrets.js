// secrets.js - read secrets from the stack's own Key Vault using the Container
// App's managed identity. Mirrors mcp-node/src/lib/secrets.js: short TTL cache
// so a rotated secret is picked up quickly instead of being served stale.
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const TTL_MS = 60_000; // 1 minute; rotation is picked up within a minute
const cache = new Map(); // name -> { value, at }

let client;
function getClient() {
  if (client) return client;
  const url = process.env.KEY_VAULT_URL;
  if (!url) throw new Error("KEY_VAULT_URL env var is not set");
  client = new SecretClient(url, new DefaultAzureCredential());
  return client;
}

async function getSecret(name) {
  const hit = cache.get(name);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const secret = await getClient().getSecret(name);
  cache.set(name, { value: secret.value, at: now });
  return secret.value;
}

module.exports = { getSecret };
