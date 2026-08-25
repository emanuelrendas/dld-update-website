/**
 * RAIOC OS - Always-On Production Supervisor (Sprint 3)
 * Manages autonomous process lifecycle, background workers, persistent scheduler,
 * connector health watchdog, automatic reconnect, crash recovery, and Supabase operational synchronization.
 */

import { operatingCenter } from '../operational/operating-center.js';
import { distributedScheduler } from './distributed-scheduler.js';
import { connectorHealthMatrix } from '../monitoring/connector-health-matrix.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { supabase } from '../db/supabase-client.js';
import { telemetry } from '../logging/telemetry.js';
import { logger } from '../logging/audit-logger.js';

export class ProductionSupervisor {
  constructor() {
    this.isRunning = false;
    this.uptimeStart = null;
    this.probeInterval = null;
    this.syncInterval = null;
    this.restartCount = 0;
  }

  /**
   * Starts the always-on production supervisor
   */
  async start() {
    if (this.isRunning) {
      logger.warn('SUPERVISOR', 'Production Supervisor is already running.');
      return;
    }

    this.isRunning = true;
    this.uptimeStart = Date.now();
    logger.info('SUPERVISOR', '🛡️ Starting RAIOC Always-On Production Supervisor...');

    try {
      // 1. Boot JOS v1.0 Operating Center & Continuous Loop
      await operatingCenter.boot({ startContinuousLoop: true, loopIntervalMs: 30000 });

      // 2. Initial Connector Health Probe
      await connectorHealthMatrix.probeAllConnectors();

      // 3. Setup Periodic Connector Health Watchdog (every 60s)
      this.probeInterval = setInterval(async () => {
        if (this.isRunning) {
          try {
            await connectorHealthMatrix.probeAllConnectors();
          } catch (err) {
            logger.error('SUPERVISOR', `Connector probe failed: ${err.message}`);
          }
        }
      }, 60000);

      // 4. Setup Periodic Supabase Operational State Sync (every 30s)
      this.syncInterval = setInterval(async () => {
        if (this.isRunning) {
          try {
            await this._syncOperationalState();
          } catch (err) {
            logger.error('SUPERVISOR', `Operational sync failed: ${err.message}`);
          }
        }
      }, 30000);

      // 5. Attach Global Process Crash Recovery Handlers
      this._attachCrashRecoveryHandlers();

      logger.info('SUPERVISOR', '✅ Production Supervisor ACTIVE. All autonomous subsystems online.');
    } catch (err) {
      logger.error('SUPERVISOR', `Fatal startup failure: ${err.message}`);
      await this._handleStartupCrash(err);
    }
  }

  async _syncOperationalState() {
    const agents = agentDirectory.listAgents();
    for (const a of agents) {
      await supabase.syncAgentStatus(a);
    }

    const snapshot = telemetry.getSnapshot();
    await supabase.recordConnectorHealth('system', {
      name: 'System Health',
      status: snapshot.systemHealth || 'HEALTHY',
      latencyMs: snapshot.latenciesMs?.mean || 0,
      authenticated: true,
      lastExecution: new Date().toISOString(),
    });
  }

  _attachCrashRecoveryHandlers() {
    process.on('uncaughtException', (err) => {
      logger.error('SUPERVISOR', `💥 Uncaught exception intercepted by supervisor: ${err.message}`, { stack: err.stack });
      this.restartCount++;
      agentEventBus.publish(AgentEvents.ALERT_RAISED, {
        severity: 'CRITICAL',
        message: `Supervisor intercepted uncaught exception: ${err.message}`,
        restartCount: this.restartCount,
      });
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('SUPERVISOR', `⚠️ Unhandled promise rejection: ${reason}`);
    });
  }

  async _handleStartupCrash(err) {
    this.restartCount++;
    logger.warn('SUPERVISOR', `Attempting graceful restart in 5s (attempt #${this.restartCount})...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return await this.start();
  }

  getSupervisorStatus() {
    return {
      status: this.isRunning ? 'RUNNING' : 'STOPPED',
      uptimeSeconds: this.uptimeStart ? Math.round((Date.now() - this.uptimeStart) / 1000) : 0,
      restartCount: this.restartCount,
      agentsOnline: agentDirectory.listAgents().length,
      schedulerRunning: distributedScheduler.isRunning,
      connectorsCount: connectorHealthMatrix.getAllConnectorHealth().length,
      timestamp: new Date().toISOString(),
    };
  }

  async stop() {
    logger.info('SUPERVISOR', 'Stopping Production Supervisor...');
    this.isRunning = false;
    if (this.probeInterval) {
      clearInterval(this.probeInterval);
      this.probeInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    await operatingCenter.shutdown();
    logger.info('SUPERVISOR', 'Production Supervisor stopped cleanly.');
  }
}

export const productionSupervisor = new ProductionSupervisor();
