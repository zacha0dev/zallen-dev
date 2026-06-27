// llm.js - a tiny provider-agnostic chat-completion client, mirroring the same
// fetch-only, no-SDK approach as src/rag/embeddings.js so the agent plane adds
// zero new dependencies. The key is read from Key Vault by a per-provider
// secret name; the provider is chosen with LLM_PROVIDER (anthropic | openai).
//
// Exposes one method the agents inject as ctx.llm:
//   complete({ system, prompt, model, maxTokens }) -> string
//
// Fail-closed: a missing provider/key throws a clear message. The agents pass a
// model id explicitly (their cost-tier knob), so this client does not pick tiers
// itself - it just routes to the right provider HTTP API.
const { getSecret } = require("../lib/secrets");

const PROVIDERS = {
  anthropic: { keySecret: "anthropic-api-key" },
  openai: { keySecret: "openai-api-key" },
};

function providerName() {
  const name = (process.env.LLM_PROVIDER || "anthropic").toLowerCase().trim();
  if (!PROVIDERS[name]) {
    throw new Error(
      `LLM_PROVIDER='${name}' is not supported. Use one of: ${Object.keys(PROVIDERS).join(", ")}.`
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
      `LLM key secret '${secretName}' is not present in Key Vault for provider '${name}'.`
    );
  }
  return key;
}

async function completeAnthropic(key, { system, prompt, model, maxTokens }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 1024,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic messages ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("");
}

async function completeOpenAI(key, { system, prompt, model, maxTokens }) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: maxTokens || 1024, messages }),
  });
  if (!res.ok) throw new Error(`openai chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return ((data.choices || [])[0] || {}).message?.content || "";
}

// complete - route one completion to the configured provider.
async function complete({ system, prompt, model, maxTokens } = {}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("llm.complete requires a non-empty 'prompt' string");
  }
  if (!model || typeof model !== "string") {
    throw new Error("llm.complete requires an explicit 'model' (the cost-tier knob)");
  }
  const name = providerName();
  const key = await keyFor(name);
  if (name === "anthropic") return completeAnthropic(key, { system, prompt, model, maxTokens });
  return completeOpenAI(key, { system, prompt, model, maxTokens });
}

module.exports = { complete, providerName };
