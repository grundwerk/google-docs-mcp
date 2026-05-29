import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getCalendarClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createCalendarEvent',
    description:
      'Creates a new event on a Google Calendar with optional attendees, description, location, and Google Meet link.',
    parameters: z.object({
      calendarId: z
        .string()
        .optional()
        .default('primary')
        .describe('Calendar ID where the event will be created.'),
      summary: z.string().describe('Event title.'),
      description: z.string().optional().describe('Event description.'),
      location: z.string().optional().describe('Event location.'),
      start: z
        .string()
        .describe('Start time (RFC3339, e.g. "2026-04-14T10:00:00+02:00").'),
      end: z
        .string()
        .describe('End time (RFC3339, e.g. "2026-04-14T11:00:00+02:00").'),
      timeZone: z
        .string()
        .optional()
        .default('Europe/Berlin')
        .describe('IANA timezone name.'),
      attendees: z
        .array(z.string())
        .optional()
        .describe('List of attendee email addresses.'),
      addGoogleMeet: z
        .boolean()
        .optional()
        .default(false)
        .describe('Create a Google Meet link for this event.'),
      sendUpdates: z
        .enum(['all', 'externalOnly', 'none'])
        .optional()
        .default('none')
        .describe('Whether to send email notifications to attendees.'),
      colorId: z
        .string()
        .optional()
        .describe('Event color ID (1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana/Yellow, 6=Tangerine/Orange, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato).'),
    }),
    execute: async (args, { log }) => {
      const calendar = await getCalendarClient();
      log.info(`Creating calendar event "${args.summary}" on ${args.calendarId}`);

      try {
        const eventBody: any = {
          summary: args.summary,
          description: args.description,
          location: args.location,
          start: { dateTime: args.start, timeZone: args.timeZone },
          end: { dateTime: args.end, timeZone: args.timeZone },
          attendees: args.attendees?.map((email) => ({ email })),
          colorId: args.colorId,
        };

        if (args.addGoogleMeet) {
          eventBody.conferenceData = {
            createRequest: {
              requestId: `mcp-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        }

        const response = await calendar.events.insert({
          calendarId: args.calendarId,
          requestBody: eventBody,
          sendUpdates: args.sendUpdates,
          conferenceDataVersion: args.addGoogleMeet ? 1 : 0,
        });

        return JSON.stringify(
          {
            id: response.data.id,
            htmlLink: response.data.htmlLink,
            hangoutLink: response.data.hangoutLink,
            status: response.data.status,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating calendar event: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. Make sure you have granted Google Calendar write access.'
          );
        }
        throw new UserError(`Failed to create calendar event: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
