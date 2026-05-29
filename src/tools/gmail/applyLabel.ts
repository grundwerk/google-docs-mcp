import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'applyLabel',
    description:
      'Applies one or more labels to a Gmail message. Use listLabels to find label IDs (system labels use IDs like INBOX, SPAM, UNREAD; user labels use Label_NNN).',
    parameters: z.object({
      messageId: z.string().describe('Gmail message ID.'),
      labelIds: z.array(z.string()).min(1).describe('Label IDs to add.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Applying labels [${args.labelIds.join(',')}] to ${args.messageId}`);
      try {
        const resp = await gmail.users.messages.modify({
          userId: 'me',
          id: args.messageId,
          requestBody: { addLabelIds: args.labelIds },
        });
        return JSON.stringify({ success: true, messageId: args.messageId, labelIds: resp.data.labelIds }, null, 2);
      } catch (error: any) {
        log.error(`Error applying labels: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Message ${args.messageId} not found.`);
        throw new UserError(`Failed to apply labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
