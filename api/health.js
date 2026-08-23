// ═══════════════════════════════════════════════════════════════
// STORAGE & RUNTIME HEALTH CHECK (/api/health)
// ═══════════════════════════════════════════════════════════════

import { getSupabaseCredentials } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured, sources } = getSupabaseCredentials();

  const out = {
    checkedAt: new Date().toISOString(),
    env: {
      urlConfigured: Boolean(URL_BASE),
      keyConfigured: Boolean(SERVICE),
      matchedUrlVariable: sources.url,
      matchedKeyVariable: sources.serviceKey,
      availableVariables: {
        SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        SUPABASE_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_KEY),
        SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
      },
      keyType: SERVICE
        ? (SERVICE.startsWith('sb_secret_') ? 'new secret key (sb_secret_...)'
          : SERVICE.startsWith('sb_publishable_') ? 'PUBLISHABLE — wrong key, this cannot write'
          : SERVICE.startsWith('eyJ') ? 'legacy JWT (service_role)'
          : 'custom key format')
        : 'none',
    },
    tables: {},
  };

  if (!isConfigured) {
    out.verdict = 'NOT CONFIGURED — Supabase URL or Service Role Key missing from this deployment environment.';
    return res.status(200).json(out);
  }

  const probe = async (table) => {
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(8000),
      });
      const body = await r.text();
      return {
        status: r.status,
        ok: r.ok,
        rowCount: r.headers.get('content-range') || null,
        error: r.ok ? null : body.slice(0, 200),
      };
    } catch (err) {
      return { status: null, ok: false, error: `${err.name}: ${err.message}` };
    }
  };

  out.tables.leads = await probe('leads');
  out.tables.lead_events = await probe('lead_events');
  out.tables.lead_assessment_responses = await probe('lead_assessment_responses');

  const allOk = Object.values(out.tables).every((t) => t.ok);
  out.verdict = allOk
    ? 'HEALTHY — Supabase connection verified across all tables. Inbound submissions will be stored.'
    : 'FAILING — Credentials found but PostgREST rejected request. Check tables[].status and tables[].error.';

  return res.status(200).json(out);
}
