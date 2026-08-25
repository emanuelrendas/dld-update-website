/**
 * RAIOC Security - Service Authentication & RBAC Middleware
 * Enforces timing-safe service-to-service key authentication and role authorization.
 */

import { config } from '../config/env.js';
import { secretsManager } from '../config/secrets-manager.js';
import { logger } from '../logging/audit-logger.js';

export const Roles = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  WEBHOOK: 'WEBHOOK',
  PUBLIC: 'PUBLIC',
};

export class AuthMiddleware {
  constructor(options = {}) {
    this.internalKey = options.internalKey || config.service.internalKey;
  }

  /**
   * Authenticates an incoming HTTP request using Bearer Token or X-API-Key header
   * @param {Object} headers - HTTP request headers
   * @param {Array<string>} allowedRoles - List of permitted roles for the route
   * @returns {Object} { authenticated: boolean, role: string, error?: string }
   */
  authenticateRequest(headers = {}, allowedRoles = [Roles.ADMIN, Roles.AGENT]) {
    // If public route allowed
    if (allowedRoles.includes(Roles.PUBLIC)) {
      return { authenticated: true, role: Roles.PUBLIC };
    }

    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'] || '';

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    }

    if (!token) {
      logger.warn('AUTH_MIDDLEWARE', 'Unauthorized access attempt: Missing credentials');
      return { authenticated: false, error: 'Missing authorization token or API key' };
    }

    // Verify token using constant-time comparison against internal service key
    const isValid = secretsManager.constantTimeCompare(token, this.internalKey);
    if (!isValid) {
      logger.warn('AUTH_MIDDLEWARE', 'Unauthorized access attempt: Invalid token');
      return { authenticated: false, error: 'Invalid authentication credentials' };
    }

    return {
      authenticated: true,
      role: Roles.ADMIN,
      authenticatedAt: new Date().toISOString(),
    };
  }
}

export const authMiddleware = new AuthMiddleware();
