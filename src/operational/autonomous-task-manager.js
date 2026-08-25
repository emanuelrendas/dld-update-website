/**
 * RAIOC Autonomous Task Manager & Enterprise Task Engine (JOS v1.0)
 * Manages full lifecycle tasks, dependencies, auto-spawning child tasks, retries, and execution costs.
 */

import { priorityTaskDispatcher } from './priority-task-dispatcher.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';

export class AutonomousTaskManager {
  constructor() {
    this.tasks = new Map(); // taskId -> TaskObject
    this.taskCounter = 0;
  }

  /**
   * Creates a new enterprise task with full provenance and metadata
   */
  createTask({
    ownerAgent,
    objective,
    priority = 'HIGH',
    priorityScore = 75,
    payload = {},
    dependencies = [],
    parentTask = null,
    businessValue = 50000,
    maxRetries = 3,
  }) {
    this.taskCounter++;
    const taskId = `task_jos_${Date.now()}_${this.taskCounter}`;

    const task = {
      id: taskId,
      ownerAgent,
      priority,
      priorityScore,
      objective,
      status: 'PENDING',
      dependencies: [...dependencies],
      parentTask,
      childTasks: [],
      retries: {
        attempt: 0,
        max: maxRetries,
      },
      payload: { ...payload },
      executionHistory: [],
      executionCost: { tokensEstimate: 1200, computeMs: 0 },
      executionDuration: 0,
      businessValue,
      learningOutcome: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    this.tasks.set(taskId, task);

    // If this is a child task, update the parent
    if (parentTask && this.tasks.has(parentTask)) {
      this.tasks.get(parentTask).childTasks.push(taskId);
    }

    logger.info('TASK_MANAGER', `Created enterprise task [${taskId}] for ${ownerAgent}: "${objective}"`, {
      priority,
      businessValue,
    });

    agentEventBus.publish(AgentEvents.TASK_ASSIGNED, { task }, {
      sourceAgent: 'jarvis',
      correlationId: taskId,
    });

    return task;
  }

  /**
   * Executes a specific task through its assigned specialist agent
   */
  async executeTask(taskId, context = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in AutonomousTaskManager`);
    }

    // Check if dependencies are resolved
    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (depTask && depTask.status !== 'COMPLETED') {
        logger.warn('TASK_MANAGER', `Cannot execute task [${taskId}]: Prerequisite [${depId}] status is ${depTask.status}`);
        return { status: 'WAITING_DEPENDENCY', taskId, waitingFor: depId };
      }
    }

    task.status = 'IN_PROGRESS';
    task.startedAt = new Date().toISOString();
    const startTime = Date.now();

    const agent = agentDirectory.getAgent(task.ownerAgent);
    if (!agent) {
      task.status = 'FAILED';
      const historyEntry = {
        timestamp: new Date().toISOString(),
        agentId: task.ownerAgent,
        status: 'FAILED',
        error: `Agent ${task.ownerAgent} not found in directory`,
      };
      task.executionHistory.push(historyEntry);
      return { status: 'FAILED', taskId, error: historyEntry.error };
    }

    try {
      task.retries.attempt++;
      const result = await agent.executeTask(task.payload, {
        correlationId: context.correlationId || taskId,
      });

      const durationMs = Date.now() - startTime;
      task.executionDuration = durationMs;
      task.executionCost.computeMs = durationMs;

      if (result.status === 'SUCCESS') {
        task.status = 'COMPLETED';
        task.completedAt = new Date().toISOString();
        task.result = result.output;

        task.executionHistory.push({
          timestamp: task.completedAt,
          agentId: task.ownerAgent,
          status: 'SUCCESS',
          durationMs,
          resultSummary: typeof result.output === 'object' ? Object.keys(result.output || {}) : result.output,
        });

        // Evaluate and spawn automatic follow-on child tasks
        this._evaluateAutoSpawn(task);

        return { status: 'SUCCESS', task };
      } else {
        throw new Error(result.error || 'Execution failed');
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      task.executionDuration = durationMs;
      task.executionHistory.push({
        timestamp: new Date().toISOString(),
        agentId: task.ownerAgent,
        status: 'FAILED',
        durationMs,
        error: err.message,
      });

      if (task.retries.attempt < task.retries.max) {
        task.status = 'RETRYING';
        logger.warn('TASK_MANAGER', `Task [${taskId}] failed (attempt ${task.retries.attempt}/${task.retries.max}). Re-enqueuing...`);
      } else {
        task.status = 'FAILED';
        logger.error('TASK_MANAGER', `Task [${taskId}] permanently failed after ${task.retries.attempt} attempts: ${err.message}`);
      }

      return { status: task.status, task, error: err.message };
    }
  }

  /**
   * Automatically generates child tasks based on successful milestone outputs
   */
  _evaluateAutoSpawn(task) {
    const { ownerAgent, payload, result } = task;

    // Rule 1: Post-AIDA brief dispatch -> Spawn HERMES CRM sync if not already present
    if (ownerAgent === 'aida' && result?.brief && !task.childTasks.length) {
      this.createTask({
        ownerAgent: 'hermes',
        objective: `Synchronize dispatched brief and deal intelligence to CRM for ${payload.leadData?.company_name || 'client'}`,
        priority: 'HIGH',
        priorityScore: 85,
        parentTask: task.id,
        payload: {
          leadData: payload.leadData,
          riisScore: payload.leadData?.riis_score || 80,
          riskLevel: 'LOW',
        },
        businessValue: 50000,
      });
    }

    // Rule 2: Post-HERMES CRM sync -> Spawn HELIOS calendar slot follow-up
    if (ownerAgent === 'hermes' && result?.status === 'SUCCESS' && !task.childTasks.length) {
      this.createTask({
        ownerAgent: 'helios',
        objective: `Schedule private advisory session for ${payload.leadData?.company_name || payload.email || 'investor'}`,
        priority: 'MEDIUM',
        priorityScore: 70,
        parentTask: task.id,
        payload: {
          attendeeEmail: payload.leadData?.email || payload.email,
          summary: `RAIOC Strategic Advisory — ${payload.leadData?.company_name || 'Client'}`,
        },
        businessValue: 60000,
      });
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  listTasks(filter = {}) {
    let list = Array.from(this.tasks.values());
    if (filter.status) {
      list = list.filter((t) => t.status === filter.status);
    }
    if (filter.ownerAgent) {
      list = list.filter((t) => t.ownerAgent === filter.ownerAgent);
    }
    if (filter.priority) {
      list = list.filter((t) => t.priority === filter.priority);
    }
    return list;
  }

  getQueueStats() {
    const list = Array.from(this.tasks.values());
    return {
      total: list.length,
      pending: list.filter((t) => t.status === 'PENDING').length,
      inProgress: list.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: list.filter((t) => t.status === 'COMPLETED').length,
      failed: list.filter((t) => t.status === 'FAILED').length,
      retrying: list.filter((t) => t.status === 'RETRYING').length,
    };
  }

  clear() {
    this.tasks.clear();
    this.taskCounter = 0;
  }
}

export const autonomousTaskManager = new AutonomousTaskManager();
