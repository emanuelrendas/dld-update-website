/**
 * RAIOC OS - Structured Audit Logging Engine
 * Records all state transitions, system events, and execution cycles.
 */

export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  AUDIT: 'AUDIT',
};

export class AuditLogger {
  constructor(options = {}) {
    this.buffer = [];
    this.maxBufferSize = options.maxBufferSize || 1000;
    this.persistHandler = options.persistHandler || null;
  }

  log(level, category, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
    };

    const formatted = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
    if (level === LogLevel.ERROR) {
      console.error(formatted, metadata);
    } else if (level === LogLevel.WARN) {
      console.warn(formatted, metadata);
    } else {
      console.log(formatted);
    }

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    return entry;
  }

  debug(category, message, metadata) {
    return this.log(LogLevel.DEBUG, category, message, metadata);
  }

  info(category, message, metadata) {
    return this.log(LogLevel.INFO, category, message, metadata);
  }

  warn(category, message, metadata) {
    return this.log(LogLevel.WARN, category, message, metadata);
  }

  error(category, message, metadata) {
    return this.log(LogLevel.ERROR, category, message, metadata);
  }

  audit(category, action, entityId, stateBefore, stateAfter, metadata = {}) {
    return this.log(LogLevel.AUDIT, category, `ACTION: ${action} on ${entityId}`, {
      action,
      entityId,
      stateBefore,
      stateAfter,
      ...metadata,
    });
  }

  getRecentLogs(limit = 100) {
    return this.buffer.slice(-limit);
  }

  async flush() {
    if (this.persistHandler && this.buffer.length > 0) {
      const itemsToPersist = [...this.buffer];
      this.buffer = [];
      await this.persistHandler(itemsToPersist);
    }
  }
}

export const logger = new AuditLogger();
