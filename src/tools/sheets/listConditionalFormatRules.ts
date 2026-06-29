import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';
import * as SheetsHelpers from '../../googleSheetsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listConditionalFormatRules',
    description:
      'Lists the conditional formatting rules in a spreadsheet, grouped by sheet. Each rule is returned with its 0-based index, applied ranges, condition and background color. Use the returned index with deleteConditionalFormatting to remove a specific rule.',
    parameters: z.object({
      spreadsheetId: z
        .string()
        .describe(
          'The spreadsheet ID — the long string between /d/ and /edit in a Google Sheets URL.'
        ),
      sheetName: z
        .string()
        .optional()
        .describe('Optional: only list rules for this sheet/tab. Defaults to all sheets.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Listing conditional format rules for spreadsheet ${args.spreadsheetId}`);

      try {
        const sheetsRules = await SheetsHelpers.listConditionalFormatRules(
          sheets,
          args.spreadsheetId,
          args.sheetName
        );

        return JSON.stringify(sheetsRules, null, 2);
      } catch (error: any) {
        log.error(`Error listing conditional format rules: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(
          `Failed to list conditional format rules: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
