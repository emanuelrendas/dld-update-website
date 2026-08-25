// ═══════════════════════════════════════════════════════════════
// INVESTOR READINESS ASSESSMENT SUBMISSION (/api/assessment)
// ═══════════════════════════════════════════════════════════════

import { getSupabaseCredentials } from './_supabase.js';

const TABLE_ASSESSMENTS = 'lead_assessment_responses';
const TABLE_LEADS       = 'leads';

const RUBRIC = {
  capital_band: { '1M-2M': 15, '2M-5M': 40, '5M+': 60 },
  strategic_focus: { off_plan_appreciation: 5, ready_ejari_yield: 10 },
  tax_jurisdiction: { PT: 5, ES: 5, UK: 8, INTL: 3 },
  hasWhatsapp: 8,
  consent: 4,
};

const TIERS = [
  [80, 'strategic_partner'],
  [62, 'priority'],
  [42, 'qualified'],
  [0,  'explorer'],
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPITAL   = new Set(['1M-2M', '2M-5M', '5M+']);
const FOCUS     = new Set(['off_plan_appreciation', 'ready_ejari_yield']);
const JURIS     = new Set(['PT', 'ES', 'UK', 'INTL']);
const LIMITS = { name: 120, email: 160, whatsapp: 40, session_id: 64,
                 utm_source: 80, utm_medium: 80, utm_campaign: 120, referrer_url: 500 };

const clean = (v, max) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

const looksLikeEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

function scoreAssessment(b) {
  let s = 0;
  s += RUBRIC.capital_band[b.capital_band] || 0;
  s += RUBRIC.strategic_focus[b.strategic_focus] || 0;
  s += RUBRIC.tax_jurisdiction[b.tax_jurisdiction] || 0;
  if (b.whatsapp && b.whatsapp.trim()) s += RUBRIC.hasWhatsapp;
  if (b.consent) s += RUBRIC.consent;

  let tier = 'explorer';
  for (const [thresh, t] of TIERS) {
    if (s >= thresh) { tier = t; break; }
  }
  return { score: s, tier };
}

async function postRow(urlBase, serviceKey, table, row, prefer = 'return=minimal') {
  const r = await fetch(`${urlBase}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, endpoint: '/api/assessment', configured: isConfigured });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  if (!isConfigured) {
    console.error('assessment: Supabase credentials missing');
    return res.status(503).json({
      ok: false, stored: false,
      error: 'Assessment storage is not configured. Please contact directly via WhatsApp.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Expected JSON body.' });
  }

  const name  = clean(body.name,  LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  if (!name)  return res.status(400).json({ ok: false, error: 'A name is required.' });
  if (!email) return res.status(400).json({ ok: false, error: 'An email address is required.' });
  if (!looksLikeEmail(email)) return res.status(400).json({ ok: false, error: 'Email format is invalid.' });

  const capital_band     = CAPITAL.has(body.capital_band) ? body.capital_band : null;
  const strategic_focus  = FOCUS.has(body.strategic_focus) ? body.strategic_focus : null;
  const tax_jurisdiction = JURIS.has(body.tax_jurisdiction) ? body.tax_jurisdiction : null;
  const whatsapp         = clean(body.whatsapp, LIMITS.whatsapp);
  const consent          = Boolean(body.consent);

  const { score, tier } = scoreAssessment({
    capital_band, strategic_focus, tax_jurisdiction, whatsapp, consent,
  });

  const session_id = typeof body.session_id === 'string' && UUID.test(body.session_id.trim())
    ? body.session_id.trim()
    : null;

  try {
    const leadRow = {
      name,
      email: email.toLowerCase(),
      mobile: whatsapp,
      investment_objective: strategic_focus,
      budget_band: capital_band,
      lead_magnet: 'investor_readiness_assessment',
      score,
      score_tier: tier,
      consent_status: consent ? 'opted_in' : 'unknown',
      source: 'website',
      origin: 'website',
      relationship_type: 'assessment_inbound',
      status: 'new',
      utm_source: clean(body.utm_source, LIMITS.utm_source),
      utm_medium: clean(body.utm_medium, LIMITS.utm_medium),
      utm_campaign: clean(body.utm_campaign, LIMITS.utm_campaign),
      referrer_url: clean(body.referrer_url, LIMITS.referrer_url),
      created_at: new Date().toISOString(),
    };

    const insertedLead = await postRow(URL_BASE, SERVICE, TABLE_LEADS, leadRow, 'return=representation');
    const leadId = insertedLead?.id ?? null;

    if (session_id) {
      const assessmentRow = {
        session_id,
        lead_id: leadId,
        responses: { capital_band, strategic_focus, tax_jurisdiction, score, tier },
        created_at: new Date().toISOString(),
      };
      await postRow(URL_BASE, SERVICE, TABLE_ASSESSMENTS, assessmentRow, 'return=minimal').catch(err => {
        console.warn('Assessment responses record warning:', err.message);
      });
    }

    return res.status(200).json({
      ok: true,
      stored: true,
      score,
      tier,
      lead_id: leadId,
    });

  } catch (err) {
    console.error(`assessment: ${err.message}`, err.detail || '');
    return res.status(502).json({
      ok: false, stored: false, score, tier,
      error: 'Assessment results computed, but could not be saved to database.',
    });
  }
}
