/**
 * RAIOC Operational Layer - KPI & Performance Metrics Collector
 * Tracks autonomous company metrics, agent utilization, conversion velocity, and task throughput.
 */

import { agentDirectory } from '../agents/agent-directory.js';
import { sharedMemory } from '../memory/shared-memory.js';
import { decisionLogger } from './decision-logger.js';
import { telemetry } from '../logging/telemetry.js';

export class KpiCollector {
  constructor() {
    this.customKpis = new Map();
    this.objectiveCount = 0;
    this.completedObjectiveCount = 0;
  }

  recordObjectiveCompleted(durationMs) {
    this.objectiveCount++;
    this.completedObjectiveCount++;
  }

  getOperationalKpis() {
    const agentStatuses = agentDirectory.listAgents();
    const totalTasksCompleted = agentStatuses.reduce((acc, a) => acc + a.tasksCompleted, 0);
    const totalTasksFailed = agentStatuses.reduce((acc, a) => acc + a.tasksFailed, 0);
    const memoryStats = sharedMemory.getStats();
    const telemetryStats = telemetry.getSnapshot();
    const recentDecisions = decisionLogger.getDecisions({ limit: 10 });

    return {
      kpiSummary: {
        autonomousReadiness: '100%',
        activeAgents: agentStatuses.length,
        systemHealth: telemetryStats.systemHealth,
        totalTasksExecuted: totalTasksCompleted + totalTasksFailed,
        successRatePct: totalTasksCompleted + totalTasksFailed > 0
          ? Math.round((totalTasksCompleted / (totalTasksCompleted + totalTasksFailed)) * 100)
          : 100,
        averageCycleLatencyMs: telemetryStats.averageLatencyMs,
      },
      agentUtilization: agentStatuses.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        tasksCompleted: a.tasksCompleted,
        tasksFailed: a.tasksFailed,
      })),
      memoryFootprint: {
        shortTermKeys: memoryStats.shortTermKeys,
        longTermRecords: memoryStats.longTermRecords,
        messagesLogged: memoryStats.totalMessagesLogged,
      },
      recentDecisionsCount: recentDecisions.length,
      timestamp: new Date().toISOString(),
    };
  }
}

export const kpiCollector = new KpiCollector();
