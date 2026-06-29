import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSheetsClient } from '../../clients.js';
import * as SheetsHelpers from '../../googleSheetsApiHelpers.js';

const BORDER_STYLES = [
  'SOLID',
  'SOLID_MEDIUM',
  'SOLID_THICK',
  'DASHED',
  'DOTTED',
  'DOUBLE',
  'NONE',
] as const;

const borderSpec = z
  .object({
    style: z
      .enum(BORDER_STYLES)
      .describe(
        'Border line style. SOLID/SOLID_MEDIUM/SOLID_THICK are increasing thicknesses; use NONE to clear a border.'
      ),
    color: z
      .string()
      .optional()
      .describe('Border color as hex (e.g., "#000000"). Defaults to black.'),
  })
  .describe('A single border side: line style plus optional hex color.');

export function register(server: FastMCP) {
  server.addTool({
    name: 'setBorders',
    description:
      'Sets borders on a range of cells. Each side (top, bottom, left, right, innerHorizontal, innerVertical) is optional and takes a style plus an optional hex color. innerHorizontal/innerVertical control the lines between cells inside the range. Provide at least one side.',
    parameters: z
      .object({
        spreadsheetId: z
          .string()
          .describe(
            'The spreadsheet ID — the long string between /d/ and /edit in a Google Sheets URL.'
          ),
        range: z
          .string()
          .describe(
            'A1 notation range to apply borders to. Examples: "Sheet1!A1:C3", "A1:D10". May include a sheet prefix.'
          ),
        top: borderSpec.optional().describe('Border on the top edge of the range.'),
        bottom: borderSpec.optional().describe('Border on the bottom edge of the range.'),
        left: borderSpec.optional().describe('Border on the left edge of the range.'),
        right: borderSpec.optional().describe('Border on the right edge of the range.'),
        innerHorizontal: borderSpec
          .optional()
          .describe('Horizontal borders between rows inside the range.'),
        innerVertical: borderSpec
          .optional()
          .describe('Vertical borders between columns inside the range.'),
      })
      .refine(
        (data) =>
          data.top !== undefined ||
          data.bottom !== undefined ||
          data.left !== undefined ||
          data.right !== undefined ||
          data.innerHorizontal !== undefined ||
          data.innerVertical !== undefined,
        { message: 'At least one border side must be provided.' }
      ),
    execute: async (args, { log }) => {
      const sheets = await getSheetsClient();
      log.info(`Setting borders on range "${args.range}" of spreadsheet ${args.spreadsheetId}`);

      try {
        await SheetsHelpers.setBorders(sheets, args.spreadsheetId, args.range, {
          top: args.top,
          bottom: args.bottom,
          left: args.left,
          right: args.right,
          innerHorizontal: args.innerHorizontal,
          innerVertical: args.innerVertical,
        });

        const sides = (
          ['top', 'bottom', 'left', 'right', 'innerHorizontal', 'innerVertical'] as const
        )
          .filter((s) => args[s] !== undefined)
          .join(', ');
        return `Successfully set borders (${sides}) on range "${args.range}".`;
      } catch (error: any) {
        log.error(`Error setting borders: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(`Failed to set borders: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
