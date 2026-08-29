/**
 * RAIOC Autonomous Operating Center (Company Operating System - JOS v1.0)
 * Central orchestrator maintaining the always-on multi-agent runtime, heartbeats, continuous loop, and goal executions.
 */

import { jarvis } from '../agents/specialists/jarvis-orchestrator.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { distributedScheduler } from '../core/distributed-scheduler.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { sharedMemory } from '../memory/shared-memory.js';
import { kpiCollector } from './kpi-collector.js';
import { executiveDashboard } from './executive-dashboard.js';
import { autonomousDailyOperations } from './autonomous-daily-operations.js';
import { opportunityEngine } from './opportunity-engine.js';
import { executiveSelfHealingLayer } from './executive-self-healing.js';
import { logger } from '../logging/audit-logger.js';

export class OperatingCenter {
  constructor() {
    this.isOnline = false;
    this.heartbeatTimer = null;
  }

  /**
   * Boots the always-on Autonomous Operating Center (JOS v1.0)
   */
  async boot(options = { startContinuousLoop: true }) {
    if (this.isOnline) return;
    this.isOnline = true;
    logger.info('OPERATING_CENTER', '🚀 Booting RAIOC JARVIS Executive Operating Center (JOS v1.0)...');

    // 1. Initialize Event Subscriptions
    this._setupEventSubscriptions();

    // 2. Enable Autonomous Reactive Mesh across all Specialist Agents
    agentDirectory.enableAutonomousMesh();

    // 3. Start Continuous Executive Loop
    if (options.startContinuousLoop) {
      jarvis.startContinuousExecutiveLoop(options.loopIntervalMs || 60000);
    }

    // 4. Start Distributed Autonomous Scheduler
    await distributedScheduler.start();

    // 5. Start Agent Heartbeat Broadcasting (every 60s)
    this.heartbeatTimer = setInterval(() => {
      if (this.isOnline) {
        agentDirectory.broadcastHeartbeats();
      }
    }, 60000);

    // Broadcast initial heartbeats
    agentDirectory.broadcastHeartbeats();

    logger.info('OPERATING_CENTER', '✅ RAIOC JOS v1.0 is ONLINE, ALWAYS-ON, and OPERATING AUTONOMOUSLY');
    return { status: 'ONLINE', agents: agentDirectory.listAgents().length, josVersion: '1.0' };
  }

  _setupEventSubscriptions() {
    agentEventBus.subscribe(AgentEvents.GOAL_COMPLETED, (event) => {
      logger.info('OPERATING_CENTER', `Goal completed: ${event.payload.reportId} (${event.payload.status})`);
      kpiCollector.recordObjectiveCompleted(event.payload.durationMs || 0);
    });

    agentEventBus.subscribe(AgentEvents.ALERT_RAISED, (event) => {
      logger.warn('OPERATING_CENTER', `Operational Alert: [${event.payload.severity}] ${event.payload.message}`);
    });
  }

  /**
   * Primary entrypoint: Human asks JARVIS one objective, JARVIS decomposes and executes autonomously.
   */
  async requestJarvisObjective(humanObjective, contextData = {}) {
    logger.info('OPERATING_CENTER', `Human objective assigned to JARVIS: "${humanObjective}"`);
    return await jarvis.executeObjective(humanObjective, contextData);
  }

  async getDashboard() {
    return await executiveDashboard.getDashboardData();
  }

  getDailyBriefing() {
    return executiveDashboard.getDailyBriefing();
  }

  async runDailyOperationsRoutine(routineType = 'morning') {
    if (routineType === 'morning') {
      return await autonomousDailyOperations.runMorningExecutiveBrief();
    }
    if (routineType === 'evening') {
      return await autonomousDailyOperations.runEveningReview();
    }
    if (routineType === 'pipeline') {
      return await autonomousDailyOperations.runPipelineReview();
    }
    return await autonomousDailyOperations.runMarketIntelligenceReview();
  }

  async shutdown() {
    logger.info('OPERATING_CENTER', 'Shutting down JOS Operating Center...');
    this.isOnline = false;
    jarvis.stopContinuousExecutiveLoop();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await distributedScheduler.stop();
  }
}

export const operatingCenter = new OperatingCenter();
