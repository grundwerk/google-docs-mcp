import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'addSlide',
    description:
      'Adds a new slide to a presentation. Optional insertionIndex (default = end). Optional predefinedLayout (e.g. TITLE_AND_BODY, BLANK).',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      insertionIndex: z.number().int().min(0).optional().describe('0-based index. Omit for append.'),
      predefinedLayout: z
        .enum([
          'BLANK',
          'CAPTION_ONLY',
          'TITLE',
          'TITLE_AND_BODY',
          'TITLE_AND_TWO_COLUMNS',
          'TITLE_ONLY',
          'SECTION_HEADER',
          'SECTION_TITLE_AND_DESCRIPTION',
          'ONE_COLUMN_TEXT',
          'MAIN_POINT',
          'BIG_NUMBER',
        ])
        .optional()
        .default('TITLE_AND_BODY'),
      slideObjectId: z.string().optional().describe('Optional custom slide ID.'),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Adding slide to ${args.presentationId}`);
      try {
        const req: any = {
          createSlide: {
            insertionIndex: args.insertionIndex,
            slideLayoutReference: { predefinedLayout: args.predefinedLayout },
          },
        };
        if (args.slideObjectId) req.createSlide.objectId = args.slideObjectId;

        const resp = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests: [req] },
        });
        const newId = resp.data.replies?.[0]?.createSlide?.objectId;
        return JSON.stringify({ success: true, slideObjectId: newId }, null, 2);
      } catch (error: any) {
        log.error(`Error adding slide: ${error.message || error}`);
        throw new UserError(`Failed to add slide: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
