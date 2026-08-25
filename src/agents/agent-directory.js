/**
 * RAIOC Agent Directory & Central Roster
 * Registers and monitors all permanent specialist agents in the autonomous operating company.
 */

import { markTriageAgent } from './specialists/mark-triage-agent.js';
import { aidaCommsAgent } from './specialists/aida-comms-agent.js';
import { atlasMarketAgent } from './specialists/atlas-market-agent.js';
import { lexComplianceAgent } from './specialists/lex-compliance-agent.js';
import { heliosCalendarAgent } from './specialists/helios-calendar-agent.js';
import { hermesCrmAgent } from './specialists/hermes-crm-agent.js';
import { sentinelHealthAgent } from './specialists/sentinel-health-agent.js';
import { logger } from '../logging/audit-logger.js';

export class AgentDirectory {
  constructor() {
    this.agents = new Map();
    this._registerSpecialists();
  }

  _registerSpecialists() {
    this.registerAgent(markTriageAgent);
    this.registerAgent(aidaCommsAgent);
    this.registerAgent(atlasMarketAgent);
    this.registerAgent(lexComplianceAgent);
    this.registerAgent(heliosCalendarAgent);
    this.registerAgent(hermesCrmAgent);
    this.registerAgent(sentinelHealthAgent);
  }

  registerAgent(agent) {
    if (!agent) return;
    this.agents.set(agent.id, agent);
    logger.info('AGENT_DIRECTORY', `Registered specialist agent: ${agent.name} (${agent.role})`);
  }

  getAgent(agentId) {
    return this.agents.get(agentId) || null;
  }

  findAgentForCapability(capability) {
    for (const agent of this.agents.values()) {
      if (agent.capabilities.includes(capability)) {
        return agent;
      }
    }
    return null;
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => a.getStatus());
  }

  enableAutonomousMesh() {
    for (const agent of this.agents.values()) {
      if (typeof agent.enableAutonomousMesh === 'function') {
        agent.enableAutonomousMesh();
      }
    }
    logger.info('AGENT_DIRECTORY', `Autonomous execution mesh active across all ${this.agents.size} agents`);
  }

  broadcastHeartbeats() {
    const statuses = [];
    for (const agent of this.agents.values()) {
      statuses.push(agent.emitHeartbeat());
    }
    return statuses;
  }
}

export const agentDirectory = new AgentDirectory();
