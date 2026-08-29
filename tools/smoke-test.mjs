#!/usr/bin/env node
/**
 * Post-Deploy Smoke Test — Real Production Lead Visibility (MISSION-010)
 *
 * Makes real HTTP calls against a deployed instance. Not an in-process
 * function call and not a mock: every check below is a genuine network
 * request to BASE_URL, exercising the actual routing, auth gate, and
 * (when DASHBOARD_PASSWORD is set) the live Supabase read path.
 *
 * Usage:
 *   BASE_URL=https://dashboard.emanuelrendas.com node tools/smoke-test.mjs
 *   BASE_URL=... DASHBOARD_PASSWORD=... node tools/smoke-test.mjs   (full check)
 *
 * Exit code is non-zero if any check fails, so this can gate CI.
 */

const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

if (!BASE_URL) {
  console.error('FAIL: BASE_URL is not set. Example: BASE_URL=https://dashboard.emanuelrendas.com node tools/smoke-test.mjs');
  process.exit(1);
}

let failures = 0;
let cookie = '';

function report(ok, label, detail) {
  if (ok) {
    console.log(`  OK   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function get(path, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: extraHeaders, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON, that's fine for HTML checks */ }
  return { status: res.status, headers: res.headers, text, json };
}

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}

console.log(`Running post-deploy smoke test against ${BASE_URL}\n`);

// 1. Public health check — real HTTP, no auth needed.
console.log('-- Public health --');
{
  const r = await get('/api/health');
  report(r.status === 200, 'GET /api/health -> 200', `got ${r.status}`);
  report(!!r.json && typeof r.json.status === 'string', '/api/health returns a status field', JSON.stringify(r.json));
}

// 2. The dashboard's auth gate is actually enforced in production.
console.log('\n-- Dashboard auth gate is live --');
{
  const r1 = await get('/dashboard');
  report(r1.status === 200 && /Sign In/i.test(r1.text), 'GET /dashboard without a session shows the login page', `status ${r1.status}`);

  const r2 = await get('/api/dashboard/overview');
  report(r2.status === 401, 'GET /api/dashboard/overview without a session -> 401', `got ${r2.status}`);
}

// 3. Full authenticated round trip: prove real production lead data flows
// end-to-end through the exact path the browser dashboard uses.
console.log('\n-- Live lead data (authenticated) --');
if (!DASHBOARD_PASSWORD) {
  console.log('  SKIP authenticated leads check — DASHBOARD_PASSWORD not set.');
  console.log('  (Set it as a secret to verify real Supabase lead data end-to-end.)');
} else {
  const loginRes = await post('/api/dashboard/login', { password: DASHBOARD_PASSWORD });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  cookie = setCookie.split(';')[0];
  report(loginRes.status === 200 && !!cookie, 'POST /api/dashboard/login -> 200 with session cookie', `status ${loginRes.status}`);

  if (cookie) {
    const overview = await get('/api/dashboard/overview', { Cookie: cookie });
    report(overview.status === 200, 'GET /api/dashboard/overview (authenticated) -> 200', `status ${overview.status}`);

    const leads = overview.json && overview.json.leads;
    report(!!leads, 'overview response includes a leads section', JSON.stringify(overview.json));

    if (leads) {
      if (leads.ok) {
        report(Number.isInteger(leads.totalLeadCount) && leads.totalLeadCount >= 0, 'leads.totalLeadCount is a real non-negative integer', JSON.stringify(leads.totalLeadCount));
        report(Array.isArray(leads.recentLeads), 'leads.recentLeads is an array', JSON.stringify(leads.recentLeads));
        // The old response shape carried these fabricated/broken fields
        // (invented AED totals, an executive_briefs-derived tier count on a
        // table that doesn't exist). Their absence proves the fixed code
        // path is actually live, not just quiet by coincidence.
        report(!('totalPipelineRevenueAed' in leads), 'no fabricated totalPipelineRevenueAed field on leads');
        report(!('tierBreakdown' in leads), 'no tierBreakdown field on leads (executive_briefs does not exist)');
      } else {
        report(false, 'leads.ok is true (live Supabase read succeeded)', `leads.error: ${leads.error}`);
      }
    }

    // financials.pipelineRevenueAed used to floor at a fabricated 25,000,000
    // whenever the real (event-driven) counter was zero, which is the
    // common case. It must now be able to show a real zero.
    const financials = overview.json && overview.json.financials;
    if (financials) {
      report(financials.pipelineRevenueAed !== 25000000, 'financials.pipelineRevenueAed is not the old fabricated 25,000,000 floor', String(financials.pipelineRevenueAed));
    }

    await post('/api/dashboard/logout', {}, { Cookie: cookie });
  }
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failing check(s).`);
process.exit(failures === 0 ? 0 : 1);
