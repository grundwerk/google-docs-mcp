import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractPlainText(payload: any): string {
  if (!payload) return '';

  // Direct plain text part
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart: recurse into parts
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fallback: recurse into nested multipart
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }

  // Last resort: decode HTML
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return '';
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'readEmail',
    description:
      'Reads a single email by its ID. Returns subject, from, to, date, labels, and the full plain-text body.',
    parameters: z.object({
      messageId: z.string().describe('The Gmail message ID (from searchEmails results).'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Reading email: ${args.messageId}`);

      try {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: args.messageId,
          format: 'full',
        });

        const headers = response.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const body = extractPlainText(response.data.payload);

        return JSON.stringify(
          {
            id: response.data.id,
            threadId: response.data.threadId,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            labels: response.data.labelIds || [],
            body,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error reading email: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(`Email not found: ${args.messageId}`);
        }
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. Make sure you have granted Gmail read access to the application.'
          );
        }
        throw new UserError(`Failed to read email: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
