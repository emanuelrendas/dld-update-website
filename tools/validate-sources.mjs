#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   SOURCE REGISTRY VALIDATOR — run before deploy, fails loudly

   Checks the registry itself, and then checks the pages against it: every
   metric slot in the HTML must resolve to a registry entry, and every
   registry entry must be reachable. A slot pointing at nothing renders an
   empty state forever without anyone noticing; an orphan entry is a figure
   someone meant to publish and didn't.

     node tools/validate-sources.mjs

   Exit 0 clean, exit 1 with a list. Wire it into a predeploy step.
   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { validate, statusOf } from '../api/metrics.js';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data', 'registry.json'), 'utf8'));

const fail = [];
const warn = [];

/* ── 1. registry integrity ── */
fail.push(...validate(registry));

/* ── 2. no bare "Official" anywhere in the registry ── */
for (const m of registry.metrics) {
  const blob = JSON.stringify(m);
  if (/"classification"\s*:\s*"Official"/i.test(blob))
    fail.push(`${m.id}: bare "Official" classification`);
}

/* ── 3. emirate / authority coherence ──
   A Dubai figure attributed to ADREC, or an Abu Dhabi figure attributed to
   DLD, is the exact mix-up the separation rule exists to prevent. */
const EXPECT = {
  'Dubai':      [/Dubai Land Department/i, /Rendas Intelligence/i, /Fitch/i, /Property Monitor/i, /Knight Frank/i],
  'Abu Dhabi':  [/Abu Dhabi Real Estate Centre/i],
  'UAE':        [/Central Bank of the UAE/i, /UAE Government/i],
};
for (const m of registry.metrics) {
  const allowed = EXPECT[m.emirate];
  if (!allowed) { warn.push(`${m.id}: unrecognised emirate "${m.emirate}"`); continue; }
  if (!allowed.some(re => re.test(m.authority || '')))
    fail.push(`${m.id}: emirate "${m.emirate}" with authority "${m.authority}" — mismatched jurisdiction`);
}

/* ── 4. DLD label discipline ──
   Only a Land Department figure may claim OFFICIAL · PRIMARY. */
for (const m of registry.metrics) {
  if (m.classification === 'OFFICIAL · PRIMARY' && !/Dubai Land Department/i.test(m.authority || ''))
    fail.push(`${m.id}: OFFICIAL · PRIMARY reserved for Dubai Land Department, got "${m.authority}"`);
  if (/Dubai Land Department/i.test(m.authority || '') && m.classification === 'THIRD-PARTY')
    fail.push(`${m.id}: a Land Department figure classified THIRD-PARTY`);
}

/* ── 5. page slots resolve ── */
const ids = new Set(registry.metrics.map(m => m.id));
const used = new Set();
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const m of html.matchAll(/data-metric="([^"]+)"/g)) {
    used.add(m[1]);
    if (!ids.has(m[1]) && !m[1].startsWith('dubai.live.'))
      fail.push(`${file}: slot data-metric="${m[1]}" has no registry entry`);
  }
  // A published market number must not be hardcoded beside a slot system.
  for (const n of html.matchAll(/AED\s?(286\.43B|326\.6|139\.75|146\.69|34\.88|15\.96)/g))
    fail.push(`${file}: hardcoded official figure "${n[0]}" — must come from /api/metrics`);
}
for (const id of ids)
  if (!used.has(id)) warn.push(`registry entry "${id}" is not used by any page`);

/* ── 6. status sanity ── */
const now = new Date(registry.policy.referenceDate + 'T00:00:00Z');
const byStatus = {};
for (const m of registry.metrics) {
  const s = statusOf(m, registry, now);
  (byStatus[s] ||= []).push(m.id);
}

/* ── report ── */
const line = '─'.repeat(66);
console.log(line);
console.log(`SOURCE REGISTRY — ${registry.metrics.length} entries, reference ${registry.policy.referenceDate}`);
console.log(line);
for (const [s, list] of Object.entries(byStatus)) console.log(`  ${s.padEnd(12)} ${list.length}`);
const cls = {};
for (const m of registry.metrics) cls[m.classification] = (cls[m.classification] || 0) + 1;
console.log('');
for (const [c, n] of Object.entries(cls)) console.log(`  ${c.padEnd(22)} ${n}`);

if (warn.length) {
  console.log('\nWARN');
  for (const w of warn) console.log('  · ' + w);
}
if (fail.length) {
  console.log('\nFAIL');
  for (const f of fail) console.log('  ✗ ' + f);
  console.log(`\n${fail.length} error(s). Not fit to deploy.`);
  process.exit(1);
}
console.log('\nPASS — registry valid, every slot resolves, no hardcoded official figures.');
