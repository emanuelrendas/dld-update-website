#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   DATASET INSPECTOR v2 — local only, never runs in production

   Reads the official DLD / Data.Dubai exports wherever they happen to sit
   on this machine and reports what is inside them. Formats are detected by
   reading the first bytes of each file, not by trusting the extension,
   because portal exports arrive as .json, .jsonl, .xlsx or delimited text
   and are frequently misnamed.

   Nothing is read whole. Delimited files stream through a state machine,
   JSON streams through a tokenizer that emits one record at a time, and
   XLSX is inflated from its ZIP container on the fly. A 500MB file costs
   roughly what a 500KB one costs in memory.

   It reports STRUCTURE, never content:
     • column names, inferred types, completeness, ranges, cardinality
     • value categories only where a column is a small enumeration
     • nothing at all — not even a category — from a column whose name
       suggests it identifies a person

   The printed summary is meant to be pasted into a chat safely. Datasets
   are never copied, moved, modified or uploaded; this tool only reads.

   Zero dependencies, matching the rest of this project.

     node tools/inspect-datasets.mjs
     node tools/inspect-datasets.mjs --dir "C:\\Users\\LENOVO\\Downloads"
     node tools/inspect-datasets.mjs --dir data/raw --dir "D:\\dld" --all

   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createReadStream } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

/* ─────────── options ─────────── */
const argv = process.argv.slice(2);
const opt  = (k, d) => { const i = argv.indexOf(k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const opts = (k) => argv.reduce((a, v, i) => (v === k && argv[i + 1] ? a.concat(argv[i + 1]) : a), []);

const DIRS      = opts('--dir').length ? opts('--dir') : ['data/raw'];
const DEPTH     = +opt('--depth', 3);            // how deep to walk each --dir
const JSON_OUT  = opt('--json', 'data/manifest.json');
const TXT_OUT   = opt('--out',  'data/inspection-report.txt');
const TYPE_ROWS = +opt('--type-rows', 50000);    // rows sampled for type inference
const CARD_CAP  = +opt('--card-cap', 5000);      // stop counting distinct values past this
const DUP_CAP   = +opt('--dup-cap', 3000000);    // give up on duplicate detection past this
const MAX_ROWS  = +opt('--max-rows', Infinity);  // hard stop per dataset, for a fast first look
const CAT_CAP   = 60;                            // a column past this is not an enumeration
const SS_CAP    = 500000;                        // shared strings held for an XLSX
const TAKE_ALL  = argv.includes('--all');        // ignore the DLD name filter
const SHOW_ROWS = argv.includes('--samples');    // opt-in, prints one example per column

/* Names that look like a Dubai land-registry export. Anything parseable but
   not matching is listed as a candidate rather than silently ignored, so a
   differently-named export is visible instead of lost. */
const DLD_NAME = /(transact|rent[_ -]?contract|contract|building|valuat|unit|project|broker|developer|land|dld|dubai|real[_ -]?estate|pulse)/i;

/* Columns that identify a person. Presence and completeness are reported;
   values, categories and samples are not, at any cardinality. */
const PII = /(buyer|seller|tenant|owner|lessor|lessee|party|person|passport|emirates?[_ -]?id|eid\b|phone|mobile|contact|email|nationality|birth|licen[cs]e[_ -]?no)/i;

/* ═══════════════════ format detection ═══════════════════ */

function head(file, n = 4096) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(n);
    const read = fs.readSync(fd, b, 0, n, 0);
    return b.subarray(0, read);
  } finally { fs.closeSync(fd); }
}

