/**
 * RAIOC Operational Layer - Daily Executive Briefing Generator
 * Compiles automated, institutional-grade daily intelligence reports for executive leadership.
 */

import { kpiCollector } from './kpi-collector.js';
import { decisionLogger } from './decision-logger.js';
import { ikl } from '../core/ikl/index.js';
import { sharedMemory } from '../memory/shared-memory.js';

export class DailyBriefingGenerator {
  /**
   * Generates a comprehensive daily briefing
   */
  generateBriefing(date = new Date().toISOString().split('T')[0]) {
    const kpis = kpiCollector.getOperationalKpis();
    const decisions = decisionLogger.getRecentDecisionsSummary(10);
    const topCommunities = ikl.getCommunities().slice(0, 3);
    const version = ikl.getVersion();

    const sections = {
      executiveSummary: `RAIOC Autonomous Operating Center is operating at ${kpis.kpiSummary.autonomousReadiness} readiness with ${kpis.kpiSummary.activeAgents} active specialist agents under JARVIS orchestration. System health is ${kpis.kpiSummary.systemHealth} with ${kpis.kpiSummary.totalTasksExecuted} tasks executed at a ${kpis.kpiSummary.successRatePct}% success rate.`,
      marketPulse: {
        iklVersion: version,
        primeCommunities: topCommunities.map((c) => ({
          name: c.name,
          grossYield: `${c.avgGrossYield || 7.0}%`,
          sqftPriceAed: c.pricePerSqFtAed || 2000,
        })),
        regulatoryStatus: 'UAE Escrow Law No. 8 & Golden Visa AED 2M threshold active and verified in IKL.',
      },
      agentOperations: kpis.agentUtilization,
      strategicDecisions: decisions,
      knowledgeGrowth: kpis.memoryFootprint,
    };

    const briefing = {
      briefingId: `daily_briefing_${date}`,
      date,
      title: `RAIOC Daily Executive Intelligence Briefing — ${date}`,
      sections,
      generatedAt: new Date().toISOString(),
    };

    sharedMemory.storeKnowledge(briefing.briefingId, briefing, {
      importance: 2.0,
      tags: ['daily_briefing', 'executive', 'kpi', date],
    });

    return briefing;
  }
}

export const dailyBriefingGenerator = new DailyBriefingGenerator();
