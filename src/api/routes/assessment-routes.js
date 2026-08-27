/**
 * RAIOC API — Assessment & Qualification Routes (DIRA / RIIS)
 *
 * WHAT WAS WRONG
 *
 * This route built a lead record in memory, mapped it onto company /
 * company_size / ai_maturity / timeline / data_stack — none of which the
 * assessment form collects — and scored it. Every submission therefore
 * scored a set of invented defaults rather than the visitor's answers.
 * The record reached `leads` only when db.isMock was true, i.e. never in
 * production; persistence otherwise went to `executive_briefs`, a table
 * that does not exist in this database. The response carried
 * `success: true` and no `ok`, which assets/dira.js reads as a failure.
 *
 * Net effect in production: the visitor saw an error, nothing was
 * stored, and the score shown came from fabricated inputs.
 *
 * WHAT IT DOES NOW
 *
 * The four answers are validated, scored against the published rubric,
 * and written to `leads` and `assessment_submissions` — the tables that
 * exist and whose columns match. The RAIOC brief and dispatch pipeline
 * still runs, but as a best-effort step after the record is safe, so a
 * missing table downstream can no longer cost a lead.
 *
 * THE SCORE
 *
 * RIIS is MODELLED — derived from what the investor typed, against the
 * rubric below. It is not a measurement, not a credit score, and not a
 * statement about the person. riis_version is stored with every row so
 * that changing the rubric later cannot silently reinterpret old rows.
 */

import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { supabase } from '../../db/supabase-client.js';
import { logger } from '../../logging/audit-logger.js';
import { getSupabaseCredentials } from '../../../api/_supabase.js';
import { checkRateLimit, clientKey, LIMITS } from '../rate-limit.js';
import { upsertLead } from '../lead-upsert.js';

const RIIS_VERSION = 'v1';

const TABLE_ASSESSMENTS = 'assessment_submissions';

/* Every weight is visible here rather than buried in a formula, because
   the one thing a score like this must survive is someone asking how it
   was arrived at. Capital dominates because it is the only answer that
   maps to a real, published threshold: AED 2M is the Golden Visa floor
   and the stated mandate minimum. */
const RUBRIC = {
  capital_band:     { '1M-2M': 15, '2M-5M': 40, '5M+': 60 },
  strategic_focus:  { off_plan_appreciation: 5, ready_ejari_yield: 10 },
  tax_jurisdiction: { PT: 5, ES: 5, UK: 8, INTL: 3 },
  hasWhatsapp: 8,
  consent: 4,
};

/* Calibrated so every tier is reachable:
     lowest  1M-2M · off-plan · INTL · no WhatsApp   27   explorer
     middle  2M-5M · ready    · PT   · WhatsApp      67   priority
     highest 5M+   · ready    · UK   · WhatsApp      90   strategic_partner */
const TIERS = [
  [80, 'strategic_partner'],
  [62, 'priority'],
  [42, 'qualified'],
  [0,  'explorer'],
];

const UUID    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPITAL = new Set(['1M-2M', '2M-5M', '5M+']);
const FOCUS   = new Set(['off_plan_appreciation', 'ready_ejari_yield']);
const JURIS   = new Set(['PT', 'ES', 'UK', 'INTL']);

const FIELD = { name: 120, email: 160, whatsapp: 40, session_id: 64,
                utm_source: 80, utm_medium: 80, utm_campaign: 120, referrer_url: 500 };

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

const looksLikeEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export function score({ capital_band, strategic_focus, tax_jurisdiction, whatsapp, consent }) {
  const n =
      (RUBRIC.capital_band[capital_band]         ?? 0)
    + (RUBRIC.strategic_focus[strategic_focus]   ?? 0)
    + (RUBRIC.tax_jurisdiction[tax_jurisdiction] ?? 0)
    + (whatsapp ? RUBRIC.hasWhatsapp : 0)
    + (consent  ? RUBRIC.consent     : 0);
  const capped = Math.max(0, Math.min(100, n));
  return { riis_score: capped, riis_tier: TIERS.find(([min]) => capped >= min)[1] };
}

async function post(URL_BASE, SERVICE, table, row, prefer) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`${table} ${r.status}`), { detail: text.slice(0, 400) });
  try { return JSON.parse(text)?.[0] ?? null; } catch { return null; }
}

