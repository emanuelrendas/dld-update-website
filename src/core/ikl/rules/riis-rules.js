/**
 * RAIOC IKL - RIIS (Rendas Intelligence Index System) Rule Definitions
 * Encapsulates all factors, scoring weights, tier thresholds, and provenance for RIIS evaluation.
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const riisRules = {
  baseScore: 50,
  maxScore: 100,
  minScore: 0,
  tierThresholds: [
    {
      tier: 'TIER_1_STRATEGIC',
      tierLabel: 'Strategic Enterprise Operating Candidate',
      minScore: 80,
      description: 'Immediate candidate for autonomous operating system deployment.',
    },
    {
      tier: 'TIER_2_ACCELERATOR',
      tierLabel: 'Growth Acceleration Candidate',
      minScore: 65,
      description: 'High-growth candidate suited for rapid intelligence deployment.',
    },
    {
      tier: 'TIER_3_FOUNDATION',
      tierLabel: 'Foundational Modernization Candidate',
      minScore: 50,
      description: 'Legacy pipeline modernization candidate.',
    },
    {
      tier: 'TIER_4_EXPLORATORY',
      tierLabel: 'Exploratory Candidate',
      minScore: 0,
      description: 'Exploratory and advisory candidate.',
    },
  ],
  factors: {
    companySize: [
      {
        keywords: ['500+', 'enterprise', '100-500'],
        weight: 20,
        factorName: 'Enterprise Scale',
        impact: '+20',
      },
      {
        keywords: ['20-99', '50-200'],
        weight: 12,
        factorName: 'Mid-Market Scale',
        impact: '+12',
      },
      {
        keywords: ['1-19', 'startup'],
        weight: 5,
        factorName: 'Startup / Lean Scale',
        impact: '+5',
      },
    ],
    aiMaturity: [
      {
        keywords: ['advanced', 'in_production'],
        weight: 15,
        factorName: 'Advanced AI Infrastructure',
        impact: '+15',
      },
      {
        keywords: ['piloting', 'experimenting'],
        weight: 10,
        factorName: 'Active AI Pilot Phase',
        impact: '+10',
      },
      {
        keywords: ['manual', 'none'],
        weight: 5,
        factorName: 'High Green-Field Potential',
        impact: '+5',
      },
    ],
    operationalBottlenecks: [
      {
        keywords: ['scale', 'data', 'latency'],
        weight: 10,
        factorName: 'High-Impact Scale Bottleneck',
        impact: '+10',
      },
    ],
    timelineUrgency: [
      {
        keywords: ['immediate', '1_month', 'asap'],
        weight: 15,
        factorName: 'Immediate Deployment Priority',
        impact: '+15',
      },
      {
        keywords: ['quarter', '3_months'],
        weight: 8,
        factorName: 'Q1 Target Priority',
        impact: '+8',
      },
    ],
  },
  provenance: {
    source: 'RAIOC RIIS Quantitative Algorithm v1.0',
    citation: 'Rendas Intelligence Index System Specification 2026',
    authorityWeight: AuthorityLevel.STATUTORY,
    lastVerified: '2026-08-01T00:00:00.000Z',
  },
};
