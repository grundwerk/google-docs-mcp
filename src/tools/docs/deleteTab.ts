import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';
import { DocumentIdParameter } from '../../types.js';
import * as GDocsHelpers from '../../googleDocsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteTab',
    description:
      'Deletes a tab from a Google Docs document. IMPORTANT: this also deletes all child (nested) tabs beneath it. Use listTabs to get the tabId first. This cannot be undone.',
    parameters: DocumentIdParameter.extend({
      tabId: z
        .string()
        .describe('The ID of the tab to delete. Use listTabs to get tab IDs.'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Deleting tab ${args.tabId} in doc ${args.documentId}`);

      try {
        // Verify the tab exists and capture its title for the response.
        const docInfo = await docs.documents.get({
          documentId: args.documentId,
          includeTabsContent: true,
          fields: 'tabs(tabProperties,childTabs(tabProperties,childTabs(tabProperties,childTabs)))',
        });
        const targetTab = GDocsHelpers.findTabById(docInfo.data, args.tabId);
        if (!targetTab) {
          throw new UserError(`Tab with ID "${args.tabId}" not found in document.`);
        }
        const oldTitle = targetTab.tabProperties?.title || '(untitled)';

        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                deleteTab: {
                  tabId: args.tabId,
                },
              },
            ],
          },
        });

        return `Successfully deleted tab "${oldTitle}" (id: ${args.tabId}).`;
      } catch (error: any) {
        log.error(`Error deleting tab ${args.tabId} in doc ${args.documentId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError(`Document not found (ID: ${args.documentId}).`);
        if (error.code === 403)
          throw new UserError(`Permission denied for document (ID: ${args.documentId}).`);
        throw new UserError(`Failed to delete tab: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
