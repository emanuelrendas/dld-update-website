/**
 * RAIOC IKL - Confidence Scoring Engine
 * Computes deterministic confidence metrics based on provenance authority, freshness decay, and evidence completeness.
 */

export const ConfidenceTier = {
  VERY_HIGH: 'VERY_HIGH', // >= 0.90
  HIGH: 'HIGH',           // >= 0.75
  MODERATE: 'MODERATE',   // >= 0.60
  PROVISIONAL: 'PROVISIONAL', // < 0.60
};

export class ConfidenceEngine {
  /**
   * Calculates confidence score for an entity or query result
   * @param {Object} provenance - Provenance entry
   * @param {Object} context - Evidence completeness context (e.g. number of matched parameters)
   * @returns {Object} Confidence evaluation
   */
  calculateConfidence(provenance = {}, context = {}) {
    const authorityWeight = provenance.authorityWeight ?? 0.85;

    // Freshness factor (1.0 for fresh within 30 days, decays gradually down to min 0.80)
    let freshnessFactor = 1.0;
    if (provenance.lastVerified) {
      const daysOld = (Date.now() - new Date(provenance.lastVerified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 180) {
        freshnessFactor = 0.85;
      } else if (daysOld > 90) {
        freshnessFactor = 0.92;
      } else if (daysOld > 30) {
        freshnessFactor = 0.97;
      }
    }

    // Evidence coverage (ratio of provided required fields vs total)
    const matchedCount = context.matchedCount ?? 1;
    const expectedCount = context.expectedCount ?? 1;
    const evidenceCoverage = Math.min(1.0, Math.max(0.5, matchedCount / Math.max(1, expectedCount)));

    // Composite calculation: 60% Authority + 25% Evidence Coverage + 15% Freshness
    const rawScore = (authorityWeight * 0.60) + (evidenceCoverage * 0.25) + (freshnessFactor * 0.15);
    const score = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(3));

    let tier = ConfidenceTier.MODERATE;
    if (score >= 0.90) {
      tier = ConfidenceTier.VERY_HIGH;
    } else if (score >= 0.75) {
      tier = ConfidenceTier.HIGH;
    } else if (score >= 0.60) {
      tier = ConfidenceTier.MODERATE;
    } else {
      tier = ConfidenceTier.PROVISIONAL;
    }

    return {
      score,
      tier,
      factors: {
        authorityWeight,
        freshnessFactor,
        evidenceCoverage,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const confidenceEngine = new ConfidenceEngine();