function sniffFormat(file) {
  let b;
  try { b = head(file); } catch { return 'unreadable'; }
  if (!b.length) return 'empty';

  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) {
    let entries = null;
    try { entries = zipEntries(file); } catch { return 'zip'; }
    if (entries && entries.some(e => /^xl\/workbook\.xml$/i.test(e.name)))  return 'xlsx';
    if (entries && entries.some(e => /^word\/|^ppt\//i.test(e.name)))       return 'office';
    return 'zip';
  }
  /* every other binary container we might trip over in a Downloads folder */
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (b[0] === 0x4d && b[1] === 0x5a)                 return 'binary';   /* .exe/.dll */
  if (b[0] === 0xd0 && b[1] === 0xcf)                 return 'xls';      /* legacy OLE */
  if (b.includes(0x00))                               return 'binary';

  let s = b.toString('utf8').replace(/^\uFEFF/, '');
  const first = s.replace(/^\s+/, '')[0];
  if (first === '[') return 'json';
  if (first === '{') {
    const lines = s.split('\n');
    if (lines.length > 1 &&
        lines[0].trimEnd().endsWith('}') &&
        lines[1].trimStart().startsWith('{')) return 'jsonl';
    return 'json';
  }
  if (/^\s*</.test(s)) return 'xml';
  /* printable text with a plausible separator in its first line */
  const line = s.split('\n')[0];
  if (line && /[,;\t|]/.test(line)) return 'delimited';
  return 'text';
}

/* ═══════════════════ ZIP / XLSX ═══════════════════
   An .xlsx is a ZIP of XML parts. Reading it needs the central directory
   and raw inflate, both of which node ships. No dependency is worth adding
   for a format that is this well specified. */

function zipEntries(file) {
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r');
  try {
    const tailLen = Math.min(size, 66 * 1024);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);

    let p = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { p = i; break; }
    }
    if (p < 0) return null;

    let cdSize = tail.readUInt32LE(p + 12);
    let cdOff  = tail.readUInt32LE(p + 16);
    let count  = tail.readUInt16LE(p + 10);

    if (cdOff === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
      let l = -1;
      for (let i = p - 20; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x07064b50) { l = i; break; }
      }
      if (l < 0) return null;
      const z64 = Number(tail.readBigUInt64LE(l + 8));
      const rec = Buffer.alloc(56);
      fs.readSync(fd, rec, 0, 56, z64);
      if (rec.readUInt32LE(0) !== 0x06064b50) return null;
      count  = Number(rec.readBigUInt64LE(32));
      cdSize = Number(rec.readBigUInt64LE(40));
      cdOff  = Number(rec.readBigUInt64LE(48));
    }

    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOff);

    const out = [];
    let o = 0;
    while (o + 46 <= cd.length && cd.readUInt32LE(o) === 0x02014b50) {
      const method   = cd.readUInt16LE(o + 10);
      let   compSize = cd.readUInt32LE(o + 20);
      let   fullSize = cd.readUInt32LE(o + 24);
      const nameLen  = cd.readUInt16LE(o + 28);
      const extraLen = cd.readUInt16LE(o + 30);
      const commLen  = cd.readUInt16LE(o + 32);
      let   localOff = cd.readUInt32LE(o + 42);
      const name     = cd.toString('utf8', o + 46, o + 46 + nameLen);

      /* ZIP64 extended information overrides whichever fields are saturated */
      if (fullSize === 0xffffffff || compSize === 0xffffffff || localOff === 0xffffffff) {
        let e = o + 46 + nameLen;
        const end = e + extraLen;
        while (e + 4 <= end) {
          const id = cd.readUInt16LE(e), len = cd.readUInt16LE(e + 2);
          if (id === 0x0001) {
            let q = e + 4;
            if (fullSize === 0xffffffff) { fullSize = Number(cd.readBigUInt64LE(q)); q += 8; }
            if (compSize === 0xffffffff) { compSize = Number(cd.readBigUInt64LE(q)); q += 8; }
            if (localOff === 0xffffffff) { localOff = Number(cd.readBigUInt64LE(q)); q += 8; }
            break;
          }
          e += 4 + len;
        }
      }
      out.push({ name, method, compSize, fullSize, localOff });
      o += 46 + nameLen + extraLen + commLen;
    }
    return out;
  } finally { fs.closeSync(fd); }
}

/* byte range of an entry's payload, after its local header */
function entryRange(file, entry) {
  const fd = fs.openSync(file, 'r');
  try {
    const lh = Buffer.alloc(30);
    fs.readSync(fd, lh, 0, 30, entry.localOff);
    if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('bad local header');
    const start = entry.localOff + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
    return { start, end: start + entry.compSize - 1 };
  } finally { fs.closeSync(fd); }
}

/* stream one ZIP entry out as decoded text chunks */
function entryStream(file, entry, onText) {
  return new Promise((resolve, reject) => {
    if (entry.compSize === 0) return resolve();
    const { start, end } = entryRange(file, entry);
    const raw = createReadStream(file, { start, end, highWaterMark: 1 << 16 });
    const dec = new StringDecoder('utf8');
    const src = entry.method === 8 ? raw.pipe(zlib.createInflateRaw()) : raw;
    src.on('data', c => onText(dec.write(c)));
    src.on('end',  () => { const t = dec.end(); if (t) onText(t); resolve(); });
    src.on('error', reject);
    raw.on('error', reject);
  });
}

async function entryText(file, entry) {
  let s = '';
  await entryStream(file, entry, c => { s += c; });
  return s;
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10))
               : XML_ENT[e] ?? m);

const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else break;
  }
  return n - 1;
};

/* Excel serial → ISO date. Epoch is 1899-12-30 because the 1900 leap-year
   bug in the file format shifts everything by one day. */
const serialDate = (n) => {
  if (!isFinite(n) || n < 1 || n > 60000) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(n * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
};

const BUILTIN_DATE = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);

function dateStyles(stylesXml) {
  const isDate = new Set();
  const custom = new Map();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*\/>/g)) {
    const id = +attr(m[0], 'numFmtId');
    const code = unxml(attr(m[0], 'formatCode') || '');
    /* a format is a date format if it positions y/m/d outside quoted text */
    const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    custom.set(id, /[yd]/i.test(bare) || /mm?m/i.test(bare));
  }
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfs) return isDate;
  let i = 0;
  for (const m of xfs[1].matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    const id = +(attr(m[0], 'numFmtId') || 0);
    if (BUILTIN_DATE.has(id) || custom.get(id) === true) isDate.add(i);
    i++;
  }
  return isDate;
}

/* Stream every row of the first populated worksheet as an array of strings.
   Rows arrive complete; only one row is ever held in memory. */
