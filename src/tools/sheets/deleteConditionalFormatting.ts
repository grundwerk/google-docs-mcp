import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';
import * as SheetsHelpers from '../../googleSheetsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteConditionalFormatting',
    description:
      'Deletes a single conditional formatting rule from a sheet by its 0-based index. Run listConditionalFormatRules first to find the index of the rule you want to remove (indices shift after each delete, so re-list between deletes).',
    parameters: z.object({
      spreadsheetId: z
        .string()
        .describe(
          'The spreadsheet ID — the long string between /d/ and /edit in a Google Sheets URL.'
        ),
      sheetName: z
        .string()
        .optional()
        .describe('Name of the sheet/tab the rule lives on. Defaults to the first sheet.'),
      index: z
        .number()
        .int()
        .min(0)
        .describe(
          'The 0-based index of the rule within the sheet (from listConditionalFormatRules).'
        ),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(
        `Deleting conditional format rule at index ${args.index} in spreadsheet ${args.spreadsheetId}`
      );

      try {
        await SheetsHelpers.deleteConditionalFormatRule(
          sheets,
          args.spreadsheetId,
          args.sheetName,
          args.index
        );

        return `Successfully deleted conditional formatting rule at index ${args.index}${
          args.sheetName ? ` on sheet "${args.sheetName}"` : ''
        }.`;
      } catch (error: any) {
        log.error(`Error deleting conditional format rule: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(
          `Failed to delete conditional formatting: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
