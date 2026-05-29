import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateEvent',
    description:
      'Updates a Calendar event (partial patch). Pass only the fields you want to change. Use sendUpdates to control notification behavior.',
    parameters: z.object({
      calendarId: z.string().optional().default('primary'),
      eventId: z.string().describe('The event ID.'),
      summary: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      start: z.string().optional().describe('RFC3339 start time.'),
      end: z.string().optional().describe('RFC3339 end time.'),
      timeZone: z.string().optional().default('Europe/Berlin'),
      attendees: z.array(z.string()).optional().describe('Attendee emails (replaces existing list).'),
      addGoogleMeet: z.boolean().optional().describe('Add a Google Meet link.'),
      sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional().default('none'),
      colorId: z.string().optional(),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Updating event ${args.eventId}`);

      const body: any = {};
      if (args.summary !== undefined) body.summary = args.summary;
      if (args.description !== undefined) body.description = args.description;
      if (args.location !== undefined) body.location = args.location;
      if (args.start) body.start = { dateTime: args.start, timeZone: args.timeZone };
      if (args.end) body.end = { dateTime: args.end, timeZone: args.timeZone };
      if (args.attendees) body.attendees = args.attendees.map((email) => ({ email }));
      if (args.colorId !== undefined) body.colorId = args.colorId;
      if (args.addGoogleMeet) {
        body.conferenceData = {
          createRequest: {
            requestId: `mcp-${args.eventId}-${args.start || 'patch'}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      try {
        const resp = await calendar.events.patch({
          calendarId: args.calendarId,
          eventId: args.eventId,
          requestBody: body,
          sendUpdates: args.sendUpdates,
          conferenceDataVersion: args.addGoogleMeet ? 1 : 0,
        });
        return JSON.stringify(
          {
            success: true,
            id: resp.data.id,
            summary: resp.data.summary,
            start: resp.data.start,
            end: resp.data.end,
            htmlLink: resp.data.htmlLink,
            hangoutLink: resp.data.hangoutLink,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error updating event: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Event ${args.eventId} not found.`);
        if (error.code === 403) throw new UserError('Permission denied.');
        throw new UserError(`Failed to update event: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
