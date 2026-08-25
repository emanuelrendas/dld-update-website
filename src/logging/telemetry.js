/**
 * RAIOC OS - Telemetry & Operational Metrics Collector
 */

export class TelemetryCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.metrics = {
      cycleCount: 0,
      totalLeadsProcessed: 0,
      totalAssessmentsProcessed: 0,
      totalExecutiveBriefsGenerated: 0,
      totalDispatches: {
        whatsapp: 0,
        email: 0,
        crm: 0,
      },
      failures: {
        processing: 0,
        dispatch: 0,
        recovery: 0,
      },
      latenciesMs: {
        lastCycle: 0,
        averageCycle: 0,
        minCycle: Infinity,
        maxCycle: 0,
      },
      lastCycleTimestamp: null,
      systemHealth: 'HEALTHY',
    };
    this.cycleDurations = [];
  }

  recordCycle(durationMs, summary = {}) {
    this.metrics.cycleCount += 1;
    this.metrics.lastCycleTimestamp = new Date().toISOString();
    this.metrics.latenciesMs.lastCycle = durationMs;

    this.cycleDurations.push(durationMs);
    if (this.cycleDurations.length > 500) {
      this.cycleDurations.shift();
    }

    const sum = this.cycleDurations.reduce((a, b) => a + b, 0);
    this.metrics.latenciesMs.averageCycle = Math.round(sum / this.cycleDurations.length);
    this.metrics.latenciesMs.minCycle = Math.min(this.metrics.latenciesMs.minCycle, durationMs);
    this.metrics.latenciesMs.maxCycle = Math.max(this.metrics.latenciesMs.maxCycle, durationMs);

    if (summary.leadsProcessed) {
      this.metrics.totalLeadsProcessed += summary.leadsProcessed;
    }
    if (summary.assessmentsProcessed) {
      this.metrics.totalAssessmentsProcessed += summary.assessmentsProcessed;
    }
    if (summary.executiveBriefsGenerated) {
      this.metrics.totalExecutiveBriefsGenerated += summary.executiveBriefsGenerated;
    }
    if (summary.dispatches) {
      this.metrics.totalDispatches.whatsapp += summary.dispatches.whatsapp || 0;
      this.metrics.totalDispatches.email += summary.dispatches.email || 0;
      this.metrics.totalDispatches.crm += summary.dispatches.crm || 0;
    }
    if (summary.failures) {
      this.metrics.failures.processing += summary.failures.processing || 0;
      this.metrics.failures.dispatch += summary.failures.dispatch || 0;
      this.metrics.failures.recovery += summary.failures.recovery || 0;
    }

    if (this.metrics.failures.dispatch > 10 || this.metrics.failures.processing > 5) {
      this.metrics.systemHealth = 'DEGRADED';
    } else {
      this.metrics.systemHealth = 'HEALTHY';
    }
  }

  recordFailure(category) {
    if (this.metrics.failures[category] !== undefined) {
      this.metrics.failures[category] += 1;
    } else {
      this.metrics.failures[category] = 1;
    }
  }

  getSnapshot() {
    return {
      ...this.metrics,
      latenciesMs: {
        ...this.metrics.latenciesMs,
        minCycle: this.metrics.latenciesMs.minCycle === Infinity ? 0 : this.metrics.latenciesMs.minCycle,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const telemetry = new TelemetryCollector();
