import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'freeBusyQuery',
    description:
      'Queries the free/busy status of one or more calendars in a time window. Returns busy intervals — useful for "when is everyone free?" workflows.',
    parameters: z.object({
      timeMin: z.string().describe('RFC3339 start time (e.g. "2026-05-29T09:00:00+02:00").'),
      timeMax: z.string().describe('RFC3339 end time.'),
      calendarIds: z
        .array(z.string())
        .min(1)
        .describe('List of calendar IDs (or email addresses) to query.'),
      timeZone: z.string().optional().default('Europe/Berlin'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Free/busy query for ${args.calendarIds.length} calendars`);
      try {
        const resp = await calendar.freebusy.query({
          requestBody: {
            timeMin: args.timeMin,
            timeMax: args.timeMax,
            timeZone: args.timeZone,
            items: args.calendarIds.map((id) => ({ id })),
          },
        });
        return JSON.stringify({ success: true, calendars: resp.data.calendars || {} }, null, 2);
      } catch (error: any) {
        log.error(`Error querying free/busy: ${error.message || error}`);
        throw new UserError(`Failed to query free/busy: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
