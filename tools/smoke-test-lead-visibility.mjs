#!/usr/bin/env node
/**
 * MISSION-010 - Post-Deploy Smoke Test: Real Production Lead Visibility
 *
 * Proves, against a live deployment, that the full path actually works:
 *   1. Submit a real lead through POST /api/lead (the public intake).
 *   2. Log into the dashboard through POST /api/dashboard/login.
 *   3. Fetch GET /api/dashboard/overview and confirm the submitted lead
 *      is present in leadPipeline.recentLeads with dataSource SUPABASE_LIVE.
 *
 * This is the same path a real visitor and a real operator use — it does
 * not call internal functions directly. A pass here means the dashboard
 * is genuinely showing production lead data end-to-end, not synthetic
 * numbers wired to look real.
 *
 * Usage:
 *   BASE_URL=https://dashboard.emanuelrendas.com \
 *   DASHBOARD_PASSWORD=*** \
 *   LEAD_BASE_URL=https://emanuelrendas.com \
 *   node tools/smoke-test-lead-visibility.mjs
 *
 * LEAD_BASE_URL defaults to BASE_URL if not set (single-host deployments).
 * Exits non-zero on any failure, with a clear reason on stderr.
 */

const BASE_URL = process.env.BASE_URL;
const LEAD_BASE_URL = process.env.LEAD_BASE_URL || BASE_URL;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!BASE_URL) fail('BASE_URL env var is required (e.g. https://dashboard.emanuelrendas.com)');
if (!DASHBOARD_PASSWORD) fail('DASHBOARD_PASSWORD env var is required to log into the dashboard');

async function main() {
  const marker = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@smoketest.emanuelrendas.com`;
  console.log(`Smoke test lead: ${marker}`);

  // 1. Submit a real lead through the public intake.
  console.log(`\n[1/3] POST ${LEAD_BASE_URL}/api/lead`);
  const leadRes = await fetch(`${LEAD_BASE_URL}/api/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Post-Deploy Smoke Test',
      email: marker,
      notes: 'Automated post-deploy smoke test — MISSION-010. Safe to delete.',
      lead_magnet: 'smoke_test',
    }),
  });
  const leadBody = await leadRes.json().catch(() => ({}));
  if (leadRes.status !== 200 || !leadBody.ok) {
    fail(`lead submission did not succeed (status ${leadRes.status}): ${JSON.stringify(leadBody)}`);
  }
  console.log(`  OK: stored=${leadBody.stored} id=${leadBody.id}`);

  // 2. Log into the dashboard.
  console.log(`\n[2/3] POST ${BASE_URL}/api/dashboard/login`);
  const loginRes = await fetch(`${BASE_URL}/api/dashboard/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: DASHBOARD_PASSWORD }),
  });
  const setCookie = loginRes.headers.get('set-cookie');
  if (loginRes.status !== 200 || !setCookie) {
    fail(`dashboard login did not succeed (status ${loginRes.status})`);
  }
  const cookiePair = setCookie.split(';')[0];
  console.log('  OK: session established');

  // 3. Confirm the lead is visible on the dashboard the browser renders.
  console.log(`\n[3/3] GET ${BASE_URL}/api/dashboard/overview`);
  const overviewRes = await fetch(`${BASE_URL}/api/dashboard/overview`, {
    headers: { cookie: cookiePair },
  });
  const overview = await overviewRes.json().catch(() => ({}));
  if (overviewRes.status !== 200) {
    fail(`dashboard overview request failed (status ${overviewRes.status})`);
  }

  const leadPipeline = overview.leadPipeline;
  if (!leadPipeline) fail('overview response has no leadPipeline field — dashboard is not wired to real leads');
  if (leadPipeline.dataSource !== 'SUPABASE_LIVE') {
    fail(`leadPipeline.dataSource is "${leadPipeline.dataSource}", expected SUPABASE_LIVE — Supabase is not configured in this deployment`);
  }

  const recent = leadPipeline.recentLeads || [];
  const found = recent.find((l) => l.email === marker);
  if (!found) {
    fail(
      `submitted lead (${marker}) was not found in leadPipeline.recentLeads. ` +
      `Either the write path or the dashboard read path is broken. ` +
      `Got ${recent.length} recent leads.`
    );
  }
  console.log(`  OK: submitted lead is visible on the live dashboard (status=${found.status})`);

  console.log('\nPASS: dashboard reflects real production lead data end-to-end.');
}

main().catch((err) => fail(err.stack || err.message));
