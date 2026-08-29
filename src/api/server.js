/**
 * RAIOC OS - Web API Router & HTTP Dispatcher (Sprint 3)
 * Dispatches inbound requests, serves the Executive Command Center, and manages SSE Realtime streams.
 */

import { createServer } from 'node:http';
import { handleIklRequest } from './routes/ikl-routes.js';
import { handleCalculatorRequest } from './routes/calculator-routes.js';
import { handleAssessmentSubmission } from './routes/assessment-routes.js';
import { handleLeadSubmission } from './routes/lead-routes.js';
import { handleTelemetryRequest } from './routes/telemetry-routes.js';
import { handleWebhookRequest } from './routes/webhook-routes.js';
import { handleAgentRequest } from './routes/agent-routes.js';
import { handleDldRequest } from './routes/dld-routes.js';
import { handleFxRequest } from './routes/fx-routes.js';
import { handleEventRequest } from './routes/event-routes.js';
import { handleIntakeRequest } from './routes/intake-routes.js';
import { correlationTracer } from '../monitoring/correlation-tracer.js';
import { metricsCollector } from '../monitoring/metrics-collector.js';
import { agentEventBus } from '../events/agent-event-bus.js';
import { executiveDashboard } from '../operational/executive-dashboard.js';
import { connectorHealthMatrix } from '../monitoring/connector-health-matrix.js';
import { logger } from '../logging/audit-logger.js';
import { dashboardSessionManager } from '../security/dashboard-session.js';
import { resolveCorsHeaders } from './cors.js';

export async function routeApiRequest(reqPath, method = 'GET', body = {}, query = {}, headers = {}) {
  const url = reqPath.split('?')[0];
  const startTime = Date.now();
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || correlationTracer.generateCorrelationId('api');

  metricsCollector.incrementCounter('http_requests_total');

  return await correlationTracer.runWithContext({ correlationId }, async () => {
    let response;

    // 1. Dashboard UI, Executive Telemetry & Connectors (/dashboard, /api/dashboard/*, /api/executive/*, /api/telemetry/*, /health, /api/health)
    if (url === '/dashboard' || url.startsWith('/api/dashboard') || url.startsWith('/api/telemetry') || url.startsWith('/api/executive') || url === '/health' || url === '/api/health') {
      response = await handleTelemetryRequest(url, { headers, query, body });
    }
    // 2. DLD Market Data
    else if (url === '/api/dld' || url.startsWith('/api/dld/')) {
      response = await handleDldRequest();
    }
    // 3. FX Exchange Rates
    else if (url === '/api/fx' || url.startsWith('/api/fx/')) {
      response = await handleFxRequest();
    }
    // 4. Telemetry / Event Tracking
    else if (url === '/api/event' || url.startsWith('/api/event/')) {
      response = await handleEventRequest(method, body, { headers });
    }
    // 5. Multi-channel Intake
    else if (url === '/api/intake' || url.startsWith('/api/intake/')) {
      response = await handleIntakeRequest(method, body, { headers });
    }
    // 6. IKL Endpoints
    else if (url.startsWith('/api/ikl')) {
      response = await handleIklRequest(url, query);
    }
    // 7. Calculator Endpoints
    else if (url.startsWith('/api/calculators')) {
      response = await handleCalculatorRequest(url, body);
    }
    // 8. Assessment Submission
    else if (url.startsWith('/api/assessment') || url.startsWith('/api/dira')) {
      response = await handleAssessmentSubmission(body, { headers, method });
    }
    // 9. Lead Submission
    else if (url.startsWith('/api/lead') || url.startsWith('/api/brief')) {
      response = await handleLeadSubmission(body, { headers, method });
    }
    // 10. Webhook Endpoints (n8n & WhatsApp)
    else if (url.startsWith('/api/webhooks')) {
      response = await handleWebhookRequest(url, method, body, query, headers);
    }
    // 11. Shared Agent API
    else if (url.startsWith('/api/agents')) {
      response = await handleAgentRequest(url, method, body, headers);
    } else {
      response = { status: 404, body: { error: `Endpoint not found: ${url}` } };
    }

    const durationMs = Date.now() - startTime;
    metricsCollector.recordLatency(`http_${url.split('/')[2] || 'root'}`, durationMs);

    return {
      ...response,
      headers: {
        'X-Correlation-ID': correlationId,
        ...(response.headers || {}),
      },
    };
  });
}

/**
 * Starts a native standalone HTTP server with SSE Realtime streaming support
 */
export function startApiServer(port = 3000) {
  const server = createServer(async (req, res) => {
    // Enable CORS for frontend integration. Credentialed (cookie-bearing) requests
    // are only permitted from allowlisted dashboard origins; everything else gets
    // the public, credential-less '*' behavior unchanged.
    const corsHeaders = resolveCorsHeaders(req.headers.origin || req.headers.Origin);
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.setHeader(k, v);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Correlation-ID, X-N8N-Signature, X-Hub-Signature-256');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // --- Realtime SSE Stream Endpoint ---
    if (parsedUrl.pathname === '/api/dashboard/stream' || parsedUrl.pathname === '/api/realtime') {
      if (!dashboardSessionManager.verifyRequest(req.headers)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dashboard session required' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send initial snapshot
      const snapshot = executiveDashboard.getDashboardData();
      const connectors = connectorHealthMatrix.getAllConnectorHealth();
      res.write(`data: ${JSON.stringify({ type: 'SNAPSHOT', data: snapshot, connectors })}\n\n`);

      // Subscribe to real-time events on the bus
      const unsub = agentEventBus.subscribe('*', (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Keep connection alive with periodic heartbeat comment
      const keepAliveTimer = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAliveTimer);
        unsub();
      });
      return;
    }

    let body = {};
    if (req.method === 'POST') {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const raw = Buffer.concat(buffers).toString();
        if (raw) body = JSON.parse(raw);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }

    const response = await routeApiRequest(parsedUrl.pathname, req.method, body, query, req.headers);

    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v);
      }
    }

    const contentType = response.headers?.['Content-Type'] || 'application/json';
    const isHtml = contentType.includes('text/html');
    const isRawString = typeof response.body === 'string';

    res.writeHead(response.status, {
      'Content-Type': contentType,
    });
    res.end(isHtml || isRawString ? response.body : JSON.stringify(response.body));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info('API_SERVER', `RAIOC Executive Command Center & API server listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}
