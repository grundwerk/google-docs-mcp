import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listNamedRanges',
    description: 'Lists all named ranges in a spreadsheet with their IDs, names, and ranges.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Listing named ranges for ${args.spreadsheetId}`);
      try {
        const resp = await sheets.spreadsheets.get({
          spreadsheetId: args.spreadsheetId,
          fields: 'namedRanges',
        });
        return JSON.stringify(
          { success: true, namedRanges: resp.data.namedRanges || [] },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing named ranges: ${error.message || error}`);
        throw new UserError(`Failed to list named ranges: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
