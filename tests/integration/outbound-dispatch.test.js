/**
 * RAIOC OS - Outbound Dispatch & Queue Drainer Integration Test
 * Verifies that when a lead is INGESTED, Executive Briefs are packaged and
 * queued in outbound_queue, transitioning cleanly to SENT upon provider confirmation.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueueEngine } from '../../src/engines/queue-engine.js';
import { EmailAdapter } from '../../src/adapters/email-adapter.js';
import { WhatsAppAdapter } from '../../src/adapters/whatsapp-adapter.js';
import { CrmAdapter } from '../../src/adapters/crm-adapter.js';
import { SupabaseClient } from '../../src/db/supabase-client.js';
import { diraRiisEngine } from '../../src/engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../../src/engines/executive-brief.js';
import { run_cycle } from '../../src/core/run-cycle.js';

describe('INTEGRATION: Outbound Dispatch Queue Drainer', () => {
  let db;
  let queue;

  beforeEach(() => {
    db = new SupabaseClient({ useMock: true });
    queue = new QueueEngine({ maxRetries: 3, baseBackoffMs: 10, maxBackoffMs: 50 });
  });

  test('1. Ingested lead produces Executive Brief and cleanly queues dispatches with QUEUED_FOR_DISPATCH status when awaiting credentials', async () => {
    const emailAdapter = new EmailAdapter({ enabled: true, user: '', password: '' });
    const waAdapter = new WhatsAppAdapter({ enabled: true, apiUrl: '', apiKey: '' });
    const crmAdapter = new CrmAdapter({ enabled: true, apiUrl: '', apiKey: '' });

    queue.registerAdapter('email', emailAdapter);
    queue.registerAdapter('whatsapp', waAdapter);
    queue.registerAdapter('crm', crmAdapter);

    const lead = {
      id: 'lead_test_ingested_001',
      name: 'Dr. Tariq Al-Mansoor',
      company: 'Al-Mansoor Private Family Office',
      email: 'tariq.almansoor@mansoorholdings.ae',
      phone: '+971509876543',
      company_size: '500+',
      ai_maturity: 'in_production',
      timeline: 'immediate',
      data_stack: 'modern cloud',
      budgetAed: 5000000,
      status: 'INGESTED',
      created_at: new Date().toISOString(),
    };

    db.mockStore.leads.push(lead);

    // Run cycle to process the INGESTED lead
    const cycleSummary = await run_cycle({ dbClient: db, batchSize: 10 });
    assert.equal(cycleSummary.status, 'SUCCESS');
    assert.equal(cycleSummary.summary.leadsProcessed, 1);
    assert.equal(cycleSummary.summary.executiveBriefsGenerated, 1);

    // Verify Executive Brief was persisted
    assert.equal(db.mockStore.executive_briefs.length, 1);
    const brief = db.mockStore.executive_briefs[0];
    assert.equal(brief.company_name, 'Al-Mansoor Private Family Office');
    assert.equal(brief.riis_score, 100);

    // Verify Dispatches were enqueued into dispatch_queue (outbound_queue)
    assert.equal(db.mockStore.dispatch_queue.length, 3);
    const emailTask = db.mockStore.dispatch_queue.find((t) => t.type === 'email');
    const waTask = db.mockStore.dispatch_queue.find((t) => t.type === 'whatsapp');

    assert.ok(emailTask);
    assert.ok(waTask);
    assert.equal(emailTask.status, 'QUEUED_FOR_DISPATCH');
    assert.equal(waTask.status, 'QUEUED_FOR_DISPATCH');
  });

  test('2. Live / Confirmed Provider transitions outbound queue tasks to SENT status', async () => {
    // Mock Provider with successful delivery confirmation
    const mockEmailAdapter = {
      dispatch: async (task) => ({
        status: 'SENT',
        provider: 'resend',
        messageId: `msg_resend_${Date.now()}`,
        recipient: task.recipient,
        timestamp: new Date().toISOString(),
      }),
    };

    const mockWhatsAppAdapter = {
      dispatch: async (task) => ({
        status: 'SENT',
        provider: 'whatsapp_cloud',
        messageId: `wamid_${Date.now()}`,
        recipient: task.recipient,
        timestamp: new Date().toISOString(),
      }),
    };

    queue.registerAdapter('email', mockEmailAdapter);
    queue.registerAdapter('whatsapp', mockWhatsAppAdapter);

    // Enqueue an email task
    const emailTask = await db.enqueueDispatch({
      type: 'email',
      recipient: 'privateadvisory@emanuelrendas.com',
      payload: { subject: 'Test Brief', body: 'Executive Brief content' },
      priority: 1,
    });

    // Enqueue a WhatsApp task
    const waTask = await db.enqueueDispatch({
      type: 'whatsapp',
      recipient: '+971509876543',
      payload: { message: 'WhatsApp Brief content' },
      priority: 2,
    });

    // Process tasks through Queue Engine
    const emailOutcome = await queue.processTask(emailTask, db);
    const waOutcome = await queue.processTask(waTask, db);

    assert.equal(emailOutcome.success, true);
    assert.equal(emailOutcome.status, 'SENT');
    assert.ok(emailOutcome.result.messageId);

    assert.equal(waOutcome.success, true);
    assert.equal(waOutcome.status, 'SENT');
    assert.ok(waOutcome.result.messageId);

    // Verify state in Supabase DB store
    const updatedEmail = db.mockStore.dispatch_queue.find((t) => t.id === emailTask.id);
    const updatedWa = db.mockStore.dispatch_queue.find((t) => t.id === waTask.id);

    assert.equal(updatedEmail.status, 'SENT');
    assert.equal(updatedEmail.delivery_receipt.provider, 'resend');

    assert.equal(updatedWa.status, 'SENT');
    assert.equal(updatedWa.delivery_receipt.provider, 'whatsapp_cloud');
  });

  test('3. Outbound dispatch error triggers exponential retry backoff and eventually dead-letters if exhausted', async () => {
    let callCount = 0;
    const failingAdapter = {
      dispatch: async () => {
        callCount++;
        throw new Error('Provider 503 Service Unavailable');
      },
    };

    queue.registerAdapter('email', failingAdapter);

    const task = await db.enqueueDispatch({
      type: 'email',
      recipient: 'test@example.com',
      payload: { subject: 'Retry Test' },
      priority: 1,
    });

    // Attempt 1 -> retrying
    const out1 = await queue.processTask(task, db);
    assert.equal(out1.success, false);
    assert.equal(out1.retrying, true);
    assert.equal(task.retry_count, 1);
    assert.equal(task.status, 'retrying');

    // Attempt 2 -> retrying
    const out2 = await queue.processTask(task, db);
    assert.equal(out2.retrying, true);
    assert.equal(task.retry_count, 2);

    // Attempt 3 -> retrying
    const out3 = await queue.processTask(task, db);
    assert.equal(out3.retrying, true);
    assert.equal(task.retry_count, 3);

    // Attempt 4 -> max retries exceeded -> failed
    const out4 = await queue.processTask(task, db);
    assert.equal(out4.failed, true);
    assert.equal(task.status, 'failed');
    assert.equal(task.retry_count, 4);
    assert.equal(callCount, 4);
  });
});
