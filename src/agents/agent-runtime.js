/**
 * RAIOC Agents - Autonomous Agent Runtime
 * Dispatches and executes agent actions against the shared tool registry with audit logging and timing.
 */

import { toolRegistry } from './tool-registry.js';
import { AgentContext, ExecutionResult } from './agent-action-interface.js';
import { logger } from '../logging/audit-logger.js';
import { telemetry } from '../logging/telemetry.js';

export class AgentRuntime {
  constructor(registry = toolRegistry) {
    this.registry = registry;
  }

  /**
   * Executes a single agent action deterministically
   * @param {Object} action - { toolName, parameters }
   * @param {AgentContext} context - Execution context
   * @returns {Promise<ExecutionResult>} Execution result
   */
  async executeAction(action, context = new AgentContext()) {
    const startTime = Date.now();
    const { toolName, parameters } = action;

    const tool = this.registry.getTool(toolName);
    if (!tool) {
      const errMessage = `Tool '${toolName}' not found in Agent Tool Registry`;
      logger.error('AGENT_RUNTIME', errMessage, { correlationId: context.correlationId });
      return new ExecutionResult({
        status: 'FAILED',
        toolName,
        error: errMessage,
        durationMs: Date.now() - startTime,
        context,
      });
    }

    try {
      logger.info('AGENT_RUNTIME', `Agent executing tool '${toolName}'`, {
        correlationId: context.correlationId,
      });

      const output = await tool.execute(parameters || {});
      const durationMs = Date.now() - startTime;

      logger.audit('AGENT_RUNTIME', 'TOOL_EXECUTED', toolName, 'executing', 'completed', {
        correlationId: context.correlationId,
        durationMs,
      });

      return new ExecutionResult({
        status: 'SUCCESS',
        toolName,
        output,
        durationMs,
        context,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      telemetry.recordFailure('processing');
      logger.error('AGENT_RUNTIME', `Tool '${toolName}' execution failed: ${err.message}`, {
        correlationId: context.correlationId,
      });

      return new ExecutionResult({
        status: 'FAILED',
        toolName,
        error: err.message,
        durationMs,
        context,
      });
    }
  }

  /**
   * Executes a sequence of agent actions as an autonomous plan
   */
  async executePlan(actions = [], context = new AgentContext()) {
    const results = [];
    for (const action of actions) {
      const res = await this.executeAction(action, context);
      results.push(res);
      if (res.status === 'FAILED') {
        logger.warn('AGENT_RUNTIME', `Plan execution halted due to failure in tool '${action.toolName}'`);
        break;
      }
    }
    return {
      correlationId: context.correlationId,
      totalActions: actions.length,
      executedActions: results.length,
      results,
      allSuccessful: results.every((r) => r.status === 'SUCCESS'),
    };
  }
}

export const agentRuntime = new AgentRuntime();
