/**
 * RAIOC OS - Google Calendar Queue Adapter
 * Creates advisory events, client booking confirmations, and consultation appointments.
 */

import { googleCalendarClient } from '../integrations/google/calendar-client.js';
import { logger } from '../logging/audit-logger.js';

export class CalendarAdapter {
  constructor(client = googleCalendarClient) {
    this.client = client;
  }

  async dispatch(task) {
    const { recipient, payload } = task;
    const attendeeEmail = recipient || payload.attendeeEmail || payload.email;
    const summary = payload.summary || payload.title || 'Private Advisory Session — Emanuel Rendas';
    const description = payload.description || 'RAIOC Executive Intelligence Consultation';
    const startIso = payload.startIso || payload.start || new Date(Date.now() + 86400000).toISOString();
    const durationMinutes = payload.durationMinutes || 45;

    logger.info('CALENDAR_ADAPTER', `Scheduling Google Calendar consultation for ${attendeeEmail || 'Client'}`, {
      start: startIso,
      durationMinutes,
    });

    return await this.client.createEvent({
      summary,
      description,
      attendeeEmail,
      startIso,
      durationMinutes,
    });
  }
}

export const calendarAdapter = new CalendarAdapter();
