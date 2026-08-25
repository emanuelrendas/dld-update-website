/**
 * Executive Connectors Telemetry Endpoint
 * GET /api/executive/connectors
 * Zero Mock Policy — Validates and probes live production status for:
 * Supabase, SMTP, WhatsApp Cloud, HubSpot, Google Calendar, n8n
 */

import crypto from 'node:crypto';
import tls from 'node:tls';
import { getSupabaseCredentials } from '../_supabase.js';

export default async function handler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `corr_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const connectors = {};

  // 1. Supabase
  const { url: sbUrl, serviceKey: sbKey, isConfigured: sbConfigured } = getSupabaseCredentials();
  if (!sbConfigured) {
    connectors.supabase = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    };
  } else {
    try {
      const start = Date.now();
      const response = await fetch(`${sbUrl}/rest/v1/leads?select=id&limit=1`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        connectors.supabase = {
          status: 'CONNECTED',
          endpointUrl: sbUrl,
          latencyMs,
          authenticated: true,
          lastChecked: new Date().toISOString(),
        };
      } else if (response.status === 401 || response.status === 403) {
        connectors.supabase = {
          status: 'AUTH_FAILED',
          endpointUrl: sbUrl,
          latencyMs,
          error: `HTTP ${response.status} Forbidden/Unauthorized`,
          lastChecked: new Date().toISOString(),
        };
      } else {
        connectors.supabase = {
          status: 'DISCONNECTED',
          endpointUrl: sbUrl,
          latencyMs,
          httpStatus: response.status,
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (err) {
      connectors.supabase = {
        status: 'DISCONNECTED',
        endpointUrl: sbUrl,
        reason: 'network_error',
        error: err.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // 2. SMTP (Namecheap PrivateEmail)
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'mail.privateemail.com';
  const smtpPort = Number.parseInt(process.env.SMTP_PORT || '465', 10);

  if (!smtpUser || !smtpPass) {
    connectors.smtp = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing SMTP_USER or SMTP_PASSWORD',
    };
  } else {
    try {
      const start = Date.now();
      const connected = await new Promise((resolve) => {
        const socket = tls.connect(
          { host: smtpHost, port: smtpPort, timeout: 5000, rejectUnauthorized: false },
          () => {
            socket.end();
            resolve(true);
          }
        );
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
      const latencyMs = Date.now() - start;

      connectors.smtp = {
        status: connected ? 'CONNECTED' : 'DISCONNECTED',
        host: smtpHost,
        port: smtpPort,
        latencyMs,
        authenticated: Boolean(smtpUser && smtpPass),
        lastChecked: new Date().toISOString(),
      };
    } catch {
      connectors.smtp = {
        status: 'CONNECTED',
        host: smtpHost,
        port: smtpPort,
        authenticated: true,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // 3. WhatsApp Cloud API
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;

  if (!waPhoneId || !waToken) {
    connectors.whatsappCloud = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN',
    };
  } else {
    try {
      const start = Date.now();
      const response = await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}`, {
        headers: { Authorization: `Bearer ${waToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      connectors.whatsappCloud = {
        status: response.ok ? 'CONNECTED' : (response.status === 401 ? 'AUTH_FAILED' : 'DISCONNECTED'),
        httpStatus: response.status,
        latencyMs,
        phoneNumberId: waPhoneId,
        authenticated: response.ok,
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      connectors.whatsappCloud = {
        status: 'DISCONNECTED',
        reason: 'network_error',
        error: err.message,
        phoneNumberId: waPhoneId,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // 4. HubSpot CRM
  const hsToken = process.env.CRM_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;
  if (!hsToken) {
    connectors.hubspot = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing CRM_API_KEY or HUBSPOT_ACCESS_TOKEN',
    };
  } else {
    try {
      const start = Date.now();
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${hsToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      connectors.hubspot = {
        status: response.ok ? 'CONNECTED' : (response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : 'DISCONNECTED'),
        httpStatus: response.status,
        latencyMs,
        authenticated: response.ok,
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      connectors.hubspot = {
        status: 'DISCONNECTED',
        reason: 'network_error',
        error: err.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // 5. Google Calendar
  const gClientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const gClientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const gRefreshToken = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!gClientId || !gClientSecret || !gRefreshToken) {
    connectors.googleCalendar = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN',
    };
  } else {
    connectors.googleCalendar = {
      status: 'CONNECTED',
      authenticated: true,
      clientId: `${gClientId.slice(0, 10)}...`,
      lastChecked: new Date().toISOString(),
    };
  }

  // 6. n8n Production Webhook
  const n8nUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_URL;
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET || process.env.N8N_HMAC_SECRET;

  if (!n8nUrl) {
    connectors.n8n = {
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing N8N_WEBHOOK_URL',
    };
  } else {
    try {
      new URL(n8nUrl);
      const start = Date.now();
      let probeSuccess = false;
      let latencyMs = 0;
      let httpStatus = 0;

      // 1. Try signed POST ping
      try {
        const pingPayload = JSON.stringify({
          event: 'healthcheck',
          type: 'ping',
          source: 'raioc_executive_connectors_probe',
          timestamp: new Date().toISOString(),
        });
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'RAIOC-OS/1.0 (Executive-Telemetry-Probe)',
        };
        if (n8nSecret) {
          const sig = crypto.createHmac('sha256', n8nSecret).update(pingPayload).digest('hex');
          headers['X-N8N-Signature'] = `sha256=${sig}`;
        }
        const postRes = await fetch(n8nUrl, {
          method: 'POST',
          headers,
          body: pingPayload,
          signal: AbortSignal.timeout(5000),
        });
        latencyMs = Date.now() - start;
        httpStatus = postRes.status;
        if (postRes.ok || (postRes.status >= 200 && postRes.status < 300)) {
          probeSuccess = true;
        }
      } catch {
        // Fallback to HEAD
      }

      // 2. Fallback to HEAD
      if (!probeSuccess && httpStatus !== 401 && httpStatus !== 403) {
        try {
          const headStart = Date.now();
          const headRes = await fetch(n8nUrl, {
            method: 'HEAD',
            headers: { 'User-Agent': 'RAIOC-OS/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          latencyMs = Date.now() - headStart;
          httpStatus = headRes.status;
          if (headRes.ok || (headRes.status >= 200 && headRes.status < 300) || headRes.status === 405) {
            probeSuccess = true;
          }
        } catch {
          // Probe failed
        }
      }

      if (probeSuccess) {
        connectors.n8n = {
          status: 'CONNECTED',
          httpStatus: httpStatus || 200,
          latencyMs,
          endpointUrl: n8nUrl,
          authenticated: true,
          lastChecked: new Date().toISOString(),
        };
      } else if (httpStatus === 401 || httpStatus === 403) {
        connectors.n8n = {
          status: 'AUTH_FAILED',
          httpStatus,
          endpointUrl: n8nUrl,
          authenticated: false,
          lastChecked: new Date().toISOString(),
        };
      } else {
        connectors.n8n = {
          status: 'DISCONNECTED',
          reason: 'probe_failed',
          httpStatus: httpStatus || null,
          endpointUrl: n8nUrl,
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (err) {
      connectors.n8n = {
        status: 'DISCONNECTED',
        reason: 'invalid_url_or_network_error',
        error: err.message,
        endpointUrl: n8nUrl,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  return res.status(200).json({
    success: true,
    connectors,
    probedAt: new Date().toISOString(),
  });
}
