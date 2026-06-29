import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';
import * as SheetsHelpers from '../../googleSheetsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'setGridlinesVisibility',
    description:
      'Shows or hides the gridlines of a sheet/tab. Set hidden=true to turn gridlines off (for a clean, print-ready look), hidden=false to turn them back on.',
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
      hidden: z.boolean().describe('Set to true to hide the gridlines, false to show them.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(
        `Setting gridlines hidden=${args.hidden} on sheet "${args.sheetName ?? 'first sheet'}" in spreadsheet ${args.spreadsheetId}`
      );

      try {
        await SheetsHelpers.setGridlinesVisibility(
          sheets,
          args.spreadsheetId,
          args.sheetName,
          args.hidden
        );

        return `Successfully ${args.hidden ? 'hid' : 'showed'} gridlines on sheet "${args.sheetName ?? 'first sheet'}".`;
      } catch (error: any) {
        log.error(`Error setting gridlines visibility: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(
          `Failed to set gridlines visibility: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
