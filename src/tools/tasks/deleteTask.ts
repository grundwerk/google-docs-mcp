import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteTask',
    description: 'Permanently deletes a task.',
    parameters: z.object({
      tasklistId: z.string().describe('Tasklist ID.'),
      taskId: z.string().describe('Task ID.'),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info(`Deleting task ${args.taskId}`);
      try {
        await tasks.tasks.delete({ tasklist: args.tasklistId, task: args.taskId });
        return JSON.stringify({ success: true, deletedTaskId: args.taskId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting task: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Task ${args.taskId} not found.`);
        throw new UserError(`Failed to delete task: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
