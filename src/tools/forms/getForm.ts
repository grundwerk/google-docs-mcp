import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getForm',
    description: 'Returns a Google Form structure (title, description, items, response settings).',
    parameters: z.object({ formId: z.string().describe('The form ID.') }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Getting form ${args.formId}`);
      try {
        const resp = await forms.forms.get({ formId: args.formId });
        return JSON.stringify({ success: true, form: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error getting form: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Form ${args.formId} not found.`);
        throw new UserError(`Failed to get form: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
