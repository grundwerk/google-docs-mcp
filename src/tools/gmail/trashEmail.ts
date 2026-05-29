import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'trashEmail',
    description:
      'Moves a single Gmail message to Trash (reversible for 30 days). Requires gmail.modify scope. Use batchTrashEmails for multiple messages.',
    parameters: z.object({
      messageId: z.string().describe('The Gmail message ID (from searchEmails results).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Trashing email: ${args.messageId}`);

      try {
        const response = await gmail.users.messages.trash({
          userId: 'me',
          id: args.messageId,
        });

        return JSON.stringify(
          {
            success: true,
            messageId: response.data.id,
            labelIds: response.data.labelIds || [],
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error trashing email: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. Make sure the OAuth token has gmail.modify scope (re-run `npm run start auth` after scope change).'
          );
        }
        if (error.code === 404) {
          throw new UserError(`Message not found: ${args.messageId}`);
        }
        throw new UserError(`Failed to trash email: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
