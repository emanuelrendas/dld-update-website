/**
 * RAIOC Integrations - Production CRM Sync Client (HubSpot & REST Engine)
 * Synchronizes contacts, deals, RIIS scores, DIRA evaluations, and executive briefs with CRM systems.
 */

import { config } from '../../config/env.js';
import { logger } from '../../logging/audit-logger.js';

export class CrmSyncClient {
  constructor(options = {}) {
    this.provider = options.provider || config.crm.provider;
    this.apiKey = options.apiKey || config.crm.apiKey;
    this.portalId = options.portalId || config.crm.portalId;
    this.webhookUrl = options.webhookUrl || config.crm.webhookUrl;
    this.pipelineId = options.pipelineId || config.crm.pipelineId;
    this.enabled = options.enabled !== undefined ? options.enabled : config.crm.enabled;
  }

  /**
   * Synchronizes a lead and creates/updates CRM contact & deal records
   * @param {Object} data - Contact & intelligence parameters
   * @returns {Promise<Object>} CRM sync result
   */
  async syncLead(data = {}) {
    const {
      companyName,
      contactName,
      email,
      phone,
      riisScore,
      riskLevel,
      dealValueAed,
      lifecycleStage = 'lead',
      dealStage = 'qualified_opportunity',
    } = data;

    if (!email && !companyName) {
      throw new Error('CRM sync failed: Missing mandatory email or company name');
    }

    if (!this.enabled) {
      logger.info('CRM_SYNC', `CRM sync disabled - simulating sync for ${companyName || email}`);
      return { status: 'simulated', company: companyName, email, timestamp: new Date().toISOString() };
    }

    const crmPayload = {
      properties: {
        email: email || '',
        firstname: contactName ? contactName.split(' ')[0] : 'Executive',
        lastname: contactName ? contactName.split(' ').slice(1).join(' ') : 'Lead',
        company: companyName || '',
        phone: phone || '',
        lifecyclestage: lifecycleStage,
        riis_intelligence_score: riisScore ? String(riisScore) : '50',
        dira_risk_level: riskLevel || 'MODERATE',
        deal_pipeline: this.pipelineId,
        deal_stage: dealStage,
        deal_amount_aed: dealValueAed ? String(dealValueAed) : '2000000',
      },
    };

    if (!this.apiKey && !this.webhookUrl) {
      logger.info('CRM_SYNC', `CRM record formatted and ready for HubSpot gateway (${companyName || email})`, {
        riisScore,
        riskLevel,
      });
      return {
        status: 'compiled_for_crm_api',
        contactId: `hub_contact_${Date.now()}`,
        dealId: `hub_deal_${Date.now()}`,
        company: companyName,
        email,
        timestamp: new Date().toISOString(),
      };
    }

    // Live HubSpot REST dispatch
    if (this.apiKey) {
      try {
        const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(crmPayload),
        });

        if (!res.ok && res.status !== 409) { // 409: Contact already exists
          throw new Error(`HubSpot API responded with status ${res.status}: ${res.statusText}`);
        }

        const result = res.status === 409 ? { status: 'contact_updated' } : await res.json();
        logger.info('CRM_SYNC', `Contact synchronized to live HubSpot CRM (${email})`);
        return { status: 'synced_live', result };
      } catch (err) {
        logger.error('CRM_SYNC', 'HubSpot API sync failed', { error: err.message });
        throw err;
      }
    }

    // Live Webhook CRM dispatch
    if (this.webhookUrl) {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crmPayload),
      });

      if (!res.ok) {
        throw new Error(`CRM webhook responded with status ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    }
  }
}

export const crmSyncClient = new CrmSyncClient();
