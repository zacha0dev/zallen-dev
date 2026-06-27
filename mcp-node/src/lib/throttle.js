// throttle.js - minimal per-IP failed-auth throttle for the node's HTTP
// surface (/mcp and /token). Single-tenant node, so an in-memory, per-instance
// fixed-window lockout is enough; it makes bearer/secret brute-force expensive
// on a warm instance. It is NOT a global ceiling (the Function App can scale
// out), just a per-instance backstop. A minimal per-instance failed-auth
// backstop.
//
// Safe by construction: only FAILED attempts are counted, and a success clears
// the IP (recordAuthSuccess), so a valid caller is never throttled.

const WINDOW_MS = 60_000; // window for counting failures
const MAX_FAILS = 10; // failures per IP per window before a cooldown
const COOLDOWN_MS = 60_000; // how long an over-threshold IP is parked
const MAX_BUCKETS = 5000; // memory bound

const buckets = new Map(); // ip -> { fails: number[], cooldownUntil: number }

const now = () => Date.now();

// Best-effort client IP from the proxy chain (Azure sets X-Forwarded-For).
function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  const first = (xff.split(",")[0] || "").trim();
  const ip = first.replace(/:\d+$/, ""); // strip trailing :port
  return ip || "unknown";
}

// Seconds of cooldown remaining for this IP, or 0 if it may proceed.
function authThrottleRetryAfter(ip) {
  const b = buckets.get(ip);
  if (!b) return 0;
  const remaining = b.cooldownUntil - now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// Record a failed attempt; parks the IP in cooldown past the threshold.
function recordAuthFailure(ip) {
  const t = now();
  const b = buckets.get(ip) || { fails: [], cooldownUntil: 0 };
  b.fails = b.fails.filter((ts) => t - ts < WINDOW_MS);
  b.fails.push(t);
  if (b.fails.length >= MAX_FAILS) {
    b.cooldownUntil = t + COOLDOWN_MS;
    console.warn(JSON.stringify({ kind: "auth_throttle", ip, fails: b.fails.length, cooldownMs: COOLDOWN_MS }));
  }
  buckets.set(ip, b);

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      const lastFail = v.fails[v.fails.length - 1] || 0;
      if (v.cooldownUntil < t && lastFail < t - WINDOW_MS) buckets.delete(k);
    }
  }
}

// A valid credential clears the IP - legitimate callers are never throttled.
function recordAuthSuccess(ip) {
  buckets.delete(ip);
}

module.exports = { clientIp, authThrottleRetryAfter, recordAuthFailure, recordAuthSuccess };
