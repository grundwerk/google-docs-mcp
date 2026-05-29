import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'quickAddEvent',
    description:
      "Creates an event from natural-language text (e.g. 'Coffee with Tom tomorrow 3pm'). Google parses time + title automatically. Faster than createCalendarEvent for simple cases.",
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
      text: z.string().describe('Natural-language event description.'),
      sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional().default('none'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`QuickAdd: '${args.text}'`);
      try {
        const resp = await calendar.events.quickAdd({
          calendarId: args.calendarId,
          text: args.text,
          sendUpdates: args.sendUpdates,
        });
        return JSON.stringify(
          {
            success: true,
            id: resp.data.id,
            summary: resp.data.summary,
            start: resp.data.start,
            end: resp.data.end,
            htmlLink: resp.data.htmlLink,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error quickAdd: ${error.message || error}`);
        throw new UserError(`Failed to quickAdd: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
