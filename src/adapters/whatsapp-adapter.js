/**
 * RAIOC OS - WhatsApp Queue Adapter
 * Responsible for delivering formatted executive briefs and notifications to WhatsApp.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class WhatsAppAdapter {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || config.adapters.whatsapp.apiUrl;
    this.apiKey = options.apiKey || config.adapters.whatsapp.apiKey;
    this.enabled = options.enabled !== undefined ? options.enabled : config.adapters.whatsapp.enabled;
  }

  async dispatch(task) {
    const { recipient, payload } = task;
    const message = payload.message || payload.text || '';

    if (!recipient) {
      throw new Error('WhatsApp dispatch failed: Missing recipient phone number');
    }

    if (!this.enabled) {
      logger.info('WHATSAPP_ADAPTER', `WhatsApp disabled - simulating delivery to ${recipient}`);
      return { status: 'simulated', recipient, timestamp: new Date().toISOString() };
    }

    // In production without external webhook URL configured, we record safe delivery payload
    if (!this.apiUrl) {
      logger.info('WHATSAPP_ADAPTER', `Payload generated and ready for WhatsApp delivery to ${recipient}`, {
        length: message.length,
      });
      return {
        status: 'queued_for_gateway',
        recipient,
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      };
    }

    // Send HTTP POST to WhatsApp Business API / Webhook
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        to: recipient,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      throw new Error(`WhatsApp API responded with status ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  }
}

export const whatsAppAdapter = new WhatsAppAdapter();
