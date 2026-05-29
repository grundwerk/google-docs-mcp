import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'findReplace',
    description:
      'Find and replace values in a sheet, single sheet, or entire spreadsheet. Optional regex, case-sensitive match, and whole-cell match. Returns the count of replacements.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      find: z.string().describe('The value/pattern to search for.'),
      replacement: z.string().describe('The replacement value.'),
      matchCase: z.boolean().optional().default(false).describe('Case-sensitive match.'),
      matchEntireCell: z.boolean().optional().default(false).describe('Only match full cell.'),
      searchByRegex: z.boolean().optional().default(false).describe('Interpret find as regex.'),
      includeFormulas: z.boolean().optional().default(false).describe('Search formulas too.'),
      scope: z
        .enum(['allSheets', 'sheet', 'range'])
        .default('allSheets')
        .describe("Scope: 'allSheets' (entire spreadsheet), 'sheet' (one tab), or 'range'."),
      sheetId: z.number().int().optional().describe('Required if scope is sheet or range.'),
      startRowIndex: z.number().int().optional().describe('Required if scope is range.'),
      endRowIndex: z.number().int().optional().describe('Required if scope is range.'),
      startColumnIndex: z.number().int().optional().describe('Required if scope is range.'),
      endColumnIndex: z.number().int().optional().describe('Required if scope is range.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Find/replace '${args.find}' → '${args.replacement}' (scope=${args.scope})`);

      const findReplaceReq: any = {
        find: args.find,
        replacement: args.replacement,
        matchCase: args.matchCase,
        matchEntireCell: args.matchEntireCell,
        searchByRegex: args.searchByRegex,
        includeFormulas: args.includeFormulas,
      };
      if (args.scope === 'allSheets') {
        findReplaceReq.allSheets = true;
      } else if (args.scope === 'sheet') {
        if (args.sheetId === undefined) throw new UserError("scope='sheet' requires sheetId.");
        findReplaceReq.sheetId = args.sheetId;
      } else {
        if (
          args.sheetId === undefined ||
          args.startRowIndex === undefined ||
          args.endRowIndex === undefined ||
          args.startColumnIndex === undefined ||
          args.endColumnIndex === undefined
        ) {
          throw new UserError("scope='range' requires sheetId+start/end Row/Column Index.");
        }
        findReplaceReq.range = {
          sheetId: args.sheetId,
          startRowIndex: args.startRowIndex,
          endRowIndex: args.endRowIndex,
          startColumnIndex: args.startColumnIndex,
          endColumnIndex: args.endColumnIndex,
        };
      }

      try {
        const resp = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: { requests: [{ findReplace: findReplaceReq }] },
        });
        const r = resp.data.replies?.[0]?.findReplace;
        return JSON.stringify(
          {
            success: true,
            valuesChanged: r?.valuesChanged || 0,
            occurrencesChanged: r?.occurrencesChanged || 0,
            rowsChanged: r?.rowsChanged || 0,
            sheetsChanged: r?.sheetsChanged || 0,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error find/replace: ${error.message || error}`);
        throw new UserError(`Failed to find/replace: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
