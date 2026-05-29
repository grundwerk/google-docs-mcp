import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'duplicateSlide',
    description: 'Duplicates an existing slide. Returns the new slide objectId.',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      slideObjectId: z.string().describe('Source slide objectId to duplicate.'),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Duplicating slide ${args.slideObjectId}`);
      try {
        const resp = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [{ duplicateObject: { objectId: args.slideObjectId } }],
          },
        });
        const newId = resp.data.replies?.[0]?.duplicateObject?.objectId;
        return JSON.stringify({ success: true, newSlideObjectId: newId }, null, 2);
      } catch (error: any) {
        log.error(`Error duplicating slide: ${error.message || error}`);
        throw new UserError(`Failed to duplicate slide: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
