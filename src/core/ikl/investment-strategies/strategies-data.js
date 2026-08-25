/**
 * RAIOC IKL - Investment Strategies Knowledge Base
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const strategiesData = [
  {
    id: 'strat_enterprise_autonomous_os',
    code: 'ENTERPRISE_AUTONOMOUS_OS',
    name: 'Enterprise Autonomous Operating System Deployment',
    targetPersonaCode: 'STRATEGIC_ENTERPRISE',
    horizonMonths: 12,
    expectedRoiPercent: 45.0,
    riskProfile: 'LOW_OPERATIONAL_RISK',
    actionPlan: [
      {
        step: 1,
        title: 'Centralize Data Pipelines into RAIOC OS',
        description: 'Eliminate fragmented ingestion points by routing lead and operational telemetry through Supabase event queues.',
        timeframe: 'Day 1 - 3',
      },
      {
        step: 2,
        title: 'Activate DIRA/RIIS Automated Scoring',
        description: 'Deploy real-time qualification algorithms to triage inbound leads instantly with 0ms manual latency.',
        timeframe: 'Day 4 - 7',
      },
      {
        step: 3,
        title: 'Deploy Multi-Channel Autonomous Dispatch',
        description: 'Connect WhatsApp Queue Engine, CRM webhooks, and executive briefing alerts with exponential retry recovery.',
        timeframe: 'Week 2',
      },
    ],
    provenance: {
      source: 'RAIOC Systems Architecture Framework',
      citation: 'RAIOC Enterprise Automation Playbook 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'strat_rapid_intelligence_deployment',
    code: 'RAPID_INTELLIGENCE_DEPLOYMENT',
    name: 'Rapid Intelligence Deployment & Pipeline Acceleration',
    targetPersonaCode: 'GROWTH_ACCELERATOR',
    horizonMonths: 6,
    expectedRoiPercent: 32.0,
    riskProfile: 'MODERATE_RISK',
    actionPlan: [
      {
        step: 1,
        title: 'Ingest Legacy Spreadsheets & Records',
        description: 'Cleanse and normalize historical pipeline data into unified Supabase schema.',
        timeframe: 'Week 1',
      },
      {
        step: 2,
        title: 'Connect DIRA Risk Auditing & Automated Scoring',
        description: 'Flag high-risk bottlenecks and establish automated scoring thresholds.',
        timeframe: 'Week 2',
      },
      {
        step: 3,
        title: 'Launch Autonomous Executive Alerts',
        description: 'Deliver instant executive briefs to stakeholders via email and mobile channels.',
        timeframe: 'Week 3 - 4',
      },
    ],
    provenance: {
      source: 'RAIOC Systems Architecture Framework',
      citation: 'RAIOC Mid-Market Modernization Strategy 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'strat_prime_luxury_long_term_hold',
    code: 'PRIME_LUXURY_LONG_TERM_HOLD',
    name: 'Prime UAE Real Estate Long-Term Wealth Preservation',
    targetPersonaCode: 'HIGH_NET_WORTH_INSTITUTIONAL',
    horizonMonths: 60,
    expectedRoiPercent: 12.5,
    riskProfile: 'LOW_MARKET_RISK',
    actionPlan: [
      {
        step: 1,
        title: 'Prime Community Screening & Title Verification',
        description: 'Filter Tier-1 master developers (Emaar, Nakheel, Meraas) in Downtown, Palm Jumeirah, and DIFC with verified escrow compliance.',
        timeframe: 'Month 1',
      },
      {
        step: 2,
        title: 'Tax Structuring & Golden Visa Filing',
        description: 'Optimize corporate holding structure for 0% personal tax and file 10-year Golden Visa residency under Cabinet Resolution No. 65.',
        timeframe: 'Month 2',
      },
      {
        step: 3,
        title: 'Automated Portfolio Yield Monitoring',
        description: 'Deploy RAIOC continuous cycle to audit rental yields and benchmark against RERA Smart Rental Index.',
        timeframe: 'Month 3 onwards',
      },
    ],
    provenance: {
      source: 'RAIOC Institutional Wealth Research',
      citation: 'RAIOC UAE Capital Allocation Guidelines 2026',
      authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
];
