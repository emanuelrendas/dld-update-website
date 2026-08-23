/**
 * Shared Supabase Configuration Helper for Vercel API Routes
 * Resiliently resolves Supabase URL and Service Role Key from all standard variable names.
 */

export function getSupabaseCredentials() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_REST_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim();

  const sourceUrl = process.env.SUPABASE_URL
    ? "SUPABASE_URL"
    : process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "NEXT_PUBLIC_SUPABASE_URL"
    : process.env.SUPABASE_REST_URL
    ? "SUPABASE_REST_URL"
    : null;

  const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : process.env.SUPABASE_SERVICE_KEY
    ? "SUPABASE_SERVICE_KEY"
    : process.env.SUPABASE_SECRET_KEY
    ? "SUPABASE_SECRET_KEY"
    : process.env.SUPABASE_KEY
    ? "SUPABASE_KEY"
    : null;

  return {
    url,
    serviceKey,
    isConfigured: Boolean(url && serviceKey),
    sources: { url: sourceUrl, serviceKey: sourceKey },
  };
}
