/**
 * RAIOC Agent Performance Engine (JOS v1.0)
 * Evaluates, tracks, scores, and ranks all permanent specialist agents across success rate,
 * execution duration, business value generated, decision accuracy, and operational efficiency.
 */

import { agentDirectory } from '../agents/agent-directory.js';
import { executiveLongTermMemory, MemoryCategories } from '../memory/executive-long-term-memory.js';
import { logger } from '../logging/audit-logger.js';

export class AgentPerformanceEngine {
  constructor() {
    this.metrics = new Map();
    this._initializeMetrics();
  }

  _initializeMetrics() {
    const agents = ['jarvis', 'mark', 'atlas', 'lex', 'aida', 'helios', 'hermes', 'sentinel'];
    for (const id of agents) {
      this.metrics.set(id, {
        agentId: id,
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        totalRetries: 0,
        totalDurationMs: 0,
        businessValueGeneratedAed: 0,
        learningScore: 90,
        decisionAccuracyPct: 98.5,
        lastActiveAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Records a task execution outcome for a specific agent
   */
  recordTaskExecution({ agentId, status, durationMs = 0, businessValue = 0, retries = 0 }) {
    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, {
        agentId,
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        totalRetries: 0,
        totalDurationMs: 0,
        businessValueGeneratedAed: 0,
        learningScore: 85,
        decisionAccuracyPct: 95.0,
        lastActiveAt: new Date().toISOString(),
      });
    }

    const m = this.metrics.get(agentId);
    m.lastActiveAt = new Date().toISOString();
    m.totalDurationMs += durationMs;
    m.totalRetries += retries;

    if (status === 'SUCCESS') {
      m.totalTasksCompleted++;
      m.businessValueGeneratedAed += businessValue;
      m.learningScore = Math.min(100, m.learningScore + 0.5);
    } else {
      m.totalTasksFailed++;
      m.learningScore = Math.max(50, m.learningScore - 2.0);
    }

    logger.info('PERFORMANCE_ENGINE', `Recorded task execution for ${agentId}: Status=${status}, Value=AED ${businessValue}`);
    return this.getAgentScorecard(agentId);
  }

  /**
   * Computes a detailed scorecard for a given agent
   */
  getAgentScorecard(agentId) {
    const m = this.metrics.get(agentId);
    if (!m) return null;

    const totalTasks = m.totalTasksCompleted + m.totalTasksFailed;
    const successRate = totalTasks > 0 ? Math.round((m.totalTasksCompleted / totalTasks) * 1000) / 10 : 100.0;
    const avgDurationMs = totalTasks > 0 ? Math.round(m.totalDurationMs / totalTasks) : 0;

    // Efficiency Index (0 to 100)
    const efficiency = Math.round(
      (successRate * 0.4) +
      (Math.min(100, (m.businessValueGeneratedAed / 500000) * 100) * 0.3) +
      (m.decisionAccuracyPct * 0.2) +
      (m.learningScore * 0.1)
    );

    return {
      agentId,
      totalTasks,
      tasksCompleted: m.totalTasksCompleted,
      tasksFailed: m.totalTasksFailed,
      successRatePct: successRate,
      averageDurationMs: avgDurationMs,
      businessValueGeneratedAed: m.businessValueGeneratedAed,
      retries: m.totalRetries,
      learningScore: Math.round(m.learningScore),
      decisionAccuracyPct: m.decisionAccuracyPct,
      efficiencyIndex: Math.min(100, Math.max(0, efficiency)),
      lastActiveAt: m.lastActiveAt,
    };
  }

  /**
   * Generates dynamic agent leaderboard ranked by overall efficiency & business value
   */
  getLeaderboard() {
    const scorecards = [];
    for (const agentId of this.metrics.keys()) {
      scorecards.push(this.getAgentScorecard(agentId));
    }

    scorecards.sort((a, b) => b.efficiencyIndex - a.efficiencyIndex || b.businessValueGeneratedAed - a.businessValueGeneratedAed);

    return scorecards.map((sc, index) => ({
      rank: index + 1,
      ...sc,
    }));
  }

  /**
   * Persists agent performance snapshots to executive long-term memory
   */
  snapshotPerformance() {
    const leaderboard = this.getLeaderboard();
    executiveLongTermMemory.store(
      MemoryCategories.AGENT_PERFORMANCE,
      `perf_snapshot_${Date.now()}`,
      leaderboard,
      {
        tags: ['performance', 'leaderboard', 'agents'],
        importance: 1.5,
      }
    );
    return leaderboard;
  }

  clear() {
    this._initializeMetrics();
  }
}

export const agentPerformanceEngine = new AgentPerformanceEngine();
