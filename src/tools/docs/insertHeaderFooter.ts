import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'insertHeaderFooter',
    description:
      "Adds a header and/or footer to a Google Doc with optional text content. Use type='HEADER', 'FOOTER', or 'BOTH'. Returns the created header/footer IDs.",
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      type: z.enum(['HEADER', 'FOOTER', 'BOTH']).describe('Which section to create.'),
      headerText: z.string().optional().describe('Optional initial header text.'),
      footerText: z.string().optional().describe('Optional initial footer text.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Inserting ${args.type} in doc ${args.documentId}`);

      const requests: any[] = [];
      if (args.type === 'HEADER' || args.type === 'BOTH') {
        requests.push({ createHeader: { type: 'DEFAULT' } });
      }
      if (args.type === 'FOOTER' || args.type === 'BOTH') {
        requests.push({ createFooter: { type: 'DEFAULT' } });
      }

      try {
        const resp = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests },
        });
        const headerId = resp.data.replies?.find((r: any) => r.createHeader)?.createHeader?.headerId;
        const footerId = resp.data.replies?.find((r: any) => r.createFooter)?.createFooter?.footerId;

        const textRequests: any[] = [];
        if (headerId && args.headerText) {
          textRequests.push({
            insertText: { location: { segmentId: headerId, index: 0 }, text: args.headerText },
          });
        }
        if (footerId && args.footerText) {
          textRequests.push({
            insertText: { location: { segmentId: footerId, index: 0 }, text: args.footerText },
          });
        }
        if (textRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: args.documentId,
            requestBody: { requests: textRequests },
          });
        }

        return JSON.stringify({ success: true, headerId, footerId }, null, 2);
      } catch (error: any) {
        log.error(`Error inserting header/footer: ${error.message || error}`);
        throw new UserError(`Failed to insert header/footer: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
