/**
 * RAIOC Business Intelligence Event Bus (JOS v1.0)
 * Enhances the Agent Event Bus with business domain categorization and real-time KPI metrics.
 */

import { agentEventBus } from './agent-event-bus.js';
import { kpiCollector } from '../operational/kpi-collector.js';
import { logger } from '../logging/audit-logger.js';

export const BusinessDomains = {
  LEAD: 'Lead',
  MEETING: 'Meeting',
  INVESTOR: 'Investor',
  COMMUNICATION: 'Communication',
  KNOWLEDGE: 'Knowledge',
  MARKET: 'Market',
  COMPLIANCE: 'Compliance',
  CALENDAR: 'Calendar',
  CRM: 'CRM',
  WEBSITE: 'Website',
  MARKETING: 'Marketing',
  RESEARCH: 'Research',
  REVENUE: 'Revenue',
};

export class BusinessIntelligenceBus {
  constructor() {
    this.bus = agentEventBus;
    this.domainEventCounts = new Map();
    for (const d of Object.values(BusinessDomains)) {
      this.domainEventCounts.set(d, 0);
    }
    this.pipelineRevenueAed = 0;
    this._attachDomainClassifier();
  }

  _attachDomainClassifier() {
    this.bus.subscribe('*', (event) => {
      const domain = this.classifyDomain(event.topic);
      const count = (this.domainEventCounts.get(domain) || 0) + 1;
      this.domainEventCounts.set(domain, count);

      // Track revenue events
      if (event.payload?.propertyPriceAed) {
        this.pipelineRevenueAed += Math.round(event.payload.propertyPriceAed * 0.02);
      } else if (event.payload?.lead?.propertyPriceAed) {
        this.pipelineRevenueAed += Math.round(event.payload.lead.propertyPriceAed * 0.02);
      }
    });
  }

  classifyDomain(topic) {
    const t = (topic || '').toLowerCase();
    if (t.includes('lead')) return BusinessDomains.LEAD;
    if (t.includes('meeting') || t.includes('consultation')) return BusinessDomains.MEETING;
    if (t.includes('investor') || t.includes('buyer')) return BusinessDomains.INVESTOR;
    if (t.includes('brief') || t.includes('message') || t.includes('email') || t.includes('whatsapp')) return BusinessDomains.COMMUNICATION;
    if (t.includes('knowledge') || t.includes('memory') || t.includes('ikl')) return BusinessDomains.KNOWLEDGE;
    if (t.includes('market') || t.includes('community') || t.includes('yield') || t.includes('arbitrage')) return BusinessDomains.MARKET;
    if (t.includes('compliance') || t.includes('tax') || t.includes('visa') || t.includes('dld')) return BusinessDomains.COMPLIANCE;
    if (t.includes('calendar')) return BusinessDomains.CALENDAR;
    if (t.includes('crm') || t.includes('hubspot') || t.includes('deal')) return BusinessDomains.CRM;
    if (t.includes('website') || t.includes('page') || t.includes('assessment')) return BusinessDomains.WEBSITE;
    if (t.includes('marketing') || t.includes('outreach')) return BusinessDomains.MARKETING;
    if (t.includes('research') || t.includes('developer')) return BusinessDomains.RESEARCH;
    if (t.includes('revenue') || t.includes('cycle') || t.includes('commission')) return BusinessDomains.REVENUE;
    return BusinessDomains.REVENUE;
  }

  publish(topic, payload = {}, metadata = {}) {
    return this.bus.publish(topic, payload, metadata);
  }

  subscribe(topic, handler) {
    return this.bus.subscribe(topic, handler);
  }

  getMetrics() {
    const counts = {};
    for (const [d, count] of this.domainEventCounts.entries()) {
      counts[d] = count;
    }
    return {
      domainCounts: counts,
      pipelineRevenueAed: this.pipelineRevenueAed,
      totalEventsClassified: Array.from(this.domainEventCounts.values()).reduce((a, b) => a + b, 0),
    };
  }

  clear() {
    for (const d of Object.values(BusinessDomains)) {
      this.domainEventCounts.set(d, 0);
    }
    this.pipelineRevenueAed = 0;
  }
}

export const businessIntelligenceBus = new BusinessIntelligenceBus();
