import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createPresentation',
    description:
      'Creates a new (empty) Google Slides presentation. Returns the presentationId — use it for addSlide/replacePlaceholderText/exportPresentation.',
    parameters: z.object({
      title: z.string().describe('Presentation title.'),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Creating presentation '${args.title}'`);
      try {
        const resp = await slides.presentations.create({ requestBody: { title: args.title } });
        return JSON.stringify(
          {
            success: true,
            presentationId: resp.data.presentationId,
            title: resp.data.title,
            slides: resp.data.slides?.map((s) => s.objectId) || [],
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating presentation: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. The 'presentations' scope must be granted. Run `node dist/index.js auth` to re-authorize."
          );
        throw new UserError(`Failed to create presentation: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
