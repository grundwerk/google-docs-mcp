import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteLabel',
    description: 'Deletes a Gmail label by ID. The label is unlinked from all messages but messages are kept.',
    parameters: z.object({
      labelId: z.string().describe('Label ID (from listLabels).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Deleting label ${args.labelId}`);
      try {
        await gmail.users.labels.delete({ userId: 'me', id: args.labelId });
        return JSON.stringify({ success: true, deletedLabelId: args.labelId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting label: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Label ${args.labelId} not found.`);
        if (error.code === 400)
          throw new UserError('Cannot delete system labels (INBOX, UNREAD, etc.). Only user-created labels.');
        throw new UserError(`Failed to delete label: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
