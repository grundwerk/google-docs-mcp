import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listBookmarks',
    description: 'Lists all bookmarks (named ranges) in a Google Doc.',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Listing bookmarks in doc ${args.documentId}`);
      try {
        const resp = await docs.documents.get({ documentId: args.documentId, fields: 'namedRanges' });
        const namedRanges = resp.data.namedRanges || {};
        const flat = Object.entries(namedRanges).flatMap(([name, group]: [string, any]) =>
          (group.namedRanges || []).map((nr: any) => ({
            name,
            bookmarkId: nr.namedRangeId,
            ranges: nr.ranges,
          }))
        );
        return JSON.stringify({ success: true, count: flat.length, bookmarks: flat }, null, 2);
      } catch (error: any) {
        log.error(`Error listing bookmarks: ${error.message || error}`);
        throw new UserError(`Failed to list bookmarks: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
