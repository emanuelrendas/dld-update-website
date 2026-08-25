/**
 * RAIOC API - Lead & Brief Inbound Routes
 * Connects lead forms and WhatsApp CTA triggers directly to IKL, Executive Briefs, and Queue Engine.
 */

import { handleAssessmentSubmission } from './assessment-routes.js';

export async function handleLeadSubmission(payload = {}, options = {}) {
  return await handleAssessmentSubmission(payload, options);
}
