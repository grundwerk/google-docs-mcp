import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createChart',
    description:
      'Adds a basic chart (column/bar/line/area/scatter/pie) to a sheet, sourced from a data range. Chart is placed at anchorCell (e.g. row 1, col 6). For complex multi-series charts, use batchWrite with custom request bodies.',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      sourceSheetId: z.number().int().describe('Sheet ID containing the data.'),
      sourceStartRow: z.number().int().min(0).describe('0-based start row.'),
      sourceEndRow: z.number().int().min(1).describe('0-based end row exclusive.'),
      sourceStartColumn: z.number().int().min(0).describe('0-based start column.'),
      sourceEndColumn: z.number().int().min(1).describe('0-based end column exclusive.'),
      chartType: z
        .enum(['COLUMN', 'BAR', 'LINE', 'AREA', 'SCATTER', 'PIE', 'STEPPED_AREA'])
        .describe('Chart type.'),
      title: z.string().optional().describe('Chart title.'),
      legendPosition: z
        .enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'NO_LEGEND'])
        .optional()
        .default('BOTTOM_LEGEND'),
      anchorSheetId: z.number().int().optional().describe('Sheet to place chart (defaults to sourceSheetId).'),
      anchorRow: z.number().int().min(0).optional().default(0).describe('0-based anchor row.'),
      anchorColumn: z.number().int().min(0).optional().default(0).describe('0-based anchor column.'),
    }),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Creating ${args.chartType} chart`);

      const isPie = args.chartType === 'PIE';
      const sourceRange = {
        sheetId: args.sourceSheetId,
        startRowIndex: args.sourceStartRow,
        endRowIndex: args.sourceEndRow,
        startColumnIndex: args.sourceStartColumn,
        endColumnIndex: args.sourceEndColumn,
      };

      const chart: any = {
        spec: {
          title: args.title,
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: args.anchorSheetId ?? args.sourceSheetId,
              rowIndex: args.anchorRow,
              columnIndex: args.anchorColumn,
            },
          },
        },
      };

      if (isPie) {
        chart.spec.pieChart = {
          legendPosition: args.legendPosition,
          domain: { sourceRange: { sources: [sourceRange] } },
          series: { sourceRange: { sources: [sourceRange] } },
        };
      } else {
        chart.spec.basicChart = {
          chartType: args.chartType,
          legendPosition: args.legendPosition,
          domains: [{ domain: { sourceRange: { sources: [sourceRange] } } }],
          series: [{ series: { sourceRange: { sources: [sourceRange] } } }],
          headerCount: 1,
        };
      }

      try {
        const resp = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: args.spreadsheetId,
          requestBody: { requests: [{ addChart: { chart } }] },
        });
        const created = resp.data.replies?.[0]?.addChart?.chart;
        return JSON.stringify({ success: true, chartId: created?.chartId, chartType: args.chartType }, null, 2);
      } catch (error: any) {
        log.error(`Error creating chart: ${error.message || error}`);
        throw new UserError(`Failed to create chart: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
