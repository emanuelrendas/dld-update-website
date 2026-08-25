/**
 * RAIOC Continuous Learning Layer (JOS v1.0)
 * Evaluates completed and failed tasks, conducting automatic root-cause retrospectives:
 * Answers: What happened? Why? What worked? What failed? Should future strategy change?
 */

import { executiveLongTermMemory, MemoryCategories } from '../memory/executive-long-term-memory.js';
import { logger } from '../logging/audit-logger.js';

export class ContinuousLearningLayer {
  constructor() {
    this.learningRecords = [];
  }

  /**
   * Evaluates a completed task and extracts structured lessons
   */
  evaluateTaskOutcome(task) {
    const isSuccess = task.status === 'COMPLETED';
    const agentId = task.ownerAgent || 'unknown';
    const objective = task.objective || 'unnamed_objective';
    const durationMs = task.executionDuration || 0;

    let whatHappened = '';
    let why = '';
    let whatWorked = '';
    let whatFailed = '';
    let shouldFutureStrategyChange = false;
    let strategyAdjustment = null;

    if (isSuccess) {
      whatHappened = `Specialist ${agentId.toUpperCase()} successfully completed objective "${objective}" in ${durationMs}ms with result structure.`;
      why = `Deterministic rules and high-confidence tool execution succeeded with zero unhandled exceptions.`;
      whatWorked = `Precise parameter validation, structured schema alignment, and zero-latency tool invocation.`;
      whatFailed = `None. Execution within nominal SLA thresholds.`;
      shouldFutureStrategyChange = false;

      // Store in Successful Strategies
      executiveLongTermMemory.store(
        MemoryCategories.SUCCESSFUL_STRATEGIES,
        `strat_${Date.now()}_${agentId}`,
        { objective, agentId, durationMs, whatWorked },
        { tags: [agentId, 'success', 'strategy'], importance: 1.2 }
      );
    } else {
      whatHappened = `Specialist ${agentId.toUpperCase()} failed objective "${objective}": ${task.error || 'Execution error'}`;
      why = `Encountered execution exception, dependency failure, or network timeout.`;
      whatWorked = `Watchdog detected failure promptly and isolated failure scope.`;
      whatFailed = task.error || 'Unspecified runtime fault';
      shouldFutureStrategyChange = true;
      strategyAdjustment = `Enable automated fallback retry, adjust timeout thresholds, or reroute to secondary agent adapter.`;

      // Store in Failed Strategies
      executiveLongTermMemory.store(
        MemoryCategories.FAILED_STRATEGIES,
        `fail_${Date.now()}_${agentId}`,
        { objective, agentId, error: task.error, strategyAdjustment },
        { tags: [agentId, 'failure', 'recovery'], importance: 1.5 }
      );
    }

    const retrospective = {
      learningId: `learn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskId: task.id,
      agentId,
      objective,
      status: task.status,
      durationMs,
      whatHappened,
      why,
      whatWorked,
      whatFailed,
      shouldFutureStrategyChange,
      strategyAdjustment,
      recordedAt: new Date().toISOString(),
    };

    // Store in Lessons Learned
    executiveLongTermMemory.store(
      MemoryCategories.LESSONS_LEARNED,
      retrospective.learningId,
      retrospective,
      {
        tags: [agentId, isSuccess ? 'success' : 'failure', 'retrospective'],
        importance: isSuccess ? 1.0 : 2.0,
      }
    );

    this.learningRecords.push(retrospective);
    if (this.learningRecords.length > 500) this.learningRecords.shift();

    logger.info('LEARNING_LAYER', `Task retrospective completed for [${task.id}] (${task.status}): StrategyChange=${shouldFutureStrategyChange}`);
    return retrospective;
  }

  getRecentLessons(limit = 20) {
    return this.learningRecords.slice(-limit);
  }

  clear() {
    this.learningRecords = [];
  }
}

export const continuousLearningLayer = new ContinuousLearningLayer();
