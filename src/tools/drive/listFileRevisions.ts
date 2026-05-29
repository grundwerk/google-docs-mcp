import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listFileRevisions',
    description:
      'Lists revision history of a Drive file (versions). Returns revision IDs, modifiedTime, lastModifyingUser, etc. Used for "undo" workflows.',
    parameters: z.object({
      fileId: z.string().describe('The Drive file ID.'),
      fields: z
        .string()
        .optional()
        .default('revisions(id,modifiedTime,keepForever,lastModifyingUser,published)')
        .describe('Fields selector.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Listing revisions for ${args.fileId}`);
      try {
        const resp = await drive.revisions.list({
          fileId: args.fileId,
          fields: `nextPageToken,${args.fields}`,
        });
        return JSON.stringify({ success: true, revisions: resp.data.revisions || [] }, null, 2);
      } catch (error: any) {
        log.error(`Error listing revisions: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError(
            'Permission denied. Revisions are only available on Google-native files (Doc/Sheet/Slides) and you need writer access.'
          );
        throw new UserError(`Failed to list revisions: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
