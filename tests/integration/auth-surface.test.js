/**
 * MISSION-006 - Unauthenticated Write/Send Surface Closure
 * Verifies: /api/test-email is gone, /api/executive/* and /api/telemetry/*
 * require INTERNAL_SERVICE_KEY, /api/dashboard/* requires a human dashboard
 * session, and both auth mechanisms fail closed when unconfigured.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// Environment must be set before config.js (and anything importing it) is
// first loaded, since config reads process.env once at module-load time.
process.env.INTERNAL_SERVICE_KEY = 'test_internal_service_key_9f3a7c';
process.env.DASHBOARD_PASSWORD = 'test_dashboard_password_4e2b';
process.env.DASHBOARD_SESSION_SECRET = 'test_dashboard_session_secret_71cd';

let handleTelemetryRequest;
let AuthMiddleware;
let Roles;
let DashboardSessionManager;

before(async () => {
  ({ handleTelemetryRequest } = await import('../../src/api/routes/telemetry-routes.js'));
  ({ AuthMiddleware, Roles } = await import('../../src/security/auth-middleware.js'));
  ({ DashboardSessionManager } = await import('../../src/security/dashboard-session.js'));
});

describe('UNIT: AuthMiddleware (service-to-service, INTERNAL_SERVICE_KEY)', () => {
  test('fails closed when internalKey is unset, regardless of presented token', () => {
    const mw = new AuthMiddleware({ internalKey: '' });
    const result = mw.authenticateRequest({ authorization: 'Bearer anything' }, [Roles.ADMIN]);
    assert.equal(result.authenticated, false);
  });

  test('rejects a request with no credentials', () => {
    const mw = new AuthMiddleware({ internalKey: 'real_key' });
    const result = mw.authenticateRequest({}, [Roles.ADMIN]);
    assert.equal(result.authenticated, false);
  });

  test('rejects an invalid token', () => {
    const mw = new AuthMiddleware({ internalKey: 'real_key' });
    const result = mw.authenticateRequest({ authorization: 'Bearer wrong_key' }, [Roles.ADMIN]);
    assert.equal(result.authenticated, false);
  });

  test('accepts a valid Bearer token', () => {
    const mw = new AuthMiddleware({ internalKey: 'real_key' });
    const result = mw.authenticateRequest({ authorization: 'Bearer real_key' }, [Roles.ADMIN]);
    assert.equal(result.authenticated, true);
  });

  test('accepts a valid X-API-Key header', () => {
    const mw = new AuthMiddleware({ internalKey: 'real_key' });
    const result = mw.authenticateRequest({ 'x-api-key': 'real_key' }, [Roles.ADMIN]);
    assert.equal(result.authenticated, true);
  });

  test('PUBLIC role bypasses auth entirely', () => {
    const mw = new AuthMiddleware({ internalKey: '' });
    const result = mw.authenticateRequest({}, [Roles.PUBLIC]);
    assert.equal(result.authenticated, true);
  });
});

describe('UNIT: DashboardSessionManager (human login, DASHBOARD_PASSWORD)', () => {
  test('fails closed when password or session secret is unset', () => {
    const mgr = new DashboardSessionManager({ password: '', sessionSecret: 'secret' });
    const result = mgr.authenticate('anything');
    assert.equal(result.success, false);
  });

  test('rejects the wrong password', () => {
    const mgr = new DashboardSessionManager({ password: 'correct', sessionSecret: 'secret', ttlMs: 60000 });
    const result = mgr.authenticate('wrong');
    assert.equal(result.success, false);
  });

  test('accepts the correct password and issues a verifiable cookie', () => {
    const mgr = new DashboardSessionManager({ password: 'correct', sessionSecret: 'secret', ttlMs: 60000 });
    const result = mgr.authenticate('correct');
    assert.equal(result.success, true);
    assert.match(result.cookie, /^raioc_dash_session=/);

    const token = result.cookie.split(';')[0].split('=')[1];
    assert.equal(mgr.verifyToken(token), true);
  });

  test('rejects an expired session token', () => {
    const mgr = new DashboardSessionManager({ password: 'correct', sessionSecret: 'secret', ttlMs: -1000 });
    const result = mgr.authenticate('correct');
    const token = result.cookie.split(';')[0].split('=')[1];
    assert.equal(mgr.verifyToken(token), false);
  });

  test('rejects a token signed with a different secret', () => {
    const mgrA = new DashboardSessionManager({ password: 'correct', sessionSecret: 'secret-a', ttlMs: 60000 });
    const mgrB = new DashboardSessionManager({ password: 'correct', sessionSecret: 'secret-b', ttlMs: 60000 });
    const token = mgrA.issueToken();
    assert.equal(mgrB.verifyToken(token), false);
  });
});

describe('INTEGRATION: unauthenticated write/send surface is closed', () => {
  test('/api/test-email no longer exists (404, not a live send)', async () => {
    const res = await handleTelemetryRequest('/api/test-email', {});
    assert.equal(res.status, 404);
  });

  test('GET /api/executive/status without credentials -> 401', async () => {
    const res = await handleTelemetryRequest('/api/executive/status', { headers: {} });
    assert.equal(res.status, 401);
  });

  test('GET /api/executive/status with valid INTERNAL_SERVICE_KEY -> 200', async () => {
    const res = await handleTelemetryRequest('/api/executive/status', {
      headers: { authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}` },
    });
    assert.equal(res.status, 200);
  });

  test('POST /api/executive/chat without credentials -> 401 (cannot trigger JARVIS unauthenticated)', async () => {
    const res = await handleTelemetryRequest('/api/executive/chat', {
      headers: {},
      body: { message: 'do something' },
    });
    assert.equal(res.status, 401);
  });

  test('GET /api/telemetry/status without credentials -> 401', async () => {
    const res = await handleTelemetryRequest('/api/telemetry/status', { headers: {} });
    assert.equal(res.status, 401);
  });

  test('GET /api/dashboard/overview without a session cookie -> 401', async () => {
    const res = await handleTelemetryRequest('/api/dashboard/overview', { headers: {} });
    assert.equal(res.status, 401);
  });

  test('GET /dashboard without a session cookie renders the login page, not the command center', async () => {
    const res = await handleTelemetryRequest('/dashboard', { headers: {} });
    assert.equal(res.status, 200);
    assert.match(res.body, /Sign In/);
  });

  test('/health and /api/health remain public', async () => {
    const res1 = await handleTelemetryRequest('/health', { headers: {} });
    const res2 = await handleTelemetryRequest('/api/health', { headers: {} });
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
  });

  test('POST /api/dashboard/login with the wrong password -> 401, no cookie issued', async () => {
    const res = await handleTelemetryRequest('/api/dashboard/login', {
      headers: {},
      body: { password: 'not-the-password' },
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers?.['Set-Cookie'], undefined);
  });

  test('full human login flow: login -> session cookie -> dashboard data access', async () => {
    const loginRes = await handleTelemetryRequest('/api/dashboard/login', {
      headers: {},
      body: { password: process.env.DASHBOARD_PASSWORD },
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers?.['Set-Cookie'];
    assert.ok(setCookie, 'expected a Set-Cookie header on successful login');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);

    const cookiePair = setCookie.split(';')[0];

    const dashRes = await handleTelemetryRequest('/dashboard', { headers: { cookie: cookiePair } });
    assert.equal(dashRes.status, 200);
    assert.doesNotMatch(dashRes.body, /Sign In/);

    const overviewRes = await handleTelemetryRequest('/api/dashboard/overview', { headers: { cookie: cookiePair } });
    assert.equal(overviewRes.status, 200);

    // MISSION-007: /api/dashboard/overview must carry real pipeline data
    // (from SupabaseClient.fetchPipelineSummary()), not just the synthetic
    // operational snapshot — this is what makes a real submitted lead
    // visible to a human dashboard session.
    assert.ok(overviewRes.body.pipeline, 'expected a pipeline key on the overview response');
    assert.ok(Array.isArray(overviewRes.body.pipeline.recentDeals), 'expected pipeline.recentDeals to be an array');
    assert.equal(typeof overviewRes.body.pipeline.activeDealsCount, 'number');
  });

  test('logout clears the session cookie', async () => {
    const res = await handleTelemetryRequest('/api/dashboard/logout', { headers: {} });
    assert.equal(res.status, 200);
    assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
  });

  test('the INTERNAL_SERVICE_KEY is never required to reach dashboard data (no service key sent)', async () => {
    const loginRes = await handleTelemetryRequest('/api/dashboard/login', {
      headers: {},
      body: { password: process.env.DASHBOARD_PASSWORD },
    });
    const cookiePair = loginRes.headers['Set-Cookie'].split(';')[0];
    const res = await handleTelemetryRequest('/api/dashboard/connectors', { headers: { cookie: cookiePair } });
    assert.equal(res.status, 200);
  });
});
