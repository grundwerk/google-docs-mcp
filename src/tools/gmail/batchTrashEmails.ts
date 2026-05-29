import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

const BATCH_SIZE = 1000;

export function register(server: FastMCP) {
  server.addTool({
    name: 'batchTrashEmails',
    description:
      'Moves multiple Gmail messages to Trash in one operation (reversible for 30 days). Either pass an array of messageIds (from searchEmails), OR pass a Gmail search `query` to auto-resolve and trash all matches. Uses Gmail batchModify API (up to 1000 IDs per call). Returns counts and any per-batch errors.',
    parameters: z.object({
      messageIds: z
        .array(z.string())
        .optional()
        .describe('Array of Gmail message IDs to trash. Mutually exclusive with `query`.'),
      query: z
        .string()
        .optional()
        .describe(
          'Gmail search query (same syntax as Gmail search bar). If set, all matching messages are trashed. Mutually exclusive with `messageIds`.'
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .optional()
        .default(5000)
        .describe('Safety cap when using `query` (1-10000). Aborts if more matches exist than cap, to prevent over-deletion.'),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, resolves and counts matches but does NOT trash. Use to preview before destructive run.'),
    }),
    execute: async (args, { log }) => {
      if (!args.messageIds && !args.query) {
        throw new UserError('Either `messageIds` or `query` must be provided.');
      }
      if (args.messageIds && args.query) {
        throw new UserError('Pass either `messageIds` OR `query`, not both.');
      }

      const gmail = await getGmailClient();

      let ids: string[] = [];

      if (args.messageIds) {
        ids = args.messageIds;
        log.info(`Batch trash: ${ids.length} explicit messageIds`);
      } else {
        log.info(`Batch trash: resolving query "${args.query}" (cap ${args.maxResults})`);
        let pageToken: string | undefined;
        while (ids.length < args.maxResults) {
          const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: args.query,
            maxResults: Math.min(500, args.maxResults - ids.length),
            pageToken,
          });
          const messages = listResponse.data.messages || [];
          for (const m of messages) {
            if (m.id) ids.push(m.id);
          }
          pageToken = listResponse.data.nextPageToken || undefined;
          if (!pageToken) break;
        }

        if (ids.length >= args.maxResults && pageToken) {
          throw new UserError(
            `Query matched more than maxResults=${args.maxResults}. Refusing to trash partial set. Raise maxResults explicitly if intended.`
          );
        }
        log.info(`Resolved ${ids.length} message IDs from query.`);
      }

      if (ids.length === 0) {
        return JSON.stringify({ success: true, trashed: 0, message: 'No messages matched.' }, null, 2);
      }

      if (args.dryRun) {
        return JSON.stringify(
          {
            success: true,
            dryRun: true,
            wouldTrash: ids.length,
            sampleIds: ids.slice(0, 5),
          },
          null,
          2
        );
      }

      const errors: Array<{ batchIndex: number; error: string }> = [];
      let trashedCount = 0;

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);
        try {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: chunk,
              addLabelIds: ['TRASH'],
              removeLabelIds: ['INBOX', 'UNREAD'],
            },
          });
          trashedCount += chunk.length;
          log.info(`Batch ${batchIndex + 1}: trashed ${chunk.length} messages (running total ${trashedCount}/${ids.length})`);
        } catch (error: any) {
          const msg = error.message || String(error);
          log.error(`Batch ${batchIndex + 1} failed: ${msg}`);
          errors.push({ batchIndex, error: msg });
          if (error.code === 403) {
            throw new UserError(
              'Permission denied. Make sure the OAuth token has gmail.modify scope (re-run auth flow after scope change).'
            );
          }
        }
      }

      return JSON.stringify(
        {
          success: errors.length === 0,
          trashed: trashedCount,
          totalRequested: ids.length,
          batchCount: Math.ceil(ids.length / BATCH_SIZE),
          errors: errors.length > 0 ? errors : undefined,
        },
        null,
        2
      );
    },
  });
}
