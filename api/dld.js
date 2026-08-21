// ═══════════════════════════════════════════════════════════════
// DLD TRANSACTION ADAPTER — Dubai Pulse
//
// Pulls registered SALES transactions from the Dubai Land Department via
// Dubai Pulse, normalises each record into the canonical shape, and returns
// an aggregate. Runs on Vercel's server; credentials never reach the browser.
//
// SETUP (see README_DLD.md):
//   DUBAI_PULSE_KEY, DUBAI_PULSE_SECRET → Vercel env vars → redeploy
//
// Until credentials are set this returns {configured:false}. The frontend
// renders an explicit "official data unavailable" state — it does NOT fall
// back to a hardcoded number.
//
// ─────────── WHAT CHANGED, AND WHY IT MATTERED ───────────
//
// The previous version capped collection at 12 pages of 1,000 records and
// stopped silently. Dubai registers roughly 14,000 sales in a single month,
// so any window wider than about three weeks was being truncated and the
// undercount published as a complete figure. Pagination now runs to
// exhaustion, and if the documented safety ceiling is ever reached the
// response is marked INCOMPLETE and the totals are withheld rather than
// published short.
//
// ─────────── UNVERIFIED ───────────
//
// dubaipulse.gov.ae is not reachable from the build environment, so the
// dataset schema could not be checked against official documentation. The
// column list below is what this code requests. Fields that may exist but
// are not requested — district, property sub-type, geographic identifiers,
// any unit-level key — are unknown, not absent. Dump one raw record on first
// successful connection before relying on any of them.
// ═══════════════════════════════════════════════════════════════

const OAUTH   = 'https://api.dubaipulse.gov.ae/oauth/client_credential/accesstoken?grant_type=client_credentials';
const DATASET = 'https://api.dubaipulse.gov.ae/open/dld/dld_transactions-open-api';

const COLUMNS = [
  'instance_date', 'area_name_en', 'actual_worth', 'procedure_area',
  'meter_sale_price', 'reg_type_en', 'property_type_en', 'trans_group_en',
].join(',');

// Community aliases. The canonical name on the left is the ONLY name the
// rest of the system uses; the aliases are how DLD spells it in the register.
// Communities the site displays but cannot yet map are listed in UNMAPPED so
// the frontend can say so explicitly instead of rendering nothing.
const AREAS = {
  'Palm Jumeirah':            ['PALM JUMEIRAH'],
  'Downtown Dubai':           ['BURJ KHALIFA', 'DOWNTOWN DUBAI'],
  'Dubai Marina':             ['MARSA DUBAI', 'DUBAI MARINA'],
  'Business Bay':             ['BUSINESS BAY'],
  'Dubai Hills Estate':       ['HADAEQ SHEIKH MOHAMMED BIN RASHID', 'DUBAI HILLS'],
  'Jumeirah Village Circle':  ['AL BARSHA SOUTH FOURTH', 'JUMEIRAH VILLAGE CIRCLE'],
  'Dubai Creek Harbour':      ['AL KHAIRAN FIRST', 'DUBAI CREEK HARBOUR'],
  'Emirates Hills':           ['EMIRATES HILLS FIRST', 'EMIRATES HILLS'],
};

// Displayed on the site, but the DLD area name is not confirmed. Guessing an
// alias here would silently attribute the wrong transactions to a community,
// which is worse than showing nothing.
const UNMAPPED = ['DIFC', 'Dubai South', 'Jumeirah Bay Island'];

const SQM_TO_SQFT = 10.7639;

// Safety ceiling. Documented, not silent: at 1,000 records a page this is
// 300,000 records, comfortably above a full year of Dubai sales. Reaching it
// means something is wrong with the query, not that the market grew.
const PAGE_SIZE  = 1000;
const MAX_PAGES  = 300;
const REQ_TIMEOUT_MS = 12000;
const MAX_RETRIES = 3;

