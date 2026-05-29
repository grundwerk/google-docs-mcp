import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'sortRange',
    description:
      'Sorts a range of cells by one or more columns ascending/descending. Use for ordered output (e.g. sort leads-list by date).',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startRowIndex: z.number().int().min(0).describe('0-based start row (inclusive).'),
      endRowIndex: z.number().int().min(1).describe('0-based end row (exclusive).'),
      startColumnIndex: z.number().int().min(0).describe('0-based start column (inclusive).'),
      endColumnIndex: z.number().int().min(1).describe('0-based end column (exclusive).'),
      sortSpecs: z
        .array(
          z.object({
            dimensionIndex: z
              .number()
              .int()
              .min(0)
              .describe('0-based column index to sort by (relative to range start).'),
            sortOrder: z
              .enum(['ASCENDING', 'DESCENDING'])
              .default('ASCENDING')
              .describe('Sort direction.'),
          })
        )
        .min(1)
        .describe('One or more sort columns (first is primary).'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Sorting range in sheet ${args.sheetId}`);

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                sortRange: {
                  range: {
                    sheetId: args.sheetId,
                    startRowIndex: args.startRowIndex,
                    endRowIndex: args.endRowIndex,
                    startColumnIndex: args.startColumnIndex,
                    endColumnIndex: args.endColumnIndex,
                  },
                  sortSpecs: args.sortSpecs,
                },
              },
            ],
          },
        });
        return JSON.stringify({ success: true, sortedRows: args.endRowIndex - args.startRowIndex }, null, 2);
      } catch (error: any) {
        log.error(`Error sorting range: ${error.message || error}`);
        throw new UserError(`Failed to sort range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
