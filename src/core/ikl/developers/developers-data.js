/**
 * RAIOC IKL - Tier-1 & Master Real Estate Developers Knowledge Base
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const developersData = [
  {
    id: 'dev_emaar',
    name: 'Emaar Properties',
    tier: 'TIER_1_GOVERNMENT_BACKED',
    rating: 'AAA',
    deliveryTrackRecordPercent: 97.4,
    escrowCompliance: 'STRICT_FULL',
    averageCompletionDelayMonths: 1.2,
    flagshipProjects: ['Burj Khalifa', 'Dubai Hills Estate', 'Downtown Dubai', 'Emaar South'],
    provenance: {
      source: 'DFM Financial Disclosures & RERA Compliance Database',
      citation: 'Emaar Properties PJSC Audited Annual Disclosures 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'dev_nakheel',
    name: 'Nakheel (Dubai Holding Real Estate)',
    tier: 'TIER_1_GOVERNMENT_BACKED',
    rating: 'AAA',
    deliveryTrackRecordPercent: 95.8,
    escrowCompliance: 'STRICT_FULL',
    averageCompletionDelayMonths: 2.1,
    flagshipProjects: ['Palm Jumeirah', 'Palm Jebel Ali', 'Dubai Islands'],
    provenance: {
      source: 'Dubai Holding Master Disclosure & RERA Registry',
      citation: 'Dubai Holding Real Estate Strategic Audit 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'dev_meraas',
    name: 'Meraas',
    tier: 'TIER_1_PREMIER',
    rating: 'AA+',
    deliveryTrackRecordPercent: 96.2,
    escrowCompliance: 'STRICT_FULL',
    averageCompletionDelayMonths: 1.8,
    flagshipProjects: ['City Walk', 'Bluewaters Island', 'Port de La Mer', 'Bvlgari Residences'],
    provenance: {
      source: 'Dubai Land Department & RERA Developer Scorecard',
      citation: 'RERA Master Developer Audits 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'dev_sobha',
    name: 'Sobha Realty',
    tier: 'TIER_1_PRIVATE_BACKWARD_INTEGRATED',
    rating: 'AA+',
    deliveryTrackRecordPercent: 98.6,
    escrowCompliance: 'STRICT_FULL',
    averageCompletionDelayMonths: 0.4,
    flagshipProjects: ['Sobha Hartland', 'Sobha Hartland II', 'Sobha Siniya Island'],
    provenance: {
      source: 'Sobha Group Audits & DLD Construction Progress Monitoring',
      citation: 'DLD Project Tracking System (PTS) 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'dev_ellington',
    name: 'Ellington Properties',
    tier: 'TIER_1_BOUTIQUE_LUXURY',
    rating: 'AA',
    deliveryTrackRecordPercent: 97.8,
    escrowCompliance: 'STRICT_FULL',
    averageCompletionDelayMonths: 0.8,
    flagshipProjects: ['DT1', 'Wilton Terraces', 'Ocean House Palm Jumeirah'],
    provenance: {
      source: 'DLD PTS & RERA Escrow Audit',
      citation: 'RERA Trust Account Monitoring 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
];
