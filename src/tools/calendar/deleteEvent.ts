import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteEvent',
    description: 'Deletes a Calendar event. Optional sendUpdates to notify attendees.',
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
      eventId: z.string().describe('The event ID.'),
      sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional().default('none'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Deleting event ${args.eventId}`);
      try {
        await calendar.events.delete({
          calendarId: args.calendarId,
          eventId: args.eventId,
          sendUpdates: args.sendUpdates,
        });
        return JSON.stringify({ success: true, deletedEventId: args.eventId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting event: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Event ${args.eventId} not found.`);
        if (error.code === 410)
          throw new UserError(`Event ${args.eventId} was already deleted.`);
        throw new UserError(`Failed to delete event: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
