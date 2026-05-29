import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getScriptClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'executeAppsScript',
    description:
      'Runs a function in a deployed Apps Script project. Returns the function result. Requires the script to be deployed as an API executable and the calling account to have access.',
    parameters: z.object({
      scriptId: z.string().describe('Deployment script ID (from listScriptProjects or Apps Script editor).'),
      functionName: z.string().describe('Name of the function to call.'),
      parameters: z
        .array(z.any())
        .optional()
        .default([])
        .describe('Array of arguments to pass to the function.'),
      devMode: z
        .boolean()
        .optional()
        .default(false)
        .describe('Run the latest unpublished version (requires script owner).'),
    }),
    execute: async (args, { log }) => {
      const script = await getScriptClient();
      log.info(`Executing ${args.functionName} in script ${args.scriptId}`);
      try {
        const resp = await script.scripts.run({
          scriptId: args.scriptId,
          requestBody: {
            function: args.functionName,
            parameters: args.parameters,
            devMode: args.devMode,
          },
        });
        if (resp.data.error) {
          throw new UserError(
            `Apps Script execution error: ${resp.data.error.details?.[0]?.errorMessage || JSON.stringify(resp.data.error)}`
          );
        }
        return JSON.stringify({ success: true, result: resp.data.response?.result }, null, 2);
      } catch (error: any) {
        if (error instanceof UserError) throw error;
        log.error(`Error executing script: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            'Permission denied. The script must be deployed as an API executable and you need execute access.'
          );
        if (error.code === 404) throw new UserError(`Script ${args.scriptId} not found.`);
        throw new UserError(`Failed to execute script: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
