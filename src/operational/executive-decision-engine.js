/**
 * RAIOC Executive Decision Engine (JOS v1.0)
 * Deterministic multi-dimensional evaluation of events, tasks, and strategic objectives.
 * Evaluates business impact, revenue impact, strategic value, risk, ROI, priorities, and assignments.
 */

import { decisionLogger } from './decision-logger.js';
import { executiveLongTermMemory, MemoryCategories } from '../memory/executive-long-term-memory.js';
import { logger } from '../logging/audit-logger.js';

export class ExecutiveDecisionEngine {
  constructor() {
    this.decisionHistory = [];
  }

  /**
   * Deterministically evaluates any event, prospect, or mandate
   */
  evaluate({ type, payload = {}, context = {} }) {
    const revenueImpactAed = this._estimateRevenueImpact(type, payload);
    const businessImpact = this._determineBusinessImpact(type, payload, revenueImpactAed);
    const strategicImpact = this._calculateStrategicImpact(type, payload);
    const riskLevel = this._assessRiskLevel(type, payload);
    const estimatedRoi = this._calculateEstimatedRoi(revenueImpactAed, riskLevel);
    const requiredSpecialist = this._determineRequiredSpecialist(type, payload);
    const dependencies = this._determineDependencies(requiredSpecialist, type);
    const urgencyHours = this._calculateUrgencyHours(businessImpact, riskLevel);
    const deadline = new Date(Date.now() + urgencyHours * 3600000).toISOString();
    const confidence = this._calculateConfidence(payload, riskLevel);
    
    // Deterministic Priority Score (0-100)
    const priorityScore = this._computePriorityScore({
      revenueImpactAed,
      businessImpact,
      strategicImpact,
      urgencyHours,
      confidence,
    });

    const nextActions = this._deriveNextActions(requiredSpecialist, type, payload);
    const decisionReason = `Evaluated ${type || 'mandate'}: Priority ${priorityScore}/100, Revenue AED ${revenueImpactAed.toLocaleString()}, Assigned to ${requiredSpecialist.toUpperCase()} (${businessImpact} Impact)`;

    const evaluation = {
      decisionId: `dec_jos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: type || 'STRATEGIC_EVALUATION',
      businessImpact,
      revenueImpactAed,
      strategicImpact,
      riskLevel,
      estimatedRoi,
      priorityScore,
      requiredSpecialist,
      dependencies,
      nextActions,
      deadline,
      confidence,
      decisionReason,
      evaluatedAt: new Date().toISOString(),
    };

    // Store permanently in DecisionLogger
    decisionLogger.logDecision({
      agentId: 'jarvis',
      objectiveId: context.correlationId || evaluation.decisionId,
      rationale: decisionReason,
      chosenAction: `ASSIGN_${requiredSpecialist.toUpperCase()}`,
      confidenceScore: confidence,
      impactLevel: businessImpact,
      metadata: evaluation,
    });

    // Store in Executive Long Term Memory
    executiveLongTermMemory.store(
      MemoryCategories.EXECUTIVE_DECISIONS,
      evaluation.decisionId,
      evaluation,
      {
        tags: [type, requiredSpecialist, businessImpact.toLowerCase()],
        importance: businessImpact === 'CRITICAL' ? 2.0 : 1.0,
        confidence,
        impactAed: revenueImpactAed,
      }
    );

    this.decisionHistory.push(evaluation);
    if (this.decisionHistory.length > 500) this.decisionHistory.shift();

    logger.info('DECISION_ENGINE', `Executive evaluation completed: ${evaluation.decisionId} -> ${evaluation.decisionReason}`);
    return evaluation;
  }

  _estimateRevenueImpact(type, payload) {
    if (payload.propertyPriceAed) {
      // 2% standard brokerage/advisory commission on real estate deals
      return Math.round(payload.propertyPriceAed * 0.02);
    }
    if (payload.budgetAed) {
      return Math.round(payload.budgetAed * 0.02);
    }
    if (payload.dealValueAed) {
      return Math.round(payload.dealValueAed * 0.02);
    }
    if (payload.lead?.propertyPriceAed) {
      return Math.round(payload.lead.propertyPriceAed * 0.02);
    }

    // Domain baseline estimates
    if (type?.includes('lead') || type?.includes('investor')) return 100000;
    if (type?.includes('meeting') || type?.includes('advisory')) return 80000;
    if (type?.includes('market') || type?.includes('opportunity')) return 150000;
    if (type?.includes('compliance') || type?.includes('golden_visa')) return 50000;
    return 25000;
  }

  _determineBusinessImpact(type, payload, revenueAed) {
    if (revenueAed >= 200000 || payload.timeline === 'immediate' || payload.priority === 'CRITICAL') {
      return 'CRITICAL';
    }
    if (revenueAed >= 80000 || payload.company_size === '500+' || payload.priority === 'HIGH') {
      return 'HIGH';
    }
    if (revenueAed >= 30000 || payload.priority === 'MEDIUM') {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  _calculateStrategicImpact(type, payload) {
    let score = 0.5;
    if (payload.ai_maturity === 'in_production' || payload.goldenVisaCandidate) score += 0.3;
    if (payload.isInstitutional || payload.isFund) score += 0.2;
    if (type?.includes('market') || type?.includes('arbitrage')) score += 0.15;
    return Math.min(1.0, Math.round(score * 100) / 100);
  }

  _assessRiskLevel(type, payload) {
    if (payload.diraRiskLevel) return payload.diraRiskLevel;
    if (payload.riskLevel) return payload.riskLevel;
    if (payload.offPlan && !payload.escrowVerified) return 'ELEVATED';
    return 'LOW';
  }

  _calculateEstimatedRoi(revenueAed, riskLevel) {
    const baseRoi = revenueAed > 100000 ? 4.5 : 2.5;
    const riskDiscount = riskLevel === 'CRITICAL' ? 0.5 : riskLevel === 'HIGH' ? 0.8 : 1.0;
    return Math.round(baseRoi * riskDiscount * 10) / 10;
  }

  _determineRequiredSpecialist(type, payload) {
    const t = (type || '').toLowerCase();
    if (t.includes('triage') || t.includes('lead') || t.includes('risk')) return 'mark';
    if (t.includes('market') || t.includes('community') || t.includes('yield') || t.includes('developer')) return 'atlas';
    if (t.includes('compliance') || t.includes('tax') || t.includes('visa') || t.includes('dld')) return 'lex';
    if (t.includes('brief') || t.includes('email') || t.includes('whatsapp') || t.includes('comm')) return 'aida';
    if (t.includes('calendar') || t.includes('meeting') || t.includes('advisory')) return 'helios';
    if (t.includes('crm') || t.includes('deal') || t.includes('pipeline') || t.includes('hubspot')) return 'hermes';
    if (t.includes('health') || t.includes('security') || t.includes('telemetry') || t.includes('watchdog')) return 'sentinel';
    return 'jarvis';
  }

  _determineDependencies(specialist, type) {
    const deps = {
      atlas: ['mark'],
      lex: ['atlas'],
      aida: ['lex'],
      hermes: ['aida'],
      helios: ['hermes'],
      sentinel: ['helios'],
    };
    return deps[specialist] || [];
  }

  _calculateUrgencyHours(businessImpact, riskLevel) {
    if (businessImpact === 'CRITICAL' || riskLevel === 'CRITICAL') return 2;
    if (businessImpact === 'HIGH') return 6;
    if (businessImpact === 'MEDIUM') return 24;
    return 48;
  }

  _calculateConfidence(payload, riskLevel) {
    let conf = 0.95;
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') conf -= 0.1;
    if (payload.tech_stack && payload.data_stack) conf += 0.04;
    return Math.min(1.0, Math.max(0.7, Math.round(conf * 100) / 100));
  }

  _computePriorityScore({ revenueImpactAed, businessImpact, strategicImpact, urgencyHours, confidence }) {
    // 1. Revenue Normalized (0-35 points)
    const revNorm = Math.min(35, (revenueImpactAed / 200000) * 35);

    // 2. Business Impact (0-25 points)
    const impactScores = { CRITICAL: 25, HIGH: 18, MEDIUM: 12, LOW: 5 };
    const impactScore = impactScores[businessImpact] || 10;

    // 3. Urgency Score (0-20 points)
    const urgencyScore = urgencyHours <= 2 ? 20 : urgencyHours <= 6 ? 15 : urgencyHours <= 24 ? 10 : 5;

    // 4. Strategic & Confidence (0-20 points)
    const stratScore = (strategicImpact * 10) + (confidence * 10);

    const total = Math.round(revNorm + impactScore + urgencyScore + stratScore);
    return Math.min(100, Math.max(1, total));
  }

  _deriveNextActions(specialist, type, payload) {
    const actionMap = {
      mark: ['Execute DIRA risk assessment', 'Calculate deterministic RIIS score', 'Qualify investor profile'],
      atlas: ['Benchmark Dubai prime yields', 'Evaluate developer track record', 'Synthesize asset allocation recommendation'],
      lex: ['Audit statutory 4% DLD fees', 'Verify Golden Visa AED 2M equity requirement', 'Validate escrow compliance'],
      aida: ['Compile bespoke Executive Brief', 'Dispatch high-touch email overview', 'Dispatch WhatsApp Cloud intelligence payload'],
      hermes: ['Synchronize lead into CRM deal pipeline', 'Stage custom RIIS properties in HubSpot', 'Track lifecycle deal status'],
      helios: ['Schedule private advisory session', 'Generate Google Meet video link', 'Reserve executive calendar slot'],
      sentinel: ['Audit multi-agent execution telemetry', 'Verify zero backlog and queue health', 'Log system availability seal'],
      jarvis: ['Govern autonomous orchestration plan', 'Synthesize executive intelligence', 'Store lessons learned in long-term memory'],
    };

    return actionMap[specialist] || ['Execute autonomous specialist task', 'Log decision', 'Propagate event downstream'];
  }

  getRecentDecisions(limit = 20) {
    return this.decisionHistory.slice(-limit);
  }
}

export const executiveDecisionEngine = new ExecutiveDecisionEngine();
