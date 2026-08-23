/**
 * Vercel Serverless Function: /api/intake
 * 
 * Thin adapter layer for unified intake actions (lead_capture, assessment_submit, event).
 */

import { getSupabaseCredentials } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/intake",
      configured: isConfigured,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ ok: false, error: "Expected JSON body." });
  }

  if (!isConfigured) {
    console.error("intake: Supabase credentials not set in process.env");
    return res.status(503).json({
      ok: false,
      error: "Supabase storage is not configured on the server.",
    });
  }

  const action = payload.action || "lead_capture";
  const waNumber = "971543871702";

  try {
    if (action === "lead_capture") {
      const name = (payload.name || "").trim();
      const email = (payload.email || "").trim().toLowerCase();
      const location = (payload.location || payload.address || "").trim();
      const mobile = (payload.mobile || payload.phone || "").trim() || null;
      const mandate = (payload.mandate_description || payload.notes || "").trim() || null;
      const objective = (payload.investment_objective || payload.objective || "").trim() || null;
      const budget = (payload.budget_band || payload.budget || "").trim() || null;
      const consent = payload.consent_given !== false;

      if (!name || !email) {
        return res.status(400).json({ ok: false, error: "Name and email are required." });
      }
      if (!consent) {
        return res.status(400).json({ ok: false, error: "Explicit consent is required." });
      }

      const row = {
        name,
        email,
        mobile,
        address: location,
        notes: mandate,
        investment_objective: objective,
        budget_band: budget,
        lead_magnet: payload.lead_magnet || "private_brief_form",
        preferred_language: payload.preferred_language || "en",
        utm_source: payload.utm_source || payload.attribution?.utm_source || null,
        utm_medium: payload.utm_medium || payload.attribution?.utm_medium || null,
        utm_campaign: payload.utm_campaign || payload.attribution?.utm_campaign || null,
        referrer_url: payload.referrer_url || payload.attribution?.referrer_url || null,
        source: "website",
        origin: "website",
        relationship_type: "website_organic",
        consent_status: "opted_in",
        status: "new",
        created_at: new Date().toISOString(),
      };

      const waText = `PRIVATE BRIEF — via website\nName: ${name}\nEmail: ${email}\nBased in: ${location || '—'}\nInterest: ${objective || '—'}\nBudget: ${budget || '—'}\nBrief: ${mandate || '—'}`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

      const r = await fetch(`${URL_BASE}/rest/v1/leads`, {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(10000),
      });

      const text = await r.text();
      let leadId = null;
      try { leadId = JSON.parse(text)?.[0]?.id || null; } catch { leadId = null; }

      if (payload.session_id && leadId) {
        try {
          await fetch(`${URL_BASE}/rest/v1/lead_events?session_id=eq.${encodeURIComponent(payload.session_id)}&lead_id=is.null`, {
            method: "PATCH",
            headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: leadId }),
          });
        } catch (_) {}
      }

      return res.status(200).json({
        ok: true,
        lead_id: leadId,
        whatsapp_url: whatsappUrl,
      });
    }

    if (action === "event") {
      const session_id = payload.session_id;
      const event_name = payload.event_name;
      if (!session_id || !event_name) return res.status(204).end();

      await fetch(`${URL_BASE}/rest/v1/lead_events`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          event_name,
          event_props: payload.event_props || null,
          page_url: payload.page_url || null,
          lead_id: payload.lead_id || null,
          created_at: new Date().toISOString(),
        }),
      });
      return res.status(204).end();
    }

    if (action === "assessment_submit") {
      const session_id = payload.session_id || "sess_assessment";
      const answers = payload.answers || {};

      await fetch(`${URL_BASE}/rest/v1/lead_assessment_responses`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          responses: answers,
          lead_id: payload.lead_id || null,
          created_at: new Date().toISOString(),
        }),
      });

      return res.status(200).json({
        ok: true,
        session_id,
        status: "completed",
      });
    }

    return res.status(400).json({ ok: false, error: `Unrecognized action: ${action}` });

  } catch (err) {
    console.error("intake handler error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
