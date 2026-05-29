import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getTasksClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createTask',
    description: 'Creates a new task in a task list. Optional due date (RFC3339).',
    parameters: z.object({
      tasklistId: z.string().describe('Tasklist ID. Use "@default" for primary.'),
      title: z.string().describe('Task title.'),
      notes: z.string().optional().describe('Task notes/description.'),
      due: z.string().optional().describe('RFC3339 due date (e.g. "2026-05-30T00:00:00Z").'),
      parent: z.string().optional().describe('Parent task ID for sub-tasks.'),
      previous: z.string().optional().describe('Previous sibling task ID for ordering.'),
    }),
    execute: async (args, { log }) => {
      const tasks = await getTasksClient();
      log.info(`Creating task '${args.title}'`);
      try {
        const resp = await tasks.tasks.insert({
          tasklist: args.tasklistId,
          parent: args.parent,
          previous: args.previous,
          requestBody: {
            title: args.title,
            notes: args.notes,
            due: args.due,
          },
        });
        return JSON.stringify({ success: true, task: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error creating task: ${error.message || error}`);
        throw new UserError(`Failed to create task: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
