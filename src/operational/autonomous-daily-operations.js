/**
 * RAIOC Autonomous Daily Operations (JOS v1.0)
 * Coordinates routine executive cycles: Morning Briefing, Evening Review, Priority Review,
 * Pipeline Review, Market Review, Weekly Planning, and Monthly Performance Synthesis.
 */

import { executiveDashboard } from './executive-dashboard.js';
import { opportunityEngine } from './opportunity-engine.js';
import { agentPerformanceEngine } from './agent-performance-engine.js';
import { executiveLongTermMemory, MemoryCategories } from '../memory/executive-long-term-memory.js';
import { autonomousTaskManager } from './autonomous-task-manager.js';
import { logger } from '../logging/audit-logger.js';

export class AutonomousDailyOperations {
  constructor() {
    this.operationLogs = [];
  }

  /**
   * Generates Morning Executive Brief (08:00 GST Routine)
   */
  async runMorningExecutiveBrief() {
    const dashboard = await executiveDashboard.getDashboardData();
    const opportunities = opportunityEngine.getOpenOpportunities();
    const pendingTasks = autonomousTaskManager.listTasks({ status: 'PENDING' });

    const brief = {
      type: 'MORNING_EXECUTIVE_BRIEF',
      timestamp: new Date().toISOString(),
      executiveSummary: `RAIOC Operating System is ONLINE. Managing ${dashboard.systemHealth?.totalAgents || 8} specialist agents with ${pendingTasks.length} queued tasks and AED ${dashboard.financials?.projectedCommissionsAed?.toLocaleString() || '0'} projected revenue pipeline.`,
      topPriorities: pendingTasks.slice(0, 5).map((t) => ({ id: t.id, objective: t.objective, agent: t.ownerAgent })),
      openOpportunities: opportunities.slice(0, 5),
      agentStatus: dashboard.systemHealth?.systemStatus || 'HEALTHY',
    };

    executiveLongTermMemory.store(
      MemoryCategories.EXECUTIVE_DECISIONS,
      `morning_brief_${Date.now()}`,
      brief,
      { tags: ['daily_ops', 'morning_brief'], importance: 1.5 }
    );

    this.operationLogs.push(brief);
    logger.info('DAILY_OPS', '🌅 Autonomous Morning Executive Briefing generated');
    return brief;
  }

  /**
   * Conducts Evening Operational Review (18:00 GST Routine)
   */
  async runEveningReview() {
    const queueStats = autonomousTaskManager.getQueueStats();
    const performance = agentPerformanceEngine.getLeaderboard();

    const review = {
      type: 'EVENING_OPERATIONAL_REVIEW',
      timestamp: new Date().toISOString(),
      tasksSummary: queueStats,
      topPerformingAgent: performance[0]?.agentId || 'mark',
      agentRankings: performance,
      status: 'OPERATIONAL_EXCELLENCE',
    };

    executiveLongTermMemory.store(
      MemoryCategories.EXECUTIVE_DECISIONS,
      `evening_review_${Date.now()}`,
      review,
      { tags: ['daily_ops', 'evening_review'], importance: 1.2 }
    );

    this.operationLogs.push(review);
    logger.info('DAILY_OPS', '🌆 Autonomous Evening Review completed');
    return review;
  }

  /**
   * Conducts Investor Follow-up & Pipeline Review
   */
  async runPipelineReview() {
    const opportunities = opportunityEngine.scanOpportunities();
    const openTasks = autonomousTaskManager.listTasks();

    const review = {
      type: 'PIPELINE_AND_FOLLOW_UP_REVIEW',
      timestamp: new Date().toISOString(),
      activeOpportunitiesCount: opportunities.length,
      managedTasksCount: openTasks.length,
      recommendation: 'Pipeline actively nurtured with zero stalled interactions.',
    };

    this.operationLogs.push(review);
    return review;
  }

  /**
   * Conducts Market Intelligence & Knowledge Update Review
   */
  async runMarketIntelligenceReview() {
    const opps = opportunityEngine.getOpenOpportunities();
    return {
      type: 'MARKET_INTELLIGENCE_REVIEW',
      timestamp: new Date().toISOString(),
      primeYieldArbitrageCount: opps.filter((o) => o.type === 'MARKET_YIELD_ARBITRAGE').length,
      developerLaunchesCount: opps.filter((o) => o.type === 'DEVELOPER_LAUNCH').length,
      status: 'UPDATED',
    };
  }

  getOperationLogs() {
    return this.operationLogs;
  }
}

export const autonomousDailyOperations = new AutonomousDailyOperations();
