import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'replaceImage',
    description:
      'Replaces an image in a presentation by its imageObjectId with a new image URL. Use getPresentation to find image object IDs.',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      imageObjectId: z.string().describe('The object ID of the image to replace.'),
      newImageUrl: z.string().describe('Public HTTPS URL of the new image.'),
      method: z.enum(['CENTER_CROP', 'CENTER_INSIDE']).optional().default('CENTER_INSIDE'),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Replacing image ${args.imageObjectId}`);
      try {
        await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: {
            requests: [
              {
                replaceImage: {
                  imageObjectId: args.imageObjectId,
                  url: args.newImageUrl,
                  imageReplaceMethod: args.method,
                },
              },
            ],
          },
        });
        return JSON.stringify({ success: true, imageObjectId: args.imageObjectId }, null, 2);
      } catch (error: any) {
        log.error(`Error replacing image: ${error.message || error}`);
        throw new UserError(`Failed to replace image: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
