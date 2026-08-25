/**
 * Executive Pipeline Telemetry Endpoint
 * GET /api/executive/pipeline
 */

import { getSupabaseCredentials } from '../_supabase.js';

export default async function handler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `corr_pipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { url: sbUrl, serviceKey: sbKey, isConfigured } = getSupabaseCredentials();

  let leads = [];
  if (isConfigured) {
    try {
      const response = await fetch(`${sbUrl}/rest/v1/leads?select=id,name,email,budget_band,investment_objective,created_at&order=created_at.desc&limit=50`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
        },
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        leads = await response.json();
      }
    } catch {
      // Fallback to empty list
    }
  }

  const budgetToAed = (band) => {
    if (!band) return 2500000;
    const str = band.toLowerCase();
    if (str.includes('10m') || str.includes('10+')) return 12000000;
    if (str.includes('5m')) return 6000000;
    if (str.includes('2m')) return 3000000;
    return 2500000;
  };

  const totalDeals = leads.length;
  let totalPipelineAed = 0;
  const stageBreakdown = {
    UNCONTACTED: 0,
    QUALIFIED: 0,
    ADVISORY_SCHEDULED: 0,
    CLOSED_WON: 0,
  };
  const investorTiers = {
    ULTRA_HNW: 0,
    INSTITUTIONAL: 0,
    PREMIUM_EXPATS: 0,
    GENERAL: 0,
  };

  for (const lead of leads) {
    const val = budgetToAed(lead.budget_band);
    totalPipelineAed += val;
    stageBreakdown.QUALIFIED++;
    if (val >= 10000000) investorTiers.ULTRA_HNW++;
    else if (val >= 5000000) investorTiers.INSTITUTIONAL++;
    else investorTiers.PREMIUM_EXPATS++;
  }

  const grossCommissionAed = Math.round(totalPipelineAed * 0.02);

  return res.status(200).json({
    success: true,
    pipeline: {
      totalDeals,
      totalPipelineAed,
      grossCommissionAed,
      averageDealAed: totalDeals > 0 ? Math.round(totalPipelineAed / totalDeals) : 0,
      stageBreakdown,
      investorTiers,
      recentDeals: leads.slice(0, 10).map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        budget: l.budget_band || 'Standard (AED 2.5M+)',
        objective: l.investment_objective || 'Prime Capital Appreciation',
        stage: 'QUALIFIED',
        createdAt: l.created_at,
      })),
    },
    fetchedAt: new Date().toISOString(),
  });
}
