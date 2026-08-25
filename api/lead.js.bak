// ═══════════════════════════════════════════════════════════════
// LEAD CAPTURE & ADVISORY BRIEF ENDPOINT (/api/lead)
// ═══════════════════════════════════════════════════════════════

import { getSupabaseCredentials } from './_supabase.js';

const TABLE = 'leads';

const LIMITS = {
  name: 120, email: 160, mobile: 40, address: 160,
  investment_objective: 80, budget_band: 40, notes: 4000,
  referrer_url: 500, utm_source: 80, utm_medium: 80, utm_campaign: 120,
  lead_magnet: 80, preferred_language: 10,
};

const clean = (v, max) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

const looksLikeEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

const LANGS = new Set(['en', 'pt', 'es']);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured, sources } = getSupabaseCredentials();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/lead',
      configured: isConfigured,
      sources,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Use POST for lead capture.' });
  }

  if (!isConfigured) {
    console.error('lead: Supabase credentials missing (checked SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, SUPABASE_SECRET_KEY)');
    return res.status(503).json({
      ok: false,
      stored: false,
      error: 'Lead storage is not configured on the server. Your brief was not saved to database.',
      diagnostic: { urlSet: Boolean(URL_BASE), keySet: Boolean(SERVICE) },
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Expected a JSON body.' });
  }

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);

  if (!name) return res.status(400).json({ ok: false, error: 'A name is required.' });
  if (!email) return res.status(400).json({ ok: false, error: 'An email address is required.' });
  if (!looksLikeEmail(email)) {
    return res.status(400).json({ ok: false, error: 'That email address does not look right.' });
  }

  const lang = clean(body.preferred_language, LIMITS.preferred_language);
  const location = clean(body.address || body.location, LIMITS.address);
  const mobile = clean(body.mobile || body.phone, LIMITS.mobile);
  const mandate = clean(body.notes || body.mandate_description, LIMITS.notes);
  const objective = clean(body.investment_objective || body.objective, LIMITS.investment_objective);
  const budget = clean(body.budget_band || body.budget, LIMITS.budget_band);
  const leadMagnet = clean(body.lead_magnet || 'private_brief_form', LIMITS.lead_magnet);

  const row = {
    name,
    email: email.toLowerCase(),
    mobile,
    address: location,
    notes: mandate,
    investment_objective: objective,
    budget_band: budget,
    lead_magnet: leadMagnet,
    preferred_language: LANGS.has(lang) ? lang : 'en',
    utm_source: clean(body.utm_source || body.attribution?.utm_source, LIMITS.utm_source),
    utm_medium: clean(body.utm_medium || body.attribution?.utm_medium, LIMITS.utm_medium),
    utm_campaign: clean(body.utm_campaign || body.attribution?.utm_campaign, LIMITS.utm_campaign),
    referrer_url: clean(body.referrer_url || body.attribution?.referrer_url, LIMITS.referrer_url),
    source: 'website',
    origin: 'website',
    relationship_type: 'website_organic',
    consent_status: 'opted_in',
    status: 'new',
    created_at: new Date().toISOString(),
  };

  const waNumber = "971543871702";
  const waText = `PRIVATE BRIEF — via website\nName: ${name}\nEmail: ${email}\nBased in: ${location || '—'}\nInterest: ${objective || '—'}\nBudget: ${budget || '—'}\nBrief: ${mandate || '—'}`;
  const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

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
      signal: AbortSignal.timeout(10000),
    });

    const text = await r.text();

    if (!r.ok) {
      console.error(`lead: insert failed ${r.status}: ${text.slice(0, 500)}`);
      return res.status(502).json({
        ok: false,
        stored: false,
        whatsapp_url: whatsappUrl,
        error: 'Your brief could not be saved. Please use WhatsApp or email.',
      });
    }

    let id = null;
    try { id = JSON.parse(text)?.[0]?.id ?? null; } catch { id = null; }

    return res.status(200).json({
      ok: true,
      stored: true,
      id,
      lead_id: id,
      whatsapp_url: whatsappUrl,
    });

  } catch (err) {
    console.error(`lead: ${err.name}: ${err.message}`);
    return res.status(502).json({
      ok: false,
      stored: false,
      whatsapp_url: whatsappUrl,
      error: 'Your brief could not be saved. Please use WhatsApp or email.',
    });
  }
}
