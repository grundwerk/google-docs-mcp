import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listScriptProjects',
    description:
      'Lists Apps Script projects via Drive search (mimeType=application/vnd.google-apps.script). For project metadata details use the editor.',
    parameters: z.object({
      query: z.string().optional().describe('Optional name filter.'),
      pageSize: z.number().int().min(1).max(1000).optional().default(50),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info('Listing Apps Script projects');
      try {
        const qParts = ["mimeType='application/vnd.google-apps.script'", 'trashed=false'];
        if (args.query) qParts.push(`name contains '${args.query.replace(/'/g, "\\'")}'`);
        const resp = await drive.files.list({
          q: qParts.join(' and '),
          pageSize: args.pageSize,
          orderBy: 'modifiedTime desc',
          fields: 'files(id,name,modifiedTime,webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        return JSON.stringify(
          { success: true, count: resp.data.files?.length || 0, projects: resp.data.files || [] },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing script projects: ${error.message || error}`);
        throw new UserError(`Failed to list script projects: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
