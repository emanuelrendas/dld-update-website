/**
 * RAIOC API — Lead & Brief Inbound Routes
 *
 * WHY THIS FILE HAS ITS OWN IMPLEMENTATION AGAIN
 *
 * It previously delegated straight to handleAssessmentSubmission. That
 * function maps a payload onto company / company_size / ai_maturity /
 * timeline / data_stack, and persists through saveExecutiveBrief into
 * `executive_briefs`. The brief form sends none of those fields, and
 * `executive_briefs` does not exist in this database — so a submission
 * wrote nothing to `leads`, and the response carried `success: true`
 * with no `ok`, which assets/site.js reads as a failure and shows the
 * visitor "that did not save".
 *
 * The brief form and the assessment are two different intakes with two
 * different payloads. They write to the same `leads` table and each keeps
 * its own mapping.
 */

import { getSupabaseCredentials } from '../../../api/_supabase.js';
import { checkRateLimit, clientKey, LIMITS } from '../rate-limit.js';
import { upsertLead } from '../lead-upsert.js';

const LIMITS_FIELD = {
  name: 120, email: 160, mobile: 40, address: 160,
  investment_objective: 80, budget_band: 40, notes: 4000,
  referrer_url: 500, utm_source: 80, utm_medium: 80, utm_campaign: 120,
  lead_magnet: 80, preferred_language: 10,
};

const LANGS = new Set(['en', 'pt', 'es']);
const WA_NUMBER = '971543871702';

const clean = (v, max) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

/* Deliberately permissive. A real address rejected by a clever regex is a
   lost client; an invalid row costs one delete. */
const looksLikeEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export async function handleLeadSubmission(payload = {}, options = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  const rate = checkRateLimit(clientKey(options.headers), LIMITS.write);
  if (!rate.allowed) {
    return {
      status: 429,
      headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) },
      body: { ok: false, stored: false, error: 'Too many submissions. Please try again shortly.' },
    };
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  let body = payload;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return { status: 400, headers, body: { ok: false, error: 'Expected a JSON body.' } };
  }

  const name  = clean(body.name, LIMITS_FIELD.name);
  const email = clean(body.email, LIMITS_FIELD.email);

  if (!name)  return { status: 400, headers, body: { ok: false, error: 'A name is required.' } };
  if (!email) return { status: 400, headers, body: { ok: false, error: 'An email address is required.' } };
  if (!looksLikeEmail(email)) {
    return { status: 400, headers, body: { ok: false, error: 'That email address does not look right.' } };
  }

  const lang       = clean(body.preferred_language, LIMITS_FIELD.preferred_language);
  const location   = clean(body.address || body.location, LIMITS_FIELD.address);
  const mobile     = clean(body.mobile || body.phone, LIMITS_FIELD.mobile);
  const mandate    = clean(body.notes || body.mandate_description, LIMITS_FIELD.notes);
  const objective  = clean(body.investment_objective || body.objective, LIMITS_FIELD.investment_objective);
  const budget     = clean(body.budget_band || body.budget, LIMITS_FIELD.budget_band);
  const leadMagnet = clean(body.lead_magnet || 'private_brief_form', LIMITS_FIELD.lead_magnet);

  /* Built before the write, so it is available on every path. The handoff
     still happens when storage fails; it just stops being the only copy
     of the record. */
  const waText = `PRIVATE BRIEF — via website\nName: ${name}\nEmail: ${email}\nBased in: ${location || '—'}\nInterest: ${objective || '—'}\nBudget: ${budget || '—'}\nBrief: ${mandate || '—'}`;
  const whatsapp_url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waText)}`;

  /* No credentials means no silent discard. The visitor is told the brief
     did not save, so they can still use the handoff knowingly. */
  if (!isConfigured) {
    console.error('lead: Supabase URL or service key is not set');
    return {
      status: 503,
      headers,
      body: { ok: false, stored: false, whatsapp_url, error: 'Lead storage is not configured. Your brief was not saved.' },
    };
  }

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
    utm_source:   clean(body.utm_source   || body.attribution?.utm_source,   LIMITS_FIELD.utm_source),
    utm_medium:   clean(body.utm_medium   || body.attribution?.utm_medium,   LIMITS_FIELD.utm_medium),
    utm_campaign: clean(body.utm_campaign || body.attribution?.utm_campaign, LIMITS_FIELD.utm_campaign),
    referrer_url: clean(body.referrer_url || body.attribution?.referrer_url, LIMITS_FIELD.referrer_url),
    /* A website submission is an inbound request to be contacted, so it
       is recorded as opted_in. That is consent to a REPLY. It is not
       consent to a newsletter; a marketing list needs its own tick. */
    source: 'website', origin: 'website', relationship_type: 'website_organic',
    consent_status: 'opted_in', status: 'new',
    created_at: new Date().toISOString(),
  };

  try {
    /* An address already on file resolves to the existing row rather than
       failing the submission — see the unique index on lower(email). The
       visitor is following up, not erroring. */
    const { id, created } = await upsertLead(URL_BASE, SERVICE, row);

    return {
      status: 200,
      headers,
      body: { ok: true, stored: true, id, lead_id: id, returning: !created, whatsapp_url },
    };

  } catch (err) {
    /* Full detail to the log, nothing to the browser: a PostgREST error
       can echo column names and constraint definitions. */
    console.error(`lead: ${err.message} ${err.detail || ''}`);
    return {
      status: 502,
      headers,
      body: { ok: false, stored: false, whatsapp_url, error: 'Your brief could not be saved. Please use WhatsApp or email.' },
    };
  }
}
