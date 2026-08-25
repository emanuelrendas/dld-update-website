/**
 * RAIOC OS - Queue Engine & Retry Recovery System
 * Handles resilient, idempotent task dispatch with exponential backoff and dead-letter failure handling.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import { telemetry } from '../logging/telemetry.js';

export class QueueEngine {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || config.engine.maxRetries;
    this.baseBackoffMs = options.baseBackoffMs || config.engine.baseBackoffMs;
    this.maxBackoffMs = options.maxBackoffMs || config.engine.maxBackoffMs;
    this.adapters = new Map();
  }

  registerAdapter(type, adapterInstance) {
    this.adapters.set(type, adapterInstance);
    logger.info('QUEUE_ENGINE', `Registered adapter: ${type}`);
  }

  calculateBackoff(retryCount) {
    const jitter = Math.floor(Math.random() * 500);
    const exponential = this.baseBackoffMs * Math.pow(2, retryCount);
    return Math.min(this.maxBackoffMs, exponential + jitter);
  }

  async processTask(task, dbClient) {
    const adapter = this.adapters.get(task.type);
    if (!adapter) {
      const errMessage = `No adapter registered for task type: ${task.type}`;
      logger.error('QUEUE_ENGINE', errMessage, { taskId: task.id });
      await dbClient.updateDispatchTask(task.id, {
        status: 'failed',
        error_message: errMessage,
      });
      telemetry.recordFailure('dispatch');
      return { success: false, error: errMessage };
    }

    // Mark as processing
    await dbClient.updateDispatchTask(task.id, { status: 'processing' });

    try {
      const result = await adapter.dispatch(task);

      const finalStatus = (result && (result.status === 'SENT' || result.status === 'sent_smtp' || result.messageId))
        ? 'SENT'
        : (result && result.status === 'QUEUED_FOR_DISPATCH' ? 'QUEUED_FOR_DISPATCH' : 'dispatched');

      // Successfully dispatched or queued
      await dbClient.updateDispatchTask(task.id, {
        status: finalStatus,
        dispatched_at: new Date().toISOString(),
        delivery_receipt: result,
      });

      logger.audit('QUEUE_ENGINE', finalStatus === 'SENT' ? 'TASK_SENT' : 'TASK_QUEUED_FOR_DISPATCH', task.id, 'processing', finalStatus, {
        type: task.type,
        recipient: task.recipient,
        provider: result?.provider,
        messageId: result?.messageId,
      });

      return { success: true, status: finalStatus, result };
    } catch (err) {
      const currentRetries = (task.retry_count || 0) + 1;
      logger.warn('QUEUE_ENGINE', `Task dispatch failed: ${task.id} (Attempt ${currentRetries}/${this.maxRetries})`, {
        error: err.message,
      });

      if (currentRetries <= this.maxRetries) {
        const backoffMs = this.calculateBackoff(currentRetries);
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

        await dbClient.updateDispatchTask(task.id, {
          status: 'retrying',
          retry_count: currentRetries,
          next_retry_at: nextRetryAt,
          last_error: err.message,
        });

        logger.info('QUEUE_ENGINE', `Task ${task.id} scheduled for retry at ${nextRetryAt} in ${backoffMs}ms`);
        return { success: false, retrying: true, nextRetryAt };
      } else {
        // Exceeded retries - mark dead-letter / failed
        await dbClient.updateDispatchTask(task.id, {
          status: 'failed',
          retry_count: currentRetries,
          last_error: err.message,
          failed_at: new Date().toISOString(),
        });

        telemetry.recordFailure('dispatch');
        logger.error('QUEUE_ENGINE', `Task ${task.id} permanently failed after ${this.maxRetries} retries`, {
          error: err.message,
        });

        return { success: false, failed: true, error: err.message };
      }
    }
  }

  async processQueue(dbClient, limit = 20) {
    const pendingTasks = await dbClient.fetchPendingDispatches(limit);
    if (!pendingTasks || pendingTasks.length === 0) {
      return { processed: 0, successful: 0, retrying: 0, failed: 0 };
    }

    logger.info('QUEUE_ENGINE', `Processing ${pendingTasks.length} queued dispatch tasks`);

    let successful = 0;
    let retrying = 0;
    let failed = 0;

    for (const task of pendingTasks) {
      const outcome = await this.processTask(task, dbClient);
      if (outcome.success) successful++;
      else if (outcome.retrying) retrying++;
      else if (outcome.failed) failed++;
    }

    return {
      processed: pendingTasks.length,
      successful,
      retrying,
      failed,
    };
  }
}

export const queueEngine = new QueueEngine();
