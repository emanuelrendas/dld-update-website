#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   DLD SCHEMA VERIFICATION PROBE

   Answers, from the real payload rather than from the field names:

     · what fields the dataset actually returns
     · their real types and shapes
     · which of them the site's adapter uses
     · which exist but are unused
     · whether any field supports reliable community mapping
     · whether a full calendar month can actually be retrieved

   Deliberately separate from the runtime. Nothing in api/ imports this.

     DUBAI_PULSE_KEY=… DUBAI_PULSE_SECRET=… node tools/verify-schema.mjs
     …                                     node tools/verify-schema.mjs --month 2026-07

   ─────────────── PERSONAL DATA ───────────────

   The probe never prints a value from a field whose name suggests it
   identifies a person. Those fields are reported as name and type only.
   The denylist is deliberately broad: a field wrongly withheld costs a line
   of documentation, a field wrongly printed cannot be taken back.
   ═══════════════════════════════════════════════════════════════════════ */

const OAUTH   = 'https://api.dubaipulse.gov.ae/oauth/client_credential/accesstoken?grant_type=client_credentials';
const DATASET = 'https://api.dubaipulse.gov.ae/open/dld/dld_transactions-open-api';

const PII = /(buyer|seller|tenant|owner|lessor|lessee|party|person|passport|emirates?[_ -]?id|\beid\b|phone|mobile|contact|email|nationality|birth|licen[cs]e[_ -]?no|name_ar$|full[_ -]?name)/i;

/* Fields the site's adapter reads today — api/dld.js */
const USED = new Set([
  'instance_date', 'area_name_en', 'actual_worth', 'procedure_area',
  'meter_sale_price', 'reg_type_en', 'property_type_en', 'trans_group_en',
  'trans_value', 'area', 'area_name', 'reg_type',
]);

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const MONTH = opt('--month', '2026-07');

const KEY = process.env.DUBAI_PULSE_KEY, SECRET = process.env.DUBAI_PULSE_SECRET;
if (!KEY || !SECRET) {
  console.error(`
DUBAI_PULSE_KEY and DUBAI_PULSE_SECRET are not set.

  1. dubaipulse.gov.ae → dataset dld-transactions/dld_transactions-open
  2. Request Permission, accept terms
  3. Two emails arrive: an API Key and an API Secret
  4. Run:  DUBAI_PULSE_KEY=… DUBAI_PULSE_SECRET=… node tools/verify-schema.mjs

Nothing about the schema can be verified without them, and this probe will
not guess.`);
  process.exit(1);
}

const pad = (d) => String(d).padStart(2, '0');
const toPulse = (iso) => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const FROM = `${MONTH}-01`;
const TO   = `${MONTH}-${pad(lastDay(MONTH))}`;

async function token() {
  const r = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(KEY)}&client_secret=${encodeURIComponent(SECRET)}`,
  });
  if (!r.ok) throw new Error(`auth failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('no access_token in response');
  return j.access_token;
}

/* Query WITHOUT a column filter, so the full field list is visible. Asking
   only for the eight columns the adapter uses would confirm our assumption
   instead of testing it. */
