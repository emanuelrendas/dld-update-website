/**
 * RAIOC Connectors - Telegram Bot Client (MISSION AG-003)
 * Automated Event Bus notification bridge for executive investor lead alerts.
 * Subscribes to BRIEF_DISPATCHED, formats structured executive messages, stores communications in Supabase,
 * audits actions, emits TELEGRAM_MESSAGE_SENT, and performs exponential backoff retries.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { supabase } from '../db/supabase-client.js';

export class TelegramClient {
  constructor(options = {}) {
    this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN || config.telegram?.botToken || '';
    this.chatId = options.chatId || process.env.TELEGRAM_CHAT_ID || config.telegram?.chatId || '';
    this.timeoutMs = options.timeoutMs || config.telegram?.timeoutMs || 10000;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.retryDelayMs = options.retryDelayMs || 500;
    this.enabled = options.enabled !== undefined
      ? options.enabled
      : (process.env.TELEGRAM_ENABLED !== 'false' && config.telegram?.enabled !== false);

    this.isEventBusConnected = false;
    this._unsubscribers = [];

    // Automatically connect to Event Bus
    this.connectEventBus();
  }

  /**
   * Reloads credentials dynamically from environment variables
   */
  reloadConfig() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || config.telegram?.botToken || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || config.telegram?.chatId || '';
    return {
      hasToken: Boolean(this.botToken),
      hasChatId: Boolean(this.chatId),
    };
  }

  /**
   * Subscribes to BRIEF_DISPATCHED on the Event Bus
   */
  connectEventBus() {
    if (this.isEventBusConnected) return;

    const handler = async (event) => {
      try {
        await this.handleBriefDispatchedEvent(event);
      } catch (err) {
        logger.error('TELEGRAM_CLIENT', `Failed to process BRIEF_DISPATCHED event: ${err.message}`, {
          error: err.message,
          correlationId: event?.metadata?.correlationId,
        });
      }
    };

    // Subscribe to both symbol and string forms
    const unsub1 = agentEventBus.subscribe(AgentEvents.BRIEF_DISPATCHED, handler);
    const unsub2 = agentEventBus.subscribe('BRIEF_DISPATCHED', handler);

    this._unsubscribers.push(unsub1, unsub2);
    this.isEventBusConnected = true;
    logger.info('TELEGRAM_CLIENT', 'Subscribed to BRIEF_DISPATCHED events on RAIOC Event Bus');
  }

  /**
   * Unsubscribes from Event Bus
   */
  disconnectEventBus() {
    for (const unsub of this._unsubscribers) {
      if (typeof unsub === 'function') unsub();
    }
    this._unsubscribers = [];
    this.isEventBusConnected = false;
    logger.info('TELEGRAM_CLIENT', 'Disconnected from RAIOC Event Bus');
  }

  /**
   * Formats and handles incoming BRIEF_DISPATCHED event
   */
  async handleBriefDispatchedEvent(event) {
    const payload = event.payload || {};
    const metadata = event.metadata || {};
    const correlationId = metadata.correlationId || payload.correlationId || `corr_tg_${Date.now()}`;

    const lead = payload.lead || payload.leadData || {};
    const recommendation = payload.recommendation || payload.brief || {};

    const name = lead.name || lead.fullName || payload.companyName || payload.name || 'Private Investor';
    const email = lead.email || payload.email || 'N/A';
    const phone = lead.phone || payload.phone || 'N/A';
    const budget = lead.budget || lead.budgetAed || payload.budget || payload.budgetAed || 'AED 15,000,000+';
    const community = recommendation.community || recommendation.recommendedCommunity || payload.community || 'Palm Jumeirah';

    const message = this.formatInvestorMessage({
      name,
      email,
      phone,
      budget,
      community,
      correlationId,
    });

    return await this.sendTelegramMessage(message, { correlationId, metadata: { ...metadata, lead, recommendation } });
  }

  /**
   * Formats the exact structured message required by specification
   */
  formatInvestorMessage({ name, email, phone, budget, community, correlationId }) {
    return `----------------------------------------

🚀 NEW INVESTOR LEAD

Name:
${name}

Email:
${email}

Phone:
${phone}

Budget:
${budget}

Community:
${community}

Correlation ID:
${correlationId}

----------------------------------------`;
  }

  /**
   * Dispatches a message via Telegram Bot API with 3x retry and exponential backoff
   * @param {string} message - Message text
   * @param {Object} options - { chatId, parseMode, correlationId, metadata }
   * @returns {Promise<Object>} Execution result
   */
  async sendTelegramMessage(message, options = {}) {
    this.reloadConfig();
    const correlationId = options.correlationId || `corr_tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const targetChatId = options.chatId || this.chatId;

    if (!this.botToken || !targetChatId) {
      const reason = 'missing_env_variable';
      logger.warn('TELEGRAM_CLIENT', `Telegram notification skipped: ${reason} (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured)`, {
        correlationId,
      });

      // Store in communications & audit log as pending/disconnected
      const commRecord = await supabase.recordCommunication({
        type: 'telegram',
        recipient: targetChatId || 'NOT_CONFIGURED',
        message,
        correlationId,
        status: 'DISCONNECTED',
        metadata: { reason, missingToken: !this.botToken, missingChatId: !targetChatId },
      });

      await supabase.recordAuditLog({
        category: 'TELEGRAM_CLIENT',
        action: 'TELEGRAM_MESSAGE_SKIPPED',
        entityId: commRecord?.id || correlationId,
        message: 'Telegram dispatch skipped due to missing environment variables',
        correlationId,
        metadata: { reason },
      });

      return {
        status: 'DISCONNECTED',
        reason,
        details: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in environment variables',
        correlationId,
        message,
      };
    }

    const apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: targetChatId,
      text: message,
      parse_mode: options.parseMode || undefined,
    };

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        logger.info('TELEGRAM_CLIENT', `Attempt ${attempt}/${this.maxRetries}: Sending Telegram message to chat ${targetChatId}...`, {
          correlationId,
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(`Telegram API responded with error: ${data.description || res.statusText || res.status}`);
        }

        const telegramMessageId = data.result?.message_id || `tg_msg_${Date.now()}`;

        logger.info('TELEGRAM_CLIENT', `Telegram notification dispatched successfully (Message ID: ${telegramMessageId})`, {
          correlationId,
          telegramMessageId,
        });

        // 1. Store communication in Supabase
        const commRecord = await supabase.recordCommunication({
          type: 'telegram',
          recipient: targetChatId,
          message,
          correlationId,
          status: 'SENT',
          messageId: telegramMessageId,
          metadata: { telegramMessageId, attempt, ...options.metadata },
        });

        // 2. Store audit log in Supabase & Logger
        await supabase.recordAuditLog({
          category: 'TELEGRAM_CLIENT',
          action: 'TELEGRAM_MESSAGE_SENT',
          entityId: telegramMessageId,
          message: `Investor lead notification sent to Telegram chat ${targetChatId}`,
          correlationId,
          metadata: { telegramMessageId, commId: commRecord?.id },
        });

        logger.audit('TELEGRAM_CLIENT', 'TELEGRAM_MESSAGE_SENT', telegramMessageId, 'PENDING', 'SENT', {
          correlationId,
          telegramMessageId,
        });

        // 3. Emit TELEGRAM_MESSAGE_SENT event on Event Bus
        agentEventBus.publish(
          AgentEvents.TELEGRAM_MESSAGE_SENT,
          {
            telegramMessageId,
            chatId: targetChatId,
            message,
            correlationId,
            timestamp: new Date().toISOString(),
          },
          { correlationId, sourceAgent: 'telegram_client' }
        );

        agentEventBus.publish(
          'TELEGRAM_MESSAGE_SENT',
          {
            telegramMessageId,
            chatId: targetChatId,
            message,
            correlationId,
            timestamp: new Date().toISOString(),
          },
          { correlationId, sourceAgent: 'telegram_client' }
        );

        return {
          status: 'SUCCESS',
          httpStatus: 200,
          telegramMessageId,
          chatId: targetChatId,
          correlationId,
          message,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        logger.warn('TELEGRAM_CLIENT', `Attempt ${attempt}/${this.maxRetries} failed to send Telegram message: ${err.message}`, {
          correlationId,
        });

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('TELEGRAM_CLIENT', `All ${this.maxRetries} attempts failed to send Telegram message: ${lastError?.message}`, {
      correlationId,
      error: lastError?.message,
    });

    // Record failure in communications & audit log
    await supabase.recordCommunication({
      type: 'telegram',
      recipient: targetChatId,
      message,
      correlationId,
      status: 'FAILED',
      metadata: { error: lastError?.message, retries: this.maxRetries },
    });

    await supabase.recordAuditLog({
      category: 'TELEGRAM_CLIENT',
      action: 'TELEGRAM_MESSAGE_FAILED',
      entityId: correlationId,
      message: `Failed to dispatch Telegram message after ${this.maxRetries} attempts: ${lastError?.message}`,
      correlationId,
      metadata: { error: lastError?.message },
    });

    const error = new Error(`Telegram dispatch failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    error.correlationId = correlationId;
    error.telegramMessage = message;
    throw error;
  }
}

export const telegramClient = new TelegramClient();

/**
 * Top-level helper function as requested in specification
 */
export async function sendTelegramMessage(message, options = {}) {
  return await telegramClient.sendTelegramMessage(message, options);
}
