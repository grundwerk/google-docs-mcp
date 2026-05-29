import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'mergeCells',
    description:
      "Merges cells in a range. mergeType: MERGE_ALL (single merged cell), MERGE_COLUMNS (per column), MERGE_ROWS (per row).",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startRowIndex: z.number().int().min(0),
      endRowIndex: z.number().int().min(1),
      startColumnIndex: z.number().int().min(0),
      endColumnIndex: z.number().int().min(1),
      mergeType: z
        .enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'])
        .default('MERGE_ALL'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Merging cells in sheet ${args.sheetId}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                mergeCells: {
                  mergeType: args.mergeType,
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
        return JSON.stringify({ success: true, mergeType: args.mergeType }, null, 2);
      } catch (error: any) {
        log.error(`Error merging cells: ${error.message || error}`);
        throw new UserError(`Failed to merge cells: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
