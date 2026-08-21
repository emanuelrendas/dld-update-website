// ═══════════════════════════════════════════════════════════════
// CANONICAL METRICS LAYER
//
// The one place the frontend gets a market number from. Every page reads
// this; no page embeds a figure of its own. That is what makes "one source
// of truth per metric" enforceable rather than aspirational — the same
// metric id on /intelligence and /addresses resolves to the same record
// because there is only one record.
//
// Response shape, per metric:
//   { id, metric, value, unit, period, published, verifiedAt,
//     emirate, authority, source, classification, methodology, status }
//
// status:
//   LIVE        served from a successful current fetch of the official API
//   VERIFIED    a published official figure, checked recently, period current
//   STALE       the period it measures has been superseded
//   UNAVAILABLE no defensible value — the frontend renders an empty state
//   INCOMPLETE  collection was truncated; a partial figure is withheld
//   MODELLED    our own calculation, methodology attached
//
// There is deliberately no code path that substitutes one metric's value for
// another's, and none that hides a stale figure behind a current-looking one.
// ═══════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';

const VALID_CLASS = new Set([
  'OFFICIAL · PRIMARY', 'OFFICIAL · AUTHORITY', 'THIRD-PARTY', 'MODELLED', 'USER INPUT',
]);

let cached = null;
function loadRegistry() {
  if (cached) return cached;
  const p = path.join(process.cwd(), 'data', 'registry.json');
  cached = JSON.parse(fs.readFileSync(p, 'utf8'));
  return cached;
}

/* ─────────── validation ───────────
   Runs on every cold start. An entry that fails is not served at all — a
   malformed provenance record is worse than a missing metric, because it
   looks authoritative. */
export function validate(registry) {
  const errors = [];
  const seen = new Set();

  for (const m of registry.metrics) {
    const at = m.id || '(no id)';
    if (!m.id)                       errors.push(`${at}: missing id`);
    if (seen.has(m.id))              errors.push(`${at}: duplicate id`);
    seen.add(m.id);
    if (!m.name)                     errors.push(`${at}: missing name`);
    if (!VALID_CLASS.has(m.classification))
      errors.push(`${at}: classification "${m.classification}" is not one of the five permitted values`);
    if (m.classification === 'MODELLED' && !m.methodology)
      errors.push(`${at}: MODELLED without methodology`);
    if (m.classification === 'OFFICIAL · PRIMARY' && !m.authority)
      errors.push(`${at}: OFFICIAL · PRIMARY without an authority`);
    if (m.classification === 'OFFICIAL · AUTHORITY' && !m.authority)
      errors.push(`${at}: OFFICIAL · AUTHORITY without an authority`);
    if (!m.verifiedAt)               errors.push(`${at}: missing verifiedAt`);
    if (!m.emirate)                  errors.push(`${at}: missing emirate`);
    if (!m.period || !m.period.type) errors.push(`${at}: missing period`);
    if (m.value === undefined)       errors.push(`${at}: missing value (use null, explicitly)`);
    if (/^official$/i.test(String(m.classification || '').trim()))
      errors.push(`${at}: bare "Official" is never a valid classification`);
  }
  return errors;
}

/* ─────────── freshness ───────────
   period, published and verifiedAt are three different facts and this is the
   only function allowed to reason about them together. */
const DAY = 86400000;
const days = (a, b) => Math.floor((a - b) / DAY);

function endOf(period) {
  if (period.to) return new Date(period.to + 'T00:00:00Z');
  if (period.type === 'static') return null;
  return null;
}

