import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteRows',
    description:
      "Deletes a range of rows from a sheet (actual delete, not clear). Use this for cleanup — clearSpreadsheetRange only blanks values but leaves empty rows behind. Indices are 0-based and end is exclusive (e.g. startIndex=4 endIndex=7 deletes rows 5,6,7 in the spreadsheet UI).",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z
        .number()
        .int()
        .describe(
          'Numeric sheet ID (gid). Get this from getSpreadsheetInfo — NOT the tab name. Default first tab is 0.'
        ),
      startIndex: z
        .number()
        .int()
        .min(0)
        .describe('0-based start row (inclusive). E.g. 0 = first row.'),
      endIndex: z
        .number()
        .int()
        .min(1)
        .describe('0-based end row (exclusive). E.g. 1 deletes only row 1 (if startIndex=0).'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(
        `Deleting rows ${args.startIndex}-${args.endIndex} in sheet ${args.sheetId} of ${args.spreadsheetId}`
      );

      if (args.endIndex <= args.startIndex) {
        throw new UserError(
          `endIndex (${args.endIndex}) must be greater than startIndex (${args.startIndex}). End is exclusive.`
        );
      }

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: args.sheetId,
                    dimension: 'ROWS',
                    startIndex: args.startIndex,
                    endIndex: args.endIndex,
                  },
                },
              },
            ],
          },
        });

        return JSON.stringify(
          {
            success: true,
            spreadsheetId: args.spreadsheetId,
            sheetId: args.sheetId,
            deletedRowCount: args.endIndex - args.startIndex,
            range: `rows ${args.startIndex + 1}–${args.endIndex} (1-based UI)`,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error deleting rows: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(`Spreadsheet ${args.spreadsheetId} not found.`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need edit access on the spreadsheet.');
        if (error.code === 400)
          throw new UserError(
            `Invalid range: ${error.message}. Check sheetId exists (use getSpreadsheetInfo) and indices are within bounds.`
          );
        throw new UserError(`Failed to delete rows: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
