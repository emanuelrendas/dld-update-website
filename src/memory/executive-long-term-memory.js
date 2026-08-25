/**
 * RAIOC Executive Long-Term Memory & Cognitive Store (JOS v1.0)
 * Permanent, categorized, and searchable cognitive memory for JARVIS and specialist agents.
 */

import { sharedMemory } from './shared-memory.js';
import { logger } from '../logging/audit-logger.js';

export const MemoryCategories = {
  EXECUTIVE_DECISIONS: 'executive_decisions',
  MARKET_OBSERVATIONS: 'market_observations',
  CLIENT_PREFERENCES: 'client_preferences',
  SALES_HISTORY: 'sales_history',
  MEETING_HISTORY: 'meeting_history',
  FOLLOW_UP_HISTORY: 'follow_up_history',
  AGENT_PERFORMANCE: 'agent_performance',
  SUCCESSFUL_STRATEGIES: 'successful_strategies',
  FAILED_STRATEGIES: 'failed_strategies',
  INVESTMENT_PATTERNS: 'investment_patterns',
  BEHAVIORAL_PATTERNS: 'behavioral_patterns',
  LESSONS_LEARNED: 'lessons_learned',
};

export class ExecutiveLongTermMemory {
  constructor() {
    this.categories = new Map();
    for (const cat of Object.values(MemoryCategories)) {
      this.categories.set(cat, new Map());
    }
  }

  /**
   * Stores a structured cognitive memory under a specific executive category
   */
  store(category, key, data, options = {}) {
    if (!this.categories.has(category)) {
      this.categories.set(category, new Map());
    }

    const memoryId = `cog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: memoryId,
      category,
      key,
      data,
      tags: options.tags || [],
      importance: options.importance !== undefined ? options.importance : 1.0,
      confidence: options.confidence !== undefined ? options.confidence : 0.95,
      impactAed: options.impactAed || 0,
      sourceAgent: options.sourceAgent || 'jarvis',
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {},
    };

    this.categories.get(category).set(key, record);

    // Also mirror to global shared memory for unified semantic recall
    sharedMemory.storeKnowledge(`exec_${category}_${key}`, record, {
      importance: record.importance,
      tags: [category, ...record.tags],
      metadata: { memoryId, category, key },
    });

    logger.info('EXECUTIVE_MEMORY', `Stored cognitive memory [${category}] key: "${key}"`, {
      memoryId,
      importance: record.importance,
    });

    return record;
  }

  /**
   * Retrieves a specific memory by category and key
   */
  get(category, key) {
    if (!this.categories.has(category)) return null;
    return this.categories.get(category).get(key) || null;
  }

  /**
   * Retrieves all memories in a given category
   */
  getByCategory(category, filter = {}) {
    if (!this.categories.has(category)) return [];
    let items = Array.from(this.categories.get(category).values());

    if (filter.minImportance !== undefined) {
      items = items.filter((i) => i.importance >= filter.minImportance);
    }
    if (filter.tag) {
      items = items.filter((i) => i.tags.includes(filter.tag));
    }
    if (filter.sourceAgent) {
      items = items.filter((i) => i.sourceAgent === filter.sourceAgent);
    }
    if (filter.limit) {
      items = items.slice(-filter.limit);
    }

    return items;
  }

  /**
   * Searches across all categories using keyword/semantic relevance scoring
   */
  search(query, options = {}) {
    const queryLower = query.toLowerCase().trim();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);
    const limit = options.limit || 10;
    const category = options.category;

    const targetCategories = category
      ? [category]
      : Array.from(this.categories.keys());

    const matches = [];

    for (const cat of targetCategories) {
      const map = this.categories.get(cat);
      if (!map) continue;

      for (const record of map.values()) {
        let score = 0;
        const keyLower = record.key.toLowerCase();
        const dataStr = typeof record.data === 'string' ? record.data : JSON.stringify(record.data);
        const dataLower = dataStr.toLowerCase();

        if (keyLower.includes(queryLower)) score += 15;
        if (record.tags.some((t) => queryTokens.includes(t.toLowerCase()))) score += 10;

        for (const token of queryTokens) {
          if (dataLower.includes(token)) score += 3;
        }

        if (score > 0) {
          matches.push({ record, relevanceScore: score * record.importance });
        }
      }
    }

    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return matches.slice(0, limit).map((m) => m.record);
  }

  /**
   * Queries past strategy outcomes to influence future decisions
   */
  queryStrategyGuidance(contextType) {
    const successful = this.getByCategory(MemoryCategories.SUCCESSFUL_STRATEGIES, { limit: 10 });
    const failed = this.getByCategory(MemoryCategories.FAILED_STRATEGIES, { limit: 10 });
    const lessons = this.getByCategory(MemoryCategories.LESSONS_LEARNED, { limit: 10 });

    return {
      recommendedPractices: successful.map((s) => s.data),
      avoidPatterns: failed.map((f) => f.data),
      keyLessons: lessons.map((l) => l.data),
      totalHistoricalExperiences: successful.length + failed.length + lessons.length,
    };
  }

  getStats() {
    const stats = {};
    let totalCount = 0;
    for (const [cat, map] of this.categories.entries()) {
      stats[cat] = map.size;
      totalCount += map.size;
    }
    return {
      totalMemories: totalCount,
      byCategory: stats,
      updatedAt: new Date().toISOString(),
    };
  }

  clear() {
    for (const map of this.categories.values()) {
      map.clear();
    }
  }
}

export const executiveLongTermMemory = new ExecutiveLongTermMemory();
