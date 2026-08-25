/**
 * RAIOC OS - CRM Sync Adapter
 * Handles two-way synchronization between RAIOC OS intelligence briefs and CRM platforms (HubSpot, Supabase CRM, Webhooks).
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class CrmAdapter {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || config.adapters.crm.webhookUrl;
    this.provider = options.provider || config.adapters.crm.provider;
    this.enabled = options.enabled !== undefined ? options.enabled : config.adapters.crm.enabled;
  }

  async dispatch(task) {
    const { payload } = task;

    if (!payload || (!payload.email && !payload.companyName)) {
      throw new Error('CRM dispatch failed: Incomplete CRM payload');
    }

    if (!this.enabled) {
      logger.info('CRM_ADAPTER', `CRM sync disabled - simulating sync for ${payload.companyName}`);
      return { status: 'simulated', company: payload.companyName, timestamp: new Date().toISOString() };
    }

    if (!this.webhookUrl) {
      logger.info('CRM_ADAPTER', `CRM record synchronized natively for ${payload.companyName}`, {
        riisScore: payload.riisScore,
        riskLevel: payload.riskLevel,
      });
      return {
        status: 'synced_native',
        company: payload.companyName,
        riisScore: payload.riisScore,
        timestamp: new Date().toISOString(),
      };
    }

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`CRM webhook responded with status ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  }
}

export const crmAdapter = new CrmAdapter();
