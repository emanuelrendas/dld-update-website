/**
 * Rate limiting for the inbound write routes.
 *
 * WHAT THIS IS AND IS NOT
 *
 * The counter lives in the memory of one serverless instance. Vercel runs
 * several instances per region and recycles them, so a determined flood
 * spread across warm instances gets more through than the limit implies.
 * This stops a single source hammering one endpoint — a stuck retry loop,
 * a script, a form resubmitted a hundred times — which is what the write
 * routes are actually exposed to today.
 *
 * It is not a defence against a distributed attack. That needs a limiter
 * with shared state (Upstash, Vercel KV, or Supabase itself) and belongs
 * with whoever owns the infrastructure budget.
 *
 * Fails open. If the bookkeeping throws, the request proceeds: losing a
 * genuine lead costs more than admitting one extra request.
 */

const BUCKETS = new Map();

/* Bounded so a spray of distinct IPs cannot grow the map without limit.
   At the ceiling the oldest entries go first. */
const MAX_KEYS = 5000;

export const LIMITS = {
  /* A person fills the brief form once, maybe twice if they mistype an
     email. Ten in ten minutes is far past honest use. */
  write: { max: 10, windowMs: 10 * 60 * 1000 },
  /* Telemetry is chattier by nature: a page view, a few calculator
     interactions, a submit. */
  telemetry: { max: 120, windowMs: 10 * 60 * 1000 },
};

/**
 * The client address, from the proxy headers Vercel sets. x-forwarded-for
 * is a client-controlled header everywhere else, but on Vercel the edge
 * rewrites it, so the first entry is the real peer.
 */
export function clientKey(headers = {}) {
  const fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const first = String(fwd).split(',')[0].trim();
  return first || headers['x-real-ip'] || headers['x-vercel-forwarded-for'] || 'unknown';
}

/**
 * Returns { allowed, remaining, retryAfterSeconds }.
 */
export function checkRateLimit(key, limit = LIMITS.write, now = Date.now()) {
  try {
    if (!key || key === 'unknown') return { allowed: true, remaining: limit.max, retryAfterSeconds: 0 };

    const bucketKey = `${key}|${limit.max}|${limit.windowMs}`;
    const entry = BUCKETS.get(bucketKey);

    if (!entry || now >= entry.resetAt) {
      if (BUCKETS.size >= MAX_KEYS) {
        /* Map preserves insertion order, so the first key is the oldest. */
        const oldest = BUCKETS.keys().next().value;
        if (oldest !== undefined) BUCKETS.delete(oldest);
      }
      BUCKETS.set(bucketKey, { count: 1, resetAt: now + limit.windowMs });
      return { allowed: true, remaining: limit.max - 1, retryAfterSeconds: 0 };
    }

    entry.count += 1;

    if (entry.count > limit.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }

    return { allowed: true, remaining: limit.max - entry.count, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, remaining: limit.max, retryAfterSeconds: 0 };
  }
}

/* Test seam. Not called by any route. */
export function __resetRateLimit() {
  BUCKETS.clear();
}
