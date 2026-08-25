/**
 * RAIOC API - Webhook Routes (n8n & WhatsApp Cloud API)
 * Handles incoming webhook payloads with cryptographic signature verification,
 * lifecycle event processing, and bidirectional status updates.
 */

import { webhookVerifier } from '../../security/webhook-verifier.js';
import { run_cycle } from '../../core/run-cycle.js';
import { logger } from '../../logging/audit-logger.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';
import { supabase } from '../../db/supabase-client.js';

export async function handleWebhookRequest(path, method = 'POST', body = {}, query = {}, headers = {}) {
  const normalized = path.replace(/^\/api\/webhooks\/?/, '');

  // 1. n8n Inbound Webhook & Callback Gateway
  if (normalized.startsWith('n8n')) {
    const signature = headers['x-n8n-signature'] || headers['X-N8N-Signature'] || '';
    const isValid = webhookVerifier.verifyN8nSignature(body, signature);

    if (!isValid) {
      logger.warn('WEBHOOK_API', 'Rejected n8n webhook: Invalid HMAC signature');
      return { status: 401, body: { error: 'Invalid HMAC signature' } };
    }

    const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || body.correlationId || `corr_inbound_${Date.now()}`;
    const event = body.event || body.action || 'n8n_event';

    logger.info('WEBHOOK_API', `Accepted verified n8n webhook event: ${event}`, {
      correlationId,
      n8nExecutionId: body.n8nExecutionId,
      status: body.status,
    });

    // Handle Cycle Trigger
    if (body.action === 'trigger_cycle' || body.event === 'trigger_cycle') {
      run_cycle().catch((e) => logger.error('WEBHOOK_API', 'Cycle trigger failed', { error: e.message }));
    }

    // Handle Workflow Lifecycle Events from n8n (TASK_COMPLETED / TASK_FAILED)
    if (body.status === 'TASK_COMPLETED' || event === 'TASK_COMPLETED') {
      agentEventBus.publish(
        AgentEvents.TASK_COMPLETED,
        {
          task: { id: `n8n_wf_${body.n8nExecutionId || Date.now()}`, name: 'n8n_investor_communication' },
          result: body.dispatches || body.result || {},
          n8nExecutionId: body.n8nExecutionId,
        },
        { correlationId, sourceAgent: 'n8n_workflow' }
      );

      logger.audit('WEBHOOK_API', 'TASK_COMPLETED', body.n8nExecutionId || correlationId, 'executing', 'completed', {
        correlationId,
        dispatches: body.dispatches,
      });
    } else if (body.status === 'TASK_FAILED' || event === 'TASK_FAILED') {
      agentEventBus.publish(
        AgentEvents.TASK_FAILED,
        {
          task: { id: `n8n_wf_${body.n8nExecutionId || Date.now()}`, name: 'n8n_investor_communication' },
          error: body.error || 'n8n workflow failure',
          agentId: 'n8n_bus',
        },
        { correlationId, sourceAgent: 'n8n_workflow' }
      );

      logger.error('WEBHOOK_API', `n8n workflow reported task failure: ${body.error}`, { correlationId });
    }

    return {
      status: 200,
      body: {
        success: true,
        status: body.status || 'TASK_COMPLETED',
        event,
        correlationId,
        n8nExecutionId: body.n8nExecutionId || `exec_ack_${Date.now()}`,
        processedAt: new Date().toISOString(),
      },
    };
  }

  // 2. WhatsApp Inbound Webhook
  if (normalized.startsWith('whatsapp')) {
    // Verification Challenge (GET)
    if (method === 'GET') {
      const mode = query['hub.mode'] || query['mode'];
      const token = query['hub.verify_token'] || query['token'];
      const challenge = query['hub.challenge'] || query['challenge'];

      const result = webhookVerifier.verifyWhatsAppChallenge(mode, token, challenge);
      if (result.success) {
        return { status: 200, body: result.challenge };
      }
      return { status: 403, body: { error: result.error } };
    }

    // Inbound Messages & Status Updates (POST)
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '';
    const isValid = webhookVerifier.verifyWhatsAppSignature(body, signature);

    if (!isValid) {
      logger.warn('WEBHOOK_API', 'Rejected WhatsApp webhook: Invalid Meta signature');
      return { status: 401, body: { error: 'Invalid Meta signature' } };
    }

    logger.info('WEBHOOK_API', 'Received WhatsApp Cloud API event callback');
    return { status: 200, body: { status: 'EVENT_RECEIVED' } };
  }

  return { status: 404, body: { error: `Unknown webhook provider: ${path}` } };
}
