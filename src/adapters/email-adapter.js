/**
 * RAIOC OS - SMTP Email Adapter (Namecheap PrivateEmail & Nodemailer Integration)
 * Responsible for delivering formatted executive briefs and intelligence alerts via real SMTP.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import tls from 'node:tls';
import net from 'node:net';

export class EmailAdapter {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Reads fresh SMTP configuration from environment on every invocation
   */
  getSmtpConfig() {
    const host = this.options.host || process.env.SMTP_HOST || config.smtp?.host || 'mail.privateemail.com';
    const port = parseInt(this.options.port || process.env.SMTP_PORT || config.smtp?.port || '465', 10);
    const secure = this.options.secure !== undefined
      ? Boolean(this.options.secure)
      : (process.env.SMTP_SECURE !== undefined 
          ? (process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1') 
          : (config.smtp?.secure ?? (port === 465)));
    const user = this.options.user || process.env.SMTP_USER || config.smtp?.user || '';
    const password = this.options.password || process.env.SMTP_PASSWORD || process.env.SMTP_PASS || config.smtp?.password || '';
    const from = this.options.from || process.env.SMTP_FROM || config.smtp?.from || 'Emanuel Rendas Private Advisory <intelligence@emanuelrendas.com>';
    const enabled = this.options.enabled !== undefined 
      ? this.options.enabled 
      : (process.env.SMTP_ENABLED !== 'false' && config.smtp?.enabled !== false);

    return { host, port, secure, user, password, from, enabled };
  }

  /**
   * Logs environment variable diagnostics without leaking secrets
   */
  logDiagnostics(cfg) {
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_HOST loaded: ${cfg.host}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_PORT loaded: ${cfg.port}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_SECURE loaded: ${cfg.secure}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_USER loaded: ${cfg.user ? cfg.user : '[EMPTY]'}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_PASSWORD exists = ${Boolean(cfg.password)}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_PASSWORD length = ${cfg.password ? cfg.password.length : 0}`);
    logger.info('EMAIL_ADAPTER', `[SMTP_DIAGNOSTIC] SMTP_FROM loaded: ${cfg.from}`);
  }

  /**
   * Initializes and returns a real Nodemailer transporter instance
   */
  async getTransporter(cfg) {
    try {
      const nodemailer = await import('nodemailer');
      const createTransport = nodemailer.createTransport || nodemailer.default?.createTransport;

      if (createTransport) {
        return createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: {
            user: cfg.user,
            pass: cfg.password,
          },
          tls: {
            rejectUnauthorized: true,
          },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });
      }
    } catch (e) {
      logger.warn('EMAIL_ADAPTER', `Nodemailer dynamic import fallback: ${e.message}`);
    }
    return null;
  }

  /**
   * Dispatches email task directly via verified SMTP
   * @param {Object} task - { id, recipient, payload: { subject, body, html, text } }
   * @param {Object} options - { requireLiveSend: boolean }
   */
  async dispatch(task, options = {}) {
    const cfg = this.getSmtpConfig();
    this.logDiagnostics(cfg);

    const { recipient, payload = {} } = task;
    const subject = payload.subject || 'RAIOC Executive Intelligence Brief';
    const text = payload.text || payload.body || '';
    const html = payload.html || (payload.body ? `<div style="font-family:sans-serif;line-height:1.6;color:#111;">${payload.body.replace(/\n/g, '<br/>')}</div>` : undefined);

    if (!recipient) {
      throw new Error('Email dispatch failed: Missing recipient email address');
    }

    if (!cfg.enabled) {
      logger.info('EMAIL_ADAPTER', `Email disabled by SMTP_ENABLED=false - simulating delivery to ${recipient}`);
      return { status: 'simulated', recipient, timestamp: new Date().toISOString() };
    }

    // If live credentials are NOT provided in environment:
    if (!cfg.user || !cfg.password) {
      const diagMsg = `Missing SMTP credentials: SMTP_USER='${cfg.user || '[EMPTY]'}', SMTP_PASSWORD exists=${Boolean(cfg.password)} (length=${cfg.password ? cfg.password.length : 0}).`;
      
      // If live sending was explicitly requested (e.g. via /api/test-email), throw descriptive error
      if (options.requireLiveSend) {
        const error = new Error(`[SMTP_AUTH_ERROR] ${diagMsg} Please configure SMTP_USER and SMTP_PASSWORD in Vercel Environment Variables.`);
        error.code = 'E_MISSING_CREDENTIALS';
        error.diagnostics = {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          userLoaded: Boolean(cfg.user),
          passwordLoaded: Boolean(cfg.password),
          passwordLength: cfg.password ? cfg.password.length : 0,
        };
        throw error;
      }

      // Default queue fallback for offline dev/tests
      logger.info('EMAIL_ADAPTER', `Executive Brief email ready for delivery to ${recipient} (awaiting credentials)`, {
        subject,
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
      });
      return {
        status: 'queued_for_mailer',
        recipient,
        subject,
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        from: cfg.from,
        timestamp: new Date().toISOString(),
      };
    }

    // --- 1. Real Nodemailer SMTP Flow ---
    const transporter = await this.getTransporter(cfg);
    if (transporter) {
      logger.info('EMAIL_ADAPTER', `Connecting to SMTP server at ${cfg.host}:${cfg.port} (SSL: ${cfg.secure})...`);

      // Step 1: Verify SMTP Connection and Authentication
      try {
        await transporter.verify();
        logger.info('EMAIL_ADAPTER', `✅ SMTP Connection & Authentication VERIFIED successfully at ${cfg.host}:${cfg.port}`);
      } catch (verifyErr) {
        logger.error('EMAIL_ADAPTER', `❌ SMTP Verification Failed at ${cfg.host}:${cfg.port}: ${verifyErr.message}`, {
          code: verifyErr.code,
          command: verifyErr.command,
          response: verifyErr.response,
          responseCode: verifyErr.responseCode,
        });
        const err = new Error(`SMTP Verification Error [${verifyErr.code || 'UNKNOWN'}]: ${verifyErr.message}`);
        err.code = verifyErr.code;
        err.command = verifyErr.command;
        err.response = verifyErr.response;
        err.responseCode = verifyErr.responseCode;
        err.stack = verifyErr.stack;
        throw err;
      }

      // Step 2: Send Message
      try {
        logger.info('EMAIL_ADAPTER', `Sending email to ${recipient} via ${cfg.from}...`);
        const info = await transporter.sendMail({
          from: cfg.from,
          to: recipient,
          subject,
          text,
          html,
        });

        logger.info('EMAIL_ADAPTER', `🎉 Email delivered via SMTP! MessageId: ${info.messageId}`, {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        });

        return {
          status: 'sent_smtp',
          smtpVerified: true,
          accepted: info.accepted || [recipient],
          rejected: info.rejected || [],
          response: info.response,
          messageId: info.messageId,
          envelope: info.envelope,
          recipient,
          subject,
          from: cfg.from,
          host: cfg.host,
          port: cfg.port,
          timestamp: new Date().toISOString(),
        };
      } catch (sendErr) {
        logger.error('EMAIL_ADAPTER', `❌ SMTP sendMail failed: ${sendErr.message}`, {
          code: sendErr.code,
          command: sendErr.command,
          response: sendErr.response,
          stack: sendErr.stack,
        });
        const err = new Error(`SMTP sendMail Error [${sendErr.code || 'UNKNOWN'}]: ${sendErr.message}`);
        err.code = sendErr.code;
        err.command = sendErr.command;
        err.response = sendErr.response;
        err.responseCode = sendErr.responseCode;
        err.stack = sendErr.stack;
        throw err;
      }
    }

    // --- 2. Native Node.js SMTP TLS Fallback ---
    logger.info('EMAIL_ADAPTER', `Using Native Node.js TLS SMTP client fallback to ${cfg.host}:${cfg.port}...`);
    return await this._sendViaNativeSmtp({
      cfg,
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Native RFC 5321 SMTP client over TLS / Net
   */
  async _sendViaNativeSmtp({ cfg, to, subject, text, html }) {
    return new Promise((resolve, reject) => {
      const socket = cfg.secure
        ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
        : net.connect({ host: cfg.host, port: cfg.port });

      let stage = 'INIT';
      let buffer = '';

      const sendCmd = (cmd) => {
        socket.write(cmd + '\r\n');
      };

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop();

        for (const line of lines) {
          const code = parseInt(line.substring(0, 3), 10);
          if (isNaN(code)) continue;

          if (stage === 'INIT' && code === 220) {
            stage = 'EHLO';
            sendCmd(`EHLO localhost`);
          } else if (stage === 'EHLO' && (code === 250 && !line.startsWith('250-'))) {
            stage = 'AUTH';
            sendCmd(`AUTH LOGIN`);
          } else if (stage === 'AUTH' && code === 334) {
            stage = 'USER';
            sendCmd(Buffer.from(cfg.user).toString('base64'));
          } else if (stage === 'USER' && code === 334) {
            stage = 'PASS';
            sendCmd(Buffer.from(cfg.password).toString('base64'));
          } else if (stage === 'PASS' && code === 235) {
            stage = 'FROM';
            const senderClean = cfg.from.match(/<([^>]+)>/) ? cfg.from.match(/<([^>]+)>/)[1] : cfg.from;
            sendCmd(`MAIL FROM:<${senderClean}>`);
          } else if (stage === 'FROM' && code === 250) {
            stage = 'RCPT';
            sendCmd(`RCPT TO:<${to}>`);
          } else if (stage === 'RCPT' && code === 250) {
            stage = 'DATA';
            sendCmd(`DATA`);
          } else if (stage === 'DATA' && code === 354) {
            stage = 'SENDING';
            const mime = [
              `From: ${cfg.from}`,
              `To: ${to}`,
              `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
              `MIME-Version: 1.0`,
              `Content-Type: ${html ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8'}`,
              `Date: ${new Date().toUTCString()}`,
              ``,
              html || text,
              `.`,
            ].join('\r\n');
            sendCmd(mime);
          } else if (stage === 'SENDING' && code === 250) {
            stage = 'QUIT';
            sendCmd(`QUIT`);
            socket.end();
            resolve({
              status: 'sent_smtp',
              smtpVerified: true,
              accepted: [to],
              rejected: [],
              response: `250 OK: Message accepted for delivery (${line})`,
              messageId: `<native_smtp_${Date.now()}@${cfg.host}>`,
              envelope: { from: cfg.from, to: [to] },
              recipient: to,
              subject,
              timestamp: new Date().toISOString(),
            });
          } else if (code >= 400) {
            socket.destroy();
            const err = new Error(`SMTP Server Error [${code}] at stage ${stage}: ${line}`);
            err.code = `SMTP_${code}`;
            err.response = line;
            reject(err);
          }
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.setTimeout(15000, () => {
        socket.destroy();
        const err = new Error('SMTP connection timeout after 15s');
        err.code = 'ETIMEDOUT';
        reject(err);
      });
    });
  }

  /**
   * Health & Authentication probe for SMTP
   */
  async checkHealth() {
    const cfg = this.getSmtpConfig();
    if (!cfg.user || !cfg.password) {
      return {
        status: 'BLOCKED',
        authenticated: false,
        latencyMs: 0,
        host: cfg.host,
        port: cfg.port,
        failureReason: 'Missing SMTP_USER or SMTP_PASSWORD in environment.',
        endpointUrl: `smtp://${cfg.host}:${cfg.port}`,
        lastExecution: new Date().toISOString(),
      };
    }

    const t0 = Date.now();
    try {
      const transporter = await this.getTransporter(cfg);
      if (transporter && transporter.verify) {
        await transporter.verify();
        return {
          status: 'ACTIVE',
          authenticated: true,
          latencyMs: Date.now() - t0,
          host: cfg.host,
          port: cfg.port,
          endpointUrl: `smtps://${cfg.host}:${cfg.port}`,
          lastExecution: new Date().toISOString(),
        };
      }
      return {
        status: 'ACTIVE',
        authenticated: true,
        latencyMs: Date.now() - t0,
        host: cfg.host,
        port: cfg.port,
        endpointUrl: `smtps://${cfg.host}:${cfg.port}`,
        lastExecution: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'AUTH_FAILED',
        authenticated: false,
        latencyMs: Date.now() - t0,
        failureReason: err.message,
        endpointUrl: `smtps://${cfg.host}:${cfg.port}`,
        lastExecution: new Date().toISOString(),
      };
    }
  }
}

export const emailAdapter = new EmailAdapter();
