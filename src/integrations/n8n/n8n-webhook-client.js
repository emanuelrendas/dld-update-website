/**
 * RAIOC Integrations - Secure n8n Webhook Bus Client (Production Grade)
 * Dispatches and receives signed workflow automation events with HMAC-SHA256 integrity verification,
 * automatic retry with exponential backoff, correlation ID propagation, and Event Bus synchronization.
 */

import { config } from '../../config/env.js';
import { secretsManager } from '../../config/secrets-manager.js';
import { webhookVerifier } from '../../security/webhook-verifier.js';
import { logger } from '../../logging/audit-logger.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';

export class N8nWebhookClient {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || process.env.N8N_WEBHOOK_URL || config.n8n?.webhookUrl;
    this.webhookSecret = options.webhookSecret || process.env.N8N_WEBHOOK_SECRET || config.n8n?.webhookSecret;
    this.timeoutMs = options.timeoutMs || config.n8n?.timeoutMs || 15000;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.retryDelayMs = options.retryDelayMs || 500;
    this.enabled = options.enabled !== undefined 
      ? options.enabled 
      : (process.env.N8N_ENABLED !== 'false' && config.n8n?.enabled !== false);

    this.forwardedTopics = [
      AgentEvents.LEAD_INGESTED,
      AgentEvents.LEAD_QUALIFIED,
      AgentEvents.MARKET_ANALYZED,
      AgentEvents.COMPLIANCE_VERIFIED,
      AgentEvents.BRIEF_DISPATCHED,
    ];

    this._unsubscribers = [];
    this.isEventBusConnected = false;
  }

  /**
   * Connects the RAIOC Event Bus to n8n to automatically forward production events
   */
  connectEventBus() {
    if (this.isEventBusConnected) return;

    for (const topic of this.forwardedTopics) {
      const unsub = agentEventBus.subscribe(topic, async (event) => {
        try {
          await this.triggerWorkflow(topic, event.payload, {
            correlationId: event.metadata?.correlationId,
            sourceAgent: event.metadata?.sourceAgent,
            timestamp: event.metadata?.timestamp,
          });
        } catch (err) {
          logger.error('N8N_BUS', `Background forwarding failed for event [${topic}]: ${err.message}`);
        }
      });
      this._unsubscribers.push(unsub);
    }

    this.isEventBusConnected = true;
    logger.info('N8N_BUS', `RAIOC Event Bus connected to n8n for topics: ${this.forwardedTopics.join(', ')}`);
  }

  /**
   * Disconnects Event Bus subscriptions
   */
  disconnectEventBus() {
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
    this.isEventBusConnected = false;
    logger.info('N8N_BUS', 'RAIOC Event Bus disconnected from n8n');
  }

  /**
   * Dispatches a signed event payload to an n8n workflow trigger with retry logic
   * @param {string} eventType - e.g. 'lead:ingested', 'lead:qualified', 'brief:dispatched'
   * @param {Object} data - Event payload
   * @param {Object} metadata - { correlationId, sourceAgent, timestamp }
   * @returns {Promise<Object>} Dispatch result
   */
  async triggerWorkflow(eventType, data = {}, metadata = {}) {
    const timestamp = metadata.timestamp || new Date().toISOString();
    const correlationId = metadata.correlationId || `corr_n8n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sourceAgent = metadata.sourceAgent || 'agent_event_bus';

    const eventPayload = {
      event: eventType,
      timestamp,
      correlationId,
      sourceAgent,
      data,
    };

    const signature = secretsManager.generateHmacSignature(eventPayload, this.webhookSecret);

    if (!this.enabled) {
      logger.info('N8N_BUS', `n8n disabled - simulating event '${eventType}' dispatch`, { correlationId });
      return {
        status: 'simulated',
        eventType,
        correlationId,
        signature: `sha256=${signature}`,
        timestamp,
      };
    }

    if (!this.webhookUrl) {
      logger.info('N8N_BUS', `Event '${eventType}' compiled with HMAC-SHA256 signature and ready for n8n gateway`, {
        correlationId,
        signaturePreview: signature.substring(0, 10) + '...',
      });
      return {
        status: 'compiled_for_n8n',
        eventType,
        correlationId,
        signature: `sha256=${signature}`,
        timestamp,
      };
    }

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        logger.info('N8N_BUS', `Attempt ${attempt}/${this.maxRetries}: Dispatching '${eventType}' to n8n (${this.webhookUrl})...`, {
          correlationId,
        });

        const res = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-Signature': `sha256=${signature}`,
            'X-Timestamp': timestamp,
            'X-Event-Type': eventType,
            'X-Correlation-ID': correlationId,
          },
          body: JSON.stringify(eventPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`n8n webhook responded with HTTP ${res.status}: ${res.statusText}`);
        }

        let responseBody = {};
        try {
          responseBody = await res.json();
        } catch {
          responseBody = { status: 'OK' };
        }

        logger.info('N8N_BUS', `Event '${eventType}' successfully triggered in n8n workflow`, {
          correlationId,
          status: res.status,
        });

        return {
          status: 'dispatched_live',
          httpStatus: res.status,
          eventType,
          correlationId,
          n8nExecutionId: responseBody.executionId || `exec_n8n_${Date.now()}`,
          response: responseBody,
          timestamp,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        logger.warn('N8N_BUS', `Attempt ${attempt}/${this.maxRetries} failed for event '${eventType}': ${err.message}`, {
          correlationId,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('N8N_BUS', `All ${this.maxRetries} attempts failed to trigger n8n event '${eventType}'`, {
      correlationId,
      error: lastError?.message,
    });

    const error = new Error(`n8n webhook dispatch failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    error.correlationId = correlationId;
    error.eventType = eventType;
    throw error;
  }

  /**
   * Processes and validates an inbound event received from an n8n webhook
   */
  processInboundEvent(rawBody, signatureHeader) {
    const isValid = webhookVerifier.verifyN8nSignature(rawBody, signatureHeader, this.webhookSecret);
    if (!isValid) {
      throw new Error('Inbound n8n webhook failed HMAC-SHA256 signature verification');
    }
    return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  }
}

export const n8nWebhookClient = new N8nWebhookClient();
