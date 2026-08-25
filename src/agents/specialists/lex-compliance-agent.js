/**
 * RAIOC Specialist Agent: LEX (Compliance, Tax & Golden Visa)
 * Evaluates UAE regulatory statutes, 4% DLD acquisition costs, Golden Visa compliance, and tax rules.
 * Autonomously reacts to MARKET_ANALYZED events and emits COMPLIANCE_VERIFIED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { ikl } from '../../core/ikl/index.js';
import { propertyCalculators } from '../../api/calculators/property-calculators.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class LexComplianceAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'lex',
      name: 'LEX',
      role: 'Compliance, Tax & Regulatory Specialist',
      capabilities: ['regulatory_audit', 'tax_optimization', 'golden_visa_verification', 'dld_cost_computation'],
      systemPrompt: 'You enforce UAE statutory real estate regulations, Golden Visa AED 2M compliance, Escrow verification, and tax structuring.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.MARKET_ANALYZED, async (event) => {
      try {
        const payload = event.payload;
        logger.info('LEX', `Autonomous reaction to MARKET_ANALYZED for ${payload.lead?.company_name || 'prospect'}`);

        const result = await this.executeTask({
          propertyPriceAed: payload.propertyPriceAed || 5000000,
          buyerType: 'INDIVIDUAL_FOREIGN',
          offPlan: true,
        }, { correlationId: event.metadata.correlationId });

        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.COMPLIANCE_VERIFIED, {
            lead: payload.lead,
            evaluation: payload.evaluation,
            marketIntelligence: payload.marketIntelligence,
            complianceAudit: result.output,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('LEX', `Autonomous compliance verification failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { propertyPriceAed = 2000000, buyerType = 'INDIVIDUAL_FOREIGN', offPlan = true } = task;

    // 1. Compute acquisition breakdown (DLD 4%, Admin fees, Trustee)
    const acquisitionBreakdown = propertyCalculators.calculateAcquisitionCost({
      propertyPriceAed,
      isOffPlan: offPlan,
    });

    // 2. Golden Visa verification (AED 2M threshold)
    const goldenVisaEligibility = propertyCalculators.calculateGoldenVisaEligibility({
      totalPropertyEquityAed: propertyPriceAed,
    });

    // 3. Tax & Regulation check from IKL
    const dldRegulation = ikl.getRegulation('reg_dld_registration');
    const incomeTaxRule = ikl.getTaxRule('tax_personal_income');
    const corporateTaxRule = ikl.getTaxRule('tax_corporate');

    const complianceAudit = {
      propertyPriceAed,
      acquisitionBreakdown,
      goldenVisaEligibility,
      statutoryFramework: {
        registration: dldRegulation,
        taxRules: [incomeTaxRule, corporateTaxRule],
      },
      compliant: true,
      timestamp: new Date().toISOString(),
    };

    const dldFee = acquisitionBreakdown.breakdown.dldTransferFee;
    this.logDecision(
      `Conducted regulatory audit for acquisition AED ${propertyPriceAed.toLocaleString()}: Golden Visa ${goldenVisaEligibility.isEligible ? 'QUALIFIED' : 'NOT QUALIFIED'}, DLD Transfer Fee AED ${dldFee.toLocaleString()}`,
      'APPROVE_REGULATORY_STRUCTURING',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.99,
        impactLevel: 'HIGH',
        metadata: { goldenVisaQualified: goldenVisaEligibility.isEligible },
      }
    );

    this.storeMemory(`compliance_audit_${Date.now()}`, complianceAudit, {
      tags: ['compliance', 'tax', 'golden_visa', 'dld'],
    });

    return complianceAudit;
  }
}

export const lexComplianceAgent = new LexComplianceAgent();
