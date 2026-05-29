// Shared MIME-building helpers for Gmail tools (sendEmail, createDraft, forwardEmail).
// Extracted from forwardEmail.ts during the Phase 1a refactor (handover 2026-05-29).

import { gmail_v1 } from 'googleapis';

export interface MimeAttachment {
  filename: string;
  mimeType: string;
  /** base64url-encoded payload (Gmail API attachment format). */
  dataBase64Url: string;
}

export interface BuildMimeOptions {
  to: string;
  subject: string;
  bodyText: string;
  from?: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
  isHtml?: boolean;
  attachments?: MimeAttachment[];
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function extractPlainText(payload: gmail_v1.Schema$MessagePart | null | undefined): string {
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

export async function collectAttachments(
  payload: gmail_v1.Schema$MessagePart | null | undefined,
  messageId: string,
  gmail: gmail_v1.Gmail,
  out: MimeAttachment[]
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

export function buildMimeMessage(opts: BuildMimeOptions): string {
  const {
    to,
    subject,
    bodyText,
    from,
    cc,
    bcc,
    inReplyTo,
    references,
    isHtml,
    attachments = [],
  } = opts;

  let mime = '';
  if (from) mime += `From: ${from}\r\n`;
  mime += `To: ${to}\r\n`;
  if (cc) mime += `Cc: ${cc}\r\n`;
  if (bcc) mime += `Bcc: ${bcc}\r\n`;
  mime += `Subject: ${subject}\r\n`;
  if (inReplyTo) mime += `In-Reply-To: ${inReplyTo}\r\n`;
  const refsHeader = references || inReplyTo;
  if (refsHeader) mime += `References: ${refsHeader}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;

  const bodyContentType = isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';

  if (attachments.length === 0) {
    mime += `Content-Type: ${bodyContentType}\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    mime += bodyText;
    return mime;
  }

  const boundary = `bnd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: ${bodyContentType}\r\n`;
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

export function encodeMimeForGmail(mime: string): string {
  return Buffer.from(mime, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
