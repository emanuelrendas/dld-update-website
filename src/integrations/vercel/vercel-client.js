/**
 * RAIOC Integrations - Vercel REST API Client
 * Inspects production web deployment state, build health, and live domain aliases.
 */

import { logger } from '../../logging/audit-logger.js';

export class VercelClient {
  constructor(options = {}) {
    this.token = options.token || process.env.VERCEL_TOKEN || '';
    this.projectId = options.projectId || process.env.VERCEL_PROJECT_ID || 'emanuelrendas';
    this.productionUrl = options.productionUrl || 'https://www.emanuelrendas.com';
    this.enabled = options.enabled !== undefined ? options.enabled : Boolean(this.token);
  }

  async getDeploymentStatus() {
    if (!this.enabled || !this.token) {
      return {
        status: 'simulated',
        projectId: this.projectId,
        productionUrl: this.productionUrl,
        deploymentState: 'READY',
        target: 'production',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${this.projectId}&limit=1`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Vercel API returned status ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return {
        status: 'live',
        projectId: this.projectId,
        latestDeployment: data.deployments?.[0],
      };
    } catch (err) {
      logger.error('VERCEL_CLIENT', `Failed to fetch deployment status: ${err.message}`);
      return { status: 'error', error: err.message };
    }
  }
}

export const vercelClient = new VercelClient();
