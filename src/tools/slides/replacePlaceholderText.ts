import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getSlidesClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'replacePlaceholderText',
    description:
      "Replaces text placeholders like {{customerName}} or {{date}} throughout a presentation. Standard template-fill workflow.",
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      replacements: z
        .record(z.string(), z.string())
        .describe('Object mapping placeholder → replacement (e.g. {"{{name}}": "Tom"}).'),
      matchCase: z.boolean().optional().default(true),
    }),
    execute: async (args, { log }) => {
      const slides = await getSlidesClient();
      log.info(`Replacing ${Object.keys(args.replacements).length} placeholders`);
      try {
        const requests = Object.entries(args.replacements).map(([find, replace]) => ({
          replaceAllText: {
            containsText: { text: find, matchCase: args.matchCase },
            replaceText: replace,
          },
        }));
        const resp = await slides.presentations.batchUpdate({
          presentationId: args.presentationId,
          requestBody: { requests },
        });
        const replyChanges = (resp.data.replies || []).map((r: any) => r.replaceAllText?.occurrencesChanged || 0);
        const total = replyChanges.reduce((a: number, b: number) => a + b, 0);
        return JSON.stringify({ success: true, totalReplacements: total, perKey: replyChanges }, null, 2);
      } catch (error: any) {
        log.error(`Error replacing placeholders: ${error.message || error}`);
        throw new UserError(`Failed to replace placeholders: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
