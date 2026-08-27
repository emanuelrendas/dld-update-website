/**
 * Unified Lead & Assessment Intake Route Handler
 */

import { getSupabaseCredentials } from '../../../api/_supabase.js';
import { checkRateLimit, clientKey, LIMITS } from '../rate-limit.js';

/* No Access-Control-Allow-Origin. This route writes to the CRM, and a
   wildcard on a write endpoint lets any page on the internet post rows
   into `leads` from a visitor's browser. The site calls it from its own
   origin, where CORS does not apply. */
export async function handleIntakeRequest(method = 'GET', payload = {}, options = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (method === 'OPTIONS') {
    return { status: 405, headers: { ...headers, Allow: 'GET, POST' }, body: null };
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  if (method === 'GET') {
    return {
      status: 200,
      headers,
      body: {
        ok: true,
        endpoint: '/api/intake',
        configured: isConfigured,
      },
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers: { ...headers, Allow: 'GET, POST' },
      body: { ok: false, error: 'Method not allowed. Use POST.' },
    };
  }

  const rate = checkRateLimit(clientKey(options.headers), LIMITS.write);
  if (!rate.allowed) {
    return {
      status: 429,
      headers: { ...headers, 'Retry-After': String(rate.retryAfterSeconds) },
      body: { ok: false, stored: false, error: 'Too many submissions. Please try again shortly.' },
    };
  }

  let body = payload;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      headers,
      body: { ok: false, error: 'Expected JSON body.' },
    };
  }

  if (!isConfigured) {
    return {
      status: 503,
      headers,
      body: { ok: false, error: 'Supabase storage is not configured on the server.' },
    };
  }

  const action = body.action || 'lead_capture';
  const waNumber = '971543871702';

  try {
    if (action === 'lead_capture') {
      const name = (body.name || '').trim();
      const email = (body.email || '').trim().toLowerCase();
      const location = (body.location || body.address || '').trim();
      const mobile = (body.mobile || body.phone || '').trim() || null;
      const mandate = (body.mandate_description || body.notes || '').trim() || null;
      const objective = (body.investment_objective || body.objective || '').trim() || null;
      const budget = (body.budget_band || body.budget || '').trim() || null;
      /* An explicit tick, not an absent field. `!== false` treated a
         payload carrying no consent key at all as consent given. */
      const consent = body.consent_given === true;

      if (!name || !email) {
        return { status: 400, headers, body: { ok: false, error: 'Name and email are required.' } };
      }
      if (!consent) {
        return { status: 400, headers, body: { ok: false, error: 'Explicit consent is required.' } };
      }

      const row = {
        name,
        email,
        mobile,
        address: location,
        notes: mandate,
        investment_objective: objective,
        budget_band: budget,
        lead_magnet: body.lead_magnet || 'private_brief_form',
        preferred_language: body.preferred_language || 'en',
        utm_source: body.utm_source || body.attribution?.utm_source || null,
        utm_medium: body.utm_medium || body.attribution?.utm_medium || null,
        utm_campaign: body.utm_campaign || body.attribution?.utm_campaign || null,
        referrer_url: body.referrer_url || body.attribution?.referrer_url || null,
        source: 'website',
        origin: 'website',
        relationship_type: 'website_organic',
        consent_status: 'opted_in',
        status: 'new',
        created_at: new Date().toISOString(),
      };

      const waText = `PRIVATE BRIEF — via website\nName: ${name}\nEmail: ${email}\nBased in: ${location || '—'}\nInterest: ${objective || '—'}\nBudget: ${budget || '—'}\nBrief: ${mandate || '—'}`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

      const r = await fetch(`${URL_BASE}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(10000),
      });

      const text = await r.text();
      let leadId = null;
      try { leadId = JSON.parse(text)?.[0]?.id || null; } catch { leadId = null; }

      if (body.session_id && leadId) {
        try {
          await fetch(`${URL_BASE}/rest/v1/lead_events?session_id=eq.${encodeURIComponent(body.session_id)}&lead_id=is.null`, {
            method: 'PATCH',
            headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId }),
          });
        } catch (_) {}
      }

      return {
        status: 200,
        headers,
        body: {
          ok: true,
          lead_id: leadId,
          whatsapp_url: whatsappUrl,
        },
      };
    }

    if (action === 'event') {
      const session_id = body.session_id;
      const event_name = body.event_name;
      if (!session_id || !event_name) return { status: 204, headers, body: null };

      await fetch(`${URL_BASE}/rest/v1/lead_events`, {
        method: 'POST',
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id,
          event_name,
          event_props: body.event_props || null,
          /* Path only — see the note in event-routes.js. */
          page_url: (() => {
            const u = body.page_url;
            if (typeof u !== 'string' || !u) return null;
            try { return new URL(u).pathname.slice(0, 200); }
            catch { return u.split('?')[0].slice(0, 200); }
          })(),
          lead_id: body.lead_id || null,
          created_at: new Date().toISOString(),
        }),
      });
      return { status: 204, headers, body: null };
    }

    if (action === 'assessment_submit') {
      const session_id = body.session_id || 'sess_assessment';
      const answers = body.answers || {};

      /* lead_assessment_responses is one row per answer:
         (session_id, question_key, answer_value), both NOT NULL. It has
         no `responses` column — posting a JSON blob to it is rejected
         with PGRST204 and every answer is lost. */
      const rows = Object.entries(answers)
        .filter(([k, v]) => k && v !== null && v !== undefined && v !== '')
        .map(([question_key, answer_value]) => ({
          session_id,
          question_key: String(question_key).slice(0, 80),
          answer_value: String(answer_value).slice(0, 500),
          lead_id: body.lead_id || null,
          created_at: new Date().toISOString(),
        }));

      if (!rows.length) {
        return { status: 400, headers, body: { ok: false, error: 'No answers supplied.' } };
      }

      const ar = await fetch(`${URL_BASE}/rest/v1/lead_assessment_responses`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(10000),
      });

      if (!ar.ok) {
        console.error(`intake: assessment_submit ${ar.status} ${(await ar.text()).slice(0, 400)}`);
        return { status: 502, headers, body: { ok: false, stored: false, error: 'The answers could not be saved.' } };
      }

      return {
        status: 200,
        headers,
        body: {
          ok: true,
          stored: true,
          session_id,
          answers_stored: rows.length,
          status: 'completed',
        },
      };
    }

    return {
      status: 400,
      headers,
      body: { ok: false, error: `Unrecognized action: ${action}` },
    };
  } catch (err) {
    return {
      status: 500,
      headers,
      /* The message goes to the log. A PostgREST or fetch error can echo
         column names, constraint definitions and internal hostnames. */
      body: { ok: false, error: 'That request could not be completed.' },
    };
  }
}
