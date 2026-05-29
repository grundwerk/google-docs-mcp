import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listPresentations',
    description: 'Lists Google Slides presentations (via Drive search) ordered by recent modification.',
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe("Optional name filter (e.g. 'Q4 Report'). Substring match."),
      pageSize: z.number().int().min(1).max(1000).optional().default(50),
      folderId: z.string().optional().describe('Optional folder ID to restrict search to.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info('Listing Slides presentations');
      try {
        const qParts = ["mimeType='application/vnd.google-apps.presentation'", 'trashed=false'];
        if (args.query) qParts.push(`name contains '${args.query.replace(/'/g, "\\'")}'`);
        if (args.folderId) qParts.push(`'${args.folderId}' in parents`);
        const resp = await drive.files.list({
          q: qParts.join(' and '),
          pageSize: args.pageSize,
          orderBy: 'modifiedTime desc',
          fields: 'files(id,name,modifiedTime,webViewLink,owners(emailAddress))',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        return JSON.stringify(
          { success: true, count: resp.data.files?.length || 0, presentations: resp.data.files || [] },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing presentations: ${error.message || error}`);
        throw new UserError(`Failed to list presentations: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
