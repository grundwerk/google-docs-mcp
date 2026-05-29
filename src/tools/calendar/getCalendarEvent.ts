import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getCalendarEvent',
    description: 'Gets full details of a single Google Calendar event by ID.',
    parameters: z.object({
      calendarId: z
        .string()
        .optional()
        .default('primary')
        .describe('Calendar ID containing the event.'),
      eventId: z.string().describe('The event ID.'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Getting calendar event ${args.eventId} from ${args.calendarId}`);

      try {
        const response = await calendar.events.get({
          calendarId: args.calendarId,
          eventId: args.eventId,
        });
        return JSON.stringify(response.data, null, 2);
      } catch (error: any) {
        log.error(`Error getting calendar event: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(`Event not found: ${args.eventId}`);
        }
        throw new UserError(`Failed to get calendar event: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
