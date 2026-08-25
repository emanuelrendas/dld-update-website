/**
 * RAIOC Operational Layer - Autonomous Decision Logger
 * Maintains an immutable audit record of all strategic decisions made across specialist agents.
 */

import { logger } from '../logging/audit-logger.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';

export class DecisionLogger {
  constructor() {
    this.decisions = [];
  }

  /**
   * Records an autonomous decision made by an agent
   */
  logDecision({
    agentId,
    objectiveId = 'general',
    rationale,
    chosenAction,
    alternativesConsidered = [],
    confidenceScore = 1.0,
    impactLevel = 'MEDIUM', // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    metadata = {},
  }) {
    const decisionRecord = {
      decisionId: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      objectiveId,
      rationale,
      chosenAction,
      alternativesConsidered,
      confidenceScore,
      impactLevel,
      metadata,
      timestamp: new Date().toISOString(),
    };

    this.decisions.push(decisionRecord);
    if (this.decisions.length > 1000) this.decisions.shift();

    logger.audit('DECISION_LOGGER', 'DECISION_MADE', decisionRecord.decisionId, 'evaluating', chosenAction, {
      agentId,
      confidenceScore,
      impactLevel,
    });

    agentEventBus.publish(AgentEvents.DECISION_LOGGED, decisionRecord, {
      sourceAgent: agentId,
      correlationId: objectiveId,
    });

    return decisionRecord;
  }

  getDecisions(filter = {}) {
    let result = [...this.decisions];
    if (filter.agentId) {
      result = result.filter((d) => d.agentId === filter.agentId);
    }
    if (filter.objectiveId) {
      result = result.filter((d) => d.objectiveId === filter.objectiveId);
    }
    if (filter.impactLevel) {
      result = result.filter((d) => d.impactLevel === filter.impactLevel);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  getRecentDecisionsSummary(limit = 10) {
    return this.getDecisions({ limit }).map((d) => ({
      id: d.decisionId,
      agent: d.agentId,
      action: d.chosenAction,
      confidence: d.confidenceScore,
      impact: d.impactLevel,
      time: d.timestamp,
    }));
  }
}

export const decisionLogger = new DecisionLogger();
