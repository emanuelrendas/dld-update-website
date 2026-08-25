/**
 * RAIOC OS - Production Secrets Management & Environment Vault
 * Provides secure retrieval, zero-leak masking, key validation, and secret rotation readiness.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export class SecretsManager {
  constructor(customEnv = process.env) {
    this.env = customEnv;
  }

  /**
   * Retrieves a secret with fallback support
   */
  get(key, defaultValue = '') {
    return this.env[key] || defaultValue;
  }

  /**
   * Masks sensitive credentials for logs and diagnostic outputs
   * e.g., "AIzaSyD...1234" -> "AIza***1234"
   */
  mask(value) {
    if (!value || typeof value !== 'string') return '[EMPTY]';
    if (value.length <= 8) return '****';
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    return `${start}***${end}`;
  }

  /**
   * Validates presence of critical production secrets
   */
  validateRequired(requiredKeys = []) {
    const missing = [];
    for (const key of requiredKeys) {
      if (!this.env[key]) {
        missing.push(key);
      }
    }
    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Generates HMAC-SHA256 signature for payload verification
   */
  generateHmacSignature(payload, secretKey) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha256', secretKey).update(raw).digest('hex');
  }

  /**
   * Timing-safe comparison to prevent side-channel timing attacks
   */
  constantTimeCompare(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Returns a sanitized diagnostic overview of configured infrastructure
   */
  getDiagnostics() {
    return {
      supabaseConfigured: Boolean(this.env.SUPABASE_URL && (this.env.SUPABASE_SERVICE_ROLE_KEY || this.env.SUPABASE_KEY)),
      gmailConfigured: Boolean(this.env.GMAIL_CLIENT_ID && this.env.GMAIL_CLIENT_SECRET && this.env.GMAIL_REFRESH_TOKEN),
      calendarConfigured: Boolean(this.env.GOOGLE_CALENDAR_ID || this.env.GMAIL_CLIENT_ID),
      whatsappBusinessConfigured: Boolean(this.env.WHATSAPP_PHONE_NUMBER_ID && this.env.WHATSAPP_ACCESS_TOKEN),
      crmConfigured: Boolean(this.env.CRM_API_KEY || this.env.CRM_WEBHOOK_URL),
      n8nConfigured: Boolean(this.env.N8N_WEBHOOK_URL),
      internalServiceAuthEnabled: Boolean(this.env.INTERNAL_SERVICE_KEY),
      nodeEnv: this.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
    };
  }
}

export const secretsManager = new SecretsManager();
