#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   DATASET INSPECTOR — local only, never runs in production

   Reads the official DLD / Data.Dubai CSV exports sitting in data/raw and
   reports what is inside them. It reads nothing into memory beyond a 64KB
   chunk and a handful of counters, so a 500MB file costs the same as a
   500KB one.

   It reports structure, never content. Column names, types, ranges and
   completeness — no transaction values, no names, no plot numbers. The
   printed summary is meant to be copied into a chat safely; the fuller
   JSON stays on disk and is gitignored.

   Zero dependencies, matching the rest of this project.

     node tools/inspect-datasets.mjs
     node tools/inspect-datasets.mjs --dir data/raw --json data/manifest.json

   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { createReadStream } from 'node:fs';

/* ─────────── options ─────────── */
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const DIR       = opt('--dir', 'data/raw');
const JSON_OUT  = opt('--json', 'data/manifest.json');
const TYPE_ROWS = +opt('--type-rows', 50000);   // rows sampled for type inference
const CARD_CAP  = +opt('--card-cap', 5000);     // stop counting distinct values past this
const DUP_CAP   = +opt('--dup-cap', 3000000);   // give up on duplicate detection past this
const SHOW_ROWS = argv.includes('--samples');   // opt-in, prints masked example values

/* ─────────── streaming CSV reader ───────────
   A real state machine rather than split(','), because government exports
   routinely carry quoted fields containing commas, newlines and doubled
   quotes. Splitting on the delimiter silently corrupts those rows and the
   corruption only shows up much later as a wrong median. */
function readCsv(file, delim, onRow) {
  return new Promise((resolve, reject) => {
    let field = '', row = [], inQuotes = false, prevQuote = false, tail = '';
    const stream = createReadStream(file, { highWaterMark: 1 << 16 });

    stream.on('data', (buf) => {
      const s = tail + buf.toString('utf8');
      /* hold back the last byte sequence in case a multi-byte char was split */
      tail = '';
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inQuotes) {
          if (c === '"') {
            if (prevQuote) { field += '"'; prevQuote = false; }
            else prevQuote = true;
          } else {
            if (prevQuote) { inQuotes = false; prevQuote = false; i--; }
            else field += c;
          }
          continue;
        }
        if (c === '"' && field === '') { inQuotes = true; continue; }
        if (c === delim) { row.push(field); field = ''; continue; }
        if (c === '\n') { row.push(field); field = ''; onRow(row); row = []; continue; }
        if (c === '\r') continue;
        field += c;
      }
    });
    stream.on('end', () => {
      if (field !== '' || row.length) { row.push(field); onRow(row); }
      resolve();
    });
    stream.on('error', reject);
  });
}

/* first line only — used to sniff the delimiter and read the header */
function firstLine(file) {
  return new Promise((resolve, reject) => {
    const st = createReadStream(file, { end: 1 << 18 });
    let s = '';
    st.on('data', d => { s += d.toString('utf8'); if (s.includes('\n')) { st.destroy(); } });
    st.on('close', () => resolve(s.split('\n')[0].replace(/^﻿/, '')));
    st.on('error', reject);
  });
}

const sniffDelim = (line) => {
  const counts = [',', ';', '\t', '|'].map(d => {
    let n = 0, q = false;
    for (const c of line) { if (c === '"') q = !q; else if (c === d && !q) n++; }
    return [d, n];
  });
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
};

/* ─────────── value typing ─────────── */
const ISO   = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
const DMY   = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const NUMRE = /^-?\d+(\.\d+)?$/;
const BOOLS = new Set(['true','false','yes','no','y','n','0','1']);

function classify(v) {
  if (v === '' || v == null) return 'empty';
  const t = v.trim();
  if (t === '') return 'empty';
  if (ISO.test(t) || DMY.test(t)) return 'date';
  if (NUMRE.test(t)) return t.includes('.') ? 'float' : 'int';
  if (BOOLS.has(t.toLowerCase())) return 'bool';
  return 'text';
}

