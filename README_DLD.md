# Dubai Pulse / DLD setup

This repository references the Dubai Pulse DLD dataset in `api/dld.js`. The function requires two environment variables to access Dubai Pulse and will return `configured: false` when they are not set (the site falls back to published static figures).

Setup
1. Request access to the `dld_transactions-open` dataset at https://dubaipulse.gov.ae and follow their process.
2. When granted, you will receive two separate emails:
   - API Key (client_id)
   - API Secret (client_secret)
3. In Vercel, set two environment variables on the project:
   - DUBAI_PULSE_KEY  (client_id)
   - DUBAI_PULSE_SECRET (client_secret)
4. Redeploy the Vercel project.

Local testing
- To test the function locally without Vercel:
  1. Use `vercel dev` (recommended) or run a small Node server that proxies the handler.
  2. Set the env vars in your shell (export DUBAI_PULSE_KEY=...; export DUBAI_PULSE_SECRET=...).
  3. Call `/api/dld` and confirm the JSON shape: { configured: true, ok: true|false, source, window, totals, areas }.

Notes
- The function caches at the edge (`s-maxage=86400`) and returns medians only where the sampleSize >= 10.
- If credentials are missing, the endpoint returns `configured: false` so the site continues to show static figures.
