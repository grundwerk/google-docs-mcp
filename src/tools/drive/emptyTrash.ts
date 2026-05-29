import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'emptyTrash',
    description:
      "PERMANENTLY DELETES all files in the user's Trash. IRREVERSIBLE. Requires explicit confirm=true to execute.",
    parameters: z.object({
      confirm: z
        .boolean()
        .default(false)
        .describe('Must be true to actually empty the trash. Default false (safety).'),
    }),
    execute: async (args, { log }) => {
      if (!args.confirm) {
        throw new UserError(
          'emptyTrash requires confirm=true. This permanently deletes ALL trashed files. There is no undo.'
        );
      }
      const drive = await getDriveClient();
      log.info('Emptying Drive trash (confirmed)');

      try {
        await drive.files.emptyTrash();
        return JSON.stringify({ success: true, trashEmptied: true }, null, 2);
      } catch (error: any) {
        log.error(`Error emptying trash: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError('Permission denied. The auth account must own the trashed files.');
        throw new UserError(`Failed to empty trash: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
