// ═══════════════════════════════════════════════════════════════
// STORAGE HEALTH CHECK
//
// Lead capture has been deployed twice and proven working zero times.
// The failure is invisible from the outside: the WhatsApp handoff still
// opens, so the form looks fine while nothing reaches the database. The
// only evidence so far is a 401 from PostgREST in the Supabase logs.
//
// This route answers, in one request, the three questions that guessing
// cannot settle:
//
//   1. Are the environment variables present in this deployment?
//   2. Does the key authenticate against PostgREST?
//   3. Can it actually read the leads table?
//
// ─────────────── WHAT IT NEVER RETURNS ───────────────
//
// Not the key, not any part of it, not its length. Only booleans, an
// HTTP status, and — when a request fails — the first 200 characters of
// PostgREST's own error text, which describes the rejection without
// echoing credentials. The project URL is not a secret; it ships in the
// page on any Supabase site.
//
// No personal data is read. The query asks for a count and nothing else.
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const URL_BASE = process.env.SUPABASE_URL;
  const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const out = {
    checkedAt: new Date().toISOString(),
    env: {
      SUPABASE_URL:              !!URL_BASE,
      SUPABASE_SERVICE_ROLE_KEY: !!SERVICE,
      /* A key pasted with a trailing newline authenticates as garbage and
         gives exactly the 401 we saw. Worth knowing without seeing it. */
      keyHasSurroundingWhitespace: SERVICE ? SERVICE !== SERVICE.trim() : null,
      keyLooksLikeSecret: SERVICE
        ? (SERVICE.startsWith('sb_secret_') ? 'new secret key'
          : SERVICE.startsWith('sb_publishable_') ? 'PUBLISHABLE — wrong key, this cannot write'
          : SERVICE.startsWith('eyJ') ? 'legacy JWT'
          : 'unrecognised prefix')
        : null,
    },
    tables: {},
  };

  if (!URL_BASE || !SERVICE) {
    out.verdict = 'NOT CONFIGURED — one or both environment variables are missing from this deployment.';
    return res.status(200).json(out);
  }

  const probe = async (table) => {
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: SERVICE.trim(),
          Authorization: `Bearer ${SERVICE.trim()}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(8000),
      });
      const body = await r.text();
      return {
        status: r.status,
        ok: r.ok,
        rowCount: r.headers.get('content-range') || null,
        /* PostgREST describes its own refusal; it does not echo the key. */
        error: r.ok ? null : body.slice(0, 200),
      };
    } catch (err) {
      return { status: null, ok: false, error: `${err.name}: ${err.message}` };
    }
  };

  out.tables.leads       = await probe('leads');
  out.tables.lead_events = await probe('lead_events');

  const allOk = Object.values(out.tables).every((t) => t.ok);
  out.verdict = allOk
    ? 'HEALTHY — the key authenticates and both tables are reachable. A submitted brief will be stored.'
    : 'FAILING — the variables are set but the request was refused. See tables[].status and tables[].error.';

  return res.status(200).json(out);
}
