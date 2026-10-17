import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { writeFileSync } from 'fs';
import { isAbsolute } from 'path';
import type { slides_v1 } from 'googleapis';
import { getSlidesClient } from '../../clients.js';
import { toGoogleUserError } from './errors.js';

// getPresentation only returns slide IDs and element counts. slidesBatchUpdate needs the real
// object IDs, sizes and text of every element, so this returns the full presentations.get JSON.

export async function executeGetPresentationJson(
  slides: slides_v1.Slides,
  args: { presentationId: string; fields?: string; saveToPath?: string }
): Promise<string> {
  if (args.saveToPath && !isAbsolute(args.saveToPath)) {
    throw new UserError('saveToPath must be an absolute path.');
  }
  let data: unknown;
  try {
    const res = await slides.presentations.get({
      presentationId: args.presentationId,
      ...(args.fields ? { fields: args.fields } : {}),
    });
    data = res.data;
  } catch (error: any) {
    throw toGoogleUserError('Slides presentations.get failed', error);
  }
  const json = JSON.stringify(data, null, 2);
  if (args.saveToPath) {
    writeFileSync(args.saveToPath, json);
    return JSON.stringify({ savedTo: args.saveToPath, byteCount: Buffer.byteLength(json) });
  }
  return json;
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'getPresentationJson',
    description:
      'Full Google Slides presentations.get JSON: every slide, page element, object ID, size, transform, text and style. ' +
      'Use before slidesBatchUpdate. Narrow with fields (e.g. "slides(objectId,pageElements(objectId,shape(text)))"), or pass saveToPath for large decks.',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      fields: z.string().optional().describe('Optional field mask.'),
      saveToPath: z
        .string()
        .optional()
        .describe('Absolute path: write the JSON to this file instead of returning it.'),
    }),
    execute: async (args) => executeGetPresentationJson(await getSlidesClient(), args),
  });
}
