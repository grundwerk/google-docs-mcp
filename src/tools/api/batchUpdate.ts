import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import type { docs_v1, sheets_v4, slides_v1 } from 'googleapis';
import { getDocsClient, getSheetsClient, getSlidesClient } from '../../clients.js';
import { toGoogleUserError } from './errors.js';

// Raw batchUpdate for Slides, Docs and Sheets: every request type of the three APIs in one call,
// instead of one curated tool per request type. Requests are passed through unchanged, the
// replies come back unchanged, so the Google API reference is the documentation.

function requireRequests(requests: unknown[]) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new UserError('batchUpdate needs at least one request (requests must not be empty).');
  }
}

export async function executeSlidesBatchUpdate(
  slides: slides_v1.Slides,
  args: { presentationId: string; requests: any[]; writeControl?: any }
): Promise<string> {
  requireRequests(args.requests);
  try {
    const res = await slides.presentations.batchUpdate({
      presentationId: args.presentationId,
      requestBody: {
        requests: args.requests,
        ...(args.writeControl ? { writeControl: args.writeControl } : {}),
      },
    });
    return JSON.stringify(res.data, null, 2);
  } catch (error: any) {
    throw toGoogleUserError('Slides batchUpdate failed', error);
  }
}

export async function executeDocsBatchUpdate(
  docs: docs_v1.Docs,
  args: { documentId: string; requests: any[]; writeControl?: any }
): Promise<string> {
  requireRequests(args.requests);
  try {
    const res = await docs.documents.batchUpdate({
      documentId: args.documentId,
      requestBody: {
        requests: args.requests,
        ...(args.writeControl ? { writeControl: args.writeControl } : {}),
      },
    });
    return JSON.stringify(res.data, null, 2);
  } catch (error: any) {
    throw toGoogleUserError('Docs batchUpdate failed', error);
  }
}

export async function executeSheetsBatchUpdate(
  sheets: sheets_v4.Sheets,
  args: { spreadsheetId: string; requests: any[] }
): Promise<string> {
  requireRequests(args.requests);
  try {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: { requests: args.requests },
    });
    return JSON.stringify(res.data, null, 2);
  } catch (error: any) {
    throw toGoogleUserError('Sheets batchUpdate failed', error);
  }
}

const requestsParam = z
  .array(z.record(z.any()))
  .min(1)
  .describe(
    'Raw request objects exactly as in the Google API reference, applied atomically in order.'
  );

export function register(server: FastMCP) {
  server.addTool({
    name: 'slidesBatchUpdate',
    description:
      'Raw Google Slides presentations.batchUpdate: ALL Slides request types (createShape, createImage, insertText, updateTextStyle, updateShapeProperties, updatePageProperties, createSlide, deleteObject, updateSlidesPosition, createTable, createLine, groupObjects ...). ' +
      'Coordinates in EMU (1 inch = 914400, 1 pt = 12700). Use getPresentationJson for object IDs. Images: createImage needs a URL Google can fetch, e.g. the contentUrl from getPresentationJson (valid 30 minutes).',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      requests: requestsParam,
      writeControl: z.record(z.any()).optional(),
    }),
    execute: async (args) => executeSlidesBatchUpdate(await getSlidesClient(), args as any),
  });

  server.addTool({
    name: 'docsBatchUpdate',
    description:
      'Raw Google Docs documents.batchUpdate: ALL Docs request types (insertText, updateTextStyle, updateParagraphStyle, insertInlineImage, createParagraphBullets, insertTable, deleteContentRange ...).',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      requests: requestsParam,
      writeControl: z.record(z.any()).optional(),
    }),
    execute: async (args) => executeDocsBatchUpdate(await getDocsClient(), args as any),
  });

  server.addTool({
    name: 'sheetsBatchUpdate',
    description:
      'Raw Google Sheets spreadsheets.batchUpdate: ALL Sheets request types (addSheet, repeatCell, updateBorders, addConditionalFormatRule, addChart, mergeCells, updateDimensionProperties ...).',
    parameters: z.object({
      spreadsheetId: z.string().describe('The spreadsheet ID.'),
      requests: requestsParam,
    }),
    execute: async (args) => executeSheetsBatchUpdate(await getSheetsClient(), args as any),
  });
}
