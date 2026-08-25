/**
 * RAIOC IKL - UAE Tax & Fiscal Optimization Knowledge Base
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const taxData = [
  {
    id: 'tax_personal_income',
    category: 'Personal Income Tax',
    ratePercent: 0.0,
    scope: 'All individuals on salary, business dividends, capital gains, and investment income earned within UAE.',
    summary: '0% personal income tax and 0% capital gains tax on individual real estate and securities investments.',
    statutoryRef: 'UAE Federal Tax Authority (FTA) Regulatory Framework',
    provenance: {
      source: 'UAE Federal Tax Authority (FTA)',
      citation: 'FTA Direct Tax Guidelines 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'tax_dld_transfer_fee',
    category: 'Property Transfer Fee',
    ratePercent: 4.0,
    scope: 'One-time registration fee paid to Dubai Land Department on property purchase or title transfer.',
    summary: 'Standard 4% DLD transfer fee (commonly split 2% buyer / 2% seller or paid in full by purchaser depending on agreement) plus administrative issuance fees (AED 4,000 + 5% VAT).',
    statutoryRef: 'DLD Fee Structure Resolution',
    provenance: {
      source: 'Dubai Land Department (DLD)',
      citation: 'DLD Official Fee Schedule 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'tax_corporate_tax_freezone',
    category: 'Corporate Tax & Qualifying Free Zones',
    ratePercent: 9.0,
    qualifyingFreezoneRatePercent: 0.0,
    scope: 'Corporate income of business entities. Qualifying Free Zone Persons (QFZP) benefit from 0% on qualifying income.',
    summary: 'Federal Corporate Tax standard rate of 9% on taxable net profits exceeding AED 375,000 ($102,000 USD). 0% rate on Qualifying Income for Free Zone entities meeting substance requirements.',
    statutoryRef: 'Federal Decree-Law No. 47 of 2022 on the Taxation of Corporations and Businesses',
    provenance: {
      source: 'UAE Ministry of Finance & Federal Tax Authority',
      citation: 'MoF Corporate Tax Implementation Cabinet Decisions 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
  {
    id: 'tax_vat_real_estate',
    category: 'Value Added Tax (VAT)',
    residentialRatePercent: 0.0,
    commercialRatePercent: 5.0,
    scope: 'First sale of new residential property within 3 years of completion is zero-rated (0%). Commercial leases and sales are standard-rated (5%). Subsequent residential resales/leases are exempt.',
    summary: '0% VAT on residential properties; 5% VAT on commercial properties and professional management services.',
    statutoryRef: 'Federal Decree-Law No. 8 of 2017 on Value Added Tax',
    provenance: {
      source: 'Federal Tax Authority (FTA)',
      citation: 'FTA Real Estate VAT Guide (VATG001) 2026',
      authorityWeight: AuthorityLevel.STATUTORY,
      lastVerified: '2026-08-01T00:00:00.000Z',
    },
  },
];
