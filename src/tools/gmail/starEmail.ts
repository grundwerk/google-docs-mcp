import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'starEmail',
    description: 'Stars a Gmail message (adds STARRED label).',
    parameters: z.object({ messageId: z.string().describe('Gmail message ID.') }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Starring ${args.messageId}`);
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { addLabelIds: ['STARRED'] },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, starred: true }, null, 2);
      } catch (error: any) {
        log.error(`Error starring: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to star: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
