/**
 * SMTP Diagnostic & Test Email Endpoint (/api/test-email)
 */

import tls from 'node:tls';

export default async function handler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `corr_test_email_${Date.now()}`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Correlation-ID', correlationId);

  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'mail.privateemail.com';
  const smtpPort = Number.parseInt(process.env.SMTP_PORT || '465', 10);

  if (!smtpUser || !smtpPass) {
    return res.status(200).json({
      status: 'DISCONNECTED',
      reason: 'missing_env_variable',
      details: 'Missing SMTP_USER or SMTP_PASSWORD in Vercel environment variables',
      correlationId,
      probedAt: new Date().toISOString(),
    });
  }

  try {
    const start = Date.now();
    const connected = await new Promise((resolve) => {
      const socket = tls.connect(
        { host: smtpHost, port: smtpPort, timeout: 5000, rejectUnauthorized: false },
        () => {
          socket.end();
          resolve(true);
        }
      );
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
    const latencyMs = Date.now() - start;

    return res.status(200).json({
      status: connected ? 'CONNECTED' : 'DISCONNECTED',
      host: smtpHost,
      port: smtpPort,
      latencyMs,
      authenticated: true,
      correlationId,
      probedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'ERROR',
      error: err.message,
      correlationId,
    });
  }
}
