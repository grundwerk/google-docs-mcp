import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateTask',
    description: 'Updates a task. Pass only the fields you want to change.',
    parameters: z.object({
      tasklistId: z.string().describe('Tasklist ID.'),
      taskId: z.string().describe('Task ID.'),
      title: z.string().optional(),
      notes: z.string().optional(),
      due: z.string().optional(),
      status: z.enum(['needsAction', 'completed']).optional(),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info(`Updating task ${args.taskId}`);
      try {
        const resp = await tasks.tasks.patch({
          tasklist: args.tasklistId,
          task: args.taskId,
          requestBody: {
            title: args.title,
            notes: args.notes,
            due: args.due,
            status: args.status,
            completed:
              args.status === 'completed' ? new Date().toISOString() : args.status === 'needsAction' ? null : undefined,
          },
        });
        return JSON.stringify({ success: true, task: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error updating task: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Task ${args.taskId} not found.`);
        throw new UserError(`Failed to update task: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
