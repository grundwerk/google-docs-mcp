import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteProtectedRange',
    description: 'Deletes a protected range by ID.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      protectedRangeId: z.number().int().describe('Protected range ID.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Deleting protected range ${args.protectedRangeId}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [{ deleteProtectedRange: { protectedRangeId: args.protectedRangeId } }],
          },
        });
        return JSON.stringify({ success: true, deletedProtectedRangeId: args.protectedRangeId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting protected range: ${error.message || error}`);
        throw new UserError(`Failed to delete protected range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
