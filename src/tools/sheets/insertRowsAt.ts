import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'insertRowsAt',
    description:
      'Inserts blank rows at a position in a sheet. Optionally inherits formatting from the row above (inheritFromBefore=true).',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startIndex: z.number().int().min(0).describe('0-based row to insert at.'),
      count: z.number().int().min(1).describe('Number of blank rows to insert.'),
      inheritFromBefore: z
        .boolean()
        .optional()
        .default(false)
        .describe('Inherit formatting from the row above.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Inserting ${args.count} rows at index ${args.startIndex} in sheet ${args.sheetId}`);

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId: args.sheetId,
                    dimension: 'ROWS',
                    startIndex: args.startIndex,
                    endIndex: args.startIndex + args.count,
                  },
                  inheritFromBefore: args.inheritFromBefore,
                },
              },
            ],
          },
        });
        return JSON.stringify({ success: true, insertedCount: args.count }, null, 2);
      } catch (error: any) {
        log.error(`Error inserting rows: ${error.message || error}`);
        throw new UserError(`Failed to insert rows: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
