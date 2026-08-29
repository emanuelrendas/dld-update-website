/**
 * MISSION-010 - Real Production Lead Visibility
 *
 * Proves the wiring, not just the pieces: a lead present in the same
 * `leads` table handleLeadSubmission writes to must show up in the
 * response the human dashboard (dashboard.html) actually renders —
 * GET /api/dashboard/overview -> leadPipeline.recentLeads — not just in
 * the machine-only /api/executive/pipeline endpoint nobody's browser calls.
 *
 * Runs hermetically against the SupabaseClient in-memory mock store (no
 * live credentials in CI), so it also proves the dashboard degrades
 * honestly: leadPipeline.dataSource must say MOCK_FALLBACK rather than
 * presenting synthetic numbers as real production leads.
 */

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'test_dashboard_password_lead_vis';
process.env.DASHBOARD_SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || 'test_dashboard_session_secret_lead_vis';

let handleTelemetryRequest;
let supabase;

before(async () => {
  ({ handleTelemetryRequest } = await import('../../src/api/routes/telemetry-routes.js'));
  ({ supabase } = await import('../../src/db/supabase-client.js'));
});

async function loginCookie() {
  const res = await handleTelemetryRequest('/api/dashboard/login', {
    headers: {},
    body: { password: process.env.DASHBOARD_PASSWORD },
  });
  assert.equal(res.status, 200, 'dashboard login must succeed with the configured password');
  return res.headers['Set-Cookie'].split(';')[0];
}

describe('INTEGRATION: dashboard overview reflects real leads end-to-end', () => {
  beforeEach(() => {
    // Isolate each test's view of the leads table.
    supabase.mockStore.leads = [];
    supabase.mockStore.executive_briefs = [];
  });

  test('leadPipeline is present and honestly labeled when Supabase is not configured', async () => {
    const cookie = await loginCookie();
    const res = await handleTelemetryRequest('/api/dashboard/overview', { headers: { cookie } });
    assert.equal(res.status, 200);
    assert.ok(res.body.leadPipeline, 'overview response must include leadPipeline');
    assert.equal(res.body.leadPipeline.dataSource, 'MOCK_FALLBACK');
  });

  test('a lead written to the leads table is visible in the dashboard overview response', async () => {
    const marker = `smoke_${Date.now()}@example.test`;
    supabase.mockStore.leads.push({
      id: 'lead_test_visibility_001',
      name: 'Visibility Test Investor',
      email: marker,
      status: 'new',
      budget_aed: 12000000,
      community: 'Dubai Marina',
      created_at: new Date().toISOString(),
    });

    const cookie = await loginCookie();
    const res = await handleTelemetryRequest('/api/dashboard/overview', { headers: { cookie } });
    assert.equal(res.status, 200);

    const { leadPipeline } = res.body;
    assert.equal(leadPipeline.activeDealsCount, 1);
    assert.ok(Array.isArray(leadPipeline.recentLeads));
    const found = leadPipeline.recentLeads.find((l) => l.email === marker);
    assert.ok(found, 'the submitted lead must appear in leadPipeline.recentLeads');
    assert.equal(found.budgetAed, 12000000);
  });

  test('GET /api/dashboard/overview without a session cookie still cannot read lead data', async () => {
    const res = await handleTelemetryRequest('/api/dashboard/overview', { headers: {} });
    assert.equal(res.status, 401);
  });
});
