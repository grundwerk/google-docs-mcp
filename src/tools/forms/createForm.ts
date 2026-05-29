import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createForm',
    description:
      'Creates a new (empty) Google Form. Returns the formId + responder URL. Use addFormQuestion to add questions.',
    parameters: z.object({
      title: z.string().describe('Form title.'),
      description: z.string().optional().describe('Form description.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Creating form '${args.title}'`);
      try {
        const resp = await forms.forms.create({
          requestBody: {
            info: { title: args.title, documentTitle: args.title },
          },
        });
        const formId = resp.data.formId;
        if (formId && args.description) {
          await forms.forms.batchUpdate({
            formId,
            requestBody: {
              requests: [
                {
                  updateFormInfo: {
                    info: { description: args.description },
                    updateMask: 'description',
                  },
                },
              ],
            },
          });
        }
        return JSON.stringify(
          {
            success: true,
            formId,
            responderUrl: resp.data.responderUri,
            editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating form: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. The 'forms.body' scope must be granted. Run `node dist/index.js auth` to re-authorize."
          );
        throw new UserError(`Failed to create form: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
