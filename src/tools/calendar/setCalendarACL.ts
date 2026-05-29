import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'setCalendarACL',
    description:
      "Grants access to a calendar to a user/group/domain. Use scopeType='user' + scopeValue=email for a single person, or scopeType='domain' + scopeValue=domain for a whole org.",
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
      scopeType: z
        .enum(['user', 'group', 'domain', 'default'])
        .describe("ACL scope type. 'default' = public."),
      scopeValue: z
        .string()
        .optional()
        .describe("Email (user/group), domain (domain), or omit for 'default'."),
      role: z
        .enum(['none', 'freeBusyReader', 'reader', 'writer', 'owner'])
        .describe('Permission level.'),
      sendNotifications: z
        .boolean()
        .optional()
        .default(false)
        .describe('Send email notification to the user.'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Setting ACL: ${args.scopeType} ${args.scopeValue || ''} → ${args.role}`);
      try {
        const resp = await calendar.acl.insert({
          calendarId: args.calendarId,
          sendNotifications: args.sendNotifications,
          requestBody: {
            scope: { type: args.scopeType, value: args.scopeValue },
            role: args.role,
          },
        });
        return JSON.stringify({ success: true, rule: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error setting ACL: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need owner access on the calendar.');
        throw new UserError(`Failed to set ACL: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
