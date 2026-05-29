import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'unmergeCells',
    description: 'Unmerges any merged cells within a range.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startRowIndex: z.number().int().min(0),
      endRowIndex: z.number().int().min(1),
      startColumnIndex: z.number().int().min(0),
      endColumnIndex: z.number().int().min(1),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Unmerging cells in sheet ${args.sheetId}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                unmergeCells: {
                  range: {
                    sheetId: args.sheetId,
                    startRowIndex: args.startRowIndex,
                    endRowIndex: args.endRowIndex,
                    startColumnIndex: args.startColumnIndex,
                    endColumnIndex: args.endColumnIndex,
                  },
                },
              },
            ],
          },
        });
        return JSON.stringify({ success: true }, null, 2);
      } catch (error: any) {
        log.error(`Error unmerging cells: ${error.message || error}`);
        throw new UserError(`Failed to unmerge cells: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
