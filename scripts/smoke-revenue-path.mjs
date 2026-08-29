#!/usr/bin/env node
/**
 * Post-deploy smoke test for the one real revenue flow:
 *   public intake -> durable database write -> dashboard visibility
 *
 * Run against a live, already-deployed URL. Not part of `npm test` (which
 * stays hermetic, no network) — this is meant to run after a deploy, via
 * `npm run smoke -- --base-url=<url>` or the smoke-revenue-path workflow.
 *
 * What it proves, in order:
 *  1. POST /api/lead persists a real row (a fixed sentinel email, so every
 *     run updates the same row instead of accumulating test data).
 *  2. POST /api/dashboard/login with the real human password succeeds and
 *     issues a session cookie — the same path a person uses, not a
 *     shortcut.
 *  3. GET /api/dashboard/overview, authenticated with that cookie, shows
 *     the sentinel lead in pipeline.recentDeals — proving the dashboard a
 *     human logs into actually reflects a real write, not synthetic data.
 *  4. GET /api/health responds.
 *
 * Exits 0 only if all four steps pass. Fails loudly and specifically
 * otherwise — no silent partial success.
 */

const SENTINEL_EMAIL = 'smoke-test@internal.verification.local';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function getBaseUrl() {
  const args = parseArgs(process.argv.slice(2));
  const raw = args['base-url'] || process.env.SMOKE_BASE_URL;
  if (!raw) {
    throw new Error('Missing target URL: pass --base-url=<url> or set SMOKE_BASE_URL');
  }
  return raw.replace(/\/+$/, '');
}

function extractCookiePair(setCookieHeader) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(';')[0];
}

async function step(name, fn) {
  process.stdout.write(`[smoke] ${name} ... `);
  try {
    const result = await fn();
    console.log('PASS');
    return result;
  } catch (err) {
    console.log('FAIL');
    console.error(`[smoke]   -> ${err.message}`);
    throw err;
  }
}

async function main() {
  const baseUrl = getBaseUrl();
  const dashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (!dashboardPassword) {
    throw new Error('Missing DASHBOARD_PASSWORD — cannot prove dashboard visibility without the real human credential');
  }

  console.log(`[smoke] target: ${baseUrl}`);

  // 1. Public intake -> durable write
  await step('POST /api/lead writes a durable row', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test',
        email: SENTINEL_EMAIL,
        investment_objective: 'smoke_test',
        budget_band: 'smoke_test',
        notes: `Automated post-deploy smoke test. Last run: ${new Date().toISOString()}`,
        lead_magnet: 'smoke_test',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200 || body.ok !== true || body.stored !== true) {
      throw new Error(`expected 200 { ok:true, stored:true }, got ${res.status} ${JSON.stringify(body)}`);
    }
    return body;
  });

  // 2. Human dashboard login (real password, real cookie — never a service key)
  const cookiePair = await step('POST /api/dashboard/login issues a session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: dashboardPassword }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200 || body.success !== true) {
      throw new Error(`expected 200 { success:true }, got ${res.status} ${JSON.stringify(body)}`);
    }
    const cookie = extractCookiePair(res.headers.get('set-cookie'));
    if (!cookie) throw new Error('login succeeded but no Set-Cookie header was returned');
    return cookie;
  });

  // 3. Dashboard visibility: the just-written lead must be visible through
  //    the same session a human uses, not just reachable via direct DB query.
  await step('GET /api/dashboard/overview shows the sentinel lead', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/overview`, {
      headers: { Cookie: cookiePair },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) {
      throw new Error(`expected 200, got ${res.status} ${JSON.stringify(body)}`);
    }
    const deals = body?.pipeline?.recentDeals;
    if (!Array.isArray(deals)) {
      throw new Error(`response has no pipeline.recentDeals array: ${JSON.stringify(body).slice(0, 300)}`);
    }
    const found = deals.some((d) => (d.email || '').toLowerCase() === SENTINEL_EMAIL);
    if (!found) {
      throw new Error(`sentinel lead (${SENTINEL_EMAIL}) not present in pipeline.recentDeals — dashboard visibility is broken`);
    }
  });

  // 4. Baseline liveness
  await step('GET /api/health responds', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.status !== 200) {
      throw new Error(`expected 200, got ${res.status}`);
    }
  });

  console.log('[smoke] all checks passed — revenue path verified end-to-end');
}

main().catch((err) => {
  console.error(`[smoke] FAILED: ${err.message}`);
  process.exit(1);
});
