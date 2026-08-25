/**
 * RAIOC Operational Layer - Executive Dashboard Aggregator (JOS v1.0)
 * Synthesizes all real-time operational metrics, agent leaderboard, financial pipeline,
 * opportunities, decisions, and system health for executive oversight.
 */

import { kpiCollector } from './kpi-collector.js';
import { decisionLogger } from './decision-logger.js';
import { priorityTaskDispatcher } from './priority-task-dispatcher.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { dailyBriefingGenerator } from './daily-briefing-generator.js';
import { sharedMemory } from '../memory/shared-memory.js';
import { agentPerformanceEngine } from './agent-performance-engine.js';
import { opportunityEngine } from './opportunity-engine.js';
import { autonomousTaskManager } from './autonomous-task-manager.js';
import { executiveLongTermMemory } from '../memory/executive-long-term-memory.js';
import { businessIntelligenceBus } from '../events/business-intelligence-bus.js';
import { telemetry } from '../logging/telemetry.js';

export class ExecutiveDashboard {
  /**
   * Retrieves the full executive dashboard snapshot
   */
  getDashboardData() {
    const kpis = kpiCollector.getOperationalKpis();
    const queueStatus = priorityTaskDispatcher.getQueueStatus();
    const taskManagerQueue = autonomousTaskManager.getQueueStats();
    const agentRoster = agentDirectory.listAgents();
    const recentDecisions = decisionLogger.getRecentDecisionsSummary(10);
    const memoryStats = sharedMemory.getStats();
    const cognitiveMemoryStats = executiveLongTermMemory.getStats();
    const agentLeaderboard = agentPerformanceEngine.getLeaderboard();
    const openOpportunities = opportunityEngine.getOpenOpportunities();
    const biMetrics = businessIntelligenceBus.getMetrics();
    const telemetrySnapshot = telemetry.getSnapshot();

    return {
      status: 'OPERATIONAL',
      title: 'RAIOC JARVIS Executive Operating Center (JOS v1.0)',
      agents: agentRoster,
      systemHealth: {
        systemStatus: telemetrySnapshot.systemHealth || 'HEALTHY',
        totalAgents: agentRoster.length,
        activeAgents: agentRoster.filter((a) => a.isAutonomous).length,
        uptimeSeconds: Math.round(process.uptime()),
      },
      financials: {
        pipelineRevenueAed: biMetrics.pipelineRevenueAed || 25000000,
        projectedCommissionsAed: Math.round((biMetrics.pipelineRevenueAed || 25000000) * 0.02),
        totalOpportunitiesValueAed: openOpportunities.reduce((acc, o) => acc + (o.estimatedValueAed || 0), 0),
      },
      currentObjectives: autonomousTaskManager.listTasks({ status: 'IN_PROGRESS' }).map((t) => ({
        id: t.id,
        objective: t.objective,
        agent: t.ownerAgent,
        priority: t.priority,
      })),
      agentLeaderboard,
      queueStatus: {
        ...queueStatus,
        taskManagerQueue,
      },
      openOpportunities: openOpportunities.slice(0, 10),
      recentStrategicDecisions: recentDecisions,
      biDomainMetrics: biMetrics.domainCounts,
      memoryStats: {
        ...memoryStats,
        cognitiveMemoryStats,
      },
      executiveMetrics: kpis.kpiSummary,
      timestamp: new Date().toISOString(),
    };
  }

  getDailyBriefing() {
    return dailyBriefingGenerator.generateBriefing();
  }
}

export const executiveDashboard = new ExecutiveDashboard();
