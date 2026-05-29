import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteNamedRange',
    description: 'Deletes a named range by ID. Use listNamedRanges to find the ID.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      namedRangeId: z.string().describe('The named range ID.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Deleting named range ${args.namedRangeId}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [{ deleteNamedRange: { namedRangeId: args.namedRangeId } }],
          },
        });
        return JSON.stringify({ success: true, deletedNamedRangeId: args.namedRangeId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting named range: ${error.message || error}`);
        throw new UserError(`Failed to delete named range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
