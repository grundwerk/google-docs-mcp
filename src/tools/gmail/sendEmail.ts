import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient, getDriveClient } from '../../clients.js';
import { buildMimeMessage, encodeMimeForGmail, type MimeAttachment } from './_mime.js';

const attachmentSchema = z.union([
  z.object({
    driveFileId: z.string().describe('Drive file ID to attach (will be fetched via drive.files.get?alt=media).'),
    filename: z.string().optional().describe('Override filename (defaults to Drive file name).'),
  }),
  z.object({
    base64: z.string().describe('Base64-encoded payload (standard or url-safe).'),
    filename: z.string().describe('Filename shown in the email.'),
    mimeType: z.string().describe("MIME type, e.g. 'application/pdf', 'image/png'."),
  }),
]);

export function register(server: FastMCP) {
  server.addTool({
    name: 'sendEmail',
    description:
      "Composes and sends a new Gmail message. Supports plain text or HTML body, optional CC/BCC, attachments (Drive files or inline base64), and threading via replyToMessageId (for Re: replies in an existing conversation). Requires gmail.send OAuth scope.",
    parameters: z.object({
      to: z.string().describe("Recipient email address. Multiple via comma: 'a@x.com, b@y.com'."),
      subject: z.string().describe('Subject line.'),
      body: z.string().describe('Email body (plain text by default; HTML if isHtml=true).'),
      cc: z.string().optional().describe('CC recipients (comma-separated).'),
      bcc: z.string().optional().describe('BCC recipients (comma-separated).'),
      isHtml: z.boolean().optional().default(false).describe('Treat body as HTML.'),
      replyToMessageId: z
        .string()
        .optional()
        .describe(
          'Gmail message ID of the email being replied to. When set, the new message gets In-Reply-To/References headers and is appended to the existing thread.'
        ),
      attachments: z
        .array(attachmentSchema)
        .optional()
        .describe('Optional attachments. Each item is either {driveFileId, filename?} or {base64, filename, mimeType}.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Sending email to ${args.to} subject='${args.subject}'`);

      let inReplyTo: string | undefined;
      let references: string | undefined;
      let threadId: string | undefined;
      let subject = args.subject;

      if (args.replyToMessageId) {
        const orig = await gmail.users.messages.get({
          userId: 'me',
          id: args.replyToMessageId,
          format: 'metadata',
          metadataHeaders: ['Message-ID', 'Subject', 'References'],
        });
        const headers = orig.data.payload?.headers || [];
        const getH = (n: string) =>
          headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
        const origMsgId = getH('Message-ID') || getH('Message-Id');
        const origRefs = getH('References');
        inReplyTo = origMsgId || undefined;
        references = origRefs ? `${origRefs} ${origMsgId || ''}`.trim() : origMsgId || undefined;
        threadId = orig.data.threadId || undefined;
        const origSubject = getH('Subject');
        if (origSubject && !subject.toLowerCase().startsWith('re:')) {
          subject = `Re: ${origSubject}`;
        }
      }

      const collectedAttachments: MimeAttachment[] = [];
      if (args.attachments && args.attachments.length > 0) {
        const drive = await getDriveClient();
        for (const att of args.attachments) {
          if ('driveFileId' in att) {
            const metaResp = await drive.files.get({
              fileId: att.driveFileId,
              fields: 'name,mimeType',
              supportsAllDrives: true,
            });
            const fileResp = await drive.files.get(
              { fileId: att.driveFileId, alt: 'media', supportsAllDrives: true },
              { responseType: 'arraybuffer' }
            );
            const buf = Buffer.from(fileResp.data as ArrayBuffer);
            collectedAttachments.push({
              filename: att.filename || metaResp.data.name || `file-${att.driveFileId}`,
              mimeType: metaResp.data.mimeType || 'application/octet-stream',
              dataBase64Url: buf
                .toString('base64')
                .replace(/=/g, '')
                .replace(/\+/g, '-')
                .replace(/\//g, '_'),
            });
          } else {
            // Normalize incoming base64 → base64url (no padding)
            const std = att.base64.replace(/-/g, '+').replace(/_/g, '/');
            const buf = Buffer.from(std, 'base64');
            collectedAttachments.push({
              filename: att.filename,
              mimeType: att.mimeType,
              dataBase64Url: buf
                .toString('base64')
                .replace(/=/g, '')
                .replace(/\+/g, '-')
                .replace(/\//g, '_'),
            });
          }
        }
      }

      const mime = buildMimeMessage({
        to: args.to,
        subject,
        bodyText: args.body,
        cc: args.cc,
        bcc: args.bcc,
        inReplyTo,
        references,
        isHtml: args.isHtml,
        attachments: collectedAttachments,
      });

      const raw = encodeMimeForGmail(mime);

      try {
        const resp = await gmail.users.messages.send({
          userId: 'me',
          requestBody: threadId ? { raw, threadId } : { raw },
        });

        return JSON.stringify(
          {
            success: true,
            messageId: resp.data.id,
            threadId: resp.data.threadId,
            to: args.to,
            subject,
            attachmentCount: collectedAttachments.length,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error sending email: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The gmail.send scope must be granted. Run `node dist/index.js auth` from ~/google-docs-mcp/ to re-authorize.'
          );
        }
        if (error.code === 400) {
          throw new UserError(`Gmail rejected message (400 Bad Request): ${error.message || 'Invalid MIME'}`);
        }
        throw new UserError(`Failed to send email: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
