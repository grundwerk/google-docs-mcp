import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'keepRevisionForever',
    description:
      "Marks a Drive file revision as keepForever (pinned, won't be auto-deleted). For Docs/Sheets/Slides which prune old revisions automatically.",
    parameters: z.object({
      fileId: z.string().describe('The Drive file ID.'),
      revisionId: z.string().describe('Revision ID (from listFileRevisions).'),
      keepForever: z.boolean().default(true).describe('Pin the revision (true) or unpin (false).'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Setting keepForever=${args.keepForever} on revision ${args.revisionId}`);
      try {
        const resp = await drive.revisions.update({
          fileId: args.fileId,
          revisionId: args.revisionId,
          requestBody: { keepForever: args.keepForever },
          fields: 'id,keepForever,modifiedTime',
        });
        return JSON.stringify({ success: true, revision: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error updating revision: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(`Revision ${args.revisionId} not found on ${args.fileId}.`);
        throw new UserError(`Failed to update revision: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
