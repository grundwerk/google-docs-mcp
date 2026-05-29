import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'removeLabel',
    description: 'Removes one or more labels from a Gmail message.',
    parameters: z.object({
      messageId: z.string().describe('Gmail message ID.'),
      labelIds: z.array(z.string()).min(1).describe('Label IDs to remove.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Removing labels [${args.labelIds.join(',')}] from ${args.messageId}`);
      try {
        const resp = await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { removeLabelIds: args.labelIds },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, labelIds: resp.data.labelIds }, null, 2);
      } catch (error: any) {
        log.error(`Error removing labels: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to remove labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
