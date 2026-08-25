/**
 * RAIOC OS - Gmail Queue Adapter
 * Dispatches Executive Briefs, Alert Notifications, and Consultation Follow-ups via Gmail API.
 */

import { gmailClient } from '../integrations/google/gmail-client.js';
import { logger } from '../logging/audit-logger.js';

export class GmailAdapter {
  constructor(client = gmailClient) {
    this.client = client;
  }

  async dispatch(task) {
    const { recipient, payload } = task;
    const to = recipient || payload.to || payload.recipient;
    const subject = payload.subject || 'RAIOC Executive Intelligence Brief';
    const body = payload.body || payload.text || '';
    const isHtml = Boolean(payload.isHtml || payload.html);
    const threadId = payload.threadId || null;

    if (!to) {
      throw new Error('GmailAdapter dispatch failed: Missing recipient email address');
    }

    logger.info('GMAIL_ADAPTER', `Dispatching email via Gmail API to ${to}`, { subject });
    return await this.client.sendEmail({ to, subject, body, isHtml, threadId });
  }
}

export const gmailAdapter = new GmailAdapter();
