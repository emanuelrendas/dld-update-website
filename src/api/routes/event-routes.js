/**
 * Telemetry / Event Tracking Route Handler
 */

import { getSupabaseCredentials } from '../../../api/_supabase.js';

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

export async function handleEventRequest(method = 'GET', body = {}) {
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

  const session_id = typeof payload.session_id === 'string' ? payload.session_id.trim().slice(0, 64) : '';
  if (!session_id) {
    return { status: 204, headers, body: null };
  }

  const incoming = payload.event_props && typeof payload.event_props === 'object' ? payload.event_props : {};
  const event_props = {};
  for (const [k, coerce] of Object.entries(PROPS)) {
    if (incoming[k] !== undefined && incoming[k] !== null) {
      event_props[k] = coerce(incoming[k]);
    }
  }

  const page_url = typeof payload.page_url === 'string' ? payload.page_url.slice(0, 500) : null;
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
