/**
 * RAIOC IKL - Deterministic Query Interface
 * The centralized institutional knowledge gateway consumed by DIRA, RIIS, Executive Brief, and runtime pipelines.
 */

import { versionManager } from './versioning/version-manager.js';
import { provenanceEngine } from './provenance/provenance-engine.js';
import { confidenceEngine } from './confidence/confidence-engine.js';
import { communitiesData } from './communities/communities-data.js';
import { developersData } from './developers/developers-data.js';
import { regulationsData } from './regulations/regulations-data.js';
import { taxData } from './tax/tax-data.js';
import { personasData } from './investor-personas/personas-data.js';
import { strategiesData } from './investment-strategies/strategies-data.js';
import { riisRules } from './rules/riis-rules.js';
import { diraRules } from './rules/dira-rules.js';
import { recommendationEngine } from './recommendation/recommendation-engine.js';

export class IKLQueryInterface {
  constructor() {
    this.versionManager = versionManager;
    this.provenanceEngine = provenanceEngine;
    this.confidenceEngine = confidenceEngine;
    this.recommendationEngine = recommendationEngine;

    // Register all core datasets into provenance registry
    this._initializeProvenance();
  }

  _initializeProvenance() {
    communitiesData.forEach((c) => {
      this.provenanceEngine.register(c.id, c.provenance);
      this.provenanceEngine.register(`community_${c.id}`, c.provenance);
    });
    developersData.forEach((d) => {
      this.provenanceEngine.register(d.id, d.provenance);
      this.provenanceEngine.register(`developer_${d.id}`, d.provenance);
    });
    regulationsData.forEach((r) => {
      this.provenanceEngine.register(r.id, r.provenance);
      this.provenanceEngine.register(`regulation_${r.id}`, r.provenance);
    });
    taxData.forEach((t) => {
      this.provenanceEngine.register(t.id, t.provenance);
      this.provenanceEngine.register(`tax_${t.id}`, t.provenance);
    });
    personasData.forEach((p) => {
      this.provenanceEngine.register(p.id, p.provenance);
      this.provenanceEngine.register(`persona_${p.code.toLowerCase()}`, p.provenance);
    });
    strategiesData.forEach((s) => {
      this.provenanceEngine.register(s.id, s.provenance);
      this.provenanceEngine.register(`strategy_${s.code.toLowerCase()}`, s.provenance);
    });
    this.provenanceEngine.register('rules_riis', riisRules.provenance);
    this.provenanceEngine.register('rules_dira', diraRules.provenance);
  }

  getVersion() {
    return this.versionManager.getCurrentVersion();
  }

  getVersionMetadata() {
    return this.versionManager.getVersionMetadata();
  }

  getProvenance(key) {
    return this.provenanceEngine.getProvenance(key);
  }

  getConfidence(key, context = {}) {
    const prov = this.getProvenance(key);
    return this.confidenceEngine.calculateConfidence(prov, context);
  }

  // Domain Queries
  getCommunities(filterFn = null) {
    return filterFn ? communitiesData.filter(filterFn) : [...communitiesData];
  }

  getCommunity(id) {
    return communitiesData.find((c) => c.id === id || c.name.toLowerCase() === id.toLowerCase()) || null;
  }

  getDevelopers(filterFn = null) {
    return filterFn ? developersData.filter(filterFn) : [...developersData];
  }

  getDeveloper(id) {
    return developersData.find((d) => d.id === id || d.name.toLowerCase().includes(id.toLowerCase())) || null;
  }

  getRegulations(filterFn = null) {
    return filterFn ? regulationsData.filter(filterFn) : [...regulationsData];
  }

  getRegulation(id) {
    return regulationsData.find((r) => r.id === id) || null;
  }

  getTaxRules(filterFn = null) {
    return filterFn ? taxData.filter(filterFn) : [...taxData];
  }

  getTaxRule(id) {
    return taxData.find((t) => t.id === id) || null;
  }

  getPersonas(filterFn = null) {
    return filterFn ? personasData.filter(filterFn) : [...personasData];
  }

  getPersona(code) {
    return personasData.find((p) => p.code === code || p.id === code) || null;
  }

  getStrategies(filterFn = null) {
    return filterFn ? strategiesData.filter(filterFn) : [...strategiesData];
  }

  getStrategy(code) {
    return strategiesData.find((s) => s.code === code || s.id === code) || null;
  }

  getRiisRules() {
    return { ...riisRules };
  }

  getDiraRules() {
    return { ...diraRules };
  }

  // Recommendations & Matching
  matchPersona(lead = {}, riisScore = 50) {
    return this.recommendationEngine.matchPersona(lead, riisScore);
  }

  recommendStrategy(persona = {}, diraRiskLevel = 'LOW') {
    return this.recommendationEngine.recommendStrategy(persona, diraRiskLevel);
  }

  recommend(persona = {}, diraRiskLevel = 'LOW') {
    return this.recommendStrategy(persona, diraRiskLevel);
  }

  generateActionPlan(strategy = {}, diraRiskLevel = 'LOW') {
    return this.recommendationEngine.generateActionPlan(strategy, diraRiskLevel);
  }
}

export const ikl = new IKLQueryInterface();
