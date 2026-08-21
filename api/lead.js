// ═══════════════════════════════════════════════════════════════
// LEAD CAPTURE
//
// The brief form used to hand the visitor straight to WhatsApp and keep
// no record. Anyone who typed their name, their city, their budget and
// their mandate — and then hesitated at the handoff, or had the pop-up
// blocked, or simply did not use WhatsApp — was lost without trace. You
// cannot follow up with someone you never knew existed.
//
// This route stores the lead first. The WhatsApp handoff still happens,
// and still converts; it just stops being the only copy of the record.
//
// ─────────────── SECURITY ───────────────
//
// Writes use the service_role key, server-side only. Row Level Security
// is enabled on the lead tables with no policies at all, so the anon key
// — which ships publicly in browser JavaScript by design — cannot read or
// write a single row. service_role bypasses RLS; nothing else reaches it.
//
// The key is read from the environment and never returned, never logged,
// never included in an error message. If a Supabase error arrives, its
// text goes to the server log and the visitor gets a generic failure.
//
// ─────────────── CONSENT ───────────────
//
// A website submission is an inbound request to be contacted, so it is
// recorded as opted_in, per the origin column's documented intent. That
// is consent to a REPLY. It is not consent to a newsletter — a marketing
// list needs its own explicit tick box, and until one exists no address
// captured here should be added to a bulk send.
// ═══════════════════════════════════════════════════════════════

const TABLE = 'leads';

/* Fields we accept, and the maximum we will store for each. A form post is
   untrusted input: bound the length here rather than letting a 2 MB body
   become a database row. */
const LIMITS = {
  name: 120, email: 160, mobile: 40, address: 160,
  investment_objective: 80, budget_band: 40, notes: 4000,
  referrer_url: 500, utm_source: 80, utm_medium: 80, utm_campaign: 120,
  lead_magnet: 80, preferred_language: 2,
};

const clean = (v, max) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

/* Deliberately permissive. The goal is to reject obvious rubbish, not to
   adjudicate the RFC — a real address that fails a clever regex is a lost
   client, which costs far more than an invalid row costs to delete. */
const looksLikeEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

const LANGS = new Set(['en', 'pt', 'es']);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const URL_BASE = process.env.SUPABASE_URL;
  const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /* No credentials means no silent discard. The visitor is told the brief
     did not save, so they can still use the WhatsApp handoff knowingly,
     and the operator sees the misconfiguration in the log. */
  if (!URL_BASE || !SERVICE) {
    console.error('lead: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return res.status(503).json({
      ok: false,
      stored: false,
      error: 'Lead storage is not configured. Your brief was not saved.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Expected a JSON body.' });
  }

  const name  = clean(body.name,  LIMITS.name);
  const email = clean(body.email, LIMITS.email);

  if (!name)  return res.status(400).json({ ok: false, error: 'A name is required.' });
  if (!email) return res.status(400).json({ ok: false, error: 'An email address is required.' });
  if (!looksLikeEmail(email)) {
    return res.status(400).json({ ok: false, error: 'That email address does not look right.' });
  }

  const lang = clean(body.preferred_language, LIMITS.preferred_language);

  const row = {
    name,
    email: email.toLowerCase(),
    mobile:  clean(body.mobile,  LIMITS.mobile),
    address: clean(body.address, LIMITS.address),
    notes:   clean(body.notes,   LIMITS.notes),

    investment_objective: clean(body.investment_objective, LIMITS.investment_objective),
    budget_band:          clean(body.budget_band,          LIMITS.budget_band),
    lead_magnet:          clean(body.lead_magnet,          LIMITS.lead_magnet),
    preferred_language:   LANGS.has(lang) ? lang : null,

    /* Provenance. Where they came from is the difference between knowing a
       channel works and guessing. */
    utm_source:   clean(body.utm_source,   LIMITS.utm_source),
    utm_medium:   clean(body.utm_medium,   LIMITS.utm_medium),
    utm_campaign: clean(body.utm_campaign, LIMITS.utm_campaign),
    referrer_url: clean(body.referrer_url, LIMITS.referrer_url),

    source:            'website',
    origin:            'website',
    relationship_type: 'website_organic',
    consent_status:    'opted_in',   /* they asked to be contacted — see header */
    status:            'new',
  };

  try {
    const r = await fetch(`${URL_BASE}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    });

    const text = await r.text();

    if (!r.ok) {
      /* Full detail to the server log, nothing to the browser. A PostgREST
         error can echo column names and constraint definitions. */
      console.error(`lead: insert failed ${r.status}: ${text.slice(0, 500)}`);
      return res.status(502).json({
        ok: false, stored: false,
        error: 'Your brief could not be saved. Please use WhatsApp or email below.',
      });
    }

    let id = null;
    try { id = JSON.parse(text)?.[0]?.id ?? null; } catch { /* representation is a convenience, not a requirement */ }

    return res.status(201).json({ ok: true, stored: true, id });

  } catch (err) {
    console.error(`lead: ${err.name}: ${err.message}`);
    return res.status(502).json({
      ok: false, stored: false,
      error: 'Your brief could not be saved. Please use WhatsApp or email below.',
    });
  }
}
