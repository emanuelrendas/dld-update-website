/**
 * RAIOC OS - Autonomous Daemon Scheduler
 * Runs continuous execution cycles on intervals with graceful shutdown & health reporting.
 */

import { config } from '../config/env.js';
import { run_cycle } from './run-cycle.js';
import { logger } from '../logging/audit-logger.js';
import { telemetry } from '../logging/telemetry.js';

export class AutonomousScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || config.engine.cycleIntervalMs;
    this.isRunning = false;
    this.timer = null;
    this.currentCyclePromise = null;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('SCHEDULER', 'Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('SCHEDULER', `RAIOC OS Autonomous Scheduler started (Interval: ${this.intervalMs}ms)`);

    // Immediate initial cycle
    await this.tick();

    // Schedule continuous cycles
    this.scheduleNext();
  }

  scheduleNext() {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      await this.tick();
      this.scheduleNext();
    }, this.intervalMs);
  }

  async tick() {
    try {
      this.currentCyclePromise = run_cycle();
      const result = await this.currentCyclePromise;
      logger.info('SCHEDULER', `Cycle completed with status: ${result.status}`);
    } catch (err) {
      logger.error('SCHEDULER', 'Unhandled exception during cycle execution', { error: err.message });
      telemetry.recordFailure('processing');
    } finally {
      this.currentCyclePromise = null;
    }
  }

  async stop() {
    logger.info('SCHEDULER', 'Stopping Autonomous Scheduler...');
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.currentCyclePromise) {
      logger.info('SCHEDULER', 'Waiting for current cycle to complete...');
      await this.currentCyclePromise;
    }

    logger.info('SCHEDULER', 'Autonomous Scheduler safely stopped');
  }
}

export const scheduler = new AutonomousScheduler();
