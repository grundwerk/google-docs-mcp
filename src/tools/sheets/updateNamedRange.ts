import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateNamedRange',
    description:
      "Updates an existing named range's name and/or range. Use listNamedRanges to get namedRangeId. Pass only the fields you want to change.",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      namedRangeId: z.string().describe('The named range ID (from listNamedRanges).'),
      newName: z.string().optional().describe('New name (optional).'),
      sheetId: z.number().int().optional().describe('New sheetId for range (optional).'),
      startRowIndex: z.number().int().optional(),
      endRowIndex: z.number().int().optional(),
      startColumnIndex: z.number().int().optional(),
      endColumnIndex: z.number().int().optional(),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Updating named range ${args.namedRangeId}`);

      const namedRange: any = { namedRangeId: args.namedRangeId };
      const updateMask: string[] = [];
      if (args.newName) {
        namedRange.name = args.newName;
        updateMask.push('name');
      }
      if (
        args.sheetId !== undefined ||
        args.startRowIndex !== undefined ||
        args.endRowIndex !== undefined ||
        args.startColumnIndex !== undefined ||
        args.endColumnIndex !== undefined
      ) {
        namedRange.range = {
          sheetId: args.sheetId,
          startRowIndex: args.startRowIndex,
          endRowIndex: args.endRowIndex,
          startColumnIndex: args.startColumnIndex,
          endColumnIndex: args.endColumnIndex,
        };
        updateMask.push('range');
      }

      if (updateMask.length === 0) {
        throw new UserError('Provide at least one of newName or range fields to update.');
      }

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              { updateNamedRange: { namedRange, fields: updateMask.join(',') } },
            ],
          },
        });
        return JSON.stringify({ success: true, namedRangeId: args.namedRangeId }, null, 2);
      } catch (error: any) {
        log.error(`Error updating named range: ${error.message || error}`);
        throw new UserError(`Failed to update named range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
