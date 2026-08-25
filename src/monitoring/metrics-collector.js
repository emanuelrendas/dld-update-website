/**
 * RAIOC Monitoring - APM Metrics & Performance Collector
 * Tracks service response latencies, error budgets, throughput counters, and system health status.
 */

export class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.latencyHistograms = new Map();
  }

  incrementCounter(metricName, value = 1) {
    const current = this.counters.get(metricName) || 0;
    this.counters.set(metricName, current + value);
  }

  recordLatency(metricName, durationMs) {
    if (!this.latencyHistograms.has(metricName)) {
      this.latencyHistograms.set(metricName, []);
    }
    const list = this.latencyHistograms.get(metricName);
    list.push(durationMs);
    if (list.length > 200) list.shift();
  }

  getMetricsSummary() {
    const counters = Object.fromEntries(this.counters.entries());
    const latencies = {};

    for (const [key, values] of this.latencyHistograms.entries()) {
      if (values.length === 0) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / values.length);
      const min = Math.min(...values);
      const max = Math.max(...values);
      latencies[key] = { avgMs: avg, minMs: min, maxMs: max, sampleCount: values.length };
    }

    return {
      counters,
      latencies,
      timestamp: new Date().toISOString(),
    };
  }
}

export const metricsCollector = new MetricsCollector();