export function statusOf(m, registry, now) {
  if (m.value === null || m.value === undefined) return 'UNAVAILABLE';
  if (m.classification === 'MODELLED') return 'MODELLED';

  // A deliberate prior-period comparator is not stale — being historical is
  // its entire job. Marking it superseded would put a warning on a figure
  // that is doing exactly what it is there to do.
  if (m.historical === true) return 'VERIFIED';

  // A forward schedule is inherently for an unfinished period. That is a
  // projection, carried by its THIRD-PARTY classification and its note —
  // not a truncated collection, which is what INCOMPLETE means.
  if (m.period.complete === false && m.forward !== true) return 'INCOMPLETE';
  if (m.forward === true) return 'VERIFIED';

  const staleAfter = registry.policy.staleAfterDays[m.period.type] ?? 365;
  const end = endOf(m.period);
  if (end && days(now, end) > staleAfter) return 'STALE';

  const verified = new Date(m.verifiedAt + 'T00:00:00Z');
  if (days(now, verified) > registry.policy.reverifyAfterDays) return 'STALE';

  return 'VERIFIED';
}

const shape = (m, status) => ({
  id: m.id,
  metric: m.name,
  value: m.value,
  unit: m.unit ?? null,
  period: m.period,
  published: m.published ?? null,
  verifiedAt: m.verifiedAt,
  emirate: m.emirate,
  authority: m.authority,
  source: m.source,
  classification: m.classification,
  methodology: m.methodology ?? null,
  note: m.note ?? null,
  status,
});

/* ─────────── live overlay ───────────
   When Dubai Pulse is connected, live aggregates supersede the registry's
   published snapshot for the metrics they cover — and only those. A live
   fetch never rewrites a metric it does not measure, and a failed fetch
   never downgrades a registry figure to a wrong one; it simply does not
   overlay. */
async function liveDubai(req) {
  if (!process.env.DUBAI_PULSE_KEY || !process.env.DUBAI_PULSE_SECRET) return null;
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host'] || req.headers.host;
    const res = await fetch(`${proto}://${host}/api/dld`);
    const d = await res.json();
    return d && d.status === 'LIVE' ? d : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  let registry;
  try { registry = loadRegistry(); }
  catch (e) {
    return res.status(200).json({ ok: false, status: 'UNAVAILABLE',
      message: 'Source registry could not be read.', detail: e.message, metrics: {} });
  }

  const errors = validate(registry);
  const now = new Date();

  const out = {};
  for (const m of registry.metrics) {
    // An invalid record is withheld, not repaired. Repairing it would mean
    // inventing the missing provenance.
    if (errors.some(e => e.startsWith(m.id + ':'))) {
      out[m.id] = shape({ ...m, value: null }, 'UNAVAILABLE');
      continue;
    }
    out[m.id] = shape(m, statusOf(m, registry, now));
  }

  const live = await liveDubai(req);
  const overlay = [];
  if (live) {
    // Only these ids are covered by a live trailing-window fetch. Everything
    // else keeps its published-period record.
    const p = live.period;
    const mk = (id, name, value, unit) => {
      out[id] = {
        id, metric: name, value, unit,
        period: { type: 'range', id: `${p.from} → ${p.to}`, from: p.from, to: p.to, complete: true },
        published: null, verifiedAt: live.fetchedAt.slice(0, 10),
        emirate: 'Dubai', authority: 'Dubai Land Department',
        source: live.source, classification: 'OFFICIAL · PRIMARY',
        methodology: null, note: live.note, status: 'LIVE',
      };
      overlay.push(id);
    };
    mk('dubai.live.sales.count', 'Dubai sales transactions', live.totals.transactions, 'transactions');
    mk('dubai.live.sales.value', 'Dubai sales value', live.totals.valueAED, 'AED');
    mk('dubai.live.median.psf', 'Median price per sqft', live.totals.medianPricePerSqft, 'AED/sqft');
    mk('dubai.live.median.value', 'Median transaction value', live.totals.medianValueAED, 'AED');
  }

  return res.status(200).json({
    ok: errors.length === 0,
    generatedAt: now.toISOString(),
    referenceDate: registry.policy.referenceDate,
    // A live connection is reported only when a current fetch actually
    // succeeded. Nothing else may light the indicator.
    live: Boolean(live),
    liveMetrics: overlay,
    unmappedCommunities: live ? live.unmappedCommunities : null,
    validationErrors: errors,
    metrics: out,
  });
}
