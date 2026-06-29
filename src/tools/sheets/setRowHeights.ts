import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';
import * as SheetsHelpers from '../../googleSheetsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'setRowHeights',
    description:
      'Sets the height (in pixels) of one or more contiguous row ranges in a spreadsheet. Accepts multiple row specs in a single call. Row numbers are 1-based and inclusive, matching the numbers shown in the Sheets UI (e.g., startRow 1, endRow 3 covers rows 1, 2 and 3).',
    parameters: z.object({
      spreadsheetId: z
        .string()
        .describe(
          'The spreadsheet ID — the long string between /d/ and /edit in a Google Sheets URL.'
        ),
      sheetName: z
        .string()
        .optional()
        .describe('Name of the sheet/tab. Defaults to the first sheet if not provided.'),
      rowHeights: z
        .array(
          z.object({
            startRow: z.number().int().min(1).describe('First row to resize (1-based, inclusive).'),
            endRow: z.number().int().min(1).describe('Last row to resize (1-based, inclusive).'),
            height: z.number().int().min(0).describe('Height in pixels. Use 0 to hide the rows.'),
          })
        )
        .min(1)
        .describe('List of row height specifications to apply.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Setting row heights in spreadsheet ${args.spreadsheetId}`);

      try {
        await SheetsHelpers.setRowHeights(
          sheets,
          args.spreadsheetId,
          args.sheetName,
          args.rowHeights
        );

        const summary = args.rowHeights
          .map((rh) =>
            rh.startRow === rh.endRow
              ? `row ${rh.startRow}=${rh.height}px`
              : `rows ${rh.startRow}:${rh.endRow}=${rh.height}px`
          )
          .join(', ');
        return `Successfully set row heights: ${summary}.`;
      } catch (error: any) {
        log.error(`Error setting row heights: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(`Failed to set row heights: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
