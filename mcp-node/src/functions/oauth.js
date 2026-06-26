// oauth.js - the node's OAuth 2.0 flow. An AI client (Claude, ChatGPT) runs the
// authorization-code dance against these endpoints; the node validates against
// its own Key Vault and returns its bearer token as the access token.
//
// routePrefix is "" (see host.json), so these serve at /authorize, /token,
// /.well-known/oauth-authorization-server directly.
const { app } = require("@azure/functions");
const crypto = require("crypto");
const { getSecret } = require("../lib/secrets");
const { clientIp, authThrottleRetryAfter, recordAuthFailure, recordAuthSuccess } = require("../lib/throttle");

// Constant-time string compare (mirrors auth.ts timingSafeStringEqual): a length
// mismatch still runs a constant-time compare so length isn't leaked by timing.
function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a), "utf8");
  const bBuf = Buffer.from(String(b), "utf8");
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Short-lived auth codes. Single-tenant scale-to-zero node, so in-memory is
// acceptable; codes expire in 10 minutes and are single-use.
const codes = new Map(); // code -> { redirectUri, state, at }
const CODE_TTL_MS = 10 * 60 * 1000;

function origin(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// GET /authorize - validate client_id, mint a code, redirect back to the client.
app.http("authorize", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "authorize",
  handler: async (request, context) => {
    const q = new URL(request.url).searchParams;
    const clientId = q.get("client_id");
    const redirectUri = q.get("redirect_uri");
    const state = q.get("state") || "";

    const expected = await getSecret("oauth-client-id");
    if (!clientId || clientId !== expected) {
      return { status: 400, body: "invalid client_id" };
    }
    if (!redirectUri) {
      return { status: 400, body: "missing redirect_uri" };
    }

    const code = crypto.randomBytes(24).toString("hex");
    codes.set(code, { redirectUri, state, at: Date.now() });

    const back = new URL(redirectUri);
    back.searchParams.set("code", code);
    if (state) back.searchParams.set("state", state);
    return { status: 302, headers: { Location: back.toString() } };
  },
});

// POST /token - validate client_id + client_secret + code, return the bearer.
app.http("token", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "token",
  handler: async (request, context) => {
    const body = await request.text();
    const form = new URLSearchParams(body);
    const clientId = form.get("client_id");
    const clientSecret = form.get("client_secret");
    const code = form.get("code");

    const [expectedId, expectedSecret, bearer] = await Promise.all([
      getSecret("oauth-client-id"),
      getSecret("oauth-client-secret"),
      getSecret("mcp-bearer-token"),
    ]);

    if (clientId !== expectedId || clientSecret !== expectedSecret) {
      return { status: 401, jsonBody: { error: "invalid_client" } };
    }

    const entry = code && codes.get(code);
    if (!entry || Date.now() - entry.at > CODE_TTL_MS) {
      return { status: 400, jsonBody: { error: "invalid_grant" } };
    }
    codes.delete(code); // single-use

    return {
      status: 200,
      jsonBody: {
        access_token: bearer,
        token_type: "Bearer",
        expires_in: 31536000, // 1 year; rotation invalidates server-side
        scope: "mcp",
      },
    };
  },
});

// Discovery metadata so clients can auto-configure the endpoints.
app.http("oauth-metadata", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: ".well-known/oauth-authorization-server",
  handler: async (request) => {
    const iss = origin(request);
    return {
      status: 200,
      jsonBody: {
        issuer: iss,
        authorization_endpoint: `${iss}/authorize`,
        token_endpoint: `${iss}/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        scopes_supported: ["mcp"],
      },
    };
  },
});

module.exports = {};
