import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createNamedRange',
    description:
      'Creates a named range so formulas can refer to it by name (e.g. SUMIF(Sales, ...) instead of SUMIF(A2:A100, ...)). Returns the namedRangeId for later update/delete.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      name: z.string().describe("Range name (letters/digits/underscore, e.g. 'Sales')."),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startRowIndex: z.number().int().min(0).describe('0-based start row.'),
      endRowIndex: z.number().int().min(1).describe('0-based end row exclusive.'),
      startColumnIndex: z.number().int().min(0).describe('0-based start column.'),
      endColumnIndex: z.number().int().min(1).describe('0-based end column exclusive.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Creating named range '${args.name}' in sheet ${args.sheetId}`);
      try {
        const resp = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                addNamedRange: {
                  namedRange: {
                    name: args.name,
                    range: {
                      sheetId: args.sheetId,
                      startRowIndex: args.startRowIndex,
                      endRowIndex: args.endRowIndex,
                      startColumnIndex: args.startColumnIndex,
                      endColumnIndex: args.endColumnIndex,
                    },
                  },
                },
              },
            ],
          },
        });
        const nr = resp.data.replies?.[0]?.addNamedRange?.namedRange;
        return JSON.stringify({ success: true, namedRange: nr }, null, 2);
      } catch (error: any) {
        log.error(`Error creating named range: ${error.message || error}`);
        throw new UserError(`Failed to create named range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
