// ═══════════════════════════════════════════════════════════════
// DLD MARKET DATA — Dubai Pulse open API
//
// Pulls registered transaction records from the Dubai Land Department
// via Dubai Pulse, aggregates them, and returns a compact JSON summary.
//
// Runs on Vercel's server. Credentials never reach the browser.
//
// SETUP (see README_DLD.md):
//   1. Request the dld_transactions-open dataset at dubaipulse.gov.ae
//   2. You receive API Key and API Secret in two separate emails
//   3. Add them in Vercel → Settings → Environment Variables:
//        DUBAI_PULSE_KEY
//        DUBAI_PULSE_SECRET
//   4. Redeploy
//
// Until the credentials are set, this returns {configured:false} and the
// site falls back to its published static figures. Nothing breaks.
// ═══════════════════════════════════════════════════════════════

const OAUTH  = 'https://api.dubaipulse.gov.ae/oauth/client_credential/accesstoken?grant_type=client_credentials';
const DATASET = 'https://api.dubaipulse.gov.ae/open/dld/dld_transactions-open-api';

// Communities we report on, mapped to how DLD names them in the records.
const AREAS = {
  'Palm Jumeirah':        ['PALM JUMEIRAH'],
  'Downtown Dubai':       ['BURJ KHALIFA', 'DOWNTOWN DUBAI'],
  'Dubai Marina':         ['MARSA DUBAI', 'DUBAI MARINA'],
  'Business Bay':         ['BUSINESS BAY'],
  'Dubai Hills Estate':   ['HADAEQ SHEIKH MOHAMMED BIN RASHID', 'DUBAI HILLS'],
  'Jumeirah Village Circle': ['AL BARSHA SOUTH FOURTH', 'JUMEIRAH VILLAGE CIRCLE'],
  'Dubai Creek Harbour':  ['AL KHAIRAN FIRST', 'DUBAI CREEK HARBOUR'],
  'Emirates Hills':       ['EMIRATES HILLS FIRST', 'EMIRATES HILLS'],
};

const SQM_TO_SQFT = 10.7639;

let tokenCache = { token: null, expires: 0 };

async function getToken(key, secret) {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;

  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`,
  });
  if (!res.ok) throw new Error(`Dubai Pulse auth failed (${res.status})`);

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in auth response');

  // Tokens are short-lived. Refresh a minute early to avoid an edge miss.
  tokenCache = { token: data.access_token, expires: Date.now() + 25 * 60 * 1000 };
  return data.access_token;
}

async function fetchPage(token, offset, limit, fromDate) {
  const url = new URL(DATASET);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  // trans_group_en separates Sales from Mortgages and Gifts. Without this
  // filter the transaction count is inflated by non-sale registrations.
  url.searchParams.set('filter', `trans_group_en='Sales' AND instance_date>='${fromDate}'`);
  url.searchParams.set('column',
    'instance_date,area_name_en,actual_worth,procedure_area,meter_sale_price,reg_type_en,property_type_en,trans_group_en');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Dataset query failed (${res.status})`);

  const body = await res.json();
  return Array.isArray(body) ? body : (body.result?.records || body.records || []);
}

// A single record's price per sqft, guarding against the messy rows.
function pricePerSqft(rec) {
  // DLD publishes meter_sale_price directly. Prefer the official figure
  // over recomputing it — fewer assumptions, fewer rounding differences.
  const perSqm = Number(rec.meter_sale_price ?? 0);
  let psf = perSqm > 0 ? perSqm / SQM_TO_SQFT : 0;

  if (!psf) {
    const amount = Number(rec.actual_worth ?? 0);
    const sqm    = Number(rec.procedure_area ?? 0);
    if (!amount || !sqm || sqm < 15 || sqm > 3000) return null;
    psf = amount / (sqm * SQM_TO_SQFT);
  }
  // Reject obvious data errors rather than let them skew a median.
  return psf > 200 && psf < 15000 ? psf : null;
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function matchArea(rec) {
  const name = String(rec.area_name_en || rec.area_name || '').toUpperCase().trim();
  if (!name) return null;
  for (const [label, aliases] of Object.entries(AREAS)) {
    if (aliases.some(a => name.includes(a))) return label;
  }
  return null;
}

export default async function handler(req, res) {
  const KEY    = process.env.DUBAI_PULSE_KEY;
  const SECRET = process.env.DUBAI_PULSE_SECRET;

  // Cache at Vercel's edge for 24 hours. Dubai Pulse states the source
  // updates daily, so a 24h cache matches the publication cadence exactly.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');

  if (!KEY || !SECRET) {
    return res.status(200).json({
      configured: false,
      message: 'Dubai Pulse credentials not set. Site is using published static figures.',
    });
  }

  try {
    const token = await getToken(KEY, SECRET);

    // Trailing 90 days. The dataset stores instance_date as DD-MM-YYYY,
    // not ISO — a mismatch here returns zero records silently.
    const d = new Date(Date.now() - 90 * 86400_000);
    const from = [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      d.getFullYear(),
    ].join('-');

    const LIMIT = 1000, MAX_PAGES = 12;
    let records = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchPage(token, page * LIMIT, LIMIT, from);
      records = records.concat(batch);
      if (batch.length < LIMIT) break;
    }

    if (!records.length) {
      return res.status(200).json({
        configured: true, ok: false,
        message: 'Authenticated, but no records returned for the requested window.',
      });
    }

    // ── Aggregate ──
    let totalValue = 0, counted = 0, offplan = 0, ready = 0;
    const allPsf = [];
    const byArea = {};

    for (const rec of records) {
      const amount = Number(rec.actual_worth ?? rec.trans_value ?? 0);
      if (amount > 0) { totalValue += amount; counted++; }

      const isOffplan = String(rec.reg_type_en || rec.reg_type || '').toLowerCase().includes('off');
      isOffplan ? offplan++ : ready++;

      const psf = pricePerSqft(rec);
      if (psf) allPsf.push(psf);

      const area = matchArea(rec);
      if (area) {
        byArea[area] ||= { transactions: 0, value: 0, psf: [] };
        byArea[area].transactions++;
        if (amount > 0) byArea[area].value += amount;
        if (psf) byArea[area].psf.push(psf);
      }
    }

    const areas = Object.entries(byArea)
      .map(([name, d]) => ({
        name,
        transactions: d.transactions,
        medianPricePerSqft: d.psf.length ? Math.round(median(d.psf)) : null,
        totalValue: Math.round(d.value),
        sampleSize: d.psf.length,
      }))
      .filter(a => a.sampleSize >= 10)   // suppress thin samples rather than publish noise
      .sort((a, b) => b.transactions - a.transactions);

    return res.status(200).json({
      configured: true,
      ok: true,
      source: 'Dubai Land Department via Dubai Pulse',
      window: { from, to: new Date().toISOString().slice(0, 10), days: 90 },
      lastUpdated: new Date().toISOString(),
      totals: {
        transactions: records.length,
        valueAED: Math.round(totalValue),
        medianPricePerSqft: allPsf.length ? Math.round(median(allPsf)) : null,
        offPlanShare: records.length ? Math.round((offplan / records.length) * 100) : null,
        readyShare: records.length ? Math.round((ready / records.length) * 100) : null,
      },
      areas,
      note: 'Medians computed from registered transaction records. Areas with fewer than 10 valid records are suppressed.',
    });

  } catch (err) {
    return res.status(200).json({
      configured: true,
      ok: false,
      message: err.message || 'Dubai Pulse request failed.',
    });
  }
}
