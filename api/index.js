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
  const headers = req.headers || {};
  const query = req.query || {};
  const method = req.method || 'GET';
  const body = req.body || {};
  const host = (headers.host || headers['x-forwarded-host'] || '').toLowerCase();

  // Extract actual requested URL from query parameter or matched path header
  let url = query.__path || headers['x-matched-path'] || req.url || '/';
  url = url.split('?')[0]; // strip query string for route matching

  // Clean duplicate /api prefixes if any occurred from rewrites (e.g. /api/api/health -> /api/health)
  url = url.replace(/^\/api\/api\//, '/api/');

  // 1. Dashboard Subdomain (dashboard.emanuelrendas.com) or '/dashboard'
  if (host.includes('dashboard') || url === '/dashboard' || url === '/dashboard/' || url === '/dashboard.html' || url === '/api/dashboard/ui') {
    let dashHtml = '';
    try {
      const candidates = [
        path.resolve('public/dashboard.html'),
        path.resolve('dashboard.html'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          dashHtml = fs.readFileSync(p, 'utf8');
          break;
        }
      }
    } catch {
      // fallback
    }
    if (!dashHtml) {
      dashHtml = renderCommandCenterHtml();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(dashHtml) : res.end(dashHtml);
  }

  // 2. API Subdomain Normalization (api.emanuelrendas.com)
  if (host.startsWith('api.')) {
    if (url === '/' || url === '' || url === '/status') {
      url = '/api/executive/status';
    } else if (url === '/connectors') {
      url = '/api/executive/connectors';
    } else if (url === '/pipeline') {
      url = '/api/executive/pipeline';
    } else if (url === '/alerts') {
      url = '/api/executive/alerts';
    } else if (url === '/kpis') {
      url = '/api/executive/kpis';
    } else if (url === '/chat') {
      url = '/api/executive/chat';
    } else if (url === '/health') {
      url = '/api/health';
    } else if (!url.startsWith('/api/')) {
      url = `/api${url}`;
    }
  }

  // 3. Static Web Pages & Assets on public website (www.emanuelrendas.com / emanuelrendas.com)
  if (!host.startsWith('api.') && !host.startsWith('dashboard.')) {
    const pageMap = {
      '': 'index.html',
      '/': 'index.html',
      '/index': 'index.html',
      '/index.html': 'index.html',
      '/about': 'about.html',
      '/about.html': 'about.html',
      '/contact': 'contact.html',
      '/contact.html': 'contact.html',
      '/advisory': 'advisory.html',
      '/advisory.html': 'advisory.html',
      '/instruments': 'instruments.html',
      '/instruments.html': 'instruments.html',
      '/intelligence': 'intelligence.html',
      '/intelligence.html': 'intelligence.html',
      '/addresses': 'addresses.html',
      '/addresses.html': 'addresses.html',
    };

    const targetFile = pageMap[url];
    if (targetFile) {
      try {
        const candidates = [
          path.resolve('public', targetFile),
          path.resolve(targetFile),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            const html = fs.readFileSync(p, 'utf8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            res.status(200);
            return typeof res.send === 'function' ? res.send(html) : res.end(html);
          }
        }
      } catch {
        // Fallback
      }
    }

    // Static assets fallback
    if (url.startsWith('/assets/') || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.svg')) {
      try {
        const cleanPath = url.replace(/^\//, '');
        const candidates = [
          path.resolve('public', cleanPath),
          path.resolve(cleanPath),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            const fileBuf = fs.readFileSync(p);
            let mimeType = 'text/plain';
            if (p.endsWith('.css')) mimeType = 'text/css';
            else if (p.endsWith('.js')) mimeType = 'application/javascript';
            else if (p.endsWith('.jpg') || p.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (p.endsWith('.png')) mimeType = 'image/png';
            else if (p.endsWith('.svg')) mimeType = 'image/svg+xml';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.status(200);
            return typeof res.send === 'function' ? res.send(fileBuf) : res.end(fileBuf);
          }
        }
      } catch {
        // Fallback
      }
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
