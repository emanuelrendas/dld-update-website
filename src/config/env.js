/**
 * RAIOC OS - Environment & Operational Infrastructure Configuration (Sprint 2 & 3)
 */

import { secretsManager } from './secrets-manager.js';

export const config = {
  env: process.env.NODE_ENV || 'production',
  service: {
    name: 'raioc-os',
    port: parseInt(process.env.PORT || '3000', 10),
    // No fallback: an unset key must fail closed, never authenticate against a
    // default. See src/security/auth-middleware.js.
    internalKey: process.env.INTERNAL_SERVICE_KEY || '',
  },
  dashboard: {
    // Human login for the browser dashboard, separate from the machine-to-machine
    // INTERNAL_SERVICE_KEY. No fallback: unset means login is disabled (fail closed).
    password: process.env.DASHBOARD_PASSWORD || '',
    sessionSecret: process.env.DASHBOARD_SESSION_SECRET || '',
    sessionTtlMs: parseInt(process.env.DASHBOARD_SESSION_TTL_MS || String(12 * 60 * 60 * 1000), 10),
  },
  security: {
    // Origins allowed to make credentialed (cookie-bearing) cross-origin requests,
    // e.g. dashboard.emanuelrendas.com calling api.emanuelrendas.com.
    dashboardOrigins: (process.env.DASHBOARD_ALLOWED_ORIGINS ||
      'https://dashboard.emanuelrendas.com,https://www.emanuelrendas.com,https://emanuelrendas.com')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  engine: {
    cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS || '30000', 10),
    batchSize: parseInt(process.env.PROCESSING_BATCH_SIZE || '50', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '5', 10),
    baseBackoffMs: parseInt(process.env.QUEUE_BASE_BACKOFF_MS || '1000', 10),
    maxBackoffMs: parseInt(process.env.QUEUE_MAX_BACKOFF_MS || '60000', 10),
  },
  smtp: {
    enabled: process.env.SMTP_ENABLED !== 'false',
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Emanuel Rendas Private Advisory <privateadvisory@emanuelrendas.com>',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || process.env.RESEND_KEY || '',
    from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'Emanuel Rendas Private Advisory <privateadvisory@emanuelrendas.com>',
  },
  whatsappBusiness: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_KEY || '',
    apiUrl: process.env.WHATSAPP_API_URL || '',
    enabled: process.env.WHATSAPP_ENABLED !== 'false',
  },
  adapters: {
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED !== 'false',
      apiUrl: process.env.WHATSAPP_API_URL || '',
      apiKey: process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_KEY || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
    email: {
      enabled: process.env.SMTP_ENABLED !== 'false' && process.env.EMAIL_ENABLED !== 'false',
      host: process.env.SMTP_HOST || 'mail.privateemail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Emanuel Rendas Private Advisory <privateadvisory@emanuelrendas.com>',
      apiUrl: process.env.EMAIL_API_URL || '',
      apiKey: process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD || process.env.EMAIL_API_KEY || '',
    },
    crm: {
      enabled: process.env.CRM_ENABLED !== 'false',
      apiUrl: process.env.CRM_API_URL || '',
      apiKey: process.env.CRM_API_KEY || '',
    },
  },
  google: {
    gmail: {
      enabled: process.env.GMAIL_ENABLED !== 'false',
      clientId: process.env.GMAIL_CLIENT_ID || '',
      clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
      refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
      senderEmail: process.env.GMAIL_SENDER_EMAIL || 'intelligence@emanuelrendas.com',
      senderName: process.env.GMAIL_SENDER_NAME || 'Emanuel Rendas Private Advisory',
    },
    calendar: {
      enabled: process.env.GOOGLE_CALENDAR_ENABLED !== 'false',
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Dubai',
      defaultMeetingDurationMinutes: parseInt(process.env.CALENDAR_DEFAULT_DURATION_MINUTES || '45', 10),
    },
  },
  whatsappBusiness: {
    enabled: process.env.WHATSAPP_ENABLED !== 'false',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'raioc_wa_verify_token',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    defaultTemplateName: process.env.WHATSAPP_DEFAULT_TEMPLATE || 'executive_brief_dispatch',
    languageCode: process.env.WHATSAPP_LANGUAGE_CODE || 'en',
  },
  crm: {
    enabled: process.env.CRM_ENABLED !== 'false',
    provider: process.env.CRM_PROVIDER || 'hubspot', // 'hubspot', 'supabase_native', 'webhook'
    apiKey: process.env.CRM_API_KEY || '',
    portalId: process.env.CRM_PORTAL_ID || '',
    webhookUrl: process.env.CRM_WEBHOOK_URL || '',
    pipelineId: process.env.CRM_PIPELINE_ID || 'default',
  },
  n8n: {
    enabled: process.env.N8N_ENABLED !== 'false',
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
    webhookSecret: process.env.N8N_WEBHOOK_SECRET || 'raioc_n8n_hmac_secret',
    timeoutMs: parseInt(process.env.N8N_TIMEOUT_MS || '10000', 10),
  },
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    timeoutMs: parseInt(process.env.TELEGRAM_TIMEOUT_MS || '10000', 10),
  },
  telemetry: {
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
    flushIntervalMs: parseInt(process.env.TELEMETRY_FLUSH_INTERVAL_MS || '10000', 10),
    apmSampleRate: parseFloat(process.env.APM_SAMPLE_RATE || '1.0'),
  },
};
