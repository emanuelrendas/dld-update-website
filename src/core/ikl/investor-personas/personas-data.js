/**
 * RAIOC IKL - Investor & Enterprise Personas Knowledge Base
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const personasData = [
  {
    id: 'persona_strategic_enterprise',
    code: 'STRATEGIC_ENTERPRISE',
    name: 'Strategic Enterprise / AI Operating Candidate',
    description: 'High-volume organizations seeking autonomous operational loops, integrated telemetry, automated risk qualification, and multi-channel instant dispatch.',
    qualificationCriteria: {
      minRiisScore: 80,
      targetCompanySizes: ['500+', '100-500', 'enterprise'],
      aiMaturityLevels: ['in_production', 'advanced'],
      timeline: ['immediate', '1_month', 'asap'],
    },
    primaryObjectives: [
      'Zero-latency automated inbound triage',
      'End-to-end telemetry and immutable audit trails',
      'Autonomous intelligence brief generation and multi-channel dispatch',
    ],
    recommendedStrategyId: 'strat_enterprise_autonomous_os',
    provenance: {
      source: 'RAIOC Quantitative Behavioral Model',
      citation: 'RAIOC Enterprise Segmentation Index 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'persona_growth_accelerator',
    code: 'GROWTH_ACCELERATOR',
    name: 'Growth Accelerator / Scalable Workflow Candidate',
    description: 'Mid-market businesses and fast-growing operators looking to modernize legacy pipelines, eliminate bottlenecks, and scale operations rapidly.',
    qualificationCriteria: {
      minRiisScore: 65,
      targetCompanySizes: ['20-99', '50-200', 'mid-market'],
      aiMaturityLevels: ['piloting', 'experimenting'],
      timeline: ['quarter', '3_months'],
    },
    primaryObjectives: [
      'Eliminate manual data entry & spreadsheet silos',
      'Accelerate lead conversion through DIRA/RIIS intelligence scoring',
      'Automated executive brief generation for internal stakeholders',
    ],
    recommendedStrategyId: 'strat_rapid_intelligence_deployment',
    provenance: {
      source: 'RAIOC Quantitative Behavioral Model',
      citation: 'RAIOC Growth Segmentation Index 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'persona_hnw_institutional',
    code: 'HIGH_NET_WORTH_INSTITUTIONAL',
    name: 'Ultra-High Net Worth / Institutional Capital Allocator',
    description: 'Institutional family offices and UHNW investors deploying AED 10M+ across prime UAE assets, seeking capital preservation, maximum net rental yields, and Golden Visa eligibility.',
    qualificationCriteria: {
      minRiisScore: 75,
      targetCompanySizes: ['family_office', 'institutional_fund', 'enterprise'],
      budgetAed: 10000000,
    },
    primaryObjectives: [
      'Prime waterfront & central business district asset acquisition',
      'Optimized 0% personal tax structure and Golden Visa residency security',
      'Autonomous institutional portfolio reporting and yield tracking',
    ],
    recommendedStrategyId: 'strat_prime_luxury_long_term_hold',
    provenance: {
      source: 'RAIOC Wealth & Institutional Research',
      citation: 'RAIOC UHNW Allocation Model 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'persona_foundational_modernization',
    code: 'FOUNDATIONAL_RELOCATOR',
    name: 'Foundational Modernization / Exploratory Candidate',
    description: 'Early-stage or traditional enterprises exploring AI integration and UAE market expansion.',
    qualificationCriteria: {
      minRiisScore: 40,
      targetCompanySizes: ['1-19', 'startup', 'advisory'],
    },
    primaryObjectives: [
      'Modern cloud data infrastructure setup',
      'Initial feasibility assessment and risk vector mapping',
    ],
    recommendedStrategyId: 'strat_foundational_cloud_modernization',
    provenance: {
      source: 'RAIOC Advisory Intelligence',
      citation: 'RAIOC Startup & Foundation Matrix 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
];
