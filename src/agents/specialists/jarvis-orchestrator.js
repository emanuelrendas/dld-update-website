/**
 * RAIOC Chief Orchestrator: JARVIS (JOS v1.0)
 * The Executive Brain of RAIOC.
 * Governs the continuous autonomous multi-agent operating company, evaluates decisions,
 * discovers opportunities, delegates to specialist agents, learns continuously, and supervises operations.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { autonomousPlanner } from '../../operational/autonomous-planner.js';
import { priorityTaskDispatcher } from '../../operational/priority-task-dispatcher.js';
import { autonomousTaskManager } from '../../operational/autonomous-task-manager.js';
import { executiveDecisionEngine } from '../../operational/executive-decision-engine.js';
import { opportunityEngine } from '../../operational/opportunity-engine.js';
import { agentPerformanceEngine } from '../../operational/agent-performance-engine.js';
import { continuousLearningLayer } from '../../operational/continuous-learning-layer.js';
import { executiveSelfHealingLayer } from '../../operational/executive-self-healing.js';
import { executiveLongTermMemory, MemoryCategories } from '../../memory/executive-long-term-memory.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';
import { sharedMemory } from '../../memory/shared-memory.js';
import { agentDirectory } from '../agent-directory.js';
import { logger } from '../../logging/audit-logger.js';

export class JarvisOrchestrator extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'jarvis',
      name: 'JARVIS',
      role: 'Chief Autonomous Orchestration Agent & Executive Brain',
      capabilities: [
        'executive_decision_governance',
        'goal_decomposition',
        'multi_agent_coordination',
        'opportunity_discovery',
        'continuous_learning',
        'self_healing_oversight',
        'executive_synthesis',
      ],
      systemPrompt:
        'You are JARVIS, Chief Intelligence Orchestrator and Executive Brain of RAIOC. You think, prioritize, delegate, supervise, learn, coordinate, measure, and improve the company operating system.',
    });

    this.isLoopRunning = false;
    this.loopTimer = null;
    this.executiveCyclesCount = 0;
  }

  setupAutonomousHandlers() {
    // Intercept all system events for executive intelligence evaluation
    this.subscribeEvent('*', (event) => {
      if (event.topic !== AgentEvents.AGENT_HEARTBEAT && event.topic !== 'decision:logged') {
        this.evaluateSystemEvent(event);
      }
    });

    // When goal received, orchestrate full plan
    this.subscribeEvent(AgentEvents.GOAL_RECEIVED, async (event) => {
      if (event.metadata.sourceAgent !== this.id) {
        await this.executeObjective(event.payload.objective, event.payload.contextData);
      }
    });
  }

  /**
   * Evaluates an incoming system event for business impact, risk, and opportunities
   */
  evaluateSystemEvent(event) {
    const evaluation = executiveDecisionEngine.evaluate({
      type: event.topic,
      payload: event.payload,
      context: { correlationId: event.metadata.correlationId },
    });

    logger.info('JARVIS', `Executive event evaluation: [${event.topic}] -> Priority ${evaluation.priorityScore}/100, Impact: ${evaluation.businessImpact}`);
    return evaluation;
  }

  /**
   * Starts the continuous, forever-running executive loop of JOS v1.0
   */
  startContinuousExecutiveLoop(intervalMs = 30000) {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    logger.info('JARVIS', '♾️ Starting continuous JARVIS Executive Operating System (JOS) Loop...');

    this.loopTimer = setInterval(async () => {
      try {
        await this.runExecutiveTick();
      } catch (err) {
        logger.error('JARVIS', `Continuous executive loop tick error: ${err.message}`);
      }
    }, intervalMs);
  }

  /**
   * Single tick of the continuous executive loop
   */
  async runExecutiveTick() {
    this.executiveCyclesCount++;
    logger.info('JARVIS', `--- JOS Executive Loop Tick #${this.executiveCyclesCount} ---`);

    // 1. Scan for business opportunities
    const opportunities = opportunityEngine.scanOpportunities();

    // 2. Scan and execute self-healing
    await executiveSelfHealingLayer.runHealthScan();

    // 3. Check and execute pending tasks in task manager
    const pendingTasks = autonomousTaskManager.listTasks({ status: 'PENDING' });
    for (const task of pendingTasks.slice(0, 3)) {
      const result = await autonomousTaskManager.executeTask(task.id);
      
      // 4. Extract continuous learning from task outcome
      continuousLearningLayer.evaluateTaskOutcome(task);

      // 5. Update agent performance metrics
      agentPerformanceEngine.recordTaskExecution({
        agentId: task.ownerAgent,
        status: result.status,
        durationMs: task.executionDuration,
        businessValue: task.businessValue,
        retries: task.retries.attempt,
      });
    }

    // 6. Snapshot performance leaderboard periodically
    if (this.executiveCyclesCount % 5 === 0) {
      agentPerformanceEngine.snapshotPerformance();
    }

    return {
      cycle: this.executiveCyclesCount,
      opportunitiesFound: opportunities.length,
      processedTasks: pendingTasks.length,
      timestamp: new Date().toISOString(),
    };
  }

  stopContinuousExecutiveLoop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.isLoopRunning = false;
    logger.info('JARVIS', 'Stopped continuous JOS executive loop.');
  }

  /**
   * Autonomous Objective Execution Loop
   * @param {string} humanObjective - Natural language objective or mandate
   * @param {Object} contextData - Associated parameters
   * @returns {Promise<Object>} Comprehensive Executive Synthesis Report
   */
  async executeObjective(humanObjective, contextData = {}) {
    const startTime = Date.now();
    const correlationId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info('JARVIS', `Ingesting human objective: "${humanObjective}"`, { correlationId });

    // 1. Publish Event
    agentEventBus.publish(
      AgentEvents.GOAL_RECEIVED,
      { objective: humanObjective, contextData },
      { sourceAgent: this.id, correlationId }
    );

    // 2. Executive Decision Evaluation
    const decision = executiveDecisionEngine.evaluate({
      type: 'HUMAN_STRATEGIC_MANDATE',
      payload: { objective: humanObjective, ...contextData },
      context: { correlationId },
    });

    // 3. Autonomous Decomposition into Execution Plan
    const plan = autonomousPlanner.createPlan(humanObjective, contextData);

    this.logDecision(
      `Decomposed human objective into execution plan [${plan.planId}] containing ${plan.tasks.length} specialist tasks`,
      'ORCHESTRATE_MULTI_AGENT_PLAN',
      {
        objectiveId: correlationId,
        confidenceScore: 0.99,
        impactLevel: 'CRITICAL',
        metadata: { taskCount: plan.tasks.length, planId: plan.planId, priorityScore: decision.priorityScore },
      }
    );

    // 4. Enqueue Tasks into Priority Dispatcher & Task Manager
    for (const task of plan.tasks) {
      task.correlationId = correlationId;
      task.objectiveId = correlationId;
      priorityTaskDispatcher.enqueueTask(task);

      autonomousTaskManager.createTask({
        ownerAgent: task.agentId,
        objective: task.name,
        priority: task.priority || 'HIGH',
        priorityScore: decision.priorityScore,
        payload: task.payload,
        businessValue: 50000,
      });
    }

    // 5. Autonomous Execution of all Dependency Tasks
    const executionResults = await priorityTaskDispatcher.processAll();

    const successCount = executionResults.filter((r) => r.status === 'SUCCESS').length;
    const failedCount = executionResults.filter((r) => r.status === 'FAILED').length;
    const durationMs = Date.now() - startTime;

    // 6. Record Agent Performance & Learnings for each task
    for (const res of executionResults) {
      agentPerformanceEngine.recordTaskExecution({
        agentId: res.agentId,
        status: res.status,
        durationMs: res.durationMs || 50,
        businessValue: 50000,
      });

      continuousLearningLayer.evaluateTaskOutcome({
        id: res.id,
        ownerAgent: res.agentId,
        objective: res.name,
        status: res.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
        executionDuration: res.durationMs || 50,
        error: res.error,
      });
    }

    // 7. Synthesize Executive Report
    const executiveReport = {
      reportId: `exec_rep_${Date.now()}`,
      correlationId,
      objective: humanObjective,
      orchestrator: 'JARVIS',
      status: failedCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
      totalExecutionTimeMs: durationMs,
      executiveDecision: decision,
      planSummary: {
        planId: plan.planId,
        totalTasks: plan.tasks.length,
        succeededTasks: successCount,
        failedTasks: failedCount,
      },
      agentContributions: executionResults.map((t) => ({
        taskId: t.id,
        taskName: t.name,
        agentId: t.agentId,
        status: t.status,
        outputSummary: typeof t.result === 'object' ? Object.keys(t.result || {}) : t.result,
      })),
      synthesizedIntelligence: {
        riskEvaluation: executionResults.find((t) => t.agentId === 'mark')?.result || null,
        marketStrategy: executionResults.find((t) => t.agentId === 'atlas')?.result || null,
        complianceAudit: executionResults.find((t) => t.agentId === 'lex')?.result || null,
        communications: executionResults.find((t) => t.agentId === 'aida')?.result || null,
        crmStaging: executionResults.find((t) => t.agentId === 'hermes')?.result || null,
        calendarBooking: executionResults.find((t) => t.agentId === 'helios')?.result || null,
        systemHealth: executionResults.find((t) => t.agentId === 'sentinel')?.result || null,
      },
      generatedAt: new Date().toISOString(),
    };

    // 8. Update Long-Term Shared Memory & Cognitive Store
    sharedMemory.storeKnowledge(`executive_report_${correlationId}`, executiveReport, {
      importance: 2.0,
      tags: ['executive_report', 'jarvis', 'orchestration', 'objective'],
    });

    executiveLongTermMemory.store(
      MemoryCategories.EXECUTIVE_DECISIONS,
      `exec_report_${correlationId}`,
      executiveReport,
      {
        importance: 2.0,
        tags: ['executive_report', 'mandate'],
        impactAed: decision.revenueImpactAed,
      }
    );

    // 9. Publish Goal Completed Event
    agentEventBus.publish(
      AgentEvents.GOAL_COMPLETED,
      { reportId: executiveReport.reportId, status: executiveReport.status, durationMs },
      { sourceAgent: this.id, correlationId }
    );

    logger.info('JARVIS', `Autonomous objective completed in ${durationMs}ms with status: ${executiveReport.status}`);
    return executiveReport;
  }
}

export const jarvis = new JarvisOrchestrator();
agentDirectory.registerAgent(jarvis);
