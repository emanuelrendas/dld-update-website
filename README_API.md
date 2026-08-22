# API / serverless functions — quick operational notes

Files:
- api/dld.js  — gathers Dubai Land Department transaction records via Dubai Pulse
- api/fx.js   — derives AED rates from ECB reference rates (via api.frankfurter.app)

Environment
- DUBAI_PULSE_KEY
- DUBAI_PULSE_SECRET
(Only required for api/dld.js; keep secrets out of the repo and only set in Vercel)

Local dev checklist (90-second review)
1. Start dev server: `vercel dev` (or equivalent).
2. If testing DLD, export the two env vars locally.
3. Confirm endpoints:
   - GET /api/fx  -> returns JSON: { ok: true|true (fallback), live: true|false, rates: {...} }
   - GET /api/dld -> returns JSON: { configured: false } (if no creds) or aggregated payload
4. Verify Content-Type is application/json and that the endpoints return the documented shapes.

Quick verification tests
- api/fx: temporarily block network to api.frankfurter.app to confirm fallback path is returned (live: false).
- api/dld: with credentials, confirm `areas` array returns items only when sampleSize >= 10.

Safety notes
- Do not commit secrets.
- Use `--force-with-lease` only when you intend to overwrite remote history.
