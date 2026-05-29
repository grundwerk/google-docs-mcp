import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getDriveAbout',
    description:
      "Returns Drive 'About' info — storage quota usage, user metadata, max file sizes etc. Useful for monitoring how much Drive storage Tom has left.",
    parameters: z.object({
      fields: z
        .string()
        .optional()
        .default('storageQuota,user(emailAddress,displayName),maxImportSizes,maxUploadSize')
        .describe('Fields selector.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info('Getting Drive about info');
      try {
        const resp = await drive.about.get({ fields: args.fields });
        return JSON.stringify({ success: true, about: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error getting about: ${error.message || error}`);
        throw new UserError(`Failed to get about: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
