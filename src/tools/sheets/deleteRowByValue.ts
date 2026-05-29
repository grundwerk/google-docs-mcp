import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteRowByValue',
    description:
      "Convenience tool: finds and deletes rows where a given column matches a value (exact-match by default, contains-substring if exactMatch=false). Reads sheet via values.get, identifies matching row(s), then calls batchUpdate deleteDimension. Returns the number of rows deleted. Critical for cleanup workflows where row numbers aren't known up-front.",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetName: z.string().describe("Tab name (e.g. 'Sheet1' or 'Melina Uhlmann')."),
      sheetId: z
        .number()
        .int()
        .optional()
        .describe(
          'Optional numeric sheet ID. If omitted, will be looked up from spreadsheets.get using sheetName.'
        ),
      columnIndex: z
        .number()
        .int()
        .min(0)
        .describe('0-based column index where the match value should be (e.g. 1 = column B).'),
      matchValue: z.string().describe('Value to match against. Trimmed before comparison.'),
      exactMatch: z
        .boolean()
        .optional()
        .default(true)
        .describe('true = exact equality. false = substring contains.'),
      maxDelete: z
        .number()
        .int()
        .min(1)
        .optional()
        .default(1)
        .describe('Maximum rows to delete (safety guard; default 1).'),
      startRow: z
        .number()
        .int()
        .min(1)
        .optional()
        .default(1)
        .describe(
          'First 1-based row to consider (default 1). Set to 2 to skip header.'
        ),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(
        `Looking for "${args.matchValue}" in col ${args.columnIndex} of ${args.sheetName} in ${args.spreadsheetId}`
      );

      let resolvedSheetId = args.sheetId;
      if (resolvedSheetId === undefined) {
        const info = await sheets.spreadsheets.get({ spreadsheetId: args.spreadsheetId });
        const tab = info.data.sheets?.find((s) => s.properties?.title === args.sheetName);
        if (!tab?.properties?.sheetId === undefined) {
          throw new UserError(
            `Sheet tab '${args.sheetName}' not found in spreadsheet ${args.spreadsheetId}.`
          );
        }
        resolvedSheetId = tab!.properties!.sheetId!;
      }

      const valuesResp = await sheets.spreadsheets.values.get({
        spreadsheetId: args.spreadsheetId,
        range: `'${args.sheetName}'`,
      });
      const rows = valuesResp.data.values || [];

      const wanted = args.matchValue.trim();
      const matchIndices: number[] = [];
      const startIdx = (args.startRow ?? 1) - 1;
      for (let i = startIdx; i < rows.length; i++) {
        const cell = (rows[i][args.columnIndex] ?? '').toString().trim();
        const hit = args.exactMatch ? cell === wanted : cell.includes(wanted);
        if (hit) matchIndices.push(i);
        if (matchIndices.length >= (args.maxDelete ?? 1)) break;
      }

      if (matchIndices.length === 0) {
        return JSON.stringify(
          { success: true, deleted: 0, message: 'No matching rows found.', searchedRows: rows.length },
          null,
          2
        );
      }

      // Delete from bottom-up so earlier indices don't shift.
      const requests = matchIndices
        .slice()
        .sort((a, b) => b - a)
        .map((idx) => ({
          deleteDimension: {
            range: {
              sheetId: resolvedSheetId,
              dimension: 'ROWS' as const,
              startIndex: idx,
              endIndex: idx + 1,
            },
          },
        }));

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: { requests },
        });

        return JSON.stringify(
          {
            success: true,
            deleted: matchIndices.length,
            deletedZeroBasedRows: matchIndices,
            deletedOneBasedRows: matchIndices.map((i) => i + 1),
            matchValue: args.matchValue,
            searchedRows: rows.length,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error deleting by value: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need edit access on the spreadsheet.');
        throw new UserError(`Failed to delete rows: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
