import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listCalendars',
    description:
      'Lists all calendars in the authenticated user\'s calendar list (subscribed calendars).',
    parameters: z.object({}),
    execute: async (_args, { log }) => {
      const calendar = await getCalendarClient();
      log.info('Listing calendars');

      try {
        const response = await calendar.calendarList.list();
        const calendars = (response.data.items || []).map((cal) => ({
          id: cal.id,
          summary: cal.summary,
          description: cal.description,
          primary: cal.primary,
          accessRole: cal.accessRole,
          timeZone: cal.timeZone,
          backgroundColor: cal.backgroundColor,
        }));
        return JSON.stringify({ calendars, count: calendars.length }, null, 2);
      } catch (error: any) {
        log.error(`Error listing calendars: ${error.message || error}`);
        throw new UserError(`Failed to list calendars: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
