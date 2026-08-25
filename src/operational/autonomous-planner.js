/**
 * RAIOC Autonomous Planning Engine
 * Decomposes high-level business objectives into dependency-graphed task execution plans.
 */

import { TaskPriority } from './priority-task-dispatcher.js';
import { logger } from '../logging/audit-logger.js';

export class AutonomousPlanner {
  /**
   * Decomposes a natural language or structured objective into an executable task plan
   * @param {string} objective - High level objective description
   * @param {Object} contextData - Associated parameters
   * @returns {Object} { planId, objective, tasks: Array<TaskDefinition> }
   */
  createPlan(objective, contextData = {}) {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const objLower = (objective || '').toLowerCase();
    const tasks = [];

    logger.info('AUTONOMOUS_PLANNER', `Creating autonomous execution plan for: "${objective}"`, { planId });

    // 1. Full Investor Onboarding & Advisory Lifecycle Workflow
    if (
      objLower.includes('investor') ||
      objLower.includes('lead') ||
      objLower.includes('onboard') ||
      objLower.includes('advisory') ||
      contextData.leadData
    ) {
      const lead = contextData.leadData || {
        company_name: contextData.companyName || 'Apex Capital Partners',
        contact_name: contextData.contactName || 'Managing Partner',
        email: contextData.email || 'investor@apexcapital.ae',
        phone: contextData.phone || '+971501234567',
        company_size: contextData.companySize || '500+',
        ai_maturity: contextData.aiMaturity || 'in_production',
        timeline: contextData.timeline || 'immediate',
        tech_stack: contextData.techStack || contextData.tech_stack || 'modern_cloud_native',
        data_stack: contextData.dataStack || contextData.data_stack || 'cloud_postgres_supabase',
        cloud_provider: contextData.cloudProvider || contextData.cloud_provider || 'aws',
      };

      const propertyPriceAed = contextData.propertyPriceAed || contextData.budgetAed || 5000000;

      // Task 1: Lead Triage & Risk Matrix (MARK)
      const triageTaskId = `t_triage_${planId}`;
      tasks.push({
        id: triageTaskId,
        name: 'Lead Triage & DIRA/RIIS Risk Matrix',
        agentId: 'mark',
        priority: TaskPriority.CRITICAL,
        payload: { leadData: lead },
        dependencies: [],
      });

      // Task 2: Market Strategy & Asset Recommendation (ATLAS)
      const marketTaskId = `t_market_${planId}`;
      tasks.push({
        id: marketTaskId,
        name: 'Dubai Prime Market Yield & Asset Benchmarking',
        agentId: 'atlas',
        priority: TaskPriority.HIGH,
        payload: {
          communityId: contextData.communityId || 'comm_downtown_dubai',
          developerId: contextData.developerId || 'dev_emaar',
          budgetAed: propertyPriceAed,
          persona: { risk_tolerance: 'BALANCED', target_yield_pct: 7.5 },
        },
        dependencies: [],
      });

      // Task 3: Legal, DLD 4% & Golden Visa Compliance Audit (LEX)
      const complianceTaskId = `t_compliance_${planId}`;
      tasks.push({
        id: complianceTaskId,
        name: 'Regulatory, Tax & Golden Visa Compliance Audit',
        agentId: 'lex',
        priority: TaskPriority.HIGH,
        payload: {
          propertyPriceAed,
          buyerType: 'INDIVIDUAL_FOREIGN',
          offPlan: true,
        },
        dependencies: [],
      });

      // Task 4: Executive Brief Compilation & Omnichannel Dispatch (AIDA)
      const briefTaskId = `t_brief_${planId}`;
      tasks.push({
        id: briefTaskId,
        name: 'Executive Brief Compilation & Omnichannel Dispatch',
        agentId: 'aida',
        priority: TaskPriority.HIGH,
        payload: { leadData: lead, channel: contextData.channel || 'all' },
        dependencies: [triageTaskId, marketTaskId, complianceTaskId],
      });

      // Task 5: CRM Pipeline Sync & Deal Staging (HERMES)
      const crmTaskId = `t_crm_${planId}`;
      tasks.push({
        id: crmTaskId,
        name: 'CRM Staging & Deal Pipeline Sync',
        agentId: 'hermes',
        priority: TaskPriority.NORMAL,
        payload: { leadData: lead, dealValueAed: propertyPriceAed },
        dependencies: [briefTaskId],
      });

      // Task 6: Google Calendar Consultation Scheduling (HELIOS)
      if (contextData.scheduleMeeting !== false) {
        const calTaskId = `t_cal_${planId}`;
        tasks.push({
          id: calTaskId,
          name: 'Advisory Consultation Scheduling & Meet Link Generation',
          agentId: 'helios',
          priority: TaskPriority.NORMAL,
          payload: {
            attendeeEmail: lead.email,
            summary: `RAIOC Strategic Advisory — ${lead.company_name}`,
            durationMinutes: 45,
          },
          dependencies: [briefTaskId],
        });
      }

      // Task 7: Operational Health & Sentinel Audit (SENTINEL)
      const healthTaskId = `t_health_${planId}`;
      tasks.push({
        id: healthTaskId,
        name: 'Autonomous Health & Watchdog Verification',
        agentId: 'sentinel',
        priority: TaskPriority.BACKGROUND,
        payload: {},
        dependencies: [],
      });
    }
    // 2. Market Intelligence Query Workflow
    else if (objLower.includes('market') || objLower.includes('yield') || objLower.includes('community')) {
      tasks.push({
        id: `t_market_${planId}`,
        name: 'Market Intelligence & Community Yield Analysis',
        agentId: 'atlas',
        priority: TaskPriority.HIGH,
        payload: contextData,
        dependencies: [],
      });
    }
    // 3. Compliance & Tax Audit Workflow
    else if (objLower.includes('compliance') || objLower.includes('visa') || objLower.includes('tax') || objLower.includes('dld')) {
      tasks.push({
        id: `t_lex_${planId}`,
        name: 'Statutory Compliance & Tax Structuring Audit',
        agentId: 'lex',
        priority: TaskPriority.HIGH,
        payload: contextData,
        dependencies: [],
      });
    }
    // 4. General / Health Watchdog Workflow
    else {
      tasks.push({
        id: `t_sentinel_${planId}`,
        name: 'Operational Telemetry & Watchdog Health Check',
        agentId: 'sentinel',
        priority: TaskPriority.HIGH,
        payload: contextData,
        dependencies: [],
      });
    }

    return {
      planId,
      objective,
      createdAt: new Date().toISOString(),
      tasks,
    };
  }
}

export const autonomousPlanner = new AutonomousPlanner();
