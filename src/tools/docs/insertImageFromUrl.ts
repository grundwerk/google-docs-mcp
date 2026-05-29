import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'insertImageFromUrl',
    description:
      "Inserts an inline image from a public URL into a Google Doc. The URL must be HTTPS and publicly accessible (Docs API fetches it server-side). For Drive-hosted images, use the existing insertImage tool.",
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      imageUrl: z.string().describe('Public HTTPS URL of the image.'),
      insertIndex: z.number().int().min(1).describe('1-based insertion index.'),
      width: z.number().optional().describe('Width in points (1 inch = 72 points).'),
      height: z.number().optional().describe('Height in points.'),
      tabId: z.string().optional().describe('Optional tab ID if inserting into a specific tab.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Inserting image from ${args.imageUrl} into doc ${args.documentId}`);

      const insertReq: any = {
        location: args.tabId ? { tabId: args.tabId, index: args.insertIndex } : { index: args.insertIndex },
        uri: args.imageUrl,
      };
      if (args.width !== undefined || args.height !== undefined) {
        insertReq.objectSize = {
          width: args.width !== undefined ? { magnitude: args.width, unit: 'PT' } : undefined,
          height: args.height !== undefined ? { magnitude: args.height, unit: 'PT' } : undefined,
        };
      }

      try {
        const resp = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests: [{ insertInlineImage: insertReq }] },
        });
        const objectId = resp.data.replies?.[0]?.insertInlineImage?.objectId;
        return JSON.stringify({ success: true, objectId, imageUrl: args.imageUrl }, null, 2);
      } catch (error: any) {
        log.error(`Error inserting image from URL: ${error.message || error}`);
        if (error.code === 400)
          throw new UserError(
            `Docs rejected image URL (400). Make sure URL is HTTPS, publicly accessible, and points to a valid image format (PNG/JPG/GIF). Detail: ${error.message}`
          );
        throw new UserError(`Failed to insert image from URL: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
