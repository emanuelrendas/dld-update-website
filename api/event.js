// ═══════════════════════════════════════════════════════════════
// FUNNEL EVENTS
//
// Where visitors stop. The audit could rank the site's leaks structurally
// but not measure them, because nothing recorded what people actually did.
// This route fills that gap: a small, named set of events, written server
// side with the service_role key so the browser never touches the table.
//
// ─────────────── WHAT IS AND IS NOT COLLECTED ───────────────
//
// A session id generated in the browser, an event name from the list
// below, the page path, and a few numeric properties. No IP address, no
// fingerprint, no cross-site identifier, nothing that identifies a person
// until they hand over their details themselves — at which point the
// lead_id is what links the two.
//
// Calculator events carry the SHAPE of a model, never its contents: a
// budget band rather than a price, a boolean for whether leverage was
// used. Knowing that someone modelled an eight-figure purchase is useful.
// Storing their exact figures is surveillance, and they did not ask for it.
// ═══════════════════════════════════════════════════════════════

const TABLE = 'lead_events';

/* The session id is generated in the browser, so its shape is the only thing
   that can be checked. Anything else is free-text a caller chose. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


/* A closed list on purpose. An open event name is an open column: within a
   month it is forty variants of the same thing and nothing can be counted. */
const EVENTS = new Set([
  'page_view',
  'assessment_started',
  'assessment_completed',
  'lead_magnet_gated_view',
  'form_submitted',
  'whatsapp_clicked',
  'calculator_used',
]);

/* Properties we will store, and how each is coerced. Anything not named
   here is dropped rather than passed through — the browser does not get to
   decide the shape of the table. */
const PROPS = {
  budget_band:   (v) => String(v).slice(0, 40),
  objective:     (v) => String(v).slice(0, 80),
  used_leverage: (v) => Boolean(v),
  hold_years:    (v) => (Number.isFinite(+v) ? Math.trunc(Math.min(Math.max(+v, 0), 99)) : null),
  tool:          (v) => String(v).slice(0, 40),
  outcome:       (v) => String(v).slice(0, 40),
  stored:        (v) => Boolean(v),
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const URL_BASE = process.env.SUPABASE_URL;
  const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /* An event is telemetry, not a lead. If storage is unavailable there is
     nothing to tell the visitor and nothing for them to do about it — the
     page must carry on working exactly as before. */
  if (!URL_BASE || !SERVICE) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(204).end();

  const event_name = typeof body.event_name === 'string' ? body.event_name.trim() : '';
  if (!EVENTS.has(event_name)) return res.status(204).end();

  const session_id = typeof body.session_id === 'string' ? body.session_id.trim().slice(0, 64) : '';
  if (!session_id || !UUID.test(session_id)) return res.status(204).end();

  const incoming = body.event_props && typeof body.event_props === 'object' ? body.event_props : {};
  const event_props = {};
  for (const [k, coerce] of Object.entries(PROPS)) {
    if (incoming[k] !== undefined && incoming[k] !== null) {
      const v = coerce(incoming[k]);
      if (v !== null) event_props[k] = v;
    }
  }

  /* Path only. A full URL carries the query string, and query strings carry
     things people did not mean to hand over. */
  let page_url = null;
  if (typeof body.page_url === 'string') {
    try { page_url = new URL(body.page_url).pathname.slice(0, 200); }
    catch { page_url = body.page_url.split('?')[0].slice(0, 200); }
  }

  const lead_id = typeof body.lead_id === 'string' && body.lead_id.length === 36 ? body.lead_id : null;

  try {
    const r = await fetch(`${URL_BASE}/rest/v1/${TABLE}`, {
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
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error(`event: insert failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  } catch (err) {
    console.error(`event: ${err.name}: ${err.message}`);
  }

  /* Always 204, success or failure. Telemetry must never change what the
     visitor sees, and must never give a caller a reason to retry. */
  return res.status(204).end();
}
