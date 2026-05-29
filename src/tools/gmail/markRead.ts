import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'markRead',
    description: 'Marks a Gmail message as read (removes UNREAD label).',
    parameters: z.object({ messageId: z.string().describe('Gmail message ID.') }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Marking ${args.messageId} as read`);
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, read: true }, null, 2);
      } catch (error: any) {
        log.error(`Error marking read: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to mark read: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
