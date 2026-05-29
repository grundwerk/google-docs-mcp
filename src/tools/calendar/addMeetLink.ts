import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'addMeetLink',
    description:
      'Adds a Google Meet conference link to an existing event. Wraps events.patch with conferenceData.createRequest.',
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
      eventId: z.string().describe('Event ID.'),
      sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional().default('none'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Adding Meet link to ${args.eventId}`);
      try {
        const resp = await calendar.events.patch({
          calendarId: args.calendarId,
          eventId: args.eventId,
          requestBody: {
            conferenceData: {
              createRequest: {
                requestId: `mcp-meet-${args.eventId}-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          },
          conferenceDataVersion: 1,
          sendUpdates: args.sendUpdates,
        });
        return JSON.stringify(
          {
            success: true,
            eventId: resp.data.id,
            hangoutLink: resp.data.hangoutLink,
            conferenceData: resp.data.conferenceData,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error adding Meet link: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Event ${args.eventId} not found.`);
        throw new UserError(`Failed to add Meet link: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
