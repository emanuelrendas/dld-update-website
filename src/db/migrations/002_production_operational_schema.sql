-- ============================================================================
-- RAIOC Production Operational Schema (Sprint 3)
-- Operational tables for Always-On Multi-Agent Monitoring & Supabase Realtime
-- ============================================================================

-- 1. Agent Status & Roster
CREATE TABLE IF NOT EXISTS public.agent_status (
    agent_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IDLE', -- 'IDLE', 'BUSY', 'ERROR', 'OFFLINE'
    current_task VARCHAR(255),
    is_autonomous BOOLEAN DEFAULT true,
    capabilities JSONB DEFAULT '[]'::jsonb,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    learning_score NUMERIC(5,2) DEFAULT 90.00,
    efficiency_index INTEGER DEFAULT 95,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. System Health & Availability
CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'DEGRADED', 'CRITICAL'
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    total_agents INTEGER NOT NULL DEFAULT 8,
    active_agents INTEGER NOT NULL DEFAULT 8,
    queue_backlog INTEGER NOT NULL DEFAULT 0,
    cycle_count BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms NUMERIC(10,2) DEFAULT 0.00,
    error_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. System Metrics Snapshots
CREATE TABLE IF NOT EXISTS public.system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(128) NOT NULL,
    metric_value NUMERIC(15,4) NOT NULL,
    unit VARCHAR(32) DEFAULT 'count',
    tags JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Connector Health Matrix
CREATE TABLE IF NOT EXISTS public.connector_health (
    connector_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'ACTIVE', 'BLOCKED', 'DEGRADED', 'ERROR'
    latency_ms INTEGER DEFAULT 0,
    authenticated BOOLEAN DEFAULT false,
    endpoint_url TEXT,
    last_execution TIMESTAMPTZ,
    failure_reason TEXT,
    retry_state JSONB DEFAULT '{"retries": 0, "max": 5}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Scheduler Jobs
CREATE TABLE IF NOT EXISTS public.scheduler_jobs (
    job_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    cron_expression VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'RUNNING', 'PAUSED', 'FAILED'
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count BIGINT DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_duration_ms INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Agent Structured Logs
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(64) NOT NULL,
    level VARCHAR(16) NOT NULL DEFAULT 'INFO',
    category VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    correlation_id VARCHAR(128),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Agent Heartbeats Telemetry
CREATE TABLE IF NOT EXISTS public.agent_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    current_task VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Operational Task Executions
CREATE TABLE IF NOT EXISTS public.executions (
    id VARCHAR(128) PRIMARY KEY,
    owner_agent VARCHAR(64) NOT NULL,
    objective TEXT NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'HIGH',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    priority_score INTEGER DEFAULT 75,
    business_value_aed NUMERIC(15,2) DEFAULT 0.00,
    duration_ms INTEGER DEFAULT 0,
    dependencies JSONB DEFAULT '[]'::jsonb,
    parent_task VARCHAR(128),
    child_tasks JSONB DEFAULT '[]'::jsonb,
    retries JSONB DEFAULT '{"attempt": 0, "max": 3}'::jsonb,
    execution_history JSONB DEFAULT '[]'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 9. Workflow Runs (E2E Cycles)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    correlation_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED'
    total_steps INTEGER NOT NULL DEFAULT 15,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    lead_id VARCHAR(128),
    revenue_impact_aed NUMERIC(15,2) DEFAULT 0.00,
    step_results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 10. System & Executive Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'INFO', -- 'INFO', 'SUCCESS', 'WARNING', 'CRITICAL'
    source VARCHAR(64) NOT NULL DEFAULT 'JARVIS',
    read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Realtime Publication
ALTER TABLE public.agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on agent_status" ON public.agent_status FOR ALL USING (true);
CREATE POLICY "Allow service role full access on system_health" ON public.system_health FOR ALL USING (true);
CREATE POLICY "Allow service role full access on connector_health" ON public.connector_health FOR ALL USING (true);
CREATE POLICY "Allow service role full access on executions" ON public.executions FOR ALL USING (true);
CREATE POLICY "Allow service role full access on workflow_runs" ON public.workflow_runs FOR ALL USING (true);
CREATE POLICY "Allow service role full access on notifications" ON public.notifications FOR ALL USING (true);
