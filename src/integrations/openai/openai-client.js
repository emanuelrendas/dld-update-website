/**
 * RAIOC Integrations - OpenAI Client
 * Inspects OpenAI connectivity, model availability, and embedding/reasoning capabilities.
 */

import { logger } from '../../logging/audit-logger.js';

export class OpenAiClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.apiUrl = options.apiUrl || 'https://api.openai.com/v1';
    this.enabled = Boolean(this.apiKey);
  }

  async checkHealth() {
    if (!this.apiKey) {
      return {
        status: 'BLOCKED',
        authenticated: false,
        latencyMs: 0,
        failureReason: 'Missing OPENAI_API_KEY in environment.',
        endpointUrl: `${this.apiUrl}/models`,
        lastExecution: new Date().toISOString(),
      };
    }

    try {
      const t0 = Date.now();
      const res = await fetch(`${this.apiUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(3000),
      });
      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        return {
          status: 'AUTH_FAILED',
          authenticated: false,
          httpStatus: res.status,
          latencyMs,
          failureReason: `OpenAI returned status ${res.status}: ${res.statusText}`,
          endpointUrl: `${this.apiUrl}/models`,
          lastExecution: new Date().toISOString(),
        };
      }

      const data = await res.json();
      return {
        status: 'ACTIVE',
        authenticated: true,
        httpStatus: 200,
        latencyMs,
        modelsAvailable: data.data?.length || 0,
        endpointUrl: `${this.apiUrl}/models`,
        lastExecution: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('OPENAI_CLIENT', `Health check failed: ${err.message}`);
      return {
        status: 'NETWORK_ERROR',
        authenticated: false,
        latencyMs: 0,
        failureReason: err.message,
        endpointUrl: `${this.apiUrl}/models`,
        lastExecution: new Date().toISOString(),
      };
    }
  }
}

export const openAiClient = new OpenAiClient();
