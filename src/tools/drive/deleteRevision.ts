import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteRevision',
    description:
      "Permanently deletes a specific revision of a Drive file. Cannot delete the latest revision. Use carefully — revisions normally don't need manual cleanup.",
    parameters: z.object({
      fileId: z.string().describe('The Drive file ID.'),
      revisionId: z.string().describe('Revision ID (from listFileRevisions).'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Deleting revision ${args.revisionId} on ${args.fileId}`);
      try {
        await drive.revisions.delete({ fileId: args.fileId, revisionId: args.revisionId });
        return JSON.stringify({ success: true, deletedRevisionId: args.revisionId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting revision: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(`Revision ${args.revisionId} not found.`);
        if (error.code === 400)
          throw new UserError('Cannot delete the latest revision of a file.');
        throw new UserError(`Failed to delete revision: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