async function readXlsx(file, onRow, meta) {
  const entries = zipEntries(file);
  if (!entries) throw new Error('not a readable zip container');
  const find = (re) => entries.find(e => re.test(e.name));

  /* sheet order and names, so the report can say which one was read */
  const wbEntry = find(/^xl\/workbook\.xml$/i);
  const wb = wbEntry ? await entryText(file, wbEntry) : '';
  const sheets = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m => ({
    name: unxml(attr(m[0], 'name') || ''), rid: attr(m[0], 'r:id') || attr(m[0], 'id'),
  }));
  const relsEntry = find(/^xl\/_rels\/workbook\.xml\.rels$/i);
  const rels = new Map();
  if (relsEntry) {
    for (const m of (await entryText(file, relsEntry)).matchAll(/<Relationship\b[^>]*\/>/g)) {
      rels.set(attr(m[0], 'Id'), unxml(attr(m[0], 'Target') || ''));
    }
  }
  meta.sheets = sheets.map(s => s.name);

  /* shared strings — the one structure that must be resident. Capped, and
     the cap is reported rather than silently truncating values. */
  const ssEntry = find(/^xl\/sharedStrings\.xml$/i);
  const shared = [];
  let ssTruncated = false;
  if (ssEntry) {
    let buf = '';
    await entryStream(file, ssEntry, (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('</si>')) !== -1) {
        const si = buf.slice(0, i);
        buf = buf.slice(i + 5);
        if (shared.length >= SS_CAP) { ssTruncated = true; continue; }
        let t = '';
        for (const m of si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) t += m[1];
        shared.push(unxml(t));
      }
      if (buf.length > 1 << 20) buf = buf.slice(-64);   /* no <si> in sight, drop it */
    });
  }
  meta.sharedStrings = shared.length + (ssTruncated ? '+ (capped)' : '');

  const stEntry = find(/^xl\/styles\.xml$/i);
  const dateStyle = stEntry ? dateStyles(await entryText(file, stEntry)) : new Set();

  /* pick the target sheet: the declared first one, falling back to sheet1 */
  let target = null;
  if (sheets.length && sheets[0].rid && rels.has(sheets[0].rid)) {
    const t = rels.get(sheets[0].rid).replace(/^\/?xl\//, '').replace(/^\//, '');
    target = entries.find(e => e.name.toLowerCase() === ('xl/' + t).toLowerCase());
  }
  target = target || find(/^xl\/worksheets\/sheet1\.xml$/i) || find(/^xl\/worksheets\/.*\.xml$/i);
  if (!target) throw new Error('no worksheet found');
  meta.sheetRead = sheets.length ? sheets[0].name : target.name;

  const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let buf = '', stop = false;

  const emitRow = (xml) => {
    const cells = [];
    CELL.lastIndex = 0;
    let m;
    while ((m = CELL.exec(xml))) {
      const at = m[1] || '', inner = m[2] || '';
      const ref = attr(at, 'r');
      const idx = ref ? colIndex(ref) : cells.length;
      const t = attr(at, 't');
      let v = null;
      if (t === 'inlineStr') {
        let s = '';
        for (const x of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) s += x[1];
        v = unxml(s);
      } else {
        const vm = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        if (vm) {
          const raw = unxml(vm[1]);
          if (t === 's') v = shared[+raw] ?? '';
          else if (t === 'b') v = raw === '1' ? 'true' : 'false';
          else if (t === 'e' || t === 'str') v = raw;
          else {
            const st = attr(at, 's');
            const d = st !== null && dateStyle.has(+st) ? serialDate(+raw) : null;
            v = d ?? raw;
          }
        }
      }
      while (cells.length < idx) cells.push('');
      cells[idx] = v ?? '';
    }
    return onRow(cells);
  };

  await new Promise((resolve, reject) => {
    const { start, end } = entryRange(file, target);
    const raw = createReadStream(file, { start, end, highWaterMark: 1 << 16 });
    const dec = new StringDecoder('utf8');
    const src = target.method === 8 ? raw.pipe(zlib.createInflateRaw()) : raw;
    src.on('data', (c) => {
      if (stop) return;
      buf += dec.write(c);
      let i;
      while (!stop && (i = buf.indexOf('</row>')) !== -1) {
        const j = buf.lastIndexOf('<row', i);
        if (j !== -1 && emitRow(buf.slice(j, i)) === false) stop = true;
        buf = buf.slice(i + 6);
      }
      /* a self-closing <row/> carries no </row>; without this the buffer
         would grow by one entry for every empty row in the sheet */
      if (buf.length > (4 << 20)) {
        const k = buf.lastIndexOf('<row');
        buf = k > 0 ? buf.slice(k) : buf.slice(-64);
      }
      if (stop) { src.destroy(); raw.destroy(); resolve(); }
    });
    src.on('end', () => { const t = dec.end(); if (t) buf += t; resolve(); });
    src.on('close', resolve);
    src.on('error', reject);
    raw.on('error', reject);
  });
}

