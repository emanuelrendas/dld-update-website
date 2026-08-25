/**
 * RAIOC OS - DIRA & RIIS Intelligence Engine
 * DIRA: Deep Intelligence Risk Analysis
 * RIIS: Rendas Intelligence Index System
 * 
 * Refactored to retrieve ALL business intelligence, rules, weights, and vectors
 * exclusively from the Institutional Knowledge Layer (IKL v1.0).
 */

import { ikl } from '../core/ikl/index.js';

export class DiraRiisEngine {
  constructor(options = {}) {
    this.ikl = options.ikl || ikl;
  }

  /**
   * Computes the RIIS (Rendas Intelligence Index Score) using IKL rules
   * @param {Object} input - Assessment or lead answers
   * @returns {Object} RIIS computation result
   */
  evaluateRiis(input = {}) {
    const rules = this.ikl.getRiisRules();
    let score = rules.baseScore;
    const factors = [];

    // Factor 1: Company Size / Revenue Scale
    const companySize = (input.company_size || input.employees || '').toString().toLowerCase();
    for (const item of rules.factors.companySize) {
      if (item.keywords.some((kw) => companySize.includes(kw))) {
        score += item.weight;
        factors.push({ name: item.factorName, impact: item.impact });
        break;
      }
    }

    // Factor 2: AI & Automation Maturity
    const maturity = (input.ai_maturity || input.automation_level || '').toString().toLowerCase();
    for (const item of rules.factors.aiMaturity) {
      if (item.keywords.some((kw) => maturity.includes(kw))) {
        score += item.weight;
        factors.push({ name: item.factorName, impact: item.impact });
        break;
      }
    }

    // Factor 3: Operational Bottlenecks / Complexity
    const bottlenecks = (input.bottlenecks || input.challenges || '').toString().toLowerCase();
    for (const item of rules.factors.operationalBottlenecks) {
      if (item.keywords.some((kw) => bottlenecks.includes(kw))) {
        score += item.weight;
        factors.push({ name: item.factorName, impact: item.impact });
        break;
      }
    }

    // Factor 4: Budget / Timeline Urgency
    const timeline = (input.timeline || input.urgency || '').toString().toLowerCase();
    for (const item of rules.factors.timelineUrgency) {
      if (item.keywords.some((kw) => timeline.includes(kw))) {
        score += item.weight;
        factors.push({ name: item.factorName, impact: item.impact });
        break;
      }
    }

    // Clamp score to bounds
    const finalScore = Math.min(rules.maxScore, Math.max(rules.minScore, score));

    // Determine tier threshold from IKL
    const matchedTier = rules.tierThresholds.find((t) => finalScore >= t.minScore) || rules.tierThresholds[rules.tierThresholds.length - 1];

    const confidence = this.ikl.getConfidence('rules_riis', {
      matchedCount: factors.length,
      expectedCount: 4,
    });

    return {
      score: finalScore,
      tier: matchedTier.tier,
      tierLabel: matchedTier.tierLabel,
      factors,
      confidence,
      iklVersion: this.ikl.getVersion(),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Computes DIRA (Deep Intelligence Risk Analysis) using IKL risk vectors
   * @param {Object} input - Lead data & assessment details
   * @param {Object} riis - Computed RIIS score
   * @returns {Object} DIRA Risk evaluation
   */
  evaluateDira(input = {}, riis = {}) {
    const rules = this.ikl.getDiraRules();
    const riskVectors = [];
    let riskPoints = 0;

    for (const vec of rules.riskVectors) {
      const val = (input[vec.field] || input.tech_stack || input.operational_overhead || input.industry || '').toString().toLowerCase();

      let isTriggered = false;
      if (vec.triggerKeywords && vec.triggerKeywords.some((kw) => val.includes(kw))) {
        isTriggered = true;
      } else if (!val && vec.failSeverity === 'HIGH') {
        // Missing data stack triggers data silo risk
        isTriggered = true;
      }

      if (isTriggered) {
        riskPoints += vec.failPoints;
        riskVectors.push({
          vector: vec.failVectorName,
          severity: vec.failSeverity,
          recommendation: vec.failRecommendation,
        });
      } else if (vec.passVectorName) {
        riskVectors.push({
          vector: vec.passVectorName,
          severity: vec.passSeverity,
          recommendation: vec.passRecommendation,
        });
      }
    }

    // Determine risk level from IKL thresholds
    const matchedSeverity = rules.severityLevels.find((s) => riskPoints >= s.minScore) || { level: 'LOW' };

    // Determine readiness grade
    const currentScore = riis.score ?? 50;
    const matchedGrade = rules.readinessThresholds.find((r) => currentScore >= r.minRiis) || { grade: 'C' };

    const confidence = this.ikl.getConfidence('rules_dira', {
      matchedCount: riskVectors.length,
      expectedCount: rules.riskVectors.length,
    });

    return {
      riskScore: riskPoints,
      riskLevel: matchedSeverity.level,
      riskVectors,
      readinessGrade: matchedGrade.grade,
      confidence,
      iklVersion: this.ikl.getVersion(),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Full comprehensive analysis combining RIIS, DIRA, Persona Matching, and Strategy Selection
   */
  analyze(leadOrAssessment = {}) {
    const riis = this.evaluateRiis(leadOrAssessment);
    const dira = this.evaluateDira(leadOrAssessment, riis);

    const personaMatch = this.ikl.matchPersona(leadOrAssessment, riis.score);
    const strategyMatch = this.ikl.recommendStrategy(personaMatch.persona, dira.riskLevel);

    return {
      riis,
      dira,
      persona: personaMatch.persona,
      strategy: strategyMatch.strategy,
      compositeScore: Math.round((riis.score + (100 - dira.riskScore)) / 2),
      recommendedTrack: strategyMatch.strategy.code,
      confidence: strategyMatch.confidence,
      iklVersion: this.ikl.getVersion(),
      analyzedAt: new Date().toISOString(),
    };
  }
}

export const diraRiisEngine = new DiraRiisEngine();
