/**
 * RAIOC Integrations - Production Gmail API Client
 * Constructs standard RFC 2822 MIME base64url messages and dispatches via Google Gmail REST API.
 */

import { config } from '../../config/env.js';
import { logger } from '../../logging/audit-logger.js';

export class GmailClient {
  constructor(options = {}) {
    this.clientId = options.clientId || config.google.gmail.clientId;
    this.clientSecret = options.clientSecret || config.google.gmail.clientSecret;
    this.refreshToken = options.refreshToken || config.google.gmail.refreshToken;
    this.senderEmail = options.senderEmail || config.google.gmail.senderEmail;
    this.senderName = options.senderName || config.google.gmail.senderName;
    this.enabled = options.enabled !== undefined ? options.enabled : config.google.gmail.enabled;
  }

  /**
   * Constructs an RFC 2822 compliant MIME message string
   */
  buildMimeMessage({ to, subject, body, isHtml = false, inReplyTo = null }) {
    const fromHeader = `${this.senderName} <${this.senderEmail}>`;
    const contentType = isHtml ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';

    const lines = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: ${contentType}`,
      `Content-Transfer-Encoding: 8bit`,
      `Date: ${new Date().toUTCString()}`,
    ];

    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`);
      lines.push(`References: ${inReplyTo}`);
    }

    lines.push('');
    lines.push(body);

    return lines.join('\r\n');
  }

  /**
   * Encodes a MIME message string into URL-safe Base64 as required by Gmail API
   */
  encodeRawMessage(mimeString) {
    return Buffer.from(mimeString)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Dispatches an email message via Gmail API
   * @param {Object} params - { to, subject, body, isHtml, threadId }
   * @returns {Promise<Object>} Gmail API dispatch result
   */
  async sendEmail(params = {}) {
    const { to, subject, body, isHtml, threadId } = params;

    if (!to) {
      throw new Error('Gmail dispatch failed: Missing recipient email');
    }

    if (!this.enabled) {
      logger.info('GMAIL_CLIENT', `Gmail disabled - simulating delivery to ${to}`);
      return { status: 'simulated', to, subject, timestamp: new Date().toISOString() };
    }

    const mime = this.buildMimeMessage({ to, subject, body, isHtml });
    const raw = this.encodeRawMessage(mime);

    // If live credentials not provided, log prepared payload
    if (!this.refreshToken || !this.clientId) {
      logger.info('GMAIL_CLIENT', `RFC 2822 MIME message compiled and ready for Gmail gateway to ${to}`, {
        subject,
        rawLength: raw.length,
      });
      return {
        status: 'compiled_for_gmail_api',
        to,
        subject,
        messageId: `gmail_msg_${Date.now()}`,
        threadId: threadId || `thread_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }

    // Live Google OAuth2 + REST API Call
    try {
      // 1. Refresh access token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Google OAuth token refresh failed: ${tokenRes.statusText}`);
      }

      const { access_token } = await tokenRes.json();

      // 2. Send message via Gmail API
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw, threadId }),
      });

      if (!sendRes.ok) {
        throw new Error(`Gmail API responded with status ${sendRes.status}: ${sendRes.statusText}`);
      }

      const result = await sendRes.json();
      logger.info('GMAIL_CLIENT', `Email delivered via live Gmail API to ${to}`, { id: result.id });
      return {
        status: 'sent_live',
        id: result.id,
        threadId: result.threadId,
        to,
      };
    } catch (err) {
      logger.error('GMAIL_CLIENT', 'Gmail API error during send', { error: err.message });
      throw err;
    }
  }
}

export const gmailClient = new GmailClient();
