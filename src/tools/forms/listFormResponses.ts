import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listFormResponses',
    description:
      'Lists responses for a Google Form. Returns answers keyed by questionId. Use getForm to map questionIds to question text.',
    parameters: z.object({
      formId: z.string().describe('The form ID.'),
      pageSize: z.number().int().min(1).max(5000).optional().default(100),
      pageToken: z.string().optional(),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Listing form responses for ${args.formId}`);
      try {
        const resp = await forms.forms.responses.list({
          formId: args.formId,
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return JSON.stringify(
          {
            success: true,
            count: resp.data.responses?.length || 0,
            responses: resp.data.responses || [],
            nextPageToken: resp.data.nextPageToken,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing responses: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. The 'forms.responses.readonly' scope must be granted."
          );
        throw new UserError(`Failed to list responses: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
