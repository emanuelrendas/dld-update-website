/**
 * RAIOC API - CORS Origin Resolution
 * Shared by the standalone HTTP server (src/api/server.js) and the Vercel
 * entrypoint (api/index.js) so both apply the same rule: credentialed
 * (cookie-bearing) cross-origin requests are only granted to allowlisted
 * dashboard origins (config.security.dashboardOrigins). Any other origin
 * gets the previous public, credential-less '*' behavior — public write
 * routes (lead/intake/assessment/event/etc.) are unaffected.
 */

import { config } from '../config/env.js';

export function resolveCorsHeaders(origin) {
  if (origin && config.security.dashboardOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
  }
  return { 'Access-Control-Allow-Origin': '*' };
}
