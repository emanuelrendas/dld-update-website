/**
 * RAIOC Shared Memory & Long-Term Associative Storage
 * Provides short-term working context, long-term semantic/keyword memory, conversation logs, and persistent state.
 */

import { logger } from '../logging/audit-logger.js';
import { supabase } from '../db/supabase-client.js';

export class SharedMemory {
  constructor(options = {}) {
    this.shortTermMemory = new Map(); // Key -> { value, ttl, timestamp }
    this.longTermKnowledge = new Map(); // Id -> { id, topic, content, tags, metadata, timestamp, importance }
    this.conversationHistory = []; // Array of { id, sender, recipient, message, correlationId, timestamp }
    this.decisionHistory = []; // Array of { decisionId, agentId, rationale, outcome, timestamp }
  }

  // --- Short-Term Working Memory ---

  setWorkingContext(key, value, ttlMs = 3600000) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.shortTermMemory.set(key, {
      value,
      expiresAt,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  getWorkingContext(key) {
    const entry = this.shortTermMemory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.shortTermMemory.delete(key);
      return null;
    }
    return entry.value;
  }

  deleteWorkingContext(key) {
    return this.shortTermMemory.delete(key);
  }

  // --- Long-Term Associative Knowledge ---

  storeKnowledge(topic, content, options = {}) {
    const id = options.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id,
      topic: topic.toLowerCase().trim(),
      content,
      tags: (options.tags || []).map((t) => t.toLowerCase()),
      importance: options.importance !== undefined ? options.importance : 1.0,
      metadata: options.metadata || {},
      storedAt: new Date().toISOString(),
      accessCount: 0,
      lastAccessedAt: new Date().toISOString(),
    };

    this.longTermKnowledge.set(id, record);
    logger.info('SHARED_MEMORY', `Stored knowledge record [${id}] under topic: '${topic}'`);
    return record;
  }

  recallKnowledge(query, options = {}) {
    const minImportance = options.minImportance || 0;
    const limit = options.limit || 5;
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);

    const matches = [];

    for (const record of this.longTermKnowledge.values()) {
      if (record.importance < minImportance) continue;

      let score = 0;
      if (record.topic.includes(queryLower)) score += 10;
      if (record.tags.some((tag) => queryTokens.includes(tag))) score += 5;

      const contentStr = typeof record.content === 'string' ? record.content : JSON.stringify(record.content);
      const contentLower = contentStr.toLowerCase();

      for (const token of queryTokens) {
        if (contentLower.includes(token)) score += 2;
      }

      if (score > 0) {
        record.accessCount++;
        record.lastAccessedAt = new Date().toISOString();
        matches.push({ record, relevanceScore: score });
      }
    }

    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return matches.slice(0, limit).map((m) => m.record);
  }

  search(query, options = {}) {
    return this.recallKnowledge(query, options);
  }

  getKnowledgeByTopic(topic) {
    const normalized = topic.toLowerCase().trim();
    const results = [];
    for (const record of this.longTermKnowledge.values()) {
      if (record.topic === normalized || record.tags.includes(normalized)) {
        results.push(record);
      }
    }
    return results;
  }

  // --- Conversation & Inter-Agent Log ---

  recordMessage(sender, recipient, message, correlationId = null) {
    const entry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender,
      recipient,
      message,
      correlationId: correlationId || 'default',
      timestamp: new Date().toISOString(),
    };
    this.conversationHistory.push(entry);
    if (this.conversationHistory.length > 500) this.conversationHistory.shift();
    return entry;
  }

  logConversationMessage(payload = {}) {
    return this.recordMessage(payload.sender, payload.recipient, payload.message, payload.correlationId);
  }

  getConversationHistory(filter = {}) {
    let result = [...this.conversationHistory];
    if (filter.correlationId) {
      result = result.filter((m) => m.correlationId === filter.correlationId);
    }
    if (filter.sender) {
      result = result.filter((m) => m.sender === filter.sender);
    }
    if (filter.recipient) {
      result = result.filter((m) => m.recipient === filter.recipient);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  // --- Statistics & Diagnostics ---

  getStats() {
    return {
      shortTermKeys: this.shortTermMemory.size,
      longTermRecords: this.longTermKnowledge.size,
      totalMessagesLogged: this.conversationHistory.length,
      topicsStored: Array.from(new Set(Array.from(this.longTermKnowledge.values()).map((k) => k.topic))),
      lastUpdated: new Date().toISOString(),
    };
  }

  clear() {
    this.shortTermMemory.clear();
    this.longTermKnowledge.clear();
    this.conversationHistory = [];
  }
}

export const sharedMemory = new SharedMemory();