function toDate(v) {
  const t = v.trim();
  if (ISO.test(t)) return t.slice(0, 10);
  const m = DMY.exec(t);
  if (m) {                                  /* ambiguous D/M vs M/D — keep both readings */
    const a = +m[1], b = +m[2], y = m[3];
    const d = a > 12 ? a : b > 12 ? b : a;   /* whichever cannot be a month is the day */
    const mo = a > 12 ? b : b > 12 ? a : b;
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

/* cheap 53-bit row hash for approximate duplicate counting */
function hashRow(cells) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = cells.join('');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1 * 4294967296 + h2;            /* stays inside Number's safe range */
}

/* ─────────── field-role guessing ───────────
   Name patterns alone are ambiguous in DLD exports: "area" is both
   area_name_en (the community, text) and procedure_area (the size,
   numeric). Detected type breaks the tie. */
const ROLE = {
  date:      { re: /(instance|transaction|trans|contract|registration|reg|start|end|date)/i, want: 'date'  },
  value:     { re: /(actual_worth|trans_value|amount|worth|value|price|consideration)/i,     want: 'num'   },
  size:      { re: /(procedure_area|area|size|sqft|sqm|built|suite|plot)/i,                  want: 'num'   },
  community: { re: /(area_name|community|master_project|location|zone|sector|district)/i,    want: 'text'  },
  txType:    { re: /(procedure|trans_group|transaction_type|group|activity)/i,               want: 'text'  },
  offplan:   { re: /(reg_type|off.?plan|sale_type|is_offplan|readiness|completion_status)/i, want: 'text'  },
  developer: { re: /(developer|master_developer|company|owner_company)/i,                    want: 'text'  },
  project:   { re: /(project|building|tower|property_name)/i,                                want: 'text'  },
  propType:  { re: /(property_type|prop_type|usage|property_sub|rooms|bedroom)/i,            want: 'text'  },
  id:        { re: /(_id$|^id$|number|no$|serial|reference)/i,                               want: 'any'   },
};

function guessRoles(cols) {
  const out = {};
  for (const [role, spec] of Object.entries(ROLE)) {
    const hits = cols.filter(c => {
      if (!spec.re.test(c.name)) return false;
      if (spec.want === 'any') return true;
      if (spec.want === 'num')  return c.type === 'int' || c.type === 'float';
      if (spec.want === 'date') return c.type === 'date';
      return c.type === 'text' || c.type === 'bool';
    }).map(c => c.name);
    if (hits.length) out[role] = hits;
  }
  return out;
}

/* ─────────── inspect one file ─────────── */
async function inspect(file) {
  const size = fs.statSync(file).size;
  const header = await firstLine(file);
  const delim = sniffDelim(header);

  let names = null, rows = 0, ragged = 0;
  let cols = [];
  const seen = new Set();
  let dupes = 0, dupGaveUp = false;

  await readCsv(file, delim, (cells) => {
    if (!names) {
      names = cells.map(c => c.replace(/^﻿/, '').trim());
      cols = names.map(n => ({
        name: n, empty: 0, votes: Object.create(null),
        min: null, max: null, minNum: null, maxNum: null,
        distinct: new Set(), cardCapped: false, sample: null,
      }));
      return;
    }
    rows++;
    if (cells.length !== names.length) ragged++;

    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], v = cells[i] ?? '';
      if (v === '' || v.trim() === '') { c.empty++; continue; }

      if (rows <= TYPE_ROWS) {
        const k = classify(v);
        c.votes[k] = (c.votes[k] || 0) + 1;
        if (!c.sample && k !== 'empty') c.sample = v.trim().slice(0, 24);
      }
      if (!c.cardCapped) {
        c.distinct.add(v.trim());
        if (c.distinct.size > CARD_CAP) { c.cardCapped = true; c.distinct = new Set(); }
      }
      const d = toDate(v);
      if (d) { if (!c.min || d < c.min) c.min = d; if (!c.max || d > c.max) c.max = d; }
      else if (NUMRE.test(v.trim())) {
        const n = +v;
        if (c.minNum === null || n < c.minNum) c.minNum = n;
        if (c.maxNum === null || n > c.maxNum) c.maxNum = n;
      }
    }

    if (!dupGaveUp) {
      if (rows > DUP_CAP) { dupGaveUp = true; seen.clear(); }
      else { const h = hashRow(cells); if (seen.has(h)) dupes++; else seen.add(h); }
    }
  });

  /* resolve each column to a single type by majority vote */
  const summary = cols.map(c => {
    const votes = Object.entries(c.votes).sort((a, b) => b[1] - a[1]);
    const type = votes.length ? votes[0][0] : 'empty';
    const mixed = votes.length > 1 && votes[1][1] / (votes[0][1] || 1) > 0.05;
    return {
      name: c.name, type, mixed,
      missingPct: rows ? +(c.empty / rows * 100).toFixed(2) : 0,
      distinct: c.cardCapped ? `>${CARD_CAP}` : c.distinct.size,
      minDate: c.min, maxDate: c.max,
      min: c.minNum, max: c.maxNum,
      sample: SHOW_ROWS ? c.sample : undefined,
    };
  });

  const dateCols = summary.filter(c => c.type === 'date' && c.minDate);
  const span = dateCols.length
    ? { from: dateCols.reduce((a, c) => c.minDate < a ? c.minDate : a, '9999'),
        to:   dateCols.reduce((a, c) => c.maxDate > a ? c.maxDate : a, '0000'),
        field: dateCols.sort((a, b) => a.missingPct - b.missingPct)[0].name }
    : null;

  return {
    file: path.basename(file), sizeBytes: size, delimiter: delim === '\t' ? '\\t' : delim,
    rows, columns: summary.length, raggedRows: ragged,
    duplicateRows: dupGaveUp ? null : dupes,
    dateRange: span, roles: guessRoles(summary), fields: summary,
  };
}

