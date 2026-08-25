/**
 * Executive Alerts Endpoint
 * GET /api/executive/alerts
 */

import { getSupabaseCredentials } from '../_supabase.js';

export default async function handler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `corr_alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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

  const alerts = [];
  const { isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    alerts.push({
      id: `alt_sb_${Date.now()}`,
      severity: 'HIGH',
      title: 'Supabase Credentials Incomplete',
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment',
      category: 'INFRASTRUCTURE',
      timestamp: new Date().toISOString(),
    });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    alerts.push({
      id: `alt_smtp_${Date.now()}`,
      severity: 'MEDIUM',
      title: 'SMTP Mailer Credentials Incomplete',
      message: 'SMTP_USER or SMTP_PASSWORD missing from environment',
      category: 'COMMUNICATION',
      timestamp: new Date().toISOString(),
    });
  }

  const severityFilter = req.query?.severity;
  const filtered = severityFilter
    ? alerts.filter((a) => a.severity.toUpperCase() === severityFilter.toUpperCase())
    : alerts;

  return res.status(200).json({
    success: true,
    alerts: filtered,
    totalCount: filtered.length,
    timestamp: new Date().toISOString(),
  });
}
