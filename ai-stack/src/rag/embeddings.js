// embeddings.js - a small provider-agnostic adapter so the RAG plane is not
// locked to one embedding vendor. Pick the provider with EMBEDDING_PROVIDER
// (openai | azure | cohere); the API key is read from Key Vault by a
// per-provider secret name. Every provider returns 1536-dim vectors to match
// the rag_chunks.embedding column (see src/db/schema.sql).
//
// Fail-closed: if EMBEDDING_PROVIDER is unset/unknown, or the key secret is
// missing, embed() throws a clear message instead of silently degrading.
const { getSecret } = require("../lib/secrets");

const DIM = 1536;

// Default model + key-secret per provider; override the model via env.
const PROVIDERS = {
  openai: {
    keySecret: "openai-api-key",
    model: () => process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  },
  azure: {
    keySecret: "azure-openai-api-key",
    model: () => process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  },
  cohere: {
    keySecret: "cohere-api-key",
    model: () => process.env.EMBEDDING_MODEL || "embed-english-v3.0",
  },
};

function providerName() {
  const name = (process.env.EMBEDDING_PROVIDER || "").toLowerCase().trim();
  if (!name) {
    throw new Error(
      "EMBEDDING_PROVIDER is not set. Set it to one of: openai | azure | cohere."
    );
  }
  if (!PROVIDERS[name]) {
    throw new Error(
      `EMBEDDING_PROVIDER='${name}' is not supported. Use one of: ${Object.keys(PROVIDERS).join(", ")}.`
    );
  }
  return name;
}

async function keyFor(name) {
  const secretName = PROVIDERS[name].keySecret;
  let key;
  try {
    key = await getSecret(secretName);
  } catch {
    key = null;
  }
  if (!key) {
    throw new Error(
      `Embedding key secret '${secretName}' is not present in Key Vault for provider '${name}'.`
    );
  }
  return key;
}

async function embedOpenAILike(baseUrl, headers, model, inputs) {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function embedCohere(key, model, inputs) {
  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      texts: inputs,
      input_type: "search_document",
      embedding_types: ["float"],
      output_dimension: DIM,
    }),
  });
  if (!res.ok) throw new Error(`cohere embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embeddings.float;
}

// embed(texts) -> number[][] - one 1536-dim vector per input string.
async function embed(texts) {
  const inputs = Array.isArray(texts) ? texts : [texts];
  if (inputs.length === 0) return [];
  const name = providerName();
  const key = await keyFor(name);
  const model = PROVIDERS[name].model();

  let vectors;
  if (name === "openai") {
    vectors = await embedOpenAILike(
      "https://api.openai.com/v1/embeddings",
      { Authorization: `Bearer ${key}` },
      model,
      inputs
    );
  } else if (name === "azure") {
    // Azure OpenAI: endpoint + deployment come from env; key is the secret.
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || model;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";
    if (!endpoint) {
      throw new Error("AZURE_OPENAI_ENDPOINT is required when EMBEDDING_PROVIDER=azure.");
    }
    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
    vectors = await embedOpenAILike(url, { "api-key": key }, model, inputs);
  } else {
    vectors = await embedCohere(key, model, inputs);
  }

  for (const v of vectors) {
    if (!Array.isArray(v) || v.length !== DIM) {
      throw new Error(
        `embedding provider '${name}' returned dimension ${v && v.length}; expected ${DIM}.`
      );
    }
  }
  return vectors;
}

module.exports = { embed, DIM, providerName };
