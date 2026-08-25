/**
 * RAIOC Institutional Knowledge Layer (IKL v1.0)
 * Foundation Module
 */

export { ikl, IKLQueryInterface } from './query-interface.js';
export { versionManager, VersionManager, IKL_CURRENT_VERSION } from './versioning/version-manager.js';
export { provenanceEngine, ProvenanceEngine, AuthorityLevel } from './provenance/provenance-engine.js';
export { confidenceEngine, ConfidenceEngine, ConfidenceTier } from './confidence/confidence-engine.js';
export { recommendationEngine, RecommendationEngine } from './recommendation/recommendation-engine.js';
export { communitiesData } from './communities/communities-data.js';
export { developersData } from './developers/developers-data.js';
export { regulationsData } from './regulations/regulations-data.js';
export { taxData } from './tax/tax-data.js';
export { personasData } from './investor-personas/personas-data.js';
export { strategiesData } from './investment-strategies/strategies-data.js';
export { riisRules } from './rules/riis-rules.js';
export { diraRules } from './rules/dira-rules.js';
