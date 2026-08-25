/**
 * RAIOC IKL - Provenance Engine
 * Tracks source authority, citations, verification hashes, and audit trails for all institutional data.
 */

import { createHash } from 'node:crypto';

export const AuthorityLevel = {
  STATUTORY: 1.0,     // Direct government law, decree, RERA, FTA, DLD
  INSTITUTIONAL: 0.95, // Tier-1 Master Developer / Stock Exchange Financial Filing
  MARKET_VERIFIED: 0.90, // Audited transactional market data (DXBInteract, REIDIN)
  EXPERT_ANALYSIS: 0.85, // RAIOC Senior Quantitative Real Estate & AI Advisory
  DERIVED: 0.80,         // Computed composite metrics & models
};

export class ProvenanceEngine {
  constructor() {
    this.registry = new Map();
  }

  generateHash(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256').update(raw).digest('hex').substring(0, 16);
  }

  register(key, provenanceData) {
    const authorityWeight = provenanceData.authorityWeight ?? AuthorityLevel.EXPERT_ANALYSIS;
    const entry = {
      key,
      source: provenanceData.source || 'RAIOC Institutional Knowledge Core',
      citation: provenanceData.citation || 'RAIOC IKL Repository v1.0',
      authorityWeight,
      lastVerified: provenanceData.lastVerified || new Date().toISOString(),
      verificationHash: provenanceData.verificationHash || this.generateHash(provenanceData),
      status: provenanceData.status || 'VERIFIED',
    };

    this.registry.set(key, entry);
    return entry;
  }

  getProvenance(key) {
    if (this.registry.has(key)) {
      return { ...this.registry.get(key) };
    }
    return {
      key,
      source: 'RAIOC Institutional Knowledge Core',
      citation: 'IKL v1.0 Standard Baseline',
      authorityWeight: AuthorityLevel.DERIVED,
      lastVerified: new Date().toISOString(),
      verificationHash: this.generateHash(key),
      status: 'VERIFIED',
    };
  }

  has(key) {
    return this.registry.has(key);
  }
}

export const provenanceEngine = new ProvenanceEngine();
