import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createLabel',
    description:
      "Creates a new Gmail label. Returns the new labelId for use in applyLabel. Supports nested labels via slash: 'Work/Clients/Grundwerk'.",
    parameters: z.object({
      name: z.string().describe('Label name (slashes create nesting).'),
      labelListVisibility: z
        .enum(['labelShow', 'labelShowIfUnread', 'labelHide'])
        .optional()
        .default('labelShow'),
      messageListVisibility: z.enum(['show', 'hide']).optional().default('show'),
      textColor: z.string().optional().describe('Hex color e.g. "#ffffff" — must be valid Gmail palette color.'),
      backgroundColor: z.string().optional().describe('Hex color e.g. "#42d692".'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Creating label '${args.name}'`);

      const requestBody: any = {
        name: args.name,
        labelListVisibility: args.labelListVisibility,
        messageListVisibility: args.messageListVisibility,
      };
      if (args.textColor && args.backgroundColor) {
        requestBody.color = { textColor: args.textColor, backgroundColor: args.backgroundColor };
      }

      try {
        const resp = await gmail.users.labels.create({ userId: 'me', requestBody });
        return JSON.stringify({ success: true, label: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error creating label: ${error.message || error}`);
        if (error.code === 409)
          throw new UserError(`Label '${args.name}' already exists.`);
        if (error.code === 400)
          throw new UserError(
            `Invalid label config: ${error.message}. Note: color must be from Gmail's palette.`
          );
        throw new UserError(`Failed to create label: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
