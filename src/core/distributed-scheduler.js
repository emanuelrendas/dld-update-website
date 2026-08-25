/**
 * RAIOC OS - Distributed Autonomous Scheduler
 * Manages recurrent jobs with distributed lock simulation, idempotency keys, and health checks.
 */

import { config } from '../config/env.js';
import { run_cycle } from './run-cycle.js';
import { queueEngine } from '../engines/queue-engine.js';
import { supabase } from '../db/supabase-client.js';
import { telemetry } from '../logging/telemetry.js';
import { logger } from '../logging/audit-logger.js';

export class DistributedScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || config.engine.cycleIntervalMs;
    this.isRunning = false;
    this.jobs = new Map();
    this.activeLocks = new Set();
    this.timers = [];

    this._registerCoreJobs();
  }

  _registerCoreJobs() {
    // 1. Run Cycle Orchestration (30s)
    this.registerJob('core_run_cycle', {
      intervalMs: this.intervalMs,
      execute: async () => await run_cycle(),
    });

    // 2. Queue Retry Sweep (60s)
    this.registerJob('queue_retry_sweep', {
      intervalMs: 60000,
      execute: async () => await queueEngine.processQueue(supabase, 50),
    });

    // 3. Health & Telemetry Snapshot (120s)
    this.registerJob('telemetry_heartbeat', {
      intervalMs: 120000,
      execute: async () => {
        const snap = telemetry.getSnapshot();
        logger.info('DISTRIBUTED_SCHEDULER', `Telemetry Heartbeat: ${snap.systemHealth} (Cycles: ${snap.cycleCount})`);
        return snap;
      },
    });
  }

  registerJob(jobId, jobDefinition) {
    this.jobs.set(jobId, {
      id: jobId,
      intervalMs: jobDefinition.intervalMs || 60000,
      execute: jobDefinition.execute,
      lastRun: null,
      lastStatus: 'PENDING',
      runCount: 0,
    });
  }

  async acquireLock(jobId) {
    if (this.activeLocks.has(jobId)) {
      logger.warn('DISTRIBUTED_SCHEDULER', `Lock acquisition skipped: Job '${jobId}' is already executing`);
      return false;
    }
    this.activeLocks.add(jobId);
    return true;
  }

  releaseLock(jobId) {
    this.activeLocks.delete(jobId);
  }

  async runJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const acquired = await this.acquireLock(jobId);
    if (!acquired) return;

    const startTime = Date.now();
    try {
      job.lastRun = new Date().toISOString();
      job.runCount++;
      const result = await job.execute();
      job.lastStatus = 'SUCCESS';
      const durationMs = Date.now() - startTime;
      logger.info('DISTRIBUTED_SCHEDULER', `Job '${jobId}' executed in ${durationMs}ms`);
      return result;
    } catch (err) {
      job.lastStatus = 'FAILED';
      telemetry.recordFailure('processing');
      logger.error('DISTRIBUTED_SCHEDULER', `Job '${jobId}' execution failed: ${err.message}`);
    } finally {
      this.releaseLock(jobId);
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('DISTRIBUTED_SCHEDULER', 'Starting Distributed Autonomous Scheduler...');

    for (const [jobId, job] of this.jobs.entries()) {
      // Immediate first run
      this.runJob(jobId);

      // Schedule continuous interval
      const timer = setInterval(() => {
        if (this.isRunning) this.runJob(jobId);
      }, job.intervalMs);

      this.timers.push(timer);
    }
  }

  async stop() {
    logger.info('DISTRIBUTED_SCHEDULER', 'Stopping Distributed Autonomous Scheduler...');
    this.isRunning = false;
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    this.activeLocks.clear();
  }

  getJobStatus() {
    return Array.from(this.jobs.values()).map((j) => ({
      id: j.id,
      intervalMs: j.intervalMs,
      lastRun: j.lastRun,
      lastStatus: j.lastStatus,
      runCount: j.runCount,
      isLocked: this.activeLocks.has(j.id),
    }));
  }
}

export const distributedScheduler = new DistributedScheduler();
