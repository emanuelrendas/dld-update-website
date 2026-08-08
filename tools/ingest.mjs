#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   INGESTION — not implemented yet, deliberately.

   The field mapping cannot be written until the manifest from
   inspect-datasets.mjs says what the columns actually are. Guessing them
   would produce a pipeline that runs, returns numbers, and is wrong in a
   way nobody notices for months.

   What is fixed now is the OUTPUT CONTRACT below. It is the whole point
   of the architecture: the site reads this shape and nothing else, so
   when Data.Dubai API access is approved only the reader at the top of
   this file changes. No page, no stylesheet and no frontend module is
   touched.

   ─────────────── THE CONTRACT ───────────────

   data/snapshots/<period>.json
   {
     "manifest": {
       "source":       "Dubai Land Department",       // publisher
       "dataset":      "<data.dubai dataset id>",     // exact provenance
       "via":          "json" | "xlsx" | "csv" | "api",  // how it was read
       "published":    "2026-08-01",                  // dataset's own date
       "verified":     "2026-08-08",                  // when we ingested
       "confidence":   "verified",                    // verified|indicative|modelled|forecast
       "rowsIn":       1245823,                       // records read
       "rowsUsed":     1198004,                       // survived validation
       "suppressed":   ["<community>", …]             // below the reporting floor
     },
     "period":  { "type": "quarter", "id": "2026-Q2", "from": "…", "to": "…" },
     "totals":  { "transactions": 0, "valueAED": 0,
                  "medianPricePerSqft": 0, "offPlanShare": 0 },
     "communities": [
       { "name": "…", "transactions": 0, "valueAED": 0,
         "medianPricePerSqft": 0, "offPlanShare": 0 }
     ]
   }

   Rules the pipeline must keep, carried over from api/dld.js because they
   are what make the figures defensible:

     • medians, never means — one AED 200M villa must not move a community
     • records with implausible area or value are discarded before any
       median is taken, and the discard count is reported, not hidden
     • a community with fewer than 10 valid records is suppressed and
       named in manifest.suppressed rather than published as noise
     • no transaction-level record ever reaches a snapshot; only
       aggregates leave this machine

   ═══════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';

const manifest = 'data/manifest.json';
if (!fs.existsSync(manifest)) {
  console.error(
`Nothing to ingest yet.

Run the inspector first:

  node tools/inspect-datasets.mjs

Point --dir at wherever the exports actually are; it detects JSON, JSONL,
XLSX and delimited text by content. It writes ${manifest} describing what
the columns are. The field mapping is written against that manifest, not
guessed.`);
  process.exit(1);
}

console.error(
`Manifest found, but the mapping is not written yet.

Send the inspector's printed summary back so each DLD column can be bound
to a metric on the site. Until then this script stays a no-op by design —
an ingestion that guesses its columns is worse than none.`);
process.exit(1);
