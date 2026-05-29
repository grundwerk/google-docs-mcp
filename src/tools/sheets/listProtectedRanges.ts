import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listProtectedRanges',
    description: 'Lists all protected ranges in a spreadsheet with their IDs, ranges, and editors.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Listing protected ranges for ${args.spreadsheetId}`);
      try {
        const resp = await sheets.spreadsheets.get({
          spreadsheetId: args.spreadsheetId,
          fields: 'sheets(properties(sheetId,title),protectedRanges)',
        });
        const all = (resp.data.sheets || []).flatMap((s) =>
          (s.protectedRanges || []).map((p) => ({
            sheetId: s.properties?.sheetId,
            sheetTitle: s.properties?.title,
            ...p,
          }))
        );
        return JSON.stringify({ success: true, count: all.length, protectedRanges: all }, null, 2);
      } catch (error: any) {
        log.error(`Error listing protected ranges: ${error.message || error}`);
        throw new UserError(
          `Failed to list protected ranges: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
