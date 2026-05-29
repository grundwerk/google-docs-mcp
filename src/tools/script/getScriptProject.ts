import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getScriptClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getScriptProject',
    description:
      "Returns project metadata for an Apps Script project (title, parent docId, createTime). Note: full content requires the broader 'script.projects' scope which is NOT in default scopes.",
    parameters: z.object({
      scriptId: z.string().describe('Apps Script project ID.'),
    }),
    execute: async (args, { log }) => {
      const script = await getScriptClient();
      log.info(`Getting script project ${args.scriptId}`);
      try {
        const resp = await script.projects.get({ scriptId: args.scriptId });
        return JSON.stringify({ success: true, project: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error getting script project: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. Default scopes only include 'script.external_request' which doesn't allow project introspection. Add 'script.projects.readonly' scope and re-authorize for full project access."
          );
        if (error.code === 404) throw new UserError(`Project ${args.scriptId} not found.`);
        throw new UserError(`Failed to get script project: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
