/**
 * RAIOC Agents - Standardized Agent Action Protocol & Interface
 * Defines the canonical data structures for autonomous agent execution and tool calling.
 */

export class AgentContext {
  constructor(options = {}) {
    this.correlationId = options.correlationId || `agent_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.callerId = options.callerId || 'autonomous_core';
    this.sessionStart = new Date().toISOString();
    this.metadata = options.metadata || {};
  }
}

export class AgentAction {
  constructor(toolName, parameters = {}, options = {}) {
    this.toolName = toolName;
    this.parameters = parameters;
    this.idempotencyKey = options.idempotencyKey || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.createdAt = new Date().toISOString();
  }
}

export class ExecutionResult {
  constructor({ status = 'SUCCESS', toolName, output = {}, error = null, durationMs = 0, context = null }) {
    this.status = status;
    this.toolName = toolName;
    this.output = output;
    this.error = error;
    this.durationMs = durationMs;
    this.correlationId = context ? context.correlationId : null;
    this.completedAt = new Date().toISOString();
  }
}
