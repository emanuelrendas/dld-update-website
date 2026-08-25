/**
 * Vercel Serverless Entrypoint - RAIOC OS
 * Explicitly protects root '/' to serve index.html (public website),
 * '/dashboard' to serve the Executive Command Center,
 * and '/api/*' to route through the unified API router.
 */

import fs from 'node:fs';
import path from 'node:path';
import { routeApiRequest } from '../src/api/server.js';
import { renderCommandCenterHtml } from '../src/dashboard/command-center-html.js';

export default async function handler(req, res) {
  let url = req.url || '/';
  const method = req.method || 'GET';
  const headers = req.headers || {};
  const query = req.query || {};
  const body = req.body || {};
  const host = (headers.host || headers['x-forwarded-host'] || '').toLowerCase();

  // 1. Dashboard Subdomain (dashboard.emanuelrendas.com) or '/dashboard'
  if (host.startsWith('dashboard.') || url === '/dashboard' || url === '/dashboard/' || url === '/api/dashboard/ui') {
    const dashHtml = renderCommandCenterHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(dashHtml) : res.end(dashHtml);
  }

  // 2. API Subdomain Normalization (api.emanuelrendas.com)
  if (host.startsWith('api.')) {
    if (url === '/' || url === '') {
      url = '/api/executive/status';
    } else if (!url.startsWith('/api/')) {
      if (['/status', '/connectors', '/pipeline', '/alerts', '/kpis', '/chat'].includes(url)) {
        url = `/api/executive${url}`;
      } else {
        url = `/api${url}`;
      }
    }
  }

  // 3. Root '/' on public website -> Serve public website index.html
  if (url === '/' || url === '/index.html' || url === '') {
    try {
      const indexPath = path.resolve('index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.status(200);
        return typeof res.send === 'function' ? res.send(html) : res.end(html);
      }
    } catch {
      // Fallback
    }
  }

  // 4. API & Telemetry Routes
  try {
    const response = await routeApiRequest(url, method, body, query, headers);

    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v);
      }
    }

    const contentType = response.headers?.['Content-Type'] || 'application/json';
    res.status(response.status);

    if (contentType.includes('text/html') || typeof response.body === 'string') {
      res.setHeader('Content-Type', contentType);
      if (typeof res.send === 'function') {
        res.send(response.body);
      } else {
        res.end(response.body);
      }
    } else {
      res.setHeader('Content-Type', 'application/json');
      if (typeof res.json === 'function') {
        res.json(response.body);
      } else {
        res.end(JSON.stringify(response.body));
      }
    }
  } catch (err) {
    res.status(500);
    const errPayload = { error: 'Internal Serverless Execution Error', message: err.message };
    if (typeof res.json === 'function') {
      res.json(errPayload);
    } else {
      res.end(JSON.stringify(errPayload));
    }
  }
}
