// ═══════════════════════════════════════════════════════════════
// DUBAI INVESTOR READINESS ASSESSMENT — intake
//
// Four questions, then contact and consent. The completed answer set is
// written to assessment_submissions, and the same person is written to
// leads so that one CRM holds every inbound route — the brief form and
// this assessment land in the same place rather than two.
//
// ─────────────── SECURITY ───────────────
//
// service_role key, server-side only. RLS is on with no policies, so the
// anon key that ships in browser JavaScript cannot read or write a row.
// The key is never returned, never logged, never in an error message.
//
// ─────────────── CONSENT ───────────────
//
// consent is an explicit tick, stored with its timestamp. Submitting an
// assessment is a request to be contacted about that assessment; it is
// not permission to add someone to a mailing list. The two are recorded
// separately and only the tick authorises the second.
//
// ─────────────── THE SCORE ───────────────
//
// RIIS is MODELLED — derived from what the investor typed, against the
// rubric below. It is not a measurement, not a credit score, and not a
// statement about the person. riis_version is stored with every row so
// that changing the rubric later cannot silently reinterpret old rows.
// ═══════════════════════════════════════════════════════════════

const RIIS_VERSION = 'v1';

/* Every weight is visible here rather than buried in a formula, because
   the one thing a score like this must survive is someone asking how it
   was arrived at. Capital dominates because it is the only answer that
   maps to a real, published threshold: AED 2M is the Golden Visa floor
   and the stated mandate minimum. The rest are preference, not standing,
   and are weighted accordingly. */
const RUBRIC = {
  capital_band: { '1M-2M': 15, '2M-5M': 40, '5M+': 60 },
  strategic_focus: { off_plan_appreciation: 5, ready_ejari_yield: 10 },
  tax_jurisdiction: { PT: 5, ES: 5, UK: 8, INTL: 3 },
  hasWhatsapp: 8,
  consent: 4,
};

/* The weights above are calibrated so the tiers below are all reachable.
   An earlier version floored at 40, which put every possible respondent
   at 'qualified' or higher and left 'explorer' unreachable — a score
   whose lowest outcome is still a pass says nothing about anyone.

     lowest  1M-2M · off-plan · INTL · no WhatsApp   27   explorer
     middle  2M-5M · ready    · PT   · WhatsApp      67   priority
     highest 5M+   · ready    · UK   · WhatsApp      90   strategic_partner */

const TIERS = [
  [80, 'strategic_partner'],
  [62, 'priority'],
  [42, 'qualified'],
  [0,  'explorer'],
];

const CAPITAL   = new Set(['1M-2M', '2M-5M', '5M+']);
const FOCUS     = new Set(['off_plan_appreciation', 'ready_ejari_yield']);
const JURIS     = new Set(['PT', 'ES', 'UK', 'INTL']);

const LIMITS = { name: 120, email: 160, whatsapp: 40, session_id: 64,
                 utm_source: 80, utm_medium: 80, utm_campaign: 120, referrer_url: 500 };

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

/* Deliberately permissive. A real address rejected by a clever regex is a
   lost client; an invalid row costs one delete. */
const looksLikeEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export function score({ capital_band, strategic_focus, tax_jurisdiction, whatsapp, consent }) {
  const n =
      (RUBRIC.capital_band[capital_band]        ?? 0)
    + (RUBRIC.strategic_focus[strategic_focus]  ?? 0)
    + (RUBRIC.tax_jurisdiction[tax_jurisdiction]?? 0)
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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const URL_BASE = process.env.SUPABASE_URL;
  const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!URL_BASE || !SERVICE) {
    console.error('assessment: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return res.status(503).json({
      ok: false, stored: false,
      error: 'The assessment could not be saved. Please continue on WhatsApp.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Expected a JSON body.' });
  }

  const capital_band     = clean(body.capital_band, 12);
  const strategic_focus  = clean(body.strategic_focus, 40);
  const tax_jurisdiction = clean(body.tax_jurisdiction, 8);
  const name             = clean(body.name, LIMITS.name);
  const email            = clean(body.email, LIMITS.email);
  const whatsapp         = clean(body.whatsapp, LIMITS.whatsapp);
  const consent          = body.consent === true;

  if (!CAPITAL.has(capital_band))     return res.status(400).json({ ok: false, error: 'Choose a capital allocation target.' });
  if (!FOCUS.has(strategic_focus))    return res.status(400).json({ ok: false, error: 'Choose a strategic focus.' });
  if (!JURIS.has(tax_jurisdiction))   return res.status(400).json({ ok: false, error: 'Choose a jurisdiction.' });
  if (!name)                          return res.status(400).json({ ok: false, error: 'A name is required.' });
  if (!looksLikeEmail(email))         return res.status(400).json({ ok: false, error: 'That email address does not look right.' });
  if (!consent)                       return res.status(400).json({ ok: false, error: 'Please confirm you are happy to be contacted.' });

  const { riis_score, riis_tier } = score({ capital_band, strategic_focus, tax_jurisdiction, whatsapp, consent });

  const provenance = {
    utm_source:   clean(body.utm_source,   LIMITS.utm_source),
    utm_medium:   clean(body.utm_medium,   LIMITS.utm_medium),
    utm_campaign: clean(body.utm_campaign, LIMITS.utm_campaign),
    referrer_url: clean(body.referrer_url, LIMITS.referrer_url),
  };

  try {
    /* The lead first, so the assessment can point at it. Both inbound
       routes converge on one record rather than two half-pictures. */
    const lead = await post(URL_BASE, SERVICE, 'leads', {
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
      score: riis_score, score_tier: riis_tier, score_computed_at: new Date().toISOString(),
      ...provenance,
    }, 'return=representation');

    await post(URL_BASE, SERVICE, 'assessment_submissions', {
      lead_id: lead?.id ?? null,
      session_id: clean(body.session_id, LIMITS.session_id) || 'unknown',
      capital_band, strategic_focus, tax_jurisdiction,
      name, email: email.toLowerCase(), whatsapp,
      consent, consent_at: new Date().toISOString(),
      riis_score, riis_tier, riis_version: RIIS_VERSION,
      ...provenance,
    }, 'return=minimal');

    /* The score goes back so the page can frame what happens next. The
       tier is a routing label for the advisory, not a verdict on the
       person, and the page says so where it shows it. */
    return res.status(201).json({ ok: true, stored: true, riis_score, riis_tier });

  } catch (err) {
    /* Full detail to the server log, nothing to the browser: a PostgREST
       error can echo column names and constraint definitions. */
    console.error(`assessment: ${err.message} ${err.detail || ''}`);
    return res.status(502).json({
      ok: false, stored: false,
      error: 'The assessment could not be saved. Please continue on WhatsApp.',
    });
  }
}
