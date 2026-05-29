import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createProtectedRange',
    description:
      "Protects a range so only the listed editors can modify it. Returns the protectedRangeId. Use 'warningOnly=true' for a soft-warning instead of hard-block.",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetId: z.number().int().describe('Numeric sheet ID.'),
      startRowIndex: z.number().int().optional().describe('0-based start row. Omit to protect whole sheet.'),
      endRowIndex: z.number().int().optional().describe('0-based end row exclusive.'),
      startColumnIndex: z.number().int().optional().describe('0-based start column.'),
      endColumnIndex: z.number().int().optional().describe('0-based end column exclusive.'),
      description: z.string().optional().describe('Reason shown to users on edit attempt.'),
      warningOnly: z.boolean().optional().default(false).describe('Soft-warning vs hard-block.'),
      editorEmails: z
        .array(z.string())
        .optional()
        .describe('List of editor emails. Omit to default to owner-only.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Protecting range on sheet ${args.sheetId}`);

      const protectedRange: any = {
        description: args.description,
        warningOnly: args.warningOnly,
      };
      if (
        args.startRowIndex !== undefined ||
        args.endRowIndex !== undefined ||
        args.startColumnIndex !== undefined ||
        args.endColumnIndex !== undefined
      ) {
        protectedRange.range = {
          sheetId: args.sheetId,
          startRowIndex: args.startRowIndex,
          endRowIndex: args.endRowIndex,
          startColumnIndex: args.startColumnIndex,
          endColumnIndex: args.endColumnIndex,
        };
      } else {
        protectedRange.range = { sheetId: args.sheetId };
      }
      if (args.editorEmails && args.editorEmails.length > 0 && !args.warningOnly) {
        protectedRange.editors = { users: args.editorEmails };
      }

      try {
        const resp = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: { requests: [{ addProtectedRange: { protectedRange } }] },
        });
        const created = resp.data.replies?.[0]?.addProtectedRange?.protectedRange;
        return JSON.stringify({ success: true, protectedRange: created }, null, 2);
      } catch (error: any) {
        log.error(`Error creating protected range: ${error.message || error}`);
        throw new UserError(`Failed to create protected range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