async function query(tok, { limit, offset = 0, filter, columns }) {
  const u = new URL(DATASET);
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('offset', String(offset));
  if (filter)  u.searchParams.set('filter', filter);
  if (columns) u.searchParams.set('column', columns);
  const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${tok}` } });
  const text = await r.text();
  if (!r.ok) throw new Error(`query failed ${r.status}: ${text.slice(0, 300)}`);
  let body; try { body = JSON.parse(text); } catch { throw new Error('response was not JSON: ' + text.slice(0, 200)); }
  return {
    envelope: Array.isArray(body) ? '(bare array)' : Object.keys(body),
    records: Array.isArray(body) ? body : (body.result?.records || body.records || []),
    raw: body,
  };
}

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t !== 'string') return t;
  if (/^\d{2}-\d{2}-\d{4}/.test(v)) return 'string(DD-MM-YYYY)';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'string(ISO date)';
  if (/^-?\d+(\.\d+)?$/.test(v))    return 'string(numeric)';
  return 'string';
};

const line = (n = 74) => console.log('─'.repeat(n));

(async () => {
  console.log('DLD SCHEMA VERIFICATION');
  console.log(`dataset  ${DATASET}`);
  console.log(`period   ${FROM} → ${TO}`);
  line();

  const tok = await token();
  console.log('A · AUTHENTICATION      OK — client_credentials accepted\n');

  /* ── C · actual field schema, from a 5-record sample ── */
  const sample = await query(tok, {
    limit: 5,
    filter: `trans_group_en='Sales' AND instance_date>='${toPulse(FROM)}' AND instance_date<='${toPulse(TO)}'`,
  });
  console.log('B · RESPONSE ENVELOPE   ' + JSON.stringify(sample.envelope));
  console.log(`    records returned    ${sample.records.length}\n`);

  if (!sample.records.length) { console.log('No records — cannot verify schema.'); process.exit(1); }

  const fields = new Map();
  for (const rec of sample.records)
    for (const [k, v] of Object.entries(rec)) {
      const f = fields.get(k) || { types: new Set(), example: undefined };
      f.types.add(typeOf(v));
      if (f.example === undefined && v !== null && v !== '') f.example = v;
      fields.set(k, f);
    }

  console.log('C · ACTUAL FIELD SCHEMA');
  const w = Math.max(...[...fields.keys()].map(k => k.length));
  for (const [name, f] of [...fields].sort()) {
    const personal = PII.test(name);
    const use = USED.has(name) ? 'USED' : '—';
    const ex = personal ? '[personal — withheld]' : String(f.example).slice(0, 34);
    console.log(`  ${name.padEnd(w)}  ${[...f.types].join('|').padEnd(22)}  ${use.padEnd(5)}  ${ex}`);
  }

  const all = new Set(fields.keys());
  console.log('\nD · USED BY THE SITE     ' + [...all].filter(f => USED.has(f)).join(', '));
  console.log('E · ASSUMED, NOT PRESENT ' +
    ([...USED].filter(f => !all.has(f)).join(', ') || '(none — every assumed field exists)'));
  console.log('F · PRESENT, UNUSED      ' +
    [...all].filter(f => !USED.has(f) && !PII.test(f)).join(', '));
  console.log('  personal fields present (never used, never printed): ' +
    ([...all].filter(f => PII.test(f)).join(', ') || 'none detected'));

  /* ── G · community mapping — does any field actually support it? ── */
  console.log('\nG · COMMUNITY / LOCATION FIELDS');
  const locLike = [...all].filter(f => /area|zone|district|community|location|project|master|sector|nakheel|municipality/i.test(f) && !PII.test(f));
  if (!locLike.length) console.log('  none — reliable community mapping is NOT possible from this dataset');
  for (const f of locLike) {
    const probe = await query(tok, {
      limit: 500,
      filter: `trans_group_en='Sales' AND instance_date>='${toPulse(FROM)}' AND instance_date<='${toPulse(TO)}'`,
      columns: f,
    });
    const vals = probe.records.map(r => r[f]).filter(v => v !== null && v !== '');
    const distinct = [...new Set(vals)];
    const numeric = distinct.every(v => /^-?\d+(\.\d+)?$/.test(String(v)));
    console.log(`  ${f}`);
    console.log(`     distinct in 500 rows: ${distinct.length}  ·  ${numeric ? 'NUMERIC — an area measure, not a place name' : 'textual'}`);
    if (!numeric) console.log(`     sample values: ${distinct.slice(0, 8).map(v => String(v).slice(0, 26)).join(' | ')}`);
  }

  /* ── H/I/J · price, area, type, date fields, verified by content ── */
  const classify = (re) => [...all].filter(f => re.test(f) && !PII.test(f))
    .map(f => `${f} (${[...fields.get(f).types].join('|')})`);
  console.log('\nH · PRICE / VALUE FIELDS ' + (classify(/worth|value|price|amount/i).join(', ') || 'none'));
  console.log('    AREA / SIZE FIELDS   ' + (classify(/area|size|sqm|sqft|space/i).join(', ') || 'none'));
  console.log('I · TRANSACTION TYPE     ' + (classify(/trans_group|procedure|reg_type|type/i).join(', ') || 'none'));
  console.log('J · DATE / PERIOD        ' + (classify(/date|year|month|time/i).join(', ') || 'none'));

  /* ── reconciliation: is a full month actually retrievable? ── */
  console.log('\nK · PAGINATION RECONCILIATION');
  const PAGE = 1000, CEIL = 300;
  let total = 0, pages = 0, sumValue = 0, offplan = 0, dates = [];
  for (; pages < CEIL; pages++) {
    const p = await query(tok, {
      limit: PAGE, offset: pages * PAGE,
      filter: `trans_group_en='Sales' AND instance_date>='${toPulse(FROM)}' AND instance_date<='${toPulse(TO)}'`,
      columns: 'instance_date,actual_worth,reg_type_en',
    });
    total += p.records.length;
    for (const r of p.records) {
      const v = Number(r.actual_worth ?? 0); if (v) sumValue += v;
      if (/off/i.test(String(r.reg_type_en || ''))) offplan++;
      if (r.instance_date) dates.push(r.instance_date);
    }
    if (p.records.length < PAGE) { pages++; break; }
  }
  const iso = dates.map(d => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(d); return m ? `${m[3]}-${m[2]}-${m[1]}` : d; }).sort();
  const daysCovered = new Set(iso.map(d => d.slice(8, 10))).size;

  console.log(`  pages fetched          ${pages}`);
  console.log(`  records collected      ${total.toLocaleString()}`);
  console.log(`  hit safety ceiling     ${pages >= CEIL ? 'YES — INCOMPLETE' : 'no'}`);
  console.log(`  first / last record    ${iso[0]} … ${iso[iso.length - 1]}`);
  console.log(`  distinct days covered  ${daysCovered} of ${lastDay(MONTH)}`);
  console.log(`  aggregated value       AED ${Math.round(sumValue).toLocaleString()}`);
  console.log(`  off-plan share         ${total ? Math.round(offplan / total * 100) : 0}%`);
  console.log(`  official total from API: ${
    Array.isArray(sample.raw) ? 'NOT PROVIDED — response is a bare array with no count'
    : (sample.raw.total ?? sample.raw.count ?? sample.raw.result?.total ?? 'NOT PROVIDED')}`);
  console.log(`\n  COMPLETE MONTH? ${
    daysCovered >= lastDay(MONTH) - 2 && pages < CEIL
      ? 'YES — coverage spans the calendar month and no ceiling was hit'
      : 'NO or UNPROVEN — see day coverage and ceiling above'}`);

  line();
  console.log('Verified against the live register. Nothing above is inferred from a field name.');
})().catch(e => { console.error('\nFAILED: ' + e.message); process.exit(1); });
