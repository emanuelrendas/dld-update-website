/**
 * RAIOC Specialist Agent: HELIOS (Advisory Calendar & Scheduling)
 * Manages Google Calendar advisory bookings, client appointment links, and consultation time slots.
 * Autonomously reacts to CRM_SYNCED events and emits MEETING_SCHEDULED.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { AgentEvents } from '../../events/agent-event-bus.js';
import { logger } from '../../logging/audit-logger.js';

export class HeliosCalendarAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'helios',
      name: 'HELIOS',
      role: 'Advisory Calendar & Scheduling Specialist',
      capabilities: ['calendar_booking', 'appointment_coordination', 'google_meet_generation', 'availability_management'],
      systemPrompt: 'You coordinate private real estate advisory consultations, generate Google Meet links, and manage advisory calendar slots.',
    });
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.CRM_SYNCED, async (event) => {
      try {
        const payload = event.payload;
        logger.info('HELIOS', `Autonomous reaction to CRM_SYNCED for ${payload.lead?.company_name || 'prospect'}`);

        const result = await this.executeTask({
          attendeeEmail: payload.lead?.email,
          summary: `RAIOC Strategic Advisory — ${payload.lead?.company_name || 'VIP Client'}`,
          durationMinutes: 45,
        }, { correlationId: event.metadata.correlationId });

        if (result.status === 'SUCCESS') {
          this.emitEvent(AgentEvents.MEETING_SCHEDULED, {
            lead: payload.lead,
            booking: result.output,
            brief: payload.brief,
            evaluation: payload.evaluation,
            marketIntelligence: payload.marketIntelligence,
            complianceAudit: payload.complianceAudit,
          }, event.metadata.correlationId);
        }
      } catch (err) {
        logger.error('HELIOS', `Autonomous consultation booking failed: ${err.message}`);
      }
    });
  }

  async processTask(task, context = {}) {
    const { attendeeEmail, summary, durationMinutes = 45, startIso } = task;

    const bookingResult = await this.invokeTool('schedule_calendar_advisory', {
      attendeeEmail,
      summary: summary || 'Private UAE Real Estate Advisory Session — Emanuel Rendas',
      durationMinutes,
      startIso,
    });

    this.logDecision(
      `Scheduled advisory consultation for ${attendeeEmail || 'Client'}: Google Meet generated, calendar synchronized`,
      'CONFIRM_ADVISORY_APPOINTMENT',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.98,
        impactLevel: 'MEDIUM',
        metadata: { meetLink: bookingResult.meetLink, start: bookingResult.start },
      }
    );

    this.storeMemory(`calendar_booking_${attendeeEmail || Date.now()}`, bookingResult, {
      tags: ['calendar', 'booking', 'consultation', attendeeEmail || ''],
    });

    return bookingResult;
  }
}

export const heliosCalendarAgent = new HeliosCalendarAgent();
