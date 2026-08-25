/**
 * RAIOC OS - Autonomous Multi-Agent Operating Company (Operational Layer - JOS v1.0 & Sprint 3)
 * Core System Entrypoint
 */

import { run_cycle } from './core/run-cycle.js';
import { scheduler } from './core/scheduler.js';
import { distributedScheduler } from './core/distributed-scheduler.js';
import { productionSupervisor } from './core/production-supervisor.js';
import { diraRiisEngine } from './engines/dira-riis-engine.js';
import { executiveBriefGenerator } from './engines/executive-brief.js';
import { queueEngine } from './engines/queue-engine.js';
import { supabase } from './db/supabase-client.js';
import { telemetry } from './logging/telemetry.js';
import { logger } from './logging/audit-logger.js';
import { config } from './config/env.js';
import { secretsManager } from './config/secrets-manager.js';
import { authMiddleware } from './security/auth-middleware.js';
import { webhookVerifier } from './security/webhook-verifier.js';
import { ikl } from './core/ikl/index.js';
import { routeApiRequest, startApiServer, propertyCalculators } from './api/index.js';
import { gmailClient } from './integrations/google/gmail-client.js';
import { googleCalendarClient } from './integrations/google/calendar-client.js';
import { whatsAppBusinessClient } from './integrations/whatsapp/whatsapp-business-client.js';
import { crmSyncClient } from './integrations/crm/crm-sync-client.js';
import { n8nWebhookClient } from './integrations/n8n/n8n-webhook-client.js';
import { telegramClient, sendTelegramMessage } from './connectors/telegram-client.js';
import { gitHubClient } from './integrations/github/github-client.js';
import { vercelClient } from './integrations/vercel/vercel-client.js';
import { openAiClient } from './integrations/openai/openai-client.js';
import { gmailAdapter } from './adapters/gmail-adapter.js';
import { calendarAdapter } from './adapters/calendar-adapter.js';
import { whatsAppCloudAdapter } from './adapters/whatsapp-cloud-adapter.js';
import { toolRegistry } from './agents/tool-registry.js';
import { agentRuntime } from './agents/agent-runtime.js';
import { AgentAction, AgentContext, ExecutionResult } from './agents/agent-action-interface.js';
import { correlationTracer } from './monitoring/correlation-tracer.js';
import { metricsCollector } from './monitoring/metrics-collector.js';
import { connectorHealthMatrix } from './monitoring/connector-health-matrix.js';

// Operational Layer & Specialist Agents
import { BaseSpecialistAgent } from './agents/specialists/base-agent.js';
import { jarvis } from './agents/specialists/jarvis-orchestrator.js';
import { markTriageAgent } from './agents/specialists/mark-triage-agent.js';
import { aidaCommsAgent } from './agents/specialists/aida-comms-agent.js';
import { atlasMarketAgent } from './agents/specialists/atlas-market-agent.js';
import { lexComplianceAgent } from './agents/specialists/lex-compliance-agent.js';
import { heliosCalendarAgent } from './agents/specialists/helios-calendar-agent.js';
import { hermesCrmAgent } from './agents/specialists/hermes-crm-agent.js';
import { sentinelHealthAgent } from './agents/specialists/sentinel-health-agent.js';
import { agentDirectory } from './agents/agent-directory.js';
import { sharedMemory } from './memory/shared-memory.js';
import { agentEventBus, AgentEvents } from './events/agent-event-bus.js';
import { priorityTaskDispatcher, TaskPriority } from './operational/priority-task-dispatcher.js';
import { autonomousPlanner } from './operational/autonomous-planner.js';
import { decisionLogger } from './operational/decision-logger.js';
import { kpiCollector } from './operational/kpi-collector.js';
import { dailyBriefingGenerator } from './operational/daily-briefing-generator.js';
import { executiveDashboard } from './operational/executive-dashboard.js';
import { operatingCenter } from './operational/operating-center.js';

// JOS v1.0 Executive Intelligence Layer
import { executiveLongTermMemory, MemoryCategories } from './memory/executive-long-term-memory.js';
import { executiveDecisionEngine } from './operational/executive-decision-engine.js';
import { autonomousTaskManager } from './operational/autonomous-task-manager.js';
import { opportunityEngine, OpportunityTypes } from './operational/opportunity-engine.js';
import { agentPerformanceEngine } from './operational/agent-performance-engine.js';
import { continuousLearningLayer } from './operational/continuous-learning-layer.js';
import { businessIntelligenceBus, BusinessDomains } from './events/business-intelligence-bus.js';
import { executiveSelfHealingLayer } from './operational/executive-self-healing.js';
import { autonomousDailyOperations } from './operational/autonomous-daily-operations.js';
import { renderCommandCenterHtml } from './dashboard/command-center-html.js';

export {
  run_cycle,
  scheduler,
  distributedScheduler,
  productionSupervisor,
  diraRiisEngine,
  executiveBriefGenerator,
  queueEngine,
  supabase,
  telemetry,
  logger,
  config,
  secretsManager,
  authMiddleware,
  webhookVerifier,
  ikl,
  routeApiRequest,
  startApiServer,
  propertyCalculators,
  gmailClient,
  googleCalendarClient,
  whatsAppBusinessClient,
  crmSyncClient,
  n8nWebhookClient,
  telegramClient,
  sendTelegramMessage,
  gitHubClient,
  vercelClient,
  openAiClient,
  gmailAdapter,
  calendarAdapter,
  whatsAppCloudAdapter,
  toolRegistry,
  agentRuntime,
  AgentAction,
  AgentContext,
  ExecutionResult,
  correlationTracer,
  metricsCollector,
  connectorHealthMatrix,
  // Operational Multi-Agent Exports
  BaseSpecialistAgent,
  jarvis,
  markTriageAgent,
  aidaCommsAgent,
  atlasMarketAgent,
  lexComplianceAgent,
  heliosCalendarAgent,
  hermesCrmAgent,
  sentinelHealthAgent,
  agentDirectory,
  sharedMemory,
  agentEventBus,
  AgentEvents,
  priorityTaskDispatcher,
  TaskPriority,
  autonomousPlanner,
  decisionLogger,
  kpiCollector,
  dailyBriefingGenerator,
  executiveDashboard,
  operatingCenter,
  // JOS v1.0 Executive Layer Exports
  executiveLongTermMemory,
  MemoryCategories,
  executiveDecisionEngine,
  autonomousTaskManager,
  opportunityEngine,
  OpportunityTypes,
  agentPerformanceEngine,
  continuousLearningLayer,
  businessIntelligenceBus,
  BusinessDomains,
  executiveSelfHealingLayer,
  autonomousDailyOperations,
  renderCommandCenterHtml,
};

// If started directly, boot Always-On Production Supervisor
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('raioc-os'))) {
  logger.info('SYSTEM', '🛡️ Booting RAIOC Always-On Production Operating System (Supervisor)...');

  productionSupervisor.start().catch((err) => {
    logger.error('SYSTEM', 'Fatal boot failure in Production Supervisor', { error: err.message });
    process.exit(1);
  });

  const handleShutdown = async (signal) => {
    logger.info('SYSTEM', `Received ${signal}, shutting down production supervisor gracefully...`);
    await productionSupervisor.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
