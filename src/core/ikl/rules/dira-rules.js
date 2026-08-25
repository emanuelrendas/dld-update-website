/**
 * RAIOC IKL - DIRA (Deep Intelligence Risk Analysis) Rule Definitions
 * Encapsulates all risk vectors, trigger conditions, severity weights, and mitigation playbooks.
 */

import { AuthorityLevel } from '../provenance/provenance-engine.js';

export const diraRules = {
  severityLevels: [
    { level: 'CRITICAL', minScore: 50 },
    { level: 'HIGH', minScore: 30 },
    { level: 'MODERATE', minScore: 15 },
    { level: 'LOW', minScore: 0 },
  ],
  readinessThresholds: [
    { grade: 'A+', minRiis: 75 },
    { grade: 'B', minRiis: 50 },
    { grade: 'C', minRiis: 0 },
  ],
  riskVectors: [
    {
      id: 'vector_data_architecture',
      name: 'Data Architecture Risk',
      field: 'data_stack',
      triggerKeywords: ['spreadsheets', 'legacy', 'none', 'csv'],
      negativeKeywords: ['cloud', 'modern', 'postgres', 'supabase', 'snowflake', 'bigquery'],
      failSeverity: 'HIGH',
      failPoints: 30,
      failVectorName: 'Data Silo & Fragmentation',
      failRecommendation: 'Deploy automated Supabase ingestion pipeline and centralized ETL normalization.',
      passSeverity: 'LOW',
      passPoints: 0,
      passVectorName: 'Modern Cloud Architecture',
      passRecommendation: 'Directly hook into existing cloud event bus.',
    },
    {
      id: 'vector_manual_latency',
      name: 'Process Latency & Manual Overhead',
      field: 'manual_hours',
      triggerKeywords: ['high', '40+', 'critical', 'manual', 'slow'],
      failSeverity: 'CRITICAL',
      failPoints: 25,
      failVectorName: 'Manual Process Bottleneck',
      failRecommendation: 'Automate high-frequency decision loops via RAIOC autonomous agents.',
    },
    {
      id: 'vector_regulatory_governance',
      name: 'Security & Governance Compliance',
      field: 'compliance',
      triggerKeywords: ['fintech', 'healthcare', 'banking', 'regulated', 'rera'],
      failSeverity: 'MODERATE',
      failPoints: 20,
      failVectorName: 'Regulatory & Data Governance',
      failRecommendation: 'Enforce end-to-end telemetry and immutable audit logging on every cycle.',
    },
  ],
  provenance: {
    source: 'RAIOC DIRA Risk Matrix Specification v1.0',
    citation: 'Deep Intelligence Risk Analysis Framework 2026',
    authorityWeight: AuthorityLevel.STATUTORY,
    lastVerified: '2026-08-01T00:00:00.000Z',
  },
};
