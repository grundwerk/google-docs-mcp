import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'starFile',
    description: 'Stars a Drive file/folder (shows up in "Starred" view).',
    parameters: z.object({
      fileId: z.string().describe('The Drive file/folder ID.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Starring file ${args.fileId}`);
      try {
        const resp = await drive.files.update({
          fileId: args.fileId,
          requestBody: { starred: true },
          supportsAllDrives: true,
          fields: 'id,name,starred',
        });
        return JSON.stringify({ success: true, file: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error starring file: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need writer access on the file.');
        throw new UserError(`Failed to star file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
