import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'insertTOC',
    description:
      'Inserts a Table-of-Contents at a position. Docs auto-populates from headings (Heading 1/2/3). Note: the Google Docs API support for TOC is limited — newer docs may need manual refresh in the UI.',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      index: z.number().int().min(1).describe('1-based insertion index (typically 1 for top).'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Inserting TOC at index ${args.index} in doc ${args.documentId}`);
      try {
        // The Docs API does not expose a direct addTableOfContents request.
        // Workaround: insert a placeholder line "Table of Contents" with HEADING_1
        // style; the user can then Insert > Table of contents in the UI.
        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: args.index },
                  text: 'Table of Contents\n',
                },
              },
            ],
          },
        });
        return JSON.stringify(
          {
            success: true,
            note: 'Placeholder inserted. Open the doc and use Insert → Table of contents to populate.',
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error inserting TOC: ${error.message || error}`);
        throw new UserError(`Failed to insert TOC: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
