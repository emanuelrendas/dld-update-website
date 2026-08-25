/**
 * RAIOC IKL - Recommendation Engine
 * Synthesizes institutional personas, strategies, risk mitigations, and generates tailored execution recommendations.
 */

import { personasData } from '../investor-personas/personas-data.js';
import { strategiesData } from '../investment-strategies/strategies-data.js';
import { confidenceEngine } from '../confidence/confidence-engine.js';
import { provenanceEngine } from '../provenance/provenance-engine.js';

export class RecommendationEngine {
  /**
   * Matches a lead to an Institutional Investor / Enterprise Persona
   * @param {Object} lead - Lead and assessment data
   * @param {number} riisScore - Calculated RIIS score
   * @returns {Object} Matched persona with confidence
   */
  matchPersona(lead = {}, riisScore = 50) {
    const companySize = (lead.company_size || lead.employees || '').toString().toLowerCase();

    let matched = null;
    let matchedCount = 1;

    if (riisScore >= 80 || companySize.includes('500+') || companySize.includes('enterprise')) {
      matched = personasData.find((p) => p.code === 'STRATEGIC_ENTERPRISE');
      matchedCount = 3;
    } else if (riisScore >= 65 || companySize.includes('20-99') || companySize.includes('50-200')) {
      matched = personasData.find((p) => p.code === 'GROWTH_ACCELERATOR');
      matchedCount = 2;
    } else if (companySize.includes('family_office') || companySize.includes('fund')) {
      matched = personasData.find((p) => p.code === 'HIGH_NET_WORTH_INSTITUTIONAL');
      matchedCount = 3;
    } else {
      matched = personasData.find((p) => p.code === 'FOUNDATIONAL_RELOCATOR');
      matchedCount = 1;
    }

    if (!matched) {
      matched = personasData[0];
    }

    const provenance = provenanceEngine.getProvenance(`persona_${matched.code.toLowerCase()}`);
    const confidence = confidenceEngine.calculateConfidence(provenance, {
      matchedCount,
      expectedCount: 3,
    });

    return {
      persona: { ...matched },
      confidence,
    };
  }

  /**
   * Recommends optimal strategy based on Persona and Risk Level
   * @param {Object} persona - Matched persona
   * @param {string} diraRiskLevel - DIRA risk level
   * @returns {Object} Strategy recommendation
   */
  recommendStrategy(persona = {}, diraRiskLevel = 'LOW') {
    const personaCode = persona.code || 'STRATEGIC_ENTERPRISE';

    let strategy = strategiesData.find((s) => s.targetPersonaCode === personaCode);
    if (!strategy) {
      strategy = strategiesData[0];
    }

    const provenance = provenanceEngine.getProvenance(`strat_${strategy.code.toLowerCase()}`);
    const confidence = confidenceEngine.calculateConfidence(provenance, {
      matchedCount: diraRiskLevel === 'CRITICAL' ? 2 : 3,
      expectedCount: 3,
    });

    return {
      strategy: { ...strategy },
      confidence,
    };
  }

  /**
   * Generates Action Plan based on selected strategy and risk profile
   */
  generateActionPlan(strategy = {}, diraRiskLevel = 'LOW') {
    const basePlan = strategy.actionPlan || strategiesData[0].actionPlan;
    return basePlan.map((step) => ({ ...step }));
  }
}

export const recommendationEngine = new RecommendationEngine();
