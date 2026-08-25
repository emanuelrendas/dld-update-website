/**
 * RAIOC Specialist Agent: HERMES (CRM & Pipeline Management)
 * Manages HubSpot and Supabase CRM records, deal pipeline stages, and contact intelligence syncing.
 * Autonomously reacts to BRIEF_DISPATCHED events and emits CRM_SYNCED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class HermesCrmAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'hermes',
      name: 'HERMES',
      role: 'CRM & Pipeline Management Specialist',
      capabilities: ['crm_sync', 'deal_pipeline_staging', 'contact_enrichment', 'lifecycle_tracking'],
      systemPrompt: 'You synchronize contacts, deal pipelines, custom RIIS properties, and lead statuses to CRM gateways.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.BRIEF_DISPATCHED, async (event) => {
      try {
        const payload = event.payload;
        logger.info('HERMES', `Autonomous reaction to BRIEF_DISPATCHED for ${payload.lead?.company_name || 'prospect'}`);

        const result = await this.executeTask({
          leadData: payload.lead,
          riisScore: payload.evaluation?.riis?.score || 80,
          riskLevel: payload.evaluation?.dira?.riskLevel || 'LOW',
          dealValueAed: payload.complianceAudit?.propertyPriceAed || 5000000,
        }, { correlationId: event.metadata.correlationId });

        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.CRM_SYNCED, {
            lead: payload.lead,
            crmResult: result.output,
            brief: payload.brief,
            evaluation: payload.evaluation,
            marketIntelligence: payload.marketIntelligence,
            complianceAudit: payload.complianceAudit,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('HERMES', `Autonomous CRM sync failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { leadData, riisScore, riskLevel, dealValueAed } = task;
    if (!leadData) {
      throw new Error('HERMES task failed: Missing leadData');
    }

    const crmResult = await this.invokeTool('sync_crm_lead', {
      email: leadData.email,
      contactName: leadData.name || leadData.contact_name,
      companyName: leadData.company_name,
      phone: leadData.phone,
      riisScore: riisScore || leadData.riis_score || 75,
      riskLevel: riskLevel || 'MODERATE',
      dealValueAed: dealValueAed || 2000000,
    });

    this.logDecision(
      `Synchronized CRM deal for ${leadData.company_name || leadData.email}: Pipeline stage updated to qualified opportunity`,
      'UPDATE_CRM_DEAL_PIPELINE',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.99,
        impactLevel: 'MEDIUM',
        metadata: { crmStatus: crmResult.status },
      }
    );

    this.storeMemory(`crm_record_${leadData.email || Date.now()}`, crmResult, {
      tags: ['crm', 'hubspot', 'deal', leadData.company_name || ''],
    });

    return crmResult;
  }
}

export const hermesCrmAgent = new HermesCrmAgent();
