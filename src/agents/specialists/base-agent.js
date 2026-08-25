/**
 * RAIOC Base Specialist Agent
 * Foundation class for all autonomous specialist agents in the RAIOC Multi-Agent Operating System.
 * Supports task execution, tool invocation, decision logging, associative memory, and autonomous event-driven chaining.
 */

import { toolRegistry } from '../tool-registry.js';
import { sharedMemory } from '../../memory/shared-memory.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';
import { decisionLogger } from '../../operational/decision-logger.js';
import { logger } from '../../logging/audit-logger.js';

export class BaseSpecialistAgent {
  constructor({ id, name, role, capabilities = [], systemPrompt = '' }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.capabilities = capabilities;
    this.systemPrompt = systemPrompt;
    this.status = 'IDLE'; // 'IDLE', 'BUSY', 'ERROR'
    this.currentTask = null;
    this.lastHeartbeat = new Date().toISOString();
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
    this.subscriptions = [];
    this.isAutonomous = false;
  }

  emitHeartbeat() {
    this.lastHeartbeat = new Date().toISOString();
    const heartbeatData = {
      agentId: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      currentTask: this.currentTask,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      isAutonomous: this.isAutonomous,
      timestamp: this.lastHeartbeat,
    };

    agentEventBus.publish(AgentEvents.AGENT_HEARTBEAT, heartbeatData, {
      sourceAgent: this.id,
    });

    return heartbeatData;
  }

  emitEvent(topic, payload = {}, correlationId = null) {
    return agentEventBus.publish(topic, payload, {
      sourceAgent: this.id,
      correlationId: correlationId || `corr_${Date.now()}`,
    });
  }

  subscribeEvent(topic, handler) {
    const unsub = agentEventBus.subscribe(topic, handler);
    this.subscriptions.push(unsub);
    return unsub;
  }

  logDecision(rationale, chosenAction, options = {}) {
    return decisionLogger.logDecision({
      agentId: this.id,
      objectiveId: options.objectiveId || 'autonomous_task',
      rationale,
      chosenAction,
      alternativesConsidered: options.alternativesConsidered || [],
      confidenceScore: options.confidenceScore !== undefined ? options.confidenceScore : 0.95,
      impactLevel: options.impactLevel || 'MEDIUM',
      metadata: options.metadata || {},
    });
  }

  async invokeTool(toolName, parameters = {}) {
    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in registry for agent ${this.id}`);
    }
    logger.info(`AGENT_${this.id.toUpperCase()}`, `Executing tool: ${toolName}`);
    return await tool.execute(parameters);
  }

  sendMessage(recipientId, message, correlationId = null) {
    return agentEventBus.sendDirectMessage(this.id, recipientId, message, correlationId);
  }

  storeMemory(topic, content, options = {}) {
    return sharedMemory.storeKnowledge(topic, content, {
      ...options,
      metadata: { ...(options.metadata || {}), storedBy: this.id },
    });
  }

  recallMemory(query, options = {}) {
    return sharedMemory.recallKnowledge(query, options);
  }

  /**
   * Enables autonomous event-driven chaining mesh for this agent
   */
  enableAutonomousMesh() {
    this.isAutonomous = true;
    this.setupAutonomousHandlers();
    logger.info(`AGENT_${this.id.toUpperCase()}`, `Autonomous execution mesh ENABLED`);
  }

  /**
   * Overridden by specialist subclasses to attach reactive domain event handlers
   */
  setupAutonomousHandlers() {
    // Implemented in subclasses
  }

  /**
   * Main entrypoint for specialized task execution - overridden by subclasses
   */
  async processTask(task, context = {}) {
    throw new Error(`processTask not implemented for agent ${this.id}`);
  }

  async executeTask(task, context = {}) {
    const startTime = Date.now();
    this.status = 'BUSY';
    this.currentTask = task.type || task.name || 'unnamed_task';

    agentEventBus.publish(AgentEvents.TASK_STARTED, { task, agentId: this.id }, {
      sourceAgent: this.id,
      correlationId: context.correlationId,
    });

    try {
      const result = await this.processTask(task, context);
      const durationMs = Date.now() - startTime;
      this.tasksCompleted++;
      this.status = 'IDLE';
      this.currentTask = null;

      agentEventBus.publish(AgentEvents.TASK_COMPLETED, { task, result, durationMs, agentId: this.id }, {
        sourceAgent: this.id,
        correlationId: context.correlationId,
      });

      return {
        status: 'SUCCESS',
        agentId: this.id,
        output: result,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.tasksFailed++;
      this.status = 'ERROR';
      this.currentTask = null;

      logger.error(`AGENT_${this.id.toUpperCase()}`, `Task execution failed: ${err.message}`, {
        task,
        error: err.message,
      });

      agentEventBus.publish(AgentEvents.TASK_FAILED, { task, error: err.message, durationMs, agentId: this.id }, {
        sourceAgent: this.id,
        correlationId: context.correlationId,
      });

      return {
        status: 'FAILED',
        agentId: this.id,
        error: err.message,
        durationMs,
      };
    }
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      status: this.status,
      currentTask: this.currentTask,
      lastHeartbeat: this.lastHeartbeat,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      isAutonomous: this.isAutonomous,
    };
  }
}
