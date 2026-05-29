import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listTasks',
    description:
      'Lists tasks in a task list. By default returns only incomplete tasks. Use showCompleted=true to include done.',
    parameters: z.object({
      tasklistId: z.string().describe('Tasklist ID (from listTaskLists). Use "@default" for primary.'),
      showCompleted: z.boolean().optional().default(false),
      showHidden: z.boolean().optional().default(false),
      maxResults: z.number().int().min(1).max(100).optional().default(100),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info(`Listing tasks in ${args.tasklistId}`);
      try {
        const resp = await tasks.tasks.list({
          tasklist: args.tasklistId,
          showCompleted: args.showCompleted,
          showHidden: args.showHidden,
          maxResults: args.maxResults,
        });
        return JSON.stringify(
          { success: true, count: resp.data.items?.length || 0, tasks: resp.data.items || [] },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing tasks: ${error.message || error}`);
        throw new UserError(`Failed to list tasks: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
