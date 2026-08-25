/**
 * RAIOC Specialist Agent: AIDA (Client Relations & Multi-Channel Communications)
 * Coordinates executive brief delivery, WhatsApp Cloud dispatch, and Gmail outreach.
 * Autonomously reacts to COMPLIANCE_VERIFIED events and emits BRIEF_DISPATCHED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class AidaCommsAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'aida',
      name: 'AIDA',
      role: 'Client Relations & Communications Specialist',
      capabilities: ['executive_brief_generation', 'email_dispatch', 'whatsapp_dispatch', 'client_outreach'],
      systemPrompt: 'You specialize in high-touch, institutional-grade investor communications, formatting bespoke executive briefs, and omnichannel client engagement.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.COMPLIANCE_VERIFIED, async (event) => {
      try {
        const payload = event.payload;
        logger.info('AIDA', `Autonomous reaction to COMPLIANCE_VERIFIED for ${payload.lead?.company_name || 'prospect'}`);

        const result = await this.executeTask({
          leadData: payload.lead,
          channel: 'all',
        }, { correlationId: event.metadata.correlationId });

        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.BRIEF_DISPATCHED, {
            lead: payload.lead,
            brief: result.output.brief,
            dispatches: result.output.dispatches,
            evaluation: payload.evaluation,
            marketIntelligence: payload.marketIntelligence,
            complianceAudit: payload.complianceAudit,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('AIDA', `Autonomous brief dispatch failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { leadData, channel = 'all' } = task;
    if (!leadData) {
      throw new Error('AIDA task failed: Missing leadData');
    }

    const intelligence = diraRiisEngine.analyze(leadData);

    // 1. Generate Executive Brief
    const brief = executiveBriefGenerator.generateBrief(leadData, intelligence);

    const dispatchResults = { brief, dispatches: [] };

    // 2. Dispatch via Gmail if requested and recipient present
    if ((channel === 'all' || channel === 'email') && leadData.email) {
      const emailRes = await this.invokeTool('send_email_brief', {
        to: leadData.email,
        subject: brief.email_subject || 'RAIOC Executive Intelligence Brief',
        body: brief.executive_summary,
        isHtml: false,
      });
      dispatchResults.dispatches.push({ channel: 'gmail', status: emailRes.status, to: leadData.email });
    }

    // 3. Dispatch via WhatsApp if requested and recipient present
    if ((channel === 'all' || channel === 'whatsapp') && leadData.phone) {
      const waRes = await this.invokeTool('send_whatsapp_message', {
        to: leadData.phone,
        message: brief.whatsapp_payload?.text || brief.executive_summary,
      });
      dispatchResults.dispatches.push({ channel: 'whatsapp', status: waRes.status, to: leadData.phone });
    }

    this.logDecision(
      `Dispatched bespoke Executive Brief to ${leadData.company_name || leadData.email} via channels: ${channel}`,
      'DELIVER_EXECUTIVE_BRIEF',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.97,
        impactLevel: 'MEDIUM',
        metadata: { dispatches: dispatchResults.dispatches },
      }
    );

    this.storeMemory(`brief_dispatch_${leadData.id || Date.now()}`, dispatchResults, {
      tags: ['communication', 'brief', 'dispatch', leadData.email || ''],
    });

    return dispatchResults;
  }
}

export const aidaCommsAgent = new AidaCommsAgent();
