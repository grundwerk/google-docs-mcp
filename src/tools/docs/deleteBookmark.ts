import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteBookmark',
    description: 'Deletes a bookmark (named range) by its ID. Use listBookmarks to find the ID.',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      bookmarkId: z.string().describe('The bookmarkId/namedRangeId.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Deleting bookmark ${args.bookmarkId} in doc ${args.documentId}`);
      try {
        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [{ deleteNamedRange: { namedRangeId: args.bookmarkId } }],
          },
        });
        return JSON.stringify({ success: true, deletedBookmarkId: args.bookmarkId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting bookmark: ${error.message || error}`);
        throw new UserError(`Failed to delete bookmark: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
