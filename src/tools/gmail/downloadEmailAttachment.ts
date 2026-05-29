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
    .optional()
    .describe(
      'The Gmail attachment ID. NOTE: Gmail rotates attachmentIds per messages.get call — IDs from prior calls may not match. If mismatch, the tool falls back to expectedFilename or attachmentIndex.'
    ),
  attachmentIndex: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Zero-based position of the attachment in the message (0 = first attachment). Use when you do not know the attachmentId or when it may be stale. If both attachmentId and attachmentIndex are given, attachmentId wins on exact match.'
    ),
  expectedFilename: z
    .string()
    .optional()
    .describe(
      'Filename to match against the attachment list (e.g. "schriftsatz.pdf"). Useful for multi-attachment emails where attachmentId is unstable.'
    ),
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
 *  1. Exact attachmentId match in current payload (if attachmentId given).
 *  2. expectedFilename exact match (if given).
 *  3. attachmentIndex (if given, 0-based position in flat parts-walk).
 *  4. Single-attachment fallback (most common case).
 *  5. Throw with fresh list + how-to-pick guidance.
 */
export function pickAttachment(
  attachments: AttachmentMeta[],
  opts: { attachmentId?: string; expectedFilename?: string; attachmentIndex?: number },
  messageId: string
): AttachmentMeta {
  if (attachments.length === 0) {
    throw new UserError(`Message ${messageId} has no attachments.`);
  }
  // 1. Exact attachmentId match
  if (opts.attachmentId) {
    const exact = attachments.find((a) => a.attachmentId === opts.attachmentId);
    if (exact) return exact;
  }
  // 2. expectedFilename match
  if (opts.expectedFilename) {
    const byName = attachments.find((a) => a.filename === opts.expectedFilename);
    if (byName) return byName;
  }
  // 3. attachmentIndex
  if (opts.attachmentIndex !== undefined) {
    const byIdx = attachments[opts.attachmentIndex];
    if (byIdx) return byIdx;
    throw new UserError(
      `attachmentIndex ${opts.attachmentIndex} out of range (message has ${attachments.length} attachment(s)).`
    );
  }
  // 4. Single-attachment fallback
  if (attachments.length === 1) {
    return attachments[0]!;
  }
  // 5. No way to pick — throw with guidance
  const summary = attachments
    .map((a, i) => `[${i}] ${a.filename || '(no filename)'} ${a.mimeType} id=${a.attachmentId.slice(0, 24)}...`)
    .join('\n  ');
  throw new UserError(
    `Cannot pick attachment in message ${messageId} (${attachments.length} candidates, no match). ` +
      `Gmail rotates attachmentIds per messages.get call. Available attachments:\n  ${summary}\n` +
      `Retry with either: (a) fresh attachmentId from current messages.get, (b) expectedFilename, or (c) attachmentIndex (0-based).`
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
  const picked = pickAttachment(
    attachments,
    {
      attachmentId: args.attachmentId,
      expectedFilename: args.expectedFilename,
      attachmentIndex: args.attachmentIndex,
    },
    args.messageId
  );

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
      'Downloads a Gmail email attachment to a local file. Use after readEmail/searchEmails when you need to save an attachment (PDF, image, etc). To pick which attachment: provide attachmentId (most precise but Gmail rotates IDs), expectedFilename (e.g. "schriftsatz.pdf"), or attachmentIndex (0-based). If none given and message has 1 attachment, picks that. Returns absolute filePath, fileName, mimeType, sizeBytes.',
    parameters: downloadEmailAttachmentParams,
    execute: async (args, { log }) => {
      log.info(
        `Downloading attachment from message ${args.messageId} to ${args.savePath} (id=${args.attachmentId?.slice(0, 24) || '?'} name=${args.expectedFilename || '?'} idx=${args.attachmentIndex ?? '?'})`
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
