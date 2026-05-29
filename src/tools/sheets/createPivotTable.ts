import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createPivotTable',
    description:
      'Creates a pivot table at a target cell from a source range. Specify rowGroups (0-based column indices), columnGroups, and value aggregations. Common: rowGroups=[0] (group by col A), values=[{sourceColumnOffset: 2, summarizeFunction: "SUM"}] (sum col C).',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sourceSheetId: z.number().int().describe('Sheet ID with source data.'),
      sourceStartRow: z.number().int().min(0),
      sourceEndRow: z.number().int().min(1),
      sourceStartColumn: z.number().int().min(0),
      sourceEndColumn: z.number().int().min(1),
      targetSheetId: z.number().int().describe('Sheet ID for the pivot.'),
      targetRow: z.number().int().min(0).default(0),
      targetColumn: z.number().int().min(0).default(0),
      rowGroups: z
        .array(z.number().int())
        .default([])
        .describe('0-based column indices (within source range) to group as rows.'),
      columnGroups: z
        .array(z.number().int())
        .default([])
        .describe('0-based column indices to group as columns.'),
      values: z
        .array(
          z.object({
            sourceColumnOffset: z.number().int().min(0),
            summarizeFunction: z
              .enum([
                'SUM',
                'COUNTA',
                'COUNT',
                'COUNTUNIQUE',
                'AVERAGE',
                'MAX',
                'MIN',
                'MEDIAN',
                'PRODUCT',
                'STDEV',
                'STDEVP',
                'VAR',
                'VARP',
              ])
              .default('SUM'),
            name: z.string().optional(),
          })
        )
        .min(1)
        .describe('At least one value aggregation.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info('Creating pivot table');

      const pivotTable: any = {
        source: {
          sheetId: args.sourceSheetId,
          startRowIndex: args.sourceStartRow,
          endRowIndex: args.sourceEndRow,
          startColumnIndex: args.sourceStartColumn,
          endColumnIndex: args.sourceEndColumn,
        },
        rows: args.rowGroups.map((c) => ({ sourceColumnOffset: c, showTotals: true, sortOrder: 'ASCENDING' })),
        columns: args.columnGroups.map((c) => ({ sourceColumnOffset: c, showTotals: true, sortOrder: 'ASCENDING' })),
        values: args.values,
      };

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: {
            requests: [
              {
                updateCells: {
                  rows: [{ values: [{ pivotTable }] }],
                  start: {
                    sheetId: args.targetSheetId,
                    rowIndex: args.targetRow,
                    columnIndex: args.targetColumn,
                  },
                  fields: 'pivotTable',
                },
              },
            ],
          },
        });
        return JSON.stringify(
          {
            success: true,
            targetSheetId: args.targetSheetId,
            targetRow: args.targetRow,
            targetColumn: args.targetColumn,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating pivot table: ${error.message || error}`);
        throw new UserError(`Failed to create pivot table: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
