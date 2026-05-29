import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'archiveEmail',
    description: 'Archives a Gmail message (removes INBOX label). Counterpart: unarchive via applyLabel with INBOX.',
    parameters: z.object({ messageId: z.string().describe('Gmail message ID.') }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Archiving ${args.messageId}`);
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { removeLabelIds: ['INBOX'] },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, archived: true }, null, 2);
      } catch (error: any) {
        log.error(`Error archiving: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to archive: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