let tokenCache = { token: null, expires: 0 };

/* ─────────── transport ─────────── */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// One fetch with a timeout, retries on transient failure, and explicit 429
// handling that honours Retry-After when the server sends it.
async function request(url, options = {}, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_RETRIES) {
        const e = new Error(`upstream ${res.status} after ${attempt + 1} attempts`);
        e.retryable = true;
        throw e;
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 2 ** attempt * 500) + Math.random() * 250;
      await sleep(backoff);
      return request(url, options, attempt + 1);
    }
    return res;
  } catch (err) {
    // AbortError and network faults are transient; 4xx are not retried above.
    const transient = err.name === 'AbortError' || err.name === 'TypeError' || err.retryable;
    if (transient && attempt < MAX_RETRIES) {
      await sleep(Math.min(8000, 2 ** attempt * 500) + Math.random() * 250);
      return request(url, options, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(key, secret) {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;

  const res = await request(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`,
  });
  if (!res.ok) throw new Error(`Dubai Pulse auth failed (${res.status})`);

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in auth response');

  tokenCache = { token: data.access_token, expires: Date.now() + 25 * 60 * 1000 };
  return data.access_token;
}

// Dubai Pulse stores instance_date as DD-MM-YYYY, not ISO. A mismatch here
// returns zero records silently rather than an error, which is the worst
// possible failure mode — hence the explicit formatter.
const toPulseDate = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return `${d}-${m}-${y}`;
};

async function fetchPage(token, offset, from, to) {
  const url = new URL(DATASET);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  // trans_group_en separates Sales from Mortgages and Gifts. Without this the
  // count is inflated by non-sale registrations — the difference between the
  // AED 286B sales figure and the AED 419.9B all-registration figure.
  url.searchParams.set('filter',
    `trans_group_en='Sales' AND instance_date>='${toPulseDate(from)}' AND instance_date<='${toPulseDate(to)}'`);
  url.searchParams.set('column', COLUMNS);

  const res = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Dataset query failed (${res.status})`);

  const body = await res.json();
  return Array.isArray(body) ? body : (body.result?.records || body.records || []);
}

/* ─────────── normalisation ─────────── */

// DD-MM-YYYY → ISO. Returns null rather than a wrong date.
function toIso(v) {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(v || ''));
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null;
}

function matchArea(name) {
  const n = String(name || '').toUpperCase().trim();
  if (!n) return null;
  for (const [label, aliases] of Object.entries(AREAS)) {
    if (aliases.some(a => n.includes(a))) return label;
  }
  return null;
}

// Price per sqft. DLD publishes meter_sale_price directly, so prefer the
// official figure over recomputing it — fewer assumptions, no rounding drift.
function pricePerSqft(rec) {
  const perSqm = Number(rec.meter_sale_price ?? 0);
  let psf = perSqm > 0 ? perSqm / SQM_TO_SQFT : 0;
  if (!psf) {
    const amount = Number(rec.actual_worth ?? 0);
    const sqm    = Number(rec.procedure_area ?? 0);
    if (!amount || !sqm || sqm < 15 || sqm > 3000) return null;
    psf = amount / (sqm * SQM_TO_SQFT);
  }
  return psf > 200 && psf < 15000 ? psf : null;   // reject obvious data errors
}

// Canonical record. Provenance travels with the row so nothing downstream has
// to remember where it came from.
function normalise(rec) {
  const date = toIso(rec.instance_date);
  const value = Number(rec.actual_worth ?? rec.trans_value ?? 0) || null;
  const areaSqm = Number(rec.procedure_area ?? rec.area ?? 0) || null;
  const psf = pricePerSqft(rec);
  const raw = rec.area_name_en || rec.area_name || null;

  return {
    date,
    emirate: 'Dubai',
    authority: 'Dubai Land Department',
    community: matchArea(raw),
    communityRaw: raw,
    district: null,          // UNVERIFIED — not requested, existence unknown
    transGroup: rec.trans_group_en || null,
    regType: /off/i.test(String(rec.reg_type_en || rec.reg_type || '')) ? 'Off-Plan' : 'Ready',
    propertyType: rec.property_type_en || null,
    propertySubType: null,   // UNVERIFIED
    valueAED: value,
    areaSqm,
    pricePerSqft: psf ? Math.round(psf) : null,
    source: 'dubai-pulse',
  };
}

const median = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ─────────── period helpers ─────────── */

// Buckets a record into month / quarter / year, so the same collection can
// answer monthly, quarterly and annual comparisons without re-querying.
function bucket(dateIso, grain) {
  if (!dateIso) return null;
  const [y, m] = dateIso.split('-');
  if (grain === 'year')    return y;
  if (grain === 'quarter') return `${y}-Q${Math.ceil(Number(m) / 3)}`;
  return `${y}-${m}`;
}

function aggregate(records) {
  let valueTotal = 0, valued = 0;
  const values = [], psfs = [];
  const off = { count: 0, valueAED: 0 };
  const ready = { count: 0, valueAED: 0 };
  const byCommunity = {}, byPropertyType = {};

  for (const r of records) {
    if (r.valueAED) { valueTotal += r.valueAED; valued++; values.push(r.valueAED); }
    const seg = r.regType === 'Off-Plan' ? off : ready;
    seg.count++;
    if (r.valueAED) seg.valueAED += r.valueAED;
    if (r.pricePerSqft) psfs.push(r.pricePerSqft);

    if (r.community) {
      const c = byCommunity[r.community] ||= { transactions: 0, valueAED: 0, values: [], psf: [], offPlan: 0 };
      c.transactions++;
      if (r.valueAED) { c.valueAED += r.valueAED; c.values.push(r.valueAED); }
      if (r.pricePerSqft) c.psf.push(r.pricePerSqft);
      if (r.regType === 'Off-Plan') c.offPlan++;
    }
    if (r.propertyType) {
      const t = byPropertyType[r.propertyType] ||= { transactions: 0, valueAED: 0 };
      t.transactions++;
      if (r.valueAED) t.valueAED += r.valueAED;
    }
  }

  return {
    totals: {
      transactions: records.length,
      valueAED: Math.round(valueTotal),
      valuedRecords: valued,
      medianValueAED: values.length ? Math.round(median(values)) : null,
      medianPricePerSqft: psfs.length ? Math.round(median(psfs)) : null,
      offPlan: { count: off.count, valueAED: Math.round(off.valueAED) },
      ready:   { count: ready.count, valueAED: Math.round(ready.valueAED) },
    },
    byCommunity: Object.entries(byCommunity)
      .map(([name, d]) => ({
        name,
        transactions: d.transactions,
        valueAED: Math.round(d.valueAED),
        medianValueAED: d.values.length ? Math.round(median(d.values)) : null,
        medianPricePerSqft: d.psf.length ? Math.round(median(d.psf)) : null,
        offPlanShare: d.transactions ? Math.round(d.offPlan / d.transactions * 100) : null,
        sampleSize: d.psf.length,
      }))
      // Below ten valid records a median is noise, not a statistic.
      .filter(a => a.sampleSize >= 10)
      .sort((a, b) => b.transactions - a.transactions),
    byPropertyType: Object.entries(byPropertyType)
      .map(([type, d]) => ({ type, transactions: d.transactions, valueAED: Math.round(d.valueAED) }))
      .sort((a, b) => b.transactions - a.transactions),
  };
}

/* ─────────── handler ─────────── */

const isoDay = (d) => d.toISOString().slice(0, 10);

export default async function handler(req, res) {
  const KEY    = process.env.DUBAI_PULSE_KEY;
  const SECRET = process.env.DUBAI_PULSE_SECRET;

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');

  if (!KEY || !SECRET) {
    return res.status(200).json({
      configured: false,
      status: 'UNAVAILABLE',
      authority: 'Dubai Land Department',
      emirate: 'Dubai',
      message: 'Dubai Pulse credentials not set. No official DLD figures are being served.',
    });
  }

  // Explicit period. Defaults to the trailing 90 days only because a default
  // is needed; any window can be requested.
  const q = req.query || {};
  const today = new Date();
  const to    = /^\d{4}-\d{2}-\d{2}$/.test(q.to || '')   ? q.to   : isoDay(today);
  const from  = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : isoDay(new Date(today - 90 * 86400_000));
  const grain = ['month', 'quarter', 'year'].includes(q.grain) ? q.grain : 'month';

  try {
    const token = await getToken(KEY, SECRET);

    // Page to exhaustion. The ceiling exists to stop a runaway query, not to
    // cap a legitimate period — and reaching it is reported, never swallowed.
    let raw = [], page = 0, truncated = false;
    for (; page < MAX_PAGES; page++) {
      const batch = await fetchPage(token, page * PAGE_SIZE, from, to);
      raw = raw.concat(batch);
      if (batch.length < PAGE_SIZE) break;
    }
    if (page >= MAX_PAGES) truncated = true;

    if (!raw.length) {
      return res.status(200).json({
        configured: true, status: 'UNAVAILABLE',
        emirate: 'Dubai', authority: 'Dubai Land Department',
        period: { from, to },
        message: 'Authenticated, but the register returned no records for this period.',
      });
    }

    const records = raw.map(normalise);
    const usable  = records.filter(r => r.date && r.valueAED);
    const discarded = records.length - usable.length;

    // A truncated collection is an undercount. Publishing it as a total would
    // be a wrong official number, so the totals are withheld.
    if (truncated) {
      return res.status(200).json({
        configured: true, status: 'INCOMPLETE',
        emirate: 'Dubai', authority: 'Dubai Land Department',
        period: { from, to },
        rowsCollected: records.length,
        safetyCeiling: MAX_PAGES * PAGE_SIZE,
        message: `Collection hit the ${MAX_PAGES * PAGE_SIZE}-record safety ceiling. `
               + 'Totals withheld — an undercount must not be published as an official figure.',
      });
    }

    const agg = aggregate(usable);

    // Period buckets, so month/quarter/year comparisons need no second query.
    const buckets = {};
    for (const r of usable) {
      const k = bucket(r.date, grain);
      if (!k) continue;
      (buckets[k] ||= []).push(r);
    }
    const series = Object.keys(buckets).sort().map(k => ({
      period: k,
      ...aggregate(buckets[k]).totals,
    }));

    const dates = usable.map(r => r.date).sort();

    return res.status(200).json({
      configured: true,
      status: 'LIVE',
      emirate: 'Dubai',
      authority: 'Dubai Land Department',
      source: 'Dubai Land Department via Dubai Pulse',
      dataset: 'dld_transactions-open',
      classification: 'OFFICIAL · PRIMARY',
      period: { from, to, grain, firstRecord: dates[0], lastRecord: dates[dates.length - 1] },
      fetchedAt: new Date().toISOString(),
      pages: page + 1,
      rowsIn: records.length,
      rowsUsed: usable.length,
      rowsDiscarded: discarded,
      truncated: false,
      unmappedCommunities: UNMAPPED,
      ...agg,
      series,
      note: 'Sales registrations only. Medians, not means. Communities with fewer '
          + 'than 10 valid price records are suppressed rather than published as noise.',
    });

  } catch (err) {
    // Never a 5xx to the browser: the frontend needs a parseable status so it
    // can render an explicit unavailable state rather than a broken one.
    return res.status(200).json({
      configured: true,
      status: 'UNAVAILABLE',
      emirate: 'Dubai',
      authority: 'Dubai Land Department',
      period: { from, to },
      message: err.message || 'Dubai Pulse request failed.',
    });
  }
}
