/**
 * RAIOC IKL - UAE & Dubai Real Estate Regulations Knowledge Base
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const regulationsData = [
  {
    id: 'reg_rera_escrow',
    name: 'RERA Escrow Account Law (Law No. 8 of 2007)',
    category: 'Investor Protection & Project Financing',
    summary: 'Mandates that all off-plan development payments must be deposited directly into a designated RERA-approved bank escrow account, disbursed only against audited construction milestones.',
    statutoryRef: 'Dubai Law No. 8/2007 Concerning Escrow Accounts for Real Estate Development in Dubai',
    complianceLevel: 'MANDATORY',
    investorBenefit: 'Protects buyer funds against developer default or diverted liquidity.',
    provenance: {
      source: 'Dubai Land Department / RERA Legal Portal',
      citation: 'Dubai Official Gazette, Law No. 8 of 2007',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'reg_golden_visa_property',
    name: '10-Year UAE Golden Visa via Real Estate Investment',
    category: 'Residency & Immigration',
    summary: 'Investors purchasing property valued at AED 2,000,000 ($545,000 USD) or more qualify for a renewable 10-year Golden Visa for themselves, spouse, children, and domestic staff.',
    statutoryRef: 'UAE Cabinet Resolution No. 65 of 2022 on Executive Regulations of Foreigners Entry and Residence',
    complianceLevel: 'STATUTORY_BENEFIT',
    thresholdAed: 2000000,
    investorBenefit: 'Long-term residency without local sponsor requirement and 100% foreign business ownership capability.',
    provenance: {
      source: 'Federal Authority for Identity, Citizenship, Customs and Port Security (ICP) / DLD Cube',
      citation: 'UAE Federal ICP Visa Guidelines 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'reg_foreign_freehold',
    name: 'Foreign Freehold Property Ownership (Law No. 7 of 2006)',
    category: 'Property Ownership Rights',
    summary: 'Grants non-UAE and non-GCC nationals unrestricted 100% absolute ownership rights (freehold) in designated areas across Dubai without term limitations.',
    statutoryRef: 'Dubai Law No. 7 of 2006 Concerning Real Property Registration in the Emirate of Dubai',
    complianceLevel: 'STATUTORY_RIGHT',
    investorBenefit: 'Perpetual title deed registered in the Dubai Land Department registry.',
    provenance: {
      source: 'Dubai Land Department (DLD)',
      citation: 'DLD Freehold Zone Designations Register 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'reg_rera_rental_index',
    name: 'RERA Rental Index & Rent Increase Cap (Decree No. 43 of 2013)',
    category: 'Tenancy & Yield Governance',
    summary: 'Regulates allowable annual rent increases based on property location and average market rent benchmarked in the official RERA Smart Rental Index.',
    statutoryRef: 'Dubai Decree No. 43 of 2013 Determining Rent Increases for Properties in the Emirate of Dubai',
    complianceLevel: 'MANDATORY',
    investorBenefit: 'Provides predictable yield modeling and prevents unilateral tenant or landlord rent shocks.',
    provenance: {
      source: 'Real Estate Regulatory Agency (RERA)',
      citation: 'RERA Smart Rental Index 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
];
