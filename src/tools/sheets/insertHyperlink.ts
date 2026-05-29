import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'insertHyperlink',
    description:
      'Inserts a clickable hyperlink in a cell using the HYPERLINK formula. Writes =HYPERLINK("url", "label") to cell at (sheetName, row, column).',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sheetName: z.string().describe('Sheet/tab name.'),
      row: z.number().int().min(1).describe('1-based row index.'),
      column: z.string().describe('Column letter (e.g. "A", "B", "AA").'),
      url: z.string().describe('Target URL.'),
      label: z.string().describe('Display text for the link.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      const range = `'${args.sheetName}'!${args.column}${args.row}`;
      log.info(`Inserting hyperlink at ${range}`);
      try {
        const safeUrl = args.url.replace(/"/g, '""');
        const safeLabel = args.label.replace(/"/g, '""');
        await sheets.spreadsheets.values.update({
          spreadsheetId: args.spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[`=HYPERLINK("${safeUrl}", "${safeLabel}")`]] },
        });
        return JSON.stringify({ success: true, range, url: args.url, label: args.label }, null, 2);
      } catch (error: any) {
        log.error(`Error inserting hyperlink: ${error.message || error}`);
        throw new UserError(`Failed to insert hyperlink: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
