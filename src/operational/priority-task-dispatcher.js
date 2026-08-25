/**
 * RAIOC Priority Task Dispatcher & Autonomous Execution Engine
 * Manages priority queues, specialist agent task routing, retries, and fallback recovery.
 */

import { agentDirectory } from '../agents/agent-directory.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';

export const TaskPriority = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  BACKGROUND: 4,
};

export class PriorityTaskDispatcher {
  constructor(options = {}) {
    this.customDirectory = options.directory || null;
    this.queue = []; // Array of task items sorted by priority
    this.activeTasks = new Map();
    this.completedTasks = new Map();
    this.maxConcurrent = options.maxConcurrent || 5;
    this.maxRetries = options.maxRetries || 3;
  }

  getDirectory() {
    return this.customDirectory || agentDirectory;
  }

  enqueueTask(taskDefinition) {
    const task = {
      id: taskDefinition.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      correlationId: taskDefinition.correlationId || taskDefinition.objectiveId || null,
      name: taskDefinition.name || 'unnamed_task',
      type: taskDefinition.type,
      agentId: taskDefinition.agentId || null,
      requiredCapability: taskDefinition.requiredCapability || null,
      payload: taskDefinition.payload || {},
      priority: taskDefinition.priority || TaskPriority.NORMAL,
      dependencies: taskDefinition.dependencies || [], // IDs of tasks that must complete first
      status: 'PENDING',
      retryCount: 0,
      maxRetries: taskDefinition.maxRetries || this.maxRetries,
      result: null,
      error: null,
      enqueuedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    this.queue.push(task);
    this._sortQueue();

    logger.info('TASK_DISPATCHER', `Enqueued task [${task.id}] '${task.name}' with Priority ${task.priority}`);
    return task;
  }

  _sortQueue() {
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  async dispatchNext() {
    if (this.queue.length === 0 || this.activeTasks.size >= this.maxConcurrent) {
      return null;
    }

    // Find first task whose dependencies are satisfied
    const readyIndex = this.queue.findIndex((t) => {
      if (t.dependencies.length === 0) return true;
      return t.dependencies.every((depId) => this.completedTasks.has(depId) && this.completedTasks.get(depId).status === 'SUCCESS');
    });

    if (readyIndex === -1) return null;

    const task = this.queue.splice(readyIndex, 1)[0];
    return await this._executeTask(task);
  }

  async _executeTask(task) {
    const directory = this.getDirectory();
    let agent = null;
    if (task.agentId) {
      agent = directory.getAgent(task.agentId);
    } else if (task.requiredCapability) {
      agent = directory.findAgentForCapability(task.requiredCapability);
    }

    if (!agent) {
      const err = `No suitable specialist agent found for task ${task.id} (agentId: ${task.agentId}, capability: ${task.requiredCapability})`;
      logger.error('TASK_DISPATCHER', err);
      task.status = 'FAILED';
      task.error = err;
      this.completedTasks.set(task.id, task);
      return task;
    }

    task.status = 'RUNNING';
    task.startedAt = new Date().toISOString();
    this.activeTasks.set(task.id, task);

    try {
      const result = await agent.executeTask(task.payload, { correlationId: task.correlationId || task.id });

      if (result && result.status === 'SUCCESS') {
        task.status = 'SUCCESS';
        task.result = result.output;
        task.completedAt = new Date().toISOString();
        this.activeTasks.delete(task.id);
        this.completedTasks.set(task.id, task);
        return task;
      } else {
        throw new Error((result && result.error) || 'Agent returned failure status');
      }
    } catch (err) {
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'RETRYING';
        this.activeTasks.delete(task.id);
        this.queue.push(task);
        this._sortQueue();
        logger.warn('TASK_DISPATCHER', `Retrying task [${task.id}] (Attempt ${task.retryCount}/${task.maxRetries}): ${err.message}`);
        return task;
      } else {
        task.status = 'FAILED';
        task.error = err.message;
        task.completedAt = new Date().toISOString();
        this.activeTasks.delete(task.id);
        this.completedTasks.set(task.id, task);
        return task;
      }
    }
  }

  async processAll() {
    const results = [];
    while (this.queue.length > 0) {
      const res = await this.dispatchNext();
      if (res) results.push(res);
      else break; // No tasks ready due to unmet dependencies or capacity
    }
    return results;
  }

  getQueueStatus() {
    return {
      pendingCount: this.queue.length,
      activeCount: this.activeTasks.size,
      completedCount: this.completedTasks.size,
      pendingTasks: this.queue.map((t) => ({ id: t.id, name: t.name, priority: t.priority })),
    };
  }
}

export const priorityTaskDispatcher = new PriorityTaskDispatcher();
