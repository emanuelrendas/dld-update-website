/**
 * RAIOC Security - Webhook Signature Verifier
 * Verifies HMAC-SHA256 signatures for Meta WhatsApp Cloud API and n8n workflow triggers.
 */

import { config } from '../config/env.js';
import { secretsManager } from '../config/secrets-manager.js';
import { logger } from '../logging/audit-logger.js';

export class WebhookVerifier {
  /**
   * Verifies an inbound n8n webhook signature (X-N8N-Signature)
   * @param {string|Object} payload - Raw request body
   * @param {string} signatureHeader - Signature from headers
   * @param {string} secretKey - Webhook secret key
   * @returns {boolean} True if signature matches
   */
  verifyN8nSignature(payload, signatureHeader, secretKey = config.n8n.webhookSecret) {
    if (!signatureHeader || !secretKey) {
      logger.warn('WEBHOOK_VERIFIER', 'n8n signature verification failed: Missing signature or secret');
      return false;
    }

    const expectedSignature = secretsManager.generateHmacSignature(payload, secretKey);
    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();

    return secretsManager.constantTimeCompare(expectedSignature, cleanSignature);
  }

  /**
   * Verifies an inbound Meta WhatsApp webhook signature (X-Hub-Signature-256)
   * @param {string|Object} payload - Raw request body
   * @param {string} signatureHeader - Header 'X-Hub-Signature-256' (sha256=...)
   * @param {string} appSecret - Meta App Secret
   * @returns {boolean} True if signature matches
   */
  verifyWhatsAppSignature(payload, signatureHeader, appSecret = config.whatsappBusiness.appSecret) {
    if (!signatureHeader || !appSecret) {
      // In dev mode without app secret, log warning
      logger.warn('WEBHOOK_VERIFIER', 'WhatsApp signature check skipped: Missing app secret');
      return true;
    }

    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
    const expectedSignature = secretsManager.generateHmacSignature(payload, appSecret);

    return secretsManager.constantTimeCompare(expectedSignature, cleanSignature);
  }

  /**
   * Validates Meta WhatsApp Webhook Verification Challenge (GET /api/webhooks/whatsapp)
   */
  verifyWhatsAppChallenge(mode, token, challenge, verifyToken = config.whatsappBusiness.verifyToken) {
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WEBHOOK_VERIFIER', 'WhatsApp webhook subscription challenge verified successfully');
      return { success: true, challenge };
    }
    logger.warn('WEBHOOK_VERIFIER', 'WhatsApp webhook challenge verification failed: Token mismatch');
    return { success: false, error: 'Verification token mismatch' };
  }
}

export const webhookVerifier = new WebhookVerifier();
