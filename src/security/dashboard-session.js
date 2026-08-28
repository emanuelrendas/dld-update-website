/**
 * RAIOC Security - Dashboard Human Session Authentication
 * Separate from src/security/auth-middleware.js (which authenticates
 * machine-to-machine callers with INTERNAL_SERVICE_KEY). This module
 * authenticates a human operator in the browser via a password login
 * and a signed, expiring session cookie. The service key is never sent
 * to, or stored in, the browser.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';
import { secretsManager } from '../config/secrets-manager.js';
import { logger } from '../logging/audit-logger.js';

export const DASHBOARD_SESSION_COOKIE = 'raioc_dash_session';

export class DashboardSessionManager {
  constructor(options = {}) {
    this.password = options.password ?? config.dashboard.password;
    this.sessionSecret = options.sessionSecret ?? config.dashboard.sessionSecret;
    this.ttlMs = options.ttlMs ?? config.dashboard.sessionTtlMs;
  }

  /**
   * Both a password and a session-signing secret must be explicitly configured.
   * If either is missing, login is disabled entirely (fail closed) rather than
   * falling back to a default credential or an unsigned session.
   */
  isConfigured() {
    return Boolean(this.password && this.sessionSecret);
  }

  /**
   * Validates a submitted password and, on success, returns a Set-Cookie header
   * value carrying a signed, expiring session token.
   */
  authenticate(password) {
    if (!this.isConfigured()) {
      logger.error('DASHBOARD_SESSION', 'Login rejected: DASHBOARD_PASSWORD or DASHBOARD_SESSION_SECRET not configured (failing closed)');
      return { success: false, error: 'Dashboard authentication is not configured' };
    }

    if (!password || typeof password !== 'string' || !secretsManager.constantTimeCompare(password, this.password)) {
      logger.warn('DASHBOARD_SESSION', 'Login rejected: invalid credentials');
      return { success: false, error: 'Invalid credentials' };
    }

    return { success: true, cookie: this.buildCookieHeader(this.issueToken()) };
  }

  issueToken() {
    const exp = Date.now() + this.ttlMs;
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
    const sig = createHmac('sha256', this.sessionSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  verifyToken(token) {
    if (!this.isConfigured() || !token || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;

    const expectedSig = createHmac('sha256', this.sessionSecret).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return typeof exp === 'number' && Date.now() < exp;
    } catch {
      return false;
    }
  }

  /** Extracts and verifies the session cookie from a request's headers. */
  verifyRequest(headers = {}) {
    const cookieHeader = headers['cookie'] || headers['Cookie'] || '';
    return this.verifyToken(this.extractCookie(cookieHeader));
  }

  extractCookie(cookieHeader) {
    const parts = String(cookieHeader || '').split(';');
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === DASHBOARD_SESSION_COOKIE) return part.slice(idx + 1).trim();
    }
    return '';
  }

  buildCookieHeader(token) {
    const maxAgeSec = Math.floor(this.ttlMs / 1000);
    const secure = config.env !== 'development';
    return [
      `${DASHBOARD_SESSION_COOKIE}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      secure ? 'Secure' : '',
      `Max-Age=${maxAgeSec}`,
    ].filter(Boolean).join('; ');
  }

  clearCookieHeader() {
    const secure = config.env !== 'development';
    return [
      `${DASHBOARD_SESSION_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      secure ? 'Secure' : '',
      'Max-Age=0',
    ].filter(Boolean).join('; ');
  }
}

export const dashboardSessionManager = new DashboardSessionManager();
