import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listTaskLists',
    description: 'Lists all Google Tasks lists for the authenticated user.',
    parameters: z.object({
      maxResults: z.number().int().min(1).max(100).optional().default(20),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info('Listing task lists');
      try {
        const resp = await tasks.tasklists.list({ maxResults: args.maxResults });
        return JSON.stringify(
          { success: true, count: resp.data.items?.length || 0, taskLists: resp.data.items || [] },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing task lists: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. The 'tasks' scope must be granted. Run `node dist/index.js auth` to re-authorize."
          );
        throw new UserError(`Failed to list task lists: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
