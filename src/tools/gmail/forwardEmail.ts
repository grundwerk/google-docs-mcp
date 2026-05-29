import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { gmail_v1 } from 'googleapis';
import { getGmailClient } from '../../clients.js';

export const forwardEmailParams = z.object({
  messageId: z.string().describe('The Gmail message ID to forward (from searchEmails results).'),
  to: z.string().describe('Recipient email address (e.g. "rechtsanwalt@kanzlei.de").'),
  additionalMessage: z
    .string()
    .optional()
    .describe('Optional message to prepend BEFORE the forwarded content (e.g. "FYI, please review").'),
});

export type ForwardEmailArgs = z.infer<typeof forwardEmailParams>;

export interface ForwardEmailResult {
  success: true;
  messageId: string;
  threadId: string;
}

interface CollectedAttachment {
  filename: string;
  mimeType: string;
  dataBase64Url: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | null | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

async function collectAttachments(
  payload: gmail_v1.Schema$MessagePart | null | undefined,
  messageId: string,
  gmail: gmail_v1.Gmail,
  out: CollectedAttachment[]
): Promise<void> {
  if (!payload) return;
  if (payload.body?.attachmentId) {
    const attResp = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: payload.body.attachmentId,
    });
    if (attResp.data.data) {
      out.push({
        filename: payload.filename || `attachment-${payload.body.attachmentId}.bin`,
        mimeType: payload.mimeType || 'application/octet-stream',
        dataBase64Url: attResp.data.data,
      });
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      await collectAttachments(part, messageId, gmail, out);
    }
  }
}

function buildMimeMessage(opts: {
  to: string;
  subject: string;
  referencesHeader: string | null;
  bodyText: string;
  attachments: CollectedAttachment[];
}): string {
  const { to, subject, referencesHeader, bodyText, attachments } = opts;
  let mime = `To: ${to}\r\n`;
  mime += `Subject: ${subject}\r\n`;
  if (referencesHeader) {
    mime += `References: ${referencesHeader}\r\n`;
    mime += `In-Reply-To: ${referencesHeader}\r\n`;
  }
  mime += `MIME-Version: 1.0\r\n`;

  if (attachments.length === 0) {
    mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    mime += bodyText;
    return mime;
  }

  const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
  mime += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  mime += bodyText + '\r\n';

  for (const att of attachments) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
    const stdBase64 = att.dataBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const wrapped = stdBase64.match(/.{1,76}/g)?.join('\r\n') || stdBase64;
    mime += wrapped + '\r\n';
  }
  mime += `--${boundary}--\r\n`;
  return mime;
}

export async function executeForwardEmail(
  args: ForwardEmailArgs,
  gmail: gmail_v1.Gmail
): Promise<ForwardEmailResult> {
  const orig = await gmail.users.messages.get({
    userId: 'me',
    id: args.messageId,
    format: 'full',
  });

  const origHeaders = orig.data.payload?.headers || [];
  const getHeader = (name: string): string =>
    origHeaders.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const origSubject = getHeader('Subject');
  const origFrom = getHeader('From');
  const origTo = getHeader('To');
  const origDate = getHeader('Date');
  const origMessageId = getHeader('Message-ID') || getHeader('Message-Id');

  const origPlainBody = extractPlainText(orig.data.payload);

  const attachments: CollectedAttachment[] = [];
  await collectAttachments(orig.data.payload, args.messageId, gmail, attachments);

  const newSubject = origSubject.toLowerCase().startsWith('fwd:')
    ? origSubject
    : `Fwd: ${origSubject}`;

  const forwardSeparator = '---------- Forwarded message ----------';
  const newBodyText =
    (args.additionalMessage ? args.additionalMessage + '\n\n' : '') +
    forwardSeparator +
    '\n' +
    `From: ${origFrom}\n` +
    `Date: ${origDate}\n` +
    `Subject: ${origSubject}\n` +
    `To: ${origTo}\n\n` +
    origPlainBody;

  const mime = buildMimeMessage({
    to: args.to,
    subject: newSubject,
    referencesHeader: origMessageId || null,
    bodyText: newBodyText,
    attachments,
  });

  const rawEncoded = Buffer.from(mime, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sendResp = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawEncoded },
  });

  if (!sendResp.data.id || !sendResp.data.threadId) {
    throw new UserError('Gmail send returned without id/threadId.');
  }

  return {
    success: true,
    messageId: sendResp.data.id,
    threadId: sendResp.data.threadId,
  };
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'forwardEmail',
    description:
      'Forwards an existing Gmail email to a new recipient, preserving all attachments. The original sender, date, subject, and body are included as quoted "Forwarded message" content. Use this to e.g. forward an Abmahnung-PDF to legal counsel. Requires gmail.send OAuth scope.',
    parameters: forwardEmailParams,
    execute: async (args, { log }) => {
      log.info(`Forwarding message ${args.messageId} to ${args.to}`);
      try {
        const gmail = await getGmailClient();
        const result = await executeForwardEmail(args, gmail);
        log.info(`Forwarded as new message ${result.messageId} (thread ${result.threadId})`);
        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        if (error instanceof UserError) throw error;
        log.error(`Error forwarding email: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(`Original email not found: ${args.messageId}`);
        }
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The gmail.send scope must be granted. Run `node dist/index.js auth` from ~/google-docs-mcp/ to re-authorize.'
          );
        }
        if (error.code === 400) {
          throw new UserError(
            `Gmail rejected the forwarded message (400 Bad Request): ${error.message || 'Invalid MIME format'}`
          );
        }
        throw new UserError(`Failed to forward email: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
