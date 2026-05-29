import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createBookmark',
    description:
      'Creates a bookmark (named range) covering a span of text in a Google Doc. Use listBookmarks to retrieve the bookmarkId for cross-document linking.',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      name: z.string().describe("Bookmark name (free-form, e.g. 'Section1', 'Conclusion')."),
      startIndex: z.number().int().min(1).describe('1-based start index of the bookmarked text.'),
      endIndex: z.number().int().min(2).describe('1-based end index (exclusive).'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Creating bookmark '${args.name}' in doc ${args.documentId}`);
      try {
        const resp = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                createNamedRange: {
                  name: args.name,
                  range: { startIndex: args.startIndex, endIndex: args.endIndex },
                },
              },
            ],
          },
        });
        const namedRangeId = resp.data.replies?.[0]?.createNamedRange?.namedRangeId;
        return JSON.stringify({ success: true, name: args.name, bookmarkId: namedRangeId }, null, 2);
      } catch (error: any) {
        log.error(`Error creating bookmark: ${error.message || error}`);
        throw new UserError(`Failed to create bookmark: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
