/**
 * Telemetry / Event Tracking Route Handler
 */

import { getSupabaseCredentials } from '../../../api/_supabase.js';
import { checkRateLimit, clientKey, LIMITS } from '../rate-limit.js';

const TABLE = 'lead_events';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENTS = new Set([
  'page_view',
  'assessment_started',
  'assessment_completed',
  'lead_magnet_gated_view',
  'form_submitted',
  'whatsapp_clicked',
  'calculator_used',
]);

const PROPS = {
  budget_band:   (v) => String(v).slice(0, 40),
  objective:     (v) => String(v).slice(0, 80),
  used_leverage: (v) => Boolean(v),
  hold_years:    (v) => (Number.isFinite(+v) ? Math.trunc(Math.min(Math.max(+v, 0), 99)) : null),
  tool:          (v) => String(v).slice(0, 40),
  score:         (v) => (Number.isFinite(+v) ? Math.trunc(+v) : null),
  tier:          (v) => String(v).slice(0, 40),
  outcome:       (v) => String(v).slice(0, 40),
  stored:        (v) => Boolean(v),
};

export async function handleEventRequest(method = 'GET', body = {}, options = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (method === 'GET') {
    const { isConfigured } = getSupabaseCredentials();
    return {
      status: 200,
      headers,
      body: { ok: true, endpoint: '/api/event', configured: isConfigured },
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers: { ...headers, Allow: 'GET, POST' },
      body: { ok: false, error: 'Use POST.' },
    };
  }

  /* Telemetry answers 204 either way, so a limited caller is simply not
     written. Nothing about the limit is signalled back. */
  if (!checkRateLimit(clientKey(options.headers), LIMITS.telemetry).allowed) {
    return { status: 204, headers, body: null };
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    return { status: 204, headers, body: null };
  }

  let payload = body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  if (!payload || typeof payload !== 'object') {
    return { status: 204, headers, body: null };
  }

  const event_name = typeof payload.event_name === 'string' ? payload.event_name.trim() : '';
  if (!EVENTS.has(event_name)) {
    return { status: 204, headers, body: null };
  }

  /* The session id is minted by the browser as a UUID. Requiring the
     shape keeps arbitrary 64-character strings — an id smuggled in from
     another system, or one chosen to collide with a real visitor's —
     out of the column used to stitch a session's events together. */
  const session_id = typeof payload.session_id === 'string' ? payload.session_id.trim().slice(0, 64) : '';
  if (!session_id || !UUID.test(session_id)) {
    return { status: 204, headers, body: null };
  }

  const incoming = payload.event_props && typeof payload.event_props === 'object' ? payload.event_props : {};
  const event_props = {};
  for (const [k, coerce] of Object.entries(PROPS)) {
    if (incoming[k] !== undefined && incoming[k] !== null) {
      event_props[k] = coerce(incoming[k]);
    }
  }

  /* Path only, never the full href. The calculator's share link puts the
     purchase price, deposit and hold period in the query string; storing
     the href copies a visitor's private figures into the telemetry table
     as a side effect of them pressing Share. */
  let page_url = null;
  if (typeof payload.page_url === 'string' && payload.page_url) {
    try { page_url = new URL(payload.page_url).pathname.slice(0, 200); }
    catch { page_url = payload.page_url.split('?')[0].slice(0, 200); }
  }
  const lead_id = typeof payload.lead_id === 'string' && UUID.test(payload.lead_id) ? payload.lead_id : null;

  try {
    await fetch(`${URL_BASE}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        session_id, event_name, page_url, lead_id,
        event_props: Object.keys(event_props).length ? event_props : null,
        created_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`event: ${err.name}: ${err.message}`);
  }

  return { status: 204, headers, body: null };
}
