import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';
import { DocumentIdParameter } from '../../types.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createTab',
    description:
      'Creates a new tab in a Google Docs document. Returns the new tab ID so subsequent tools (appendMarkdown, insertText, etc.) can target it. Use index to control position (0-based); omit to append at the end. Use parentTabId to nest the new tab under an existing tab.',
    parameters: DocumentIdParameter.extend({
      title: z.string().min(1).describe('Title for the new tab.'),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          'Optional 0-based position of the new tab. Omit to append at the end. All existing tabs at or after this index shift down by one.'
        ),
      parentTabId: z
        .string()
        .optional()
        .describe(
          'Optional parent tab ID to create this tab as a child (nested tab). Use listTabs to get parent tab IDs.'
        ),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Creating tab "${args.title}" in doc ${args.documentId}`);

      try {
        const tabProperties: Record<string, any> = { title: args.title };
        if (typeof args.index === 'number') tabProperties.index = args.index;
        if (args.parentTabId) tabProperties.parentTabId = args.parentTabId;

        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: {
            requests: [
              {
                addDocumentTab: {
                  tabProperties,
                },
              },
            ],
          },
        });

        // Re-read document to find the new tab's server-assigned tabId.
        // We match by title + position — the new tab sits at `args.index`
        // (or at the end, under the same parentTabId if specified) and has
        // the exact title we just passed in.
        const docInfo = await docs.documents.get({
          documentId: args.documentId,
          includeTabsContent: true,
          fields: 'tabs(tabProperties,childTabs(tabProperties,childTabs))',
        });

        const flatten = (tabs: any[] | undefined): any[] => {
          if (!tabs) return [];
          const out: any[] = [];
          for (const t of tabs) {
            out.push(t);
            if (t.childTabs) out.push(...flatten(t.childTabs));
          }
          return out;
        };

        const allTabs = flatten(docInfo.data.tabs);
        // Pick the last tab with matching title and matching parentTabId —
        // if the user creates two tabs with the same name, the most recent
        // one wins (acceptable tradeoff for a simple workflow).
        const matches = allTabs.filter((t: any) => {
          const p = t.tabProperties || {};
          if (p.title !== args.title) return false;
          if (args.parentTabId && p.parentTabId !== args.parentTabId) return false;
          if (!args.parentTabId && p.parentTabId) return false;
          return true;
        });
        const newTab = matches.length ? matches[matches.length - 1] : null;
        const newTabId = newTab?.tabProperties?.tabId || null;

        return JSON.stringify(
          {
            success: true,
            title: args.title,
            tabId: newTabId,
            index: newTab?.tabProperties?.index ?? null,
            parentTabId: newTab?.tabProperties?.parentTabId || null,
            note: newTabId
              ? 'Use this tabId with other tools (appendMarkdown, insertText, insertPageBreak, applyTextStyle, etc.) to target this tab.'
              : 'Tab created, but could not determine new tabId automatically — call listTabs to locate it.',
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating tab in doc ${args.documentId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError(`Document not found (ID: ${args.documentId}).`);
        if (error.code === 403)
          throw new UserError(`Permission denied for document (ID: ${args.documentId}).`);
        throw new UserError(`Failed to create tab: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
