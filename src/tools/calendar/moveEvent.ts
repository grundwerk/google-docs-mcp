import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'moveEvent',
    description: 'Moves an event from one calendar to another (e.g. personal → work).',
    parameters: z.object({
      sourceCalendarId: z.string().describe('Current calendar ID.'),
      eventId: z.string().describe('Event ID.'),
      destinationCalendarId: z.string().describe('Target calendar ID.'),
      sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional().default('none'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Moving event ${args.eventId} → ${args.destinationCalendarId}`);
      try {
        const resp = await calendar.events.move({
          calendarId: args.sourceCalendarId,
          eventId: args.eventId,
          destination: args.destinationCalendarId,
          sendUpdates: args.sendUpdates,
        });
        return JSON.stringify({ success: true, eventId: resp.data.id, calendar: args.destinationCalendarId }, null, 2);
      } catch (error: any) {
        log.error(`Error moving event: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Event ${args.eventId} not found.`);
        throw new UserError(`Failed to move event: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
