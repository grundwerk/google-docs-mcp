import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'setColumnVisibility',
    description:
      'Hides or shows a range of columns (by 0-based start/end). Single tool covers both hide and show via the hidden parameter.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startIndex: z.number().int().min(0).describe('0-based start column (inclusive).'),
      endIndex: z.number().int().min(1).describe('0-based end column (exclusive).'),
      hidden: z.boolean().describe('true = hide, false = show.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(
        `Setting column visibility ${args.hidden ? 'hidden' : 'visible'} for cols ${args.startIndex}-${args.endIndex}`
      );
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId: args.sheetId,
                    dimension: 'COLUMNS',
                    startIndex: args.startIndex,
                    endIndex: args.endIndex,
                  },
                  properties: { hiddenByUser: args.hidden },
                  fields: 'hiddenByUser',
                },
              },
            ],
          },
        });
        return JSON.stringify({ success: true, hidden: args.hidden }, null, 2);
      } catch (error: any) {
        log.error(`Error setting column visibility: ${error.message || error}`);
        throw new UserError(`Failed to set column visibility: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
