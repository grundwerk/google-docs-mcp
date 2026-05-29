import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateProtectedRange',
    description:
      "Updates a protected range's description, warningOnly flag, or editors. Pass only the fields you want to change.",
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      protectedRangeId: z.number().int().describe('Protected range ID (from listProtectedRanges).'),
      description: z.string().optional(),
      warningOnly: z.boolean().optional(),
      editorEmails: z.array(z.string()).optional().describe('Replace editor list.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Updating protected range ${args.protectedRangeId}`);

      const protectedRange: any = { protectedRangeId: args.protectedRangeId };
      const fields: string[] = [];
      if (args.description !== undefined) {
        protectedRange.description = args.description;
        fields.push('description');
      }
      if (args.warningOnly !== undefined) {
        protectedRange.warningOnly = args.warningOnly;
        fields.push('warningOnly');
      }
      if (args.editorEmails !== undefined) {
        protectedRange.editors = { users: args.editorEmails };
        fields.push('editors');
      }
      if (fields.length === 0) {
        throw new UserError('Provide at least one of description/warningOnly/editorEmails.');
      }

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              { updateProtectedRange: { protectedRange, fields: fields.join(',') } },
            ],
          },
        });
        return JSON.stringify({ success: true, protectedRangeId: args.protectedRangeId }, null, 2);
      } catch (error: any) {
        log.error(`Error updating protected range: ${error.message || error}`);
        throw new UserError(`Failed to update protected range: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