/* ─────────── report ─────────── */
const mb = b => (b / 1048576).toFixed(1) + ' MB';
const num = n => n.toLocaleString('en-US');

function report(r) {
  const L = [];
  L.push(`DATASET: ${r.file}`);
  L.push(`SIZE: ${mb(r.sizeBytes)}   ROWS: ${num(r.rows)}   COLUMNS: ${r.columns}   DELIM: ${r.delimiter}`);
  if (r.dateRange) L.push(`DATE RANGE: ${r.dateRange.from} → ${r.dateRange.to}  (field: ${r.dateRange.field})`);
  else L.push('DATE RANGE: no date column detected');
  L.push(`DUPLICATE ROWS: ${r.duplicateRows === null ? 'not computed (over cap)' : num(r.duplicateRows)}`
       + `   RAGGED ROWS: ${num(r.raggedRows)}`);
  L.push('');
  L.push('COLUMNS:');
  const w = Math.max(...r.fields.map(f => f.name.length));
  for (const f of r.fields) {
    let extra = '';
    if (f.type === 'date' && f.minDate) extra = `  ${f.minDate}..${f.maxDate}`;
    else if ((f.type === 'int' || f.type === 'float') && f.min !== null) extra = `  ${f.min}..${f.max}`;
    else extra = `  distinct:${f.distinct}`;
    L.push(`  ${f.name.padEnd(w)}  ${f.type.padEnd(5)}${f.mixed ? '*' : ' '}`
         + `  missing:${String(f.missingPct).padStart(6)}%${extra}`
         + (f.sample ? `  eg:${f.sample}` : ''));
  }
  L.push('');
  L.push('LIKELY ROLES:');
  const roles = Object.entries(r.roles);
  if (!roles.length) L.push('  none matched');
  for (const [k, v] of roles) L.push(`  ${k.padEnd(10)} → ${v.join(', ')}`);
  L.push('');
  L.push('(* = column holds mixed types)');
  return L.join('\n');
}

/* ─────────── main ─────────── */
const dir = path.resolve(DIR);
if (!fs.existsSync(dir)) { console.error(`No such directory: ${dir}`); process.exit(1); }
const files = fs.readdirSync(dir).filter(f => /\.(csv|tsv|txt)$/i.test(f)).map(f => path.join(dir, f));
if (!files.length) {
  console.error(`No CSV files in ${dir}. Put the DLD exports there and run again.`);
  process.exit(1);
}

const all = [];
for (const f of files) {
  process.stderr.write(`reading ${path.basename(f)} … `);
  const t = Date.now();
  try {
    const r = await inspect(f);
    all.push(r);
    process.stderr.write(`${num(r.rows)} rows in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
    console.log('\n' + '='.repeat(70) + '\n' + report(r));
  } catch (e) {
    process.stderr.write(`FAILED: ${e.message}\n`);
  }
}

fs.mkdirSync(path.dirname(path.resolve(JSON_OUT)), { recursive: true });
fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({
  generated: new Date().toISOString(),
  tool: 'inspect-datasets.mjs',
  note: 'Structure only. No transaction-level values are recorded here.',
  datasets: all,
}, null, 1));
process.stderr.write(`\nmanifest written to ${JSON_OUT} (gitignored)\n`);
