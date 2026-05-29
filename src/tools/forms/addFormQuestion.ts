import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'addFormQuestion',
    description:
      'Appends a question to a Google Form. Supports TEXT (short answer), PARAGRAPH (long), RADIO (single choice), CHECKBOX (multiple), DROPDOWN. For RADIO/CHECKBOX/DROPDOWN provide options[].',
    parameters: z.object({
      formId: z.string().describe('The form ID.'),
      title: z.string().describe('Question text.'),
      type: z
        .enum(['TEXT', 'PARAGRAPH', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'SCALE'])
        .describe('Question type.'),
      options: z
        .array(z.string())
        .optional()
        .describe('Required for RADIO/CHECKBOX/DROPDOWN.'),
      required: z.boolean().optional().default(false),
      insertionIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('0-based position. Omit to append.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Adding ${args.type} question to ${args.formId}`);

      const question: any = { required: args.required };
      if (args.type === 'TEXT') {
        question.textQuestion = { paragraph: false };
      } else if (args.type === 'PARAGRAPH') {
        question.textQuestion = { paragraph: true };
      } else if (args.type === 'RADIO' || args.type === 'CHECKBOX' || args.type === 'DROPDOWN') {
        if (!args.options || args.options.length === 0)
          throw new UserError(`${args.type} requires options[].`);
        const typeMap = { RADIO: 'RADIO', CHECKBOX: 'CHECKBOX', DROPDOWN: 'DROP_DOWN' } as const;
        question.choiceQuestion = {
          type: typeMap[args.type],
          options: args.options.map((value) => ({ value })),
        };
      } else if (args.type === 'SCALE') {
        question.scaleQuestion = { low: 1, high: 5 };
      }

      try {
        const resp = await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            requests: [
              {
                createItem: {
                  item: {
                    title: args.title,
                    questionItem: { question },
                  },
                  location: args.insertionIndex !== undefined ? { index: args.insertionIndex } : { index: 0 },
                },
              },
            ],
          },
        });
        const created = resp.data.replies?.[0]?.createItem;
        return JSON.stringify({ success: true, itemId: created?.itemId, questionId: created?.questionId }, null, 2);
      } catch (error: any) {
        log.error(`Error adding question: ${error.message || error}`);
        throw new UserError(`Failed to add question: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