/* ═══════════════════ JSON ═══════════════════
   Portal exports wrap their rows: CKAN returns
   {"success":true,"result":{"fields":[ … ],"records":[ … ]}}. Taking the
   first array of objects would pick up "fields" — the column catalogue —
   and report one extra row plus a phantom column. So the head of the file
   is scanned once for the key that actually holds the records, and the
   streamer arms only on that key. Only one record is buffered at a time. */

const RECORD_KEY = /^(records|results|data|rows|items|entries|features|value)$/i;

function findRecordKey(file) {
  let s;
  try { s = head(file, 4 << 20).toString('utf8'); } catch { return null; }
  const re = /"([^"\\]{1,64})"\s*:\s*\[\s*\{/g;
  let m, first = null;
  while ((m = re.exec(s))) {
    if (RECORD_KEY.test(m[1])) return m[1];
    if (first === null) first = m[1];
  }
  return first;                    /* null → the records are the top-level array */
}

function readJson(file, onRecord, meta = {}) {
  const targetKey = findRecordKey(file);
  meta.recordKey = targetKey;
  return new Promise((resolve, reject) => {
    let inStr = false, esc = false, depth = 0;
    let armed = false, arrDepth = -1, pendingArr = -1, pendingKey = null;
    let strBuf = '', lastStr = null, lastKey = null;
    let cap = null, capDepth = 0, stop = false;
    const dec = new StringDecoder('utf8');
    const stream = createReadStream(file, { highWaterMark: 1 << 16 });

    const finish = () => { stop = true; stream.destroy(); resolve(); };

    stream.on('data', (b) => {
      if (stop) return;
      const s = dec.write(b);
      for (let i = 0; i < s.length; i++) {
        const c = s[i];

        if (inStr) {
          if (cap !== null) cap += c;
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') { inStr = false; if (cap === null) lastStr = strBuf; }
          else if (cap === null && strBuf.length < 64) strBuf += c;
          continue;
        }
        if (c === '"') { inStr = true; if (cap !== null) cap += c; else strBuf = ''; continue; }

        if (cap !== null) {                       /* inside a record */
          cap += c;
          if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') {
            depth--;
            if (depth === capDepth) {
              const text = cap; cap = null;
              let obj = null;
              try { obj = JSON.parse(text); } catch { /* malformed record, counted upstream */ }
              if (onRecord(obj) === false) return finish();
            }
          }
          continue;
        }

        if (c === ':') { lastKey = lastStr; continue; }
        if (c === '[') {
          depth++;
          if (!armed) { pendingArr = depth; pendingKey = lastKey; }
          continue;
        }
        if (c === '{') {
          if (!armed && pendingArr === depth && (targetKey === null || pendingKey === targetKey)) {
            armed = true; arrDepth = depth;
          }
          if (armed && depth === arrDepth) { capDepth = depth; depth++; cap = '{'; continue; }
          depth++;
          continue;
        }
        if (c === '}' || c === ']') { depth--; if (armed && depth < arrDepth) armed = false; continue; }
        if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',') continue;
        pendingArr = -1;                          /* array of scalars, not records */
      }
    });
    stream.on('end', resolve);
    stream.on('close', () => { if (stop) resolve(); });
    stream.on('error', reject);
  });
}

/* newline-delimited JSON: one complete object per line */
function readJsonl(file, onRecord) {
  return new Promise((resolve, reject) => {
    let buf = '', stop = false;
    const dec = new StringDecoder('utf8');
    const stream = createReadStream(file, { highWaterMark: 1 << 16 });
    const line = (l) => {
      const t = l.trim().replace(/,$/, '');
      if (!t || t === '[' || t === ']') return true;
      let obj = null;
      try { obj = JSON.parse(t); } catch { /* counted upstream */ }
      return onRecord(obj) !== false;
    };
    stream.on('data', (b) => {
      if (stop) return;
      buf += dec.write(b);
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const l = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line(l)) { stop = true; stream.destroy(); return resolve(); }
      }
    });
    stream.on('end', () => { buf += dec.end(); if (buf.trim()) line(buf); resolve(); });
    stream.on('close', () => { if (stop) resolve(); });
    stream.on('error', reject);
  });
}

/* ═══════════════════ delimited text ═══════════════════
   A real state machine rather than split(','), because government exports
   routinely carry quoted fields containing commas, newlines and doubled
   quotes. Splitting on the delimiter silently corrupts those rows and the
   corruption only shows up much later as a wrong median. */

function readDelimited(file, delim, onRow) {
  return new Promise((resolve, reject) => {
    let field = '', row = [], inQuotes = false, prevQuote = false, stop = false;
    const dec = new StringDecoder('utf8');
    const stream = createReadStream(file, { highWaterMark: 1 << 16 });

    stream.on('data', (buf) => {
      if (stop) return;
      const s = dec.write(buf);
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
        if (c === '\n') {
          row.push(field); field = '';
          const r = row; row = [];
          if (onRow(r) === false) { stop = true; stream.destroy(); return resolve(); }
          continue;
        }
        if (c === '\r') continue;
        field += c;
      }
    });
    stream.on('end', () => {
      const t = dec.end(); if (t) field += t;
      if (!stop && (field !== '' || row.length)) { row.push(field); onRow(row); }
      resolve();
    });
    stream.on('close', () => { if (stop) resolve(); });
    stream.on('error', reject);
  });
}