export async function handleAssessmentSubmission(payload = {}, options = {}) {
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

  let body = payload;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return { status: 400, headers, body: { ok: false, error: 'Expected a JSON body.' } };
  }

  const capital_band     = clean(body.capital_band, 12);
  const strategic_focus  = clean(body.strategic_focus, 40);
  const tax_jurisdiction = clean(body.tax_jurisdiction, 8);
  const name             = clean(body.name, FIELD.name);
  const email            = clean(body.email, FIELD.email);
  const whatsapp         = clean(body.whatsapp || body.phone, FIELD.whatsapp);
  const consent          = body.consent === true || body.consent_given === true;

  /* Every one of these is NOT NULL on assessment_submissions. Rejecting
     here returns a sentence the visitor can act on; letting it through
     returns a Postgres constraint violation they cannot. */
  if (!CAPITAL.has(capital_band))   return { status: 400, headers, body: { ok: false, error: 'Choose a capital allocation target.' } };
  if (!FOCUS.has(strategic_focus))  return { status: 400, headers, body: { ok: false, error: 'Choose a strategic focus.' } };
  if (!JURIS.has(tax_jurisdiction)) return { status: 400, headers, body: { ok: false, error: 'Choose a jurisdiction.' } };
  if (!name)                        return { status: 400, headers, body: { ok: false, error: 'A name is required.' } };
  if (!looksLikeEmail(email))       return { status: 400, headers, body: { ok: false, error: 'That email address does not look right.' } };
  if (!consent)                     return { status: 400, headers, body: { ok: false, error: 'Please confirm you are happy to be contacted.' } };

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    console.error('assessment: Supabase URL or service key is not set');
    return {
      status: 503, headers,
      body: { ok: false, stored: false, error: 'The assessment could not be saved. Please continue on WhatsApp.' },
    };
  }

  const { riis_score, riis_tier } = score({ capital_band, strategic_focus, tax_jurisdiction, whatsapp, consent });

  const provenance = {
    utm_source:   clean(body.utm_source,   FIELD.utm_source),
    utm_medium:   clean(body.utm_medium,   FIELD.utm_medium),
    utm_campaign: clean(body.utm_campaign, FIELD.utm_campaign),
    referrer_url: clean(body.referrer_url, FIELD.referrer_url),
  };

  const sid = clean(body.session_id, FIELD.session_id);
  const session_id = sid && UUID.test(sid) ? sid : 'unknown';
  const now = new Date().toISOString();

  let lead = null;

  try {
    /* The lead first, so the assessment can point at it. Both inbound
       routes converge on one record rather than two half-pictures. */
    const up = await upsertLead(URL_BASE, SERVICE, {
      name,
      email: email.toLowerCase(),
      mobile: whatsapp,
      investment_objective: strategic_focus === 'ready_ejari_yield'
        ? 'Rental income allocation' : 'Capital appreciation',
      budget_band: capital_band === '5M+' ? 'AED 5M+' : `AED ${capital_band.replace('-', ' – ')}`,
      lead_magnet: 'Dubai Investor Readiness Assessment',
      notes: `DIRA · ${capital_band} · ${strategic_focus} · ${tax_jurisdiction} · RIIS ${riis_score} (${riis_tier})`,
      source: 'website', origin: 'website', relationship_type: 'website_organic',
      consent_status: 'opted_in', status: 'new',
      score: riis_score, score_tier: riis_tier, score_computed_at: now,
      ...provenance,
    });
    lead = { id: up.id };

    /* Not wrapped in its own catch. The answers are the assessment; if
       they cannot be stored, the visitor is told and routed to WhatsApp
       rather than thanked for a submission that went nowhere. */
    await post(URL_BASE, SERVICE, TABLE_ASSESSMENTS, {
      lead_id: lead?.id ?? null,
      session_id,
      capital_band, strategic_focus, tax_jurisdiction,
      name, email: email.toLowerCase(), whatsapp,
      consent, consent_at: now,
      riis_score, riis_tier, riis_version: RIIS_VERSION,
      ...provenance,
    }, 'return=minimal');

  } catch (err) {
    console.error(`assessment: ${err.message} ${err.detail || ''}`);
    return {
      status: 502, headers,
      body: { ok: false, stored: false, error: 'The assessment could not be saved. Please continue on WhatsApp.' },
    };
  }

  /* ── Best effort from here ──────────────────────────────────────────
     The record is safe. The brief and dispatch pipeline writes to tables
     that are not present in this database yet; a failure below must not
     turn a stored assessment into an error for the visitor. */
  let brief = null;
  try {
    const db = options.dbClient || supabase;
    const leadRecord = {
      id: lead?.id ?? null,
      name, email: email.toLowerCase(), phone: whatsapp,
      capital_band, strategic_focus, tax_jurisdiction,
      riis_score, riis_tier,
      status: 'new', created_at: now,
    };
    const intelligence = diraRiisEngine.analyze(leadRecord);
    brief = executiveBriefGenerator.generate(leadRecord, intelligence);
    await db.saveExecutiveBrief(brief);

    for (const [type, key, priority] of [['whatsapp', 'whatsapp', 2], ['email', 'email', 1]]) {
      const recipient = brief?.dispatchPayloads?.[key]?.recipient;
      if (recipient) {
        await db.enqueueDispatch({ type, recipient, payload: brief.dispatchPayloads[key], priority });
      }
    }
    if (brief?.dispatchPayloads?.crm) {
      await db.enqueueDispatch({ type: 'crm', recipient: 'crm_system', payload: brief.dispatchPayloads.crm, priority: 1 });
    }
  } catch (err) {
    logger.error('API_ASSESSMENT', 'Brief pipeline failed after the record was stored', { error: err.message });
  }

  try {
    logger.audit('API_ASSESSMENT', 'ASSESSMENT_SUBMITTED', lead?.id ?? 'unknown', 'new', 'stored', {
      riis_score, riis_tier, riis_version: RIIS_VERSION,
    });
  } catch { /* logging must never fail a request */ }

  /* The score goes back so the page can frame what happens next. The tier
     is a routing label for the advisory, not a verdict on the person. */
  return {
    status: 201,
    headers,
    body: {
      ok: true, stored: true,
      riis_score, riis_tier, riis_version: RIIS_VERSION,
      lead_id: lead?.id ?? null,
      brief_id: brief?.id ?? null,
    },
  };
}
