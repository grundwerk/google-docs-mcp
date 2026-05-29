import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'sendDraft',
    description:
      "Sends a previously-created Gmail draft (by draftId from createDraft). Used after Tom approves the draft in Gmail-UI. Returns the sent messageId + threadId.",
    parameters: z.object({
      draftId: z.string().describe('Draft ID returned by createDraft.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Sending draft ${args.draftId}`);

      try {
        const resp = await gmail.users.drafts.send({
          userId: 'me',
          requestBody: { id: args.draftId },
        });

        return JSON.stringify(
          {
            success: true,
            messageId: resp.data.id,
            threadId: resp.data.threadId,
            draftId: args.draftId,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error sending draft: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(`Draft not found: ${args.draftId}`);
        }
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The gmail.send scope must be granted. Run `node dist/index.js auth` to re-authorize.'
          );
        }
        throw new UserError(`Failed to send draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
