import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listCalendarEvents',
    description:
      'Lists events from a Google Calendar within a time range, optionally filtered by a search query. Returns events in chronological order. Use calendarId="primary" for the user\'s main calendar, or pass an email address to access a shared calendar.',
    parameters: z.object({
      calendarId: z
        .string()
        .optional()
        .default('primary')
        .describe('Calendar ID. Use "primary" for the user\'s main calendar or an email address for shared calendars.'),
      timeMin: z
        .string()
        .describe('Lower bound for event end time (RFC3339, e.g. "2026-04-07T00:00:00+02:00" or "2026-04-07T00:00:00Z").'),
      timeMax: z
        .string()
        .describe('Upper bound for event start time (RFC3339, e.g. "2026-05-15T00:00:00+02:00").'),
      q: z
        .string()
        .optional()
        .describe('Free-text search query (matches summary, description, location, attendees).'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(250)
        .optional()
        .default(50)
        .describe('Maximum number of events to return (1-250).'),
      singleEvents: z
        .boolean()
        .optional()
        .default(true)
        .describe('Expand recurring events into individual instances.'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(
        `Listing calendar events. Calendar: ${args.calendarId}, Range: ${args.timeMin} → ${args.timeMax}, Query: ${args.q || 'none'}`
      );

      try {
        const response = await calendar.events.list({
          calendarId: args.calendarId,
          timeMin: args.timeMin,
          timeMax: args.timeMax,
          q: args.q,
          maxResults: args.maxResults,
          singleEvents: args.singleEvents,
          orderBy: args.singleEvents ? 'startTime' : undefined,
        });

        const items = response.data.items || [];
        const events = items.map((event) => ({
          id: event.id,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start,
          end: event.end,
          status: event.status,
          htmlLink: event.htmlLink,
          attendees: event.attendees?.map((a) => ({
            email: a.email,
            displayName: a.displayName,
            responseStatus: a.responseStatus,
            organizer: a.organizer,
          })),
          organizer: event.organizer,
          hangoutLink: event.hangoutLink,
          recurringEventId: event.recurringEventId,
        }));

        return JSON.stringify({ events, count: events.length }, null, 2);
      } catch (error: any) {
        log.error(`Error listing calendar events: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. Make sure you have granted Google Calendar access to the application.'
          );
        }
        if (error.code === 404) {
          throw new UserError(`Calendar not found: ${args.calendarId}`);
        }
        throw new UserError(`Failed to list calendar events: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
