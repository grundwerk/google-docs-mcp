import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'searchEmails',
    description:
      'Searches Gmail using Gmail query syntax (e.g. "from:someone@example.com", "subject:hello", "after:2026/01/01"). Returns a list of matching emails with ID, subject, from, date, and snippet.',
    parameters: z.object({
      query: z
        .string()
        .describe('Gmail search query (same syntax as Gmail search bar). E.g. "from:info@example.com subject:report".'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(50)
        .describe('Maximum number of emails to return (1-500).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Searching emails with query: ${args.query}, maxResults: ${args.maxResults}`);

      try {
        const allMessages: Array<{
          id: string;
          subject: string;
          from: string;
          to: string;
          date: string;
          snippet: string;
        }> = [];

        let pageToken: string | undefined;
        let remaining = args.maxResults;

        while (remaining > 0) {
          const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: args.query,
            maxResults: Math.min(remaining, 100),
            pageToken,
          });

          const messages = listResponse.data.messages || [];
          if (messages.length === 0) break;

          for (const msg of messages) {
            if (!msg.id) continue;
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            });

            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            allMessages.push({
              id: msg.id,
              subject: getHeader('Subject'),
              from: getHeader('From'),
              to: getHeader('To'),
              date: getHeader('Date'),
              snippet: detail.data.snippet || '',
            });
          }

          remaining -= messages.length;
          pageToken = listResponse.data.nextPageToken || undefined;
          if (!pageToken) break;
        }

        return JSON.stringify({ emails: allMessages, count: allMessages.length }, null, 2);
      } catch (error: any) {
        log.error(`Error searching emails: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. Make sure you have granted Gmail read access to the application.'
          );
        }
        throw new UserError(`Failed to search emails: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
