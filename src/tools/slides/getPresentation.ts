import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getPresentation',
    description:
      'Returns presentation metadata + slide list. Use to inspect structure before addSlide/duplicateSlide.',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Getting presentation ${args.presentationId}`);
      try {
        const resp = await slides.presentations.get({ presentationId: args.presentationId });
        return JSON.stringify(
          {
            success: true,
            presentationId: resp.data.presentationId,
            title: resp.data.title,
            slideCount: resp.data.slides?.length || 0,
            slides: (resp.data.slides || []).map((s) => ({
              objectId: s.objectId,
              layoutObjectId: s.slideProperties?.layoutObjectId,
              pageElementCount: s.pageElements?.length || 0,
            })),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error getting presentation: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Presentation ${args.presentationId} not found.`);
        throw new UserError(`Failed to get presentation: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
