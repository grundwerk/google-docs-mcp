import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'unstarEmail',
    description: 'Removes the star from a Gmail message (removes STARRED label).',
    parameters: z.object({ messageId: z.string().describe('Gmail message ID.') }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Unstarring ${args.messageId}`);
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { removeLabelIds: ['STARRED'] },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, starred: false }, null, 2);
      } catch (error: any) {
        log.error(`Error unstarring: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to unstar: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
