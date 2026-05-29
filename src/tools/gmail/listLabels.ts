import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listLabels',
    description: 'Lists all Gmail labels (system + user). Use this to get labelIds for applyLabel/removeLabel.',
    parameters: z.object({}),
    execute: async (_args, { log }) => {
      const gmail = await getGmailClient();
      log.info('Listing Gmail labels');
      try {
        const resp = await gmail.users.labels.list({ userId: 'me' });
        return JSON.stringify({ success: true, count: resp.data.labels?.length || 0, labels: resp.data.labels || [] }, null, 2);
      } catch (error: any) {
        log.error(`Error listing labels: ${error.message || error}`);
        throw new UserError(`Failed to list labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
