/**
 * Executive Command Center Dashboard UI Serverless Function (/dashboard)
 * Serves the RAIOC Executive Command Center UI
 */

import { renderCommandCenterHtml } from '../src/dashboard/command-center-html.js';

export default async function handler(req, res) {
  const correlationId = req.headers?.['x-correlation-id'] || `corr_dash_${Date.now()}`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Correlation-ID', correlationId);

  const html = renderCommandCenterHtml();

  res.status(200);
  if (typeof res.send === 'function') {
    res.send(html);
  } else {
    res.end(html);
  }
}
