/**
 * RAIOC Agents - Shared Tool Registry
 * Exposes standardized, callable tools across SMTP Email, Calendar, WhatsApp, CRM, IKL, and Supabase.
 */

import { emailAdapter } from '../adapters/email-adapter.js';
import { gmailClient } from '../integrations/google/gmail-client.js';
import { googleCalendarClient } from '../integrations/google/calendar-client.js';
import { whatsAppBusinessClient } from '../integrations/whatsapp/whatsapp-business-client.js';
import { crmSyncClient } from '../integrations/crm/crm-sync-client.js';
import { ikl } from '../core/ikl/index.js';
import { diraRiisEngine } from '../engines/dira-riis-engine.js';
import { run_cycle } from '../core/run-cycle.js';
import { logger } from '../logging/audit-logger.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerCoreTools();
  }

  registerTool(name, toolDefinition) {
    this.tools.set(name, {
      name,
      description: toolDefinition.description || '',
      parametersSchema: toolDefinition.parametersSchema || {},
      execute: toolDefinition.execute,
    });
    logger.info('TOOL_REGISTRY', `Registered agent tool: ${name}`);
  }

  getTool(name) {
    return this.tools.get(name) || null;
  }

  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parametersSchema: t.parametersSchema,
    }));
  }

  _registerCoreTools() {
    // 1. SMTP Email Tool (Namecheap PrivateEmail & Nodemailer)
    this.registerTool('send_email_brief', {
      description: 'Sends an Executive Brief or email notification via SMTP (Namecheap PrivateEmail / Nodemailer)',
      parametersSchema: { to: 'string', subject: 'string', body: 'string', isHtml: 'boolean?' },
      execute: async (params) => {
        return await emailAdapter.dispatch({
          recipient: params.to,
          payload: {
            subject: params.subject,
            body: params.body,
            html: params.html || (params.isHtml ? params.body : undefined),
          },
        });
      },
    });

    // 2. Google Calendar Tool
    this.registerTool('schedule_calendar_advisory', {
      description: 'Schedules a private real estate advisory session on Google Calendar',
      parametersSchema: { attendeeEmail: 'string', summary: 'string?', startIso: 'string?' },
      execute: async (params) => await googleCalendarClient.createEvent(params),
    });

    // 3. WhatsApp Cloud Tool
    this.registerTool('send_whatsapp_message', {
      description: 'Sends a formatted WhatsApp message or template via Meta Cloud API',
      parametersSchema: { to: 'string', message: 'string?', templateName: 'string?' },
      execute: async (params) => {
        if (params.templateName) return await whatsAppBusinessClient.sendTemplateMessage(params);
        return await whatsAppBusinessClient.sendTextMessage(params);
      },
    });

    // 4. CRM Lead Sync Tool
    this.registerTool('sync_crm_lead', {
      description: 'Synchronizes a qualified lead, RIIS score, and deal to HubSpot CRM',
      parametersSchema: { email: 'string', companyName: 'string', riisScore: 'number' },
      execute: async (params) => await crmSyncClient.syncLead(params),
    });

    // 5. IKL Knowledge Query Tool
    this.registerTool('query_ikl_knowledge', {
      description: 'Queries statutory regulations, tax rates, developers, and community yields from IKL',
      parametersSchema: { domain: 'string', queryId: 'string?' },
      execute: async (params) => {
        const { domain, queryId } = params;
        if (domain === 'communities' || domain === 'community') {
          return queryId ? (ikl.getCommunity(queryId) || ikl.getCommunities()) : ikl.getCommunities();
        }
        if (domain === 'developers' || domain === 'developer') {
          return queryId ? (ikl.getDeveloper(queryId) || ikl.getDevelopers()) : ikl.getDevelopers();
        }
        if (domain === 'regulations' || domain === 'regulation') {
          return queryId ? (ikl.getRegulation(queryId) || ikl.getRegulations()) : ikl.getRegulations();
        }
        if (domain === 'taxes' || domain === 'tax') {
          return queryId ? (ikl.getTaxRule(queryId) || ikl.getTaxRules()) : ikl.getTaxRules();
        }
        return { version: ikl.getVersion() };
      },
    });

    // 6. DIRA/RIIS Evaluation Tool
    this.registerTool('evaluate_dira_riis', {
      description: 'Executes DIRA evaluation and RIIS scoring for an investor profile',
      parametersSchema: { lead: 'object' },
      execute: async (params) => diraRiisEngine.analyze(params.lead),
    });

    // 7. Core Run Cycle Pipeline Execution Tool
    this.registerTool('run_cycle_pipeline', {
      description: 'Executes the core autonomous batch run_cycle across Supabase pending leads',
      parametersSchema: { limit: 'number?' },
      execute: async (params) => await run_cycle({ limit: params?.limit || 50 }),
    });
  }
}

export const toolRegistry = new ToolRegistry();
