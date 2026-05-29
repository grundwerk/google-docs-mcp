import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';
import { randomUUID } from 'crypto';

export function register(server: FastMCP) {
  server.addTool({
    name: 'watchFile',
    description:
      "Starts a webhook (push notification) channel for a Drive file. Google sends HTTPS POST requests to the webhook URL when the file changes. Returns the channel ID and resourceId — needed to stop the watch later.",
    parameters: z.object({
      fileId: z.string().describe('The Drive file ID to watch.'),
      webhookUrl: z.string().describe('HTTPS endpoint that will receive change notifications.'),
      channelId: z
        .string()
        .optional()
        .describe('Optional channel UUID. Auto-generated if omitted.'),
      ttlSeconds: z
        .number()
        .int()
        .optional()
        .describe('Optional TTL in seconds (Google caps depending on resource). Default = server max.'),
      token: z.string().optional().describe('Optional token sent in each notification (for verification).'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      const channelId = args.channelId || randomUUID();
      log.info(`Starting watch on file ${args.fileId} → ${args.webhookUrl}`);
      try {
        const resp = await drive.files.watch({
          fileId: args.fileId,
          requestBody: {
            id: channelId,
            type: 'web_hook',
            address: args.webhookUrl,
            token: args.token,
            expiration: args.ttlSeconds ? String(Date.now() + args.ttlSeconds * 1000) : undefined,
          },
          supportsAllDrives: true,
        });
        return JSON.stringify(
          {
            success: true,
            channelId: resp.data.id,
            resourceId: resp.data.resourceId,
            expiration: resp.data.expiration,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error starting watch: ${error.message || error}`);
        if (error.code === 400)
          throw new UserError(
            `Watch setup rejected (400). The webhook URL must be HTTPS with a verified domain. Detail: ${error.message}`
          );
        if (error.code === 401)
          throw new UserError(
            'Webhook domain not verified in Google Cloud Console. See https://developers.google.com/drive/api/guides/push#registering'
          );
        throw new UserError(`Failed to watch file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
