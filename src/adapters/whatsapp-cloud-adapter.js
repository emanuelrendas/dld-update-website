/**
 * RAIOC OS - WhatsApp Cloud Adapter
 * Connects Queue Engine to Meta WhatsApp Business Cloud API with template & interactive support.
 */

import { whatsAppBusinessClient } from '../integrations/whatsapp/whatsapp-business-client.js';
import { logger } from '../logging/audit-logger.js';

export class WhatsAppCloudAdapter {
  constructor(client = whatsAppBusinessClient) {
    this.client = client;
  }

  async dispatch(task) {
    const { recipient, payload } = task;
    const to = recipient || payload.to || payload.recipient || payload.phone;

    if (!to) {
      throw new Error('WhatsAppCloudAdapter dispatch failed: Missing recipient phone number');
    }

    if (payload.templateName) {
      logger.info('WHATSAPP_CLOUD_ADAPTER', `Dispatching template message (${payload.templateName}) to ${to}`);
      return await this.client.sendTemplateMessage({
        to,
        templateName: payload.templateName,
        language: payload.language,
        components: payload.components,
      });
    }

    const message = payload.message || payload.text || payload.body || '';
    logger.info('WHATSAPP_CLOUD_ADAPTER', `Dispatching text message to ${to}`);
    return await this.client.sendTextMessage({
      to,
      message,
      previewUrl: Boolean(payload.previewUrl),
    });
  }
}

export const whatsAppCloudAdapter = new WhatsAppCloudAdapter();
