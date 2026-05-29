import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'completeTask',
    description: 'Marks a task as completed (convenience wrapper around updateTask).',
    parameters: z.object({
      tasklistId: z.string().describe('Tasklist ID.'),
      taskId: z.string().describe('Task ID.'),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info(`Completing task ${args.taskId}`);
      try {
        const resp = await tasks.tasks.patch({
          tasklist: args.tasklistId,
          task: args.taskId,
          requestBody: { status: 'completed', completed: new Date().toISOString() },
        });
        return JSON.stringify({ success: true, task: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error completing task: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Task ${args.taskId} not found.`);
        throw new UserError(`Failed to complete task: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
