import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'findReplaceDocs',
    description:
      'Replaces all occurrences of a text in a Google Doc. Optional case-sensitive matching. Returns the replacement count.',
    parameters: z.object({
      documentId: z.string().describe('The document ID.'),
      findText: z.string().describe('Text to find.'),
      replaceText: z.string().describe('Replacement text.'),
      matchCase: z.boolean().optional().default(false).describe('Case-sensitive match.'),
      tabId: z.string().optional().describe('Optional tab ID to limit search to a single tab.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Find/replace in doc ${args.documentId}: '${args.findText}' → '${args.replaceText}'`);
      try {
        const replaceAllText: any = {
          containsText: { text: args.findText, matchCase: args.matchCase },
          replaceText: args.replaceText,
        };
        if (args.tabId) {
          replaceAllText.tabsCriteria = { tabIds: [args.tabId] };
        }
        const resp = await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests: [{ replaceAllText }] },
        });
        const r = resp.data.replies?.[0]?.replaceAllText;
        return JSON.stringify({ success: true, occurrencesChanged: r?.occurrencesChanged || 0 }, null, 2);
      } catch (error: any) {
        log.error(`Error find/replace docs: ${error.message || error}`);
        throw new UserError(`Failed to find/replace in doc: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
