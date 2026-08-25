/**
 * RAIOC Specialist Agent: MARK (Lead Triage & Risk Intelligence)
 * Evaluates inbound investor profiles using DIRA risk matrices and RIIS scoring.
 * Autonomously reacts to LEAD_INGESTED events and emits LEAD_QUALIFIED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class MarkTriageAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'mark',
      name: 'MARK',
      role: 'Lead Triage & Risk Intelligence Specialist',
      capabilities: ['lead_triage', 'dira_risk_analysis', 'riis_scoring', 'investor_qualification'],
      systemPrompt: 'You analyze prospect readiness, evaluate risk vectors across operational readiness, regulatory compliance, and calculate deterministic RIIS scores.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.LEAD_INGESTED, async (event) => {
      try {
        const lead = event.payload.lead || event.payload;
        logger.info('MARK', `Autonomous reaction to LEAD_INGESTED for ${lead.company_name || lead.email}`);
        
        const result = await this.executeTask({ leadData: lead }, { correlationId: event.metadata.correlationId });
        
        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.LEAD_QUALIFIED, {
            lead,
            evaluation: result.output,
            riisScore: result.output.riis?.score || 50,
            diraRiskLevel: result.output.dira?.riskLevel || 'LOW',
            communityId: lead.communityId || event.payload.communityId || 'comm_palm_jumeirah',
            propertyPriceAed: lead.propertyPriceAed || event.payload.propertyPriceAed || 5000000,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('MARK', `Autonomous triage handler failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { leadData } = task;
    if (!leadData) {
      throw new Error('MARK task failed: Missing leadData in payload');
    }

    const evaluation = diraRiisEngine.analyze(leadData);
    const riisScore = evaluation.riis?.score || 50;
    const riskLevel = evaluation.dira?.riskLevel || 'LOW';

    this.logDecision(
      `Evaluated prospect ${leadData.company_name || leadData.email || 'lead'}: RIIS score ${riisScore}, Risk Tier: ${riskLevel}`,
      riisScore >= 70 ? 'QUALIFY_HIGH_PRIORITY_LEAD' : 'QUALIFY_STANDARD_LEAD',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.98,
        impactLevel: riisScore >= 80 ? 'HIGH' : 'MEDIUM',
        metadata: { riisScore, riskLevel },
      }
    );

    this.storeMemory(
      `lead_evaluation_${leadData.id || leadData.email || Date.now()}`,
      evaluation,
      { tags: ['lead', 'riis', 'dira', leadData.company_name || ''] }
    );

    return evaluation;
  }
}

export const markTriageAgent = new MarkTriageAgent();
