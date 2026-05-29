import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient, getDriveClient } from '../../clients.js';
import { buildMimeMessage, encodeMimeForGmail, type MimeAttachment } from './_mime.js';

const attachmentSchema = z.union([
  z.object({
    driveFileId: z.string().describe('Drive file ID to attach.'),
    filename: z.string().optional().describe('Override filename.'),
  }),
  z.object({
    base64: z.string().describe('Base64-encoded payload.'),
    filename: z.string().describe('Filename shown in the email.'),
    mimeType: z.string().describe("MIME type, e.g. 'application/pdf'."),
  }),
]);

export function register(server: FastMCP) {
  server.addTool({
    name: 'createDraft',
    description:
      "Creates a Gmail draft (saved, not sent). Returns the draft ID + Gmail-Web-URL so the user can review/edit it before sending via sendDraft. Use this for Tom's 'review-before-send' workflow: assistant builds the draft, Tom checks wording in Gmail-UI, then calls sendDraft.",
    parameters: z.object({
      to: z.string().describe('Recipient email address.'),
      subject: z.string().describe('Subject line.'),
      body: z.string().describe('Email body.'),
      cc: z.string().optional().describe('CC recipients.'),
      bcc: z.string().optional().describe('BCC recipients.'),
      isHtml: z.boolean().optional().default(false).describe('Treat body as HTML.'),
      threadId: z
        .string()
        .optional()
        .describe('Optional Gmail thread ID — attach draft to existing thread.'),
      replyToMessageId: z
        .string()
        .optional()
        .describe('Message ID being replied to (sets In-Reply-To + Re: subject + resolves thread).'),
      attachments: z.array(attachmentSchema).optional().describe('Optional attachments.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Creating draft to ${args.to} subject='${args.subject}'`);

      let inReplyTo: string | undefined;
      let references: string | undefined;
      let threadId = args.threadId;
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
        threadId = threadId || orig.data.threadId || undefined;
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
        const resp = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: threadId ? { raw, threadId } : { raw },
          },
        });

        return JSON.stringify(
          {
            success: true,
            draftId: resp.data.id,
            messageId: resp.data.message?.id,
            threadId: resp.data.message?.threadId,
            webUrl: `https://mail.google.com/mail/u/0/#drafts/${resp.data.message?.threadId || resp.data.id}`,
            to: args.to,
            subject,
            attachmentCount: collectedAttachments.length,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating draft: ${error.message || error}`);
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The gmail.send scope must be granted. Run `node dist/index.js auth` to re-authorize.'
          );
        }
        if (error.code === 400) {
          throw new UserError(`Gmail rejected draft (400): ${error.message || 'Invalid MIME'}`);
        }
        throw new UserError(`Failed to create draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
