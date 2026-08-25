/**
 * RAIOC Specialist Agent: ATLAS (Real Estate & Market Intelligence)
 * Evaluates Dubai prime communities, yields, developer credibility, and investment strategies.
 * Autonomously reacts to LEAD_QUALIFIED events and emits MARKET_ANALYZED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { ikl } from '../../core/ikl/index.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class AtlasMarketAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'atlas',
      name: 'ATLAS',
      role: 'Real Estate & Market Intelligence Specialist',
      capabilities: ['market_analysis', 'community_benchmarking', 'developer_audit', 'ikl_query', 'investment_strategy'],
      systemPrompt: 'You specialize in Dubai prime real estate analytics, off-plan vs secondary market yields, and statutory IKL intelligence.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.LEAD_QUALIFIED, async (event) => {
      try {
        const payload = event.payload;
        logger.info('ATLAS', `Autonomous reaction to LEAD_QUALIFIED for ${payload.lead?.company_name || 'prospect'}`);

        const result = await this.executeTask({
          communityId: payload.communityId || 'comm_palm_jumeirah',
          developerId: payload.developerId || 'dev_nakheel',
          budgetAed: payload.propertyPriceAed || 5000000,
          persona: { risk_tolerance: 'BALANCED', target_yield_pct: 7.5 },
        }, { correlationId: event.metadata.correlationId });

        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.MARKET_ANALYZED, {
            lead: payload.lead,
            evaluation: payload.evaluation,
            marketIntelligence: result.output,
            propertyPriceAed: payload.propertyPriceAed || 5000000,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('ATLAS', `Autonomous market analysis failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { communityId, developerId, budgetAed } = task;

    let communityData = null;
    if (communityId) {
      communityData = ikl.getCommunity(communityId);
    }

    let developerData = null;
    if (developerId) {
      developerData = ikl.getDeveloper(developerId);
    }

    const community = communityData || ikl.getCommunities()[0];
    const developer = developerData || ikl.getDevelopers()[0];

    let recommendation = null;
    if (task.persona) {
      recommendation = ikl.recommend(task.persona);
    }

    const marketIntelligence = {
      community,
      developer,
      recommendation,
      iklVersion: ikl.getVersion(),
      evaluatedAt: new Date().toISOString(),
    };

    const avgYield = community.avgGrossYield || 7.0;
    this.logDecision(
      `Computed market recommendation for budget AED ${budgetAed || '2M+'}: Selected prime community ${community.name} with target gross yield ${avgYield}%`,
      'RECOMMEND_PRIME_ASSET_ALLOCATION',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.96,
        impactLevel: 'HIGH',
        metadata: { community: community.id },
      }
    );

    this.storeMemory(`market_intelligence_${communityId || 'general'}`, marketIntelligence, {
      tags: ['market', 'community', 'yield', 'dubai'],
    });

    return marketIntelligence;
  }
}

export const atlasMarketAgent = new AtlasMarketAgent();
