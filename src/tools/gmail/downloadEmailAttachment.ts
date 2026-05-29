import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { gmail_v1 } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getGmailClient } from '../../clients.js';

export const downloadEmailAttachmentParams = z.object({
  messageId: z.string().describe('The Gmail message ID containing the attachment (from searchEmails results).'),
  attachmentId: z
    .string()
    .describe('The Gmail attachment ID (from message payload parts[].body.attachmentId).'),
  savePath: z
    .string()
    .optional()
    .default('/tmp/')
    .describe('Directory path where the file will be saved. Defaults to /tmp/. Directory is created if missing.'),
});

export type DownloadEmailAttachmentArgs = z.infer<typeof downloadEmailAttachmentParams>;

export interface DownloadEmailAttachmentResult {
  success: true;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function decodeBase64Url(data: string): Buffer {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64');
}

interface AttachmentMeta {
  attachmentId: string;
  filename: string | null;
  mimeType: string;
  size: number | null;
}

export function listAttachments(
  payload: gmail_v1.Schema$MessagePart | null | undefined
): AttachmentMeta[] {
  const out: AttachmentMeta[] = [];
  function walk(part: gmail_v1.Schema$MessagePart | null | undefined): void {
    if (!part) return;
    if (part.body?.attachmentId) {
      out.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || null,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size ?? null,
      });
    }
    if (part.parts) {
      for (const sub of part.parts) walk(sub);
    }
  }
  walk(payload);
  return out;
}

/**
 * Picks the right attachment from a list.
 *
 * IMPORTANT: Gmail's `attachmentId` is NOT stable across `messages.get` calls
 * (verified live 2026-05-29: same physical attachment returns different IDs
 * per response). So matching by exact `attachmentId` may fail if the caller
 * passed an ID from a previous `messages.get` cycle.
 *
 * Resolution order:
 *  1. Exact attachmentId match in current payload.
 *  2. If user-input is a known stub (starts with `attachment-` or empty), fall back.
 *  3. If exactly one attachment exists, use it (most common case).
 *  4. Else throw with the fresh list so caller can retry with current IDs.
 */
export function pickAttachment(
  attachments: AttachmentMeta[],
  userAttachmentId: string,
  messageId: string
): AttachmentMeta {
  if (attachments.length === 0) {
    throw new UserError(`Message ${messageId} has no attachments.`);
  }
  const exact = attachments.find((a) => a.attachmentId === userAttachmentId);
  if (exact) return exact;
  if (attachments.length === 1) {
    return attachments[0]!;
  }
  const summary = attachments
    .map((a, i) => `[${i}] ${a.filename || '(no filename)'} ${a.mimeType} id=${a.attachmentId.slice(0, 24)}...`)
    .join('\n  ');
  throw new UserError(
    `attachmentId not found in message ${messageId} (Gmail rotates attachmentIds per messages.get call). ` +
      `Re-fetch with a fresh messages.get and use one of:\n  ${summary}`
  );
}

export async function executeDownloadEmailAttachment(
  args: DownloadEmailAttachmentArgs,
  gmail: gmail_v1.Gmail
): Promise<DownloadEmailAttachmentResult> {
  const msgResp = await gmail.users.messages.get({
    userId: 'me',
    id: args.messageId,
    format: 'full',
  });
  const attachments = listAttachments(msgResp.data.payload);
  const picked = pickAttachment(attachments, args.attachmentId, args.messageId);

  const attachResp = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: args.messageId,
    id: picked.attachmentId,
  });
  if (!attachResp.data.data) {
    throw new UserError(`Attachment ${picked.attachmentId.slice(0, 24)}... returned no data from Gmail API.`);
  }
  const buffer = decodeBase64Url(attachResp.data.data);

  const fileName =
    picked.filename || `attachment-${picked.attachmentId.slice(0, 24)}.bin`;
  const mimeType = picked.mimeType;

  await fs.mkdir(args.savePath, { recursive: true });
  const filePath = path.join(args.savePath, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    success: true,
    filePath,
    fileName,
    mimeType,
    sizeBytes: buffer.length,
  };
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'downloadEmailAttachment',
    description:
      'Downloads a Gmail email attachment to a local file. Use this after readEmail/searchEmails when you need to save an attachment (e.g. PDF, image). Returns absolute filePath, original fileName, mimeType, and sizeBytes. Default savePath is /tmp/.',
    parameters: downloadEmailAttachmentParams,
    execute: async (args, { log }) => {
      log.info(
        `Downloading attachment ${args.attachmentId} from message ${args.messageId} to ${args.savePath}`
      );
      try {
        const gmail = await getGmailClient();
        const result = await executeDownloadEmailAttachment(args, gmail);
        log.info(`Saved ${result.sizeBytes} bytes to ${result.filePath}`);
        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        if (error instanceof UserError) throw error;
        log.error(`Error downloading attachment: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(
            `Email or attachment not found: messageId=${args.messageId} attachmentId=${args.attachmentId}`
          );
        }
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The Gmail readonly scope must be granted. Run `node dist/index.js auth` to re-authorize.'
          );
        }
        throw new UserError(`Failed to download attachment: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
