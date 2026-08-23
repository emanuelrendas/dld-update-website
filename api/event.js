// ═══════════════════════════════════════════════════════════════
// TELEMETRY / EVENT TRACKING ENDPOINT (/api/event)
// ═══════════════════════════════════════════════════════════════

import { getSupabaseCredentials } from './_supabase.js';

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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const { isConfigured } = getSupabaseCredentials();
    return res.status(200).json({ ok: true, endpoint: '/api/event', configured: isConfigured });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(204).end();

  const event_name = typeof body.event_name === 'string' ? body.event_name.trim() : '';
  if (!EVENTS.has(event_name)) return res.status(204).end();

  const session_id = typeof body.session_id === 'string' ? body.session_id.trim().slice(0, 64) : '';
  if (!session_id) return res.status(204).end();

  const incoming = body.event_props && typeof body.event_props === 'object' ? body.event_props : {};
  const event_props = {};
  for (const [k, coerce] of Object.entries(PROPS)) {
    if (incoming[k] !== undefined && incoming[k] !== null) {
      event_props[k] = coerce(incoming[k]);
    }
  }

  const page_url = typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : null;
  const lead_id = typeof body.lead_id === 'string' && UUID.test(body.lead_id) ? body.lead_id : null;

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

  return res.status(204).end();
}
