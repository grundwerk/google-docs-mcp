import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listCalendarACL',
    description: 'Lists the access control list (sharing) of a calendar — who has read/write access.',
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Listing ACL for calendar ${args.calendarId}`);
      try {
        const resp = await calendar.acl.list({ calendarId: args.calendarId });
        return JSON.stringify({ success: true, rules: resp.data.items || [] }, null, 2);
      } catch (error: any) {
        log.error(`Error listing ACL: ${error.message || error}`);
        throw new UserError(`Failed to list ACL: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