function firstLine(file) {
  const b = head(file, 1 << 18).toString('utf8').replace(/^\uFEFF/, '');
  return b.split('\n')[0];
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

/* ═══════════════════ value typing ═══════════════════ */

const ISO   = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
const DMY   = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
const NUMRE = /^-?\d+(\.\d+)?$/;
const BOOLS = new Set(['true','false','yes','no','y','n']);

function classify(t) {
  if (ISO.test(t) || DMY.test(t)) return 'date';
  if (NUMRE.test(t)) return t.includes('.') ? 'float' : 'int';
  if (BOOLS.has(t.toLowerCase())) return 'bool';
  return 'text';
}

function toDate(t) {
  if (ISO.test(t)) return t.slice(0, 10);
  const m = DMY.exec(t);
  if (m) {                                   /* ambiguous D/M vs M/D — keep the safe reading */
    const a = +m[1], b = +m[2], y = m[3];
    const d  = a > 12 ? a : b > 12 ? b : a;  /* whichever cannot be a month is the day */
    const mo = a > 12 ? b : b > 12 ? a : b;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

/* cheap 53-bit row hash for approximate duplicate counting */
function hashStr(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1 * 4294967296 + h2;               /* stays inside Number's safe range */
}

/* ═══════════════════ accumulator ═══════════════════
   One accumulator per LOGICAL dataset. Split exports (…_0001, …_0002) feed
   the same accumulator, so the row count, date span and duplicate count
   describe the dataset rather than an arbitrary slice of it. */

function newAcc(name) {
  return {
    name, parts: [], rows: 0, ragged: 0, malformed: 0,
    dupes: 0, dupGaveUp: false, seen: new Set(),
    order: [], byName: new Map(),
    signature: null, signatureMismatch: [],
  };
}

function column(acc, name) {
  let c = acc.byName.get(name);
  if (!c) {
    c = { name, present: 0, votes: Object.create(null),
          minDate: null, maxDate: null, minNum: null, maxNum: null,
          distinct: new Set(), cardCapped: false,
          cats: new Map(), catsCapped: false, sample: null };
    acc.byName.set(name, c);
    acc.order.push(name);
  }
  return c;
}

function feedValue(acc, c, v) {
  let s, k;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object')       { k = 'json';  s = Array.isArray(v) ? '[array]' : '[object]'; }
  else if (typeof v === 'number')  { k = Number.isInteger(v) ? 'int' : 'float'; s = String(v); }
  else if (typeof v === 'boolean') { k = 'bool';  s = String(v); }
  else {
    s = String(v).trim();
    if (s === '' || s.toLowerCase() === 'null') return '';
    k = classify(s);
  }

  c.present++;
  if (acc.rows <= TYPE_ROWS) {
    c.votes[k] = (c.votes[k] || 0) + 1;
    if (!c.sample) c.sample = s.slice(0, 28);
  }
  if (!c.cardCapped) {
    c.distinct.add(s);
    if (c.distinct.size > CARD_CAP) { c.cardCapped = true; c.distinct = new Set(); }
  }
  if (!c.catsCapped) {
    c.cats.set(s, (c.cats.get(s) || 0) + 1);
    if (c.cats.size > CAT_CAP) { c.catsCapped = true; c.cats = new Map(); }
  }
  if (k === 'date') {
    const d = toDate(s);
    if (d) { if (!c.minDate || d < c.minDate) c.minDate = d; if (!c.maxDate || d > c.maxDate) c.maxDate = d; }
  } else if (k === 'int' || k === 'float') {
    const n = +s;
    if (isFinite(n)) {
      if (c.minNum === null || n < c.minNum) c.minNum = n;
      if (c.maxNum === null || n > c.maxNum) c.maxNum = n;
    }
  }
  return s;
}

function countDup(acc, key) {
  if (acc.dupGaveUp) return;
  if (acc.rows > DUP_CAP) { acc.dupGaveUp = true; acc.seen = new Set(); return; }
  const h = hashStr(key);
  if (acc.seen.has(h)) acc.dupes++; else acc.seen.add(h);
}

function feedArray(acc, names, cells) {
  acc.rows++;
  if (cells.length !== names.length) acc.ragged++;
  let key = '';
  for (let i = 0; i < names.length; i++) key += feedValue(acc, column(acc, names[i]), cells[i]) + '\u0001';
  countDup(acc, key);
  return acc.rows < MAX_ROWS;
}

function feedObject(acc, obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { acc.malformed++; return true; }
  acc.rows++;
  let key = '';
  for (const [k, v] of Object.entries(obj)) key += k + '=' + feedValue(acc, column(acc, k), v) + '\u0001';
  countDup(acc, key);
  return acc.rows < MAX_ROWS;
}

/* ═══════════════════ field roles ═══════════════════
   Name patterns alone are ambiguous in DLD exports: "area" is both
   area_name_en (the community, text) and procedure_area (the size,
   numeric). Detected type breaks the tie. */

const ROLE = {
  date:      { re: /(instance|transaction|trans|contract|registration|reg|start|end|date)/i, want: 'date'  },
  value:     { re: /(actual_worth|trans_value|amount|worth|value|price|rent|consideration)/i,want: 'num'   },
  size:      { re: /(procedure_area|area|size|sqft|sqm|built|suite|plot)/i,                  want: 'num'   },
  community: { re: /(area_name|community|master_project|location|zone|sector|district)/i,    want: 'text'  },
  txType:    { re: /(procedure|trans_group|transaction_type|group|activity|version)/i,       want: 'text'  },
  offplan:   { re: /(reg_type|off.?plan|sale_type|is_offplan|readiness|completion_status)/i, want: 'text'  },
  developer: { re: /(developer|master_developer|company|owner_company)/i,                    want: 'text'  },
  project:   { re: /(project|building|tower|property_name)/i,                                want: 'text'  },
  propType:  { re: /(property_type|prop_type|usage|property_sub|rooms|bedroom)/i,            want: 'text'  },
  id:        { re: /(_id$|^id$|number|no$|serial|reference)/i,                               want: 'any'   },
};

function guessRoles(fields) {
  const out = {};
  for (const [role, spec] of Object.entries(ROLE)) {
    const hits = fields.filter(c => {
      if (!spec.re.test(c.name)) return false;
      if (spec.want === 'any')  return true;
      if (spec.want === 'num')  return c.type === 'int' || c.type === 'float';
      if (spec.want === 'date') return c.type === 'date';
      return c.type === 'text' || c.type === 'bool';
    }).map(c => c.name);
    if (hits.length) out[role] = hits;
  }
  return out;
}

/* ═══════════════════ finalise one dataset ═══════════════════ */

function finish(acc) {
  const fields = acc.order.map(n => {
    const c = acc.byName.get(n);
    const votes = Object.entries(c.votes).sort((a, b) => b[1] - a[1]);
    const type  = votes.length ? votes[0][0] : 'empty';
    const mixed = votes.length > 1 && votes[1][1] / (votes[0][1] || 1) > 0.05;
    const pii   = PII.test(n);
    const cats  = (!pii && !c.catsCapped && c.cats.size && c.cats.size <= 25)
      ? [...c.cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      : null;
    return {
      name: n, type, mixed, personal: pii,
      missingPct: acc.rows ? +((acc.rows - c.present) / acc.rows * 100).toFixed(2) : 0,
      distinct: c.cardCapped ? `>${CARD_CAP}` : c.distinct.size,
      minDate: c.minDate, maxDate: c.maxDate,
      min: c.minNum, max: c.maxNum,
      categories: cats,
      sample: (SHOW_ROWS && !pii && !c.cardCapped && c.distinct.size <= 200) ? c.sample : undefined,
    };
  });

  const dated = fields.filter(f => f.type === 'date' && f.minDate);
  const span = dated.length
    ? { from:  dated.reduce((a, c) => c.minDate < a ? c.minDate : a, '9999'),
        to:    dated.reduce((a, c) => c.maxDate > a ? c.maxDate : a, '0000'),
        field: [...dated].sort((a, b) => a.missingPct - b.missingPct)[0].name }
    : null;

  return {
    dataset: acc.name,
    parts: acc.parts,
    sizeBytes: acc.parts.reduce((a, p) => a + p.sizeBytes, 0),
    fileModified: acc.parts.reduce((a, p) => p.modified > a ? p.modified : a, ''),
    rows: acc.rows,
    truncated: acc.rows >= MAX_ROWS,
    columns: fields.length,
    raggedRows: acc.ragged,
    malformedRecords: acc.malformed,
    duplicateRows: acc.dupGaveUp ? null : acc.dupes,
    signatureMismatch: acc.signatureMismatch,
    dateRange: span,
    roles: guessRoles(fields),
    fields,
  };
}

/* ═══════════════════ read one part into an accumulator ═══════════════════ */

async function readPart(acc, file, fmt) {
  const st = fs.statSync(file);
  const part = { file: path.basename(file), dir: path.dirname(file), format: fmt,
                 sizeBytes: st.size, modified: st.mtime.toISOString().slice(0, 10),
                 rowsBefore: acc.rows };

  if (fmt === 'delimited') {
    const line = firstLine(file);
    const delim = sniffDelim(line);
    part.delimiter = delim === '\t' ? '\\t' : delim;
    let names = null;
    await readDelimited(file, delim, (cells) => {
      if (!names) {
        names = cells.map(c => c.replace(/^\uFEFF/, '').trim());
        const sig = names.join('|');
        if (acc.signature === null) acc.signature = sig;
        else if (acc.signature !== sig) acc.signatureMismatch.push(part.file);
        return true;
      }
      return feedArray(acc, names, cells);
    });
  } else if (fmt === 'xlsx') {
    const meta = {};
    let names = null;
    await readXlsx(file, (cells) => {
      if (!names) {
        names = cells.map((c, i) => String(c || '').trim() || `col_${i + 1}`);
        const sig = names.join('|');
        if (acc.signature === null) acc.signature = sig;
        else if (acc.signature !== sig) acc.signatureMismatch.push(part.file);
        return true;
      }
      if (cells.every(v => v === '' || v === null)) return true;   /* trailing blank rows */
      return feedArray(acc, names, cells);
    }, meta);
    part.sheets = meta.sheets;
    part.sheetRead = meta.sheetRead;
    part.sharedStrings = meta.sharedStrings;
  } else if (fmt === 'json') {
    const meta = {};
    await readJson(file, (obj) => feedObject(acc, obj), meta);
    part.recordKey = meta.recordKey ?? '(top-level array)';
  } else if (fmt === 'jsonl') {
    await readJsonl(file, (obj) => feedObject(acc, obj));
  } else {
    throw new Error(`unsupported format: ${fmt}`);
  }

  part.rows = acc.rows - part.rowsBefore;
  delete part.rowsBefore;
  acc.parts.push(part);
  return part;
}

/* ═══════════════════ discovery ═══════════════════ */

const SKIP_DIR = /^(node_modules|\.git|AppData|Windows|Program Files.*|\$Recycle\.Bin|System Volume Information|\.cache|Library)$/i;

function walk(dir, depth, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !SKIP_DIR.test(e.name) && !e.name.startsWith('.')) walk(full, depth - 1, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
}

/* …_0001 / …-part2 / … (1) are slices of one export, not separate datasets.
   A trailing year is left alone — rent_contracts_2025 and _2026 are two
   periods of the same table and merging them silently would hide that. */
function logicalName(file) {
  let n = path.basename(file).replace(/\.[^.]+$/, '');
  n = n.replace(/[ _-]*\(\d+\)$/, '');
  n = n.replace(/[ _-]*(part|chunk|file|split)[ _-]*\d{1,6}$/i, '');
  n = n.replace(/[ _-]+(\d{1,6})$/, (m, d) => /^(19|20)\d{2}$/.test(d) ? m : '');
  return n.replace(/[ _-]+$/, '').trim() || path.basename(file);
}

/* ═══════════════════ report ═══════════════════ */

const mb  = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
const num = n => (n ?? 0).toLocaleString('en-US');

function report(r) {
  const L = [];
  L.push('='.repeat(78));
  L.push(`DATASET: ${r.dataset}`);
  L.push(`FILES: ${r.parts.length}   SIZE: ${mb(r.sizeBytes)}   ROWS: ${num(r.rows)}`
       + `   COLUMNS: ${r.columns}   MODIFIED: ${r.fileModified}`);
  for (const p of r.parts) {
    L.push(`   · ${p.file}  [${p.format}${p.delimiter ? ' "' + p.delimiter + '"' : ''}]`
         + `  ${mb(p.sizeBytes)}  ${num(p.rows)} rows`
         + (p.sheetRead  ? `  sheet:${p.sheetRead}`   : '')
         + (p.recordKey  ? `  records:${p.recordKey}` : '')
         + (p.error      ? `  READ FAILED: ${p.error}` : ''));
    if (p.sheets && p.sheets.length > 1) L.push(`     sheets present: ${p.sheets.join(', ')}`);
  }
  if (r.signatureMismatch.length)
    L.push(`!! COLUMN SIGNATURE DIFFERS in: ${r.signatureMismatch.join(', ')} — parts are NOT the same table`);
  if (r.truncated) L.push(`!! stopped at --max-rows ${num(MAX_ROWS)} — counts below are partial`);
  L.push(r.dateRange
    ? `DATE RANGE: ${r.dateRange.from} → ${r.dateRange.to}  (field: ${r.dateRange.field})`
    : 'DATE RANGE: no date column detected');
  L.push(`DUPLICATE ROWS: ${r.duplicateRows === null ? 'not computed (over cap)' : num(r.duplicateRows)}`
       + `   RAGGED: ${num(r.raggedRows)}   MALFORMED: ${num(r.malformedRecords)}`);
  L.push('');
  L.push('COLUMNS:');
  const w = Math.max(4, ...r.fields.map(f => f.name.length));
  for (const f of r.fields) {
    let extra;
    if (f.type === 'date' && f.minDate)                       extra = `  ${f.minDate}..${f.maxDate}`;
    else if ((f.type === 'int' || f.type === 'float') && f.min !== null) extra = `  ${f.min}..${f.max}`;
    else                                                      extra = `  distinct:${f.distinct}`;
    L.push(`  ${f.name.padEnd(w)}  ${f.type.padEnd(5)}${f.mixed ? '*' : ' '}`
         + `  missing:${String(f.missingPct).padStart(6)}%${extra}`
         + (f.personal ? '  [personal — values withheld]' : '')
         + (f.sample ? `  eg:${f.sample}` : ''));
    if (f.categories)
      L.push(`  ${' '.repeat(w)}     values: ` +
             f.categories.map(([v, n]) => `${v}(${num(n)})`).join(', '));
  }
  L.push('');
  L.push('LIKELY ROLES:');
  const roles = Object.entries(r.roles);
  if (!roles.length) L.push('  none matched');
  for (const [k, v] of roles) L.push(`  ${k.padEnd(10)} → ${v.join(', ')}`);
  return L.join('\n');
}

/* Fields shared by two or more datasets — the raw material for deciding
   whether a join is possible. It states co-occurrence, nothing more; it
   does NOT assert that a join is valid. */
function crossReport(all) {
  const map = new Map();
  for (const r of all) {
    for (const f of r.fields) {
      const k = f.name.toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ ds: r.dataset, type: f.type, distinct: f.distinct, missing: f.missingPct });
    }
  }
  const shared = [...map.entries()].filter(([, v]) => new Set(v.map(x => x.ds)).size > 1);
  const L = ['', '='.repeat(78), 'FIELDS PRESENT IN MORE THAN ONE DATASET', ''];
  if (!shared.length) { L.push('  none — no field name is common to two datasets'); return L.join('\n'); }
  shared.sort((a, b) => b[1].length - a[1].length);
  for (const [name, uses] of shared) {
    L.push(`  ${name}`);
    for (const u of uses) L.push(`      ${u.ds}  type:${u.type}  distinct:${u.distinct}  missing:${u.missing}%`);
  }
  L.push('');
  L.push('  Co-occurrence only. Whether any of these is a valid join key is a');
  L.push('  separate question and is not answered here.');
  return L.join('\n');
}

/* ═══════════════════ main ═══════════════════ */

const candidates = [];
for (const d of DIRS) {
  const abs = path.resolve(d);
  if (!fs.existsSync(abs)) { process.stderr.write(`skipping missing directory: ${abs}\n`); continue; }
  walk(abs, DEPTH, candidates);
}
if (!candidates.length) {
  console.error(`No files found under: ${DIRS.join(', ')}`);
  process.exit(1);
}

process.stderr.write(`scanning ${num(candidates.length)} files …\n`);

const READABLE = new Set(['delimited', 'json', 'jsonl', 'xlsx']);
const matched = [], otherCandidates = [], skipped = new Map();

for (const f of candidates) {
  let fmt;
  try { fmt = sniffFormat(f); } catch { fmt = 'unreadable'; }
  if (!READABLE.has(fmt)) { skipped.set(fmt, (skipped.get(fmt) || 0) + 1); continue; }
  if (TAKE_ALL || DLD_NAME.test(path.basename(f))) matched.push({ f, fmt });
  else otherCandidates.push({ f, fmt });
}

if (!matched.length) {
  console.error(`\nNo dataset files matched.\n` +
    (otherCandidates.length
      ? `${otherCandidates.length} readable file(s) were found but their names do not look like\n` +
        `DLD exports. Re-run with --all to inspect them:\n` +
        otherCandidates.slice(0, 20).map(c => `  ${path.basename(c.f)}  [${c.fmt}]`).join('\n') + '\n'
      : `Nothing readable as delimited text, JSON or XLSX was found.\n`));
  process.exit(1);
}

/* group split parts into logical datasets */
const groups = new Map();
for (const m of matched) {
  const k = logicalName(m.f);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(m);
}
for (const list of groups.values()) list.sort((a, b) => a.f.localeCompare(b.f));

const all = [];
const out = [];

for (const [name, list] of groups) {
  const acc = newAcc(name);
  for (const { f, fmt } of list) {
    process.stderr.write(`reading ${path.basename(f)} [${fmt}] … `);
    const t = Date.now();
    try {
      const p = await readPart(acc, f, fmt);
      process.stderr.write(`${num(p.rows)} rows in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
    } catch (e) {
      process.stderr.write(`FAILED: ${e.message}\n`);
      acc.parts.push({ file: path.basename(f), dir: path.dirname(f), format: fmt,
                       sizeBytes: fs.statSync(f).size,
                       modified: fs.statSync(f).mtime.toISOString().slice(0, 10),
                       rows: 0, error: e.message });
    }
  }
  acc.seen = new Set();                       /* release the duplicate index */
  const r = finish(acc);
  all.push(r);
  out.push(report(r));
}

out.push(crossReport(all));

if (otherCandidates.length) {
  out.push('', '='.repeat(78), 'READABLE FILES NOT INSPECTED (name does not look like a DLD export)', '');
  for (const c of otherCandidates.slice(0, 40)) out.push(`  ${path.basename(c.f)}  [${c.fmt}]`);
  out.push('', '  Re-run with --all to include them.');
}
if (skipped.size) {
  out.push('', `Skipped by format: ${[...skipped].map(([k, v]) => `${k}:${v}`).join('  ')}`);
}

const text = out.join('\n\n');
console.log(text);

for (const [p, body] of [[TXT_OUT, text], [JSON_OUT, JSON.stringify({
  generated: new Date().toISOString(),
  tool: 'inspect-datasets.mjs v2',
  note: 'Structure only. No transaction-level values are recorded here.',
  scanned: DIRS.map(d => path.resolve(d)),
  datasets: all,
}, null, 1)]]) {
  try {
    fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
    fs.writeFileSync(path.resolve(p), body);
    process.stderr.write(`written: ${p} (gitignored)\n`);
  } catch (e) {
    process.stderr.write(`could not write ${p}: ${e.message}\n`);
  }
}
