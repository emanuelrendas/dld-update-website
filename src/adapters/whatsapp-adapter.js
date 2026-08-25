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

    // Resolve active Meta WhatsApp Cloud API credentials
    const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || 
                  process.env.WHATSAPP_ACCESS_TOKEN || 
                  this.apiKey || 
                  config.whatsappBusiness?.accessToken || 
                  config.adapters.whatsapp?.apiKey;

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || 
                    config.whatsappBusiness?.phoneNumberId || 
                    config.adapters.whatsapp?.phoneNumberId;

    const endpointUrl = this.apiUrl || 
                        (phoneId ? `https://graph.facebook.com/v20.0/${phoneId}/messages` : null);

    // If live API credentials are not present, record cleanly in queue
    if (!token || !endpointUrl) {
      logger.info('WHATSAPP_ADAPTER', `WhatsApp brief payload cleanly queued for delivery to ${recipient} (status: QUEUED_FOR_DISPATCH)`, {
        length: message.length,
        hasToken: Boolean(token),
        hasPhoneId: Boolean(phoneId),
      });
      return {
        status: 'QUEUED_FOR_DISPATCH',
        reason: 'awaiting_credentials',
        recipient,
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      };
    }

    // Send HTTP POST to Meta WhatsApp Cloud API
    logger.info('WHATSAPP_ADAPTER', `Sending live WhatsApp message to ${recipient} via Meta Cloud API...`);
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient.replace(/[^0-9+]/g, ''),
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WhatsApp API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    logger.info('WHATSAPP_ADAPTER', `🎉 WhatsApp delivered successfully to ${recipient}! MessageId: ${data.messages?.[0]?.id || 'ACK'}`);
    return {
      status: 'SENT',
      provider: 'whatsapp_cloud',
      messageId: data.messages?.[0]?.id || 'ACK',
      recipient,
      timestamp: new Date().toISOString(),
    };
  }
}

export const whatsAppAdapter = new WhatsAppAdapter();
