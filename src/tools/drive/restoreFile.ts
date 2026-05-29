import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'restoreFile',
    description:
      'Restores a trashed Drive file/folder back to its previous location (un-trash). Counterpart to trashFile.',
    parameters: z.object({
      fileId: z.string().describe('The trashed file/folder ID.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Restoring file ${args.fileId}`);

      try {
        const resp = await drive.files.update({
          fileId: args.fileId,
          requestBody: { trashed: false },
          supportsAllDrives: true,
          fields: 'id,name,trashed,parents',
        });
        return JSON.stringify({ success: true, file: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error restoring file: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need writer/owner access.');
        throw new UserError(`Failed to restore file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
