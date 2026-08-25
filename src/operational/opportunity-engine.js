/**
 * RAIOC Opportunity Engine (JOS v1.0)
 * Continuously discovers high-value investors, market yield arbitrage, Golden Visa candidates,
 * dormant leads, and developer launches, automatically generating actionable tasks.
 */

import { ikl } from '../core/ikl/index.js';
import { autonomousTaskManager } from './autonomous-task-manager.js';
import { executiveLongTermMemory, MemoryCategories } from '../memory/executive-long-term-memory.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';

export const OpportunityTypes = {
  HIGH_VALUE_INVESTOR: 'HIGH_VALUE_INVESTOR',
  DORMANT_LEAD: 'DORMANT_LEAD',
  FOLLOW_UP_OPPORTUNITY: 'FOLLOW_UP_OPPORTUNITY',
  EXPIRED_MEETING_FOLLOW_UP: 'EXPIRED_MEETING_FOLLOW_UP',
  MARKET_YIELD_ARBITRAGE: 'MARKET_YIELD_ARBITRAGE',
  GOLDEN_VISA_CANDIDATE: 'GOLDEN_VISA_CANDIDATE',
  DEVELOPER_LAUNCH: 'DEVELOPER_LAUNCH',
  PORTFOLIO_DIVERSIFICATION: 'PORTFOLIO_DIVERSIFICATION',
};

export class OpportunityEngine {
  constructor() {
    this.opportunities = [];
    this.opportunityCounter = 0;
  }

  /**
   * Scans lead profiles, community benchmarks, and pipeline states to discover opportunities
   */
  scanOpportunities({ leads = [], marketContext = {} } = {}) {
    const discovered = [];

    // 1. Scan Leads for High-Value Investors & Golden Visa Candidates
    for (const lead of leads) {
      const price = lead.propertyPriceAed || lead.budgetAed || 0;

      if (price >= 10000000) {
        discovered.push(this._createOpportunity({
          type: OpportunityTypes.HIGH_VALUE_INVESTOR,
          title: `Ultra-HNWI Investor Detected: ${lead.company_name || lead.contact_name || lead.email} (AED ${price.toLocaleString()})`,
          targetEntity: lead,
          estimatedValueAed: price * 0.02,
          assignedAgent: 'mark',
          priority: 'CRITICAL',
          rationale: 'High capital allocation warrants priority advisory treatment and direct bespoke executive brief generation.',
        }));
      }

      if (price >= 2000000 && lead.buyerType !== 'UAE_NATIONAL') {
        discovered.push(this._createOpportunity({
          type: OpportunityTypes.GOLDEN_VISA_CANDIDATE,
          title: `Golden Visa 10-Year Residency Candidate: ${lead.company_name || lead.email}`,
          targetEntity: lead,
          estimatedValueAed: price * 0.02,
          assignedAgent: 'lex',
          priority: 'HIGH',
          rationale: 'Investment value AED 2M+ qualifies investor for UAE 10-Year Golden Visa residency status.',
        }));
      }

      if (lead.isDormant || lead.daysSinceLastContact >= 14) {
        discovered.push(this._createOpportunity({
          type: OpportunityTypes.DORMANT_LEAD,
          title: `Dormant Lead Re-engagement Opportunity: ${lead.company_name || lead.email}`,
          targetEntity: lead,
          estimatedValueAed: 40000,
          assignedAgent: 'aida',
          priority: 'MEDIUM',
          rationale: '14+ days of inactivity detected. Automated re-engagement with new market yield update recommended.',
        }));
      }
    }

    // 2. Scan IKL for Prime Market Yield Arbitrage & Developer Launches
    const communities = ikl.getCommunities();
    for (const comm of communities) {
      if (comm.avgGrossYield >= 7.5) {
        discovered.push(this._createOpportunity({
          type: OpportunityTypes.MARKET_YIELD_ARBITRAGE,
          title: `High-Yield Prime Community Arbitrage: ${comm.name} (${comm.avgGrossYield}% Yield)`,
          targetEntity: comm,
          estimatedValueAed: 150000,
          assignedAgent: 'atlas',
          priority: 'HIGH',
          rationale: `Substantial gross yield spread identified in ${comm.name}. Ideal for capital growth & yield investors.`,
        }));
      }
    }

    const developers = ikl.getDevelopers();
    for (const dev of developers) {
      if (dev.tier === 'TIER_1' && dev.activeProjects?.length) {
        discovered.push(this._createOpportunity({
          type: OpportunityTypes.DEVELOPER_LAUNCH,
          title: `Tier-1 Master Developer Launch: ${dev.name}`,
          targetEntity: dev,
          estimatedValueAed: 200000,
          assignedAgent: 'atlas',
          priority: 'HIGH',
          rationale: `Tier 1 developer ${dev.name} projects available with high capital appreciation potential.`,
        }));
      }
    }

    logger.info('OPPORTUNITY_ENGINE', `Opportunity scan completed: ${discovered.length} actionable opportunities identified`);
    return discovered;
  }

  _createOpportunity({ type, title, targetEntity, estimatedValueAed, assignedAgent, priority, rationale }) {
    this.opportunityCounter++;
    const id = `opp_${Date.now()}_${this.opportunityCounter}`;

    const opp = {
      id,
      type,
      title,
      targetEntity,
      estimatedValueAed,
      assignedAgent,
      priority,
      rationale,
      status: 'OPEN',
      discoveredAt: new Date().toISOString(),
    };

    this.opportunities.push(opp);
    if (this.opportunities.length > 200) this.opportunities.shift();

    // Store in Executive Long Term Memory
    executiveLongTermMemory.store(
      MemoryCategories.INVESTMENT_PATTERNS,
      id,
      opp,
      {
        tags: ['opportunity', type.toLowerCase(), assignedAgent],
        importance: priority === 'CRITICAL' ? 2.0 : 1.0,
        impactAed: estimatedValueAed,
      }
    );

    // Auto-generate task in AutonomousTaskManager
    autonomousTaskManager.createTask({
      ownerAgent: assignedAgent,
      objective: `Execute Opportunity: ${title}`,
      priority,
      priorityScore: priority === 'CRITICAL' ? 95 : priority === 'HIGH' ? 80 : 60,
      businessValue: estimatedValueAed,
      payload: {
        opportunityId: id,
        opportunityType: type,
        leadData: targetEntity,
        targetEntity,
      },
    });

    return opp;
  }

  getOpenOpportunities() {
    return this.opportunities.filter((o) => o.status === 'OPEN');
  }

  getAllOpportunities(limit = 50) {
    return this.opportunities.slice(-limit);
  }

  clear() {
    this.opportunities = [];
    this.opportunityCounter = 0;
  }
}

export const opportunityEngine = new OpportunityEngine();
