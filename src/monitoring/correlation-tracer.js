/**
 * RAIOC Monitoring - Distributed Request & Correlation Tracer
 * Generates and propagates correlation IDs across asynchronous agent loops and external API boundaries.
 */

import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

export class CorrelationTracer {
  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage();
  }

  generateCorrelationId(prefix = 'req') {
    return `${prefix}_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  runWithContext(context = {}, callback) {
    const store = {
      correlationId: context.correlationId || this.generateCorrelationId(),
      startTime: Date.now(),
      metadata: context.metadata || {},
    };
    return this.asyncLocalStorage.run(store, callback);
  }

  getContext() {
    return this.asyncLocalStorage.getStore() || {
      correlationId: this.generateCorrelationId('fallback'),
      startTime: Date.now(),
      metadata: {},
    };
  }

  getCorrelationId() {
    return this.getContext().correlationId;
  }
}

export const correlationTracer = new CorrelationTracer();
