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

// ── Header-Kodierung nach RFC 2047 ───────────────────────────────────────────
// Header sind nach RFC 5322 auf 7-bit-ASCII beschraenkt. `encodeMimeForGmail`
// schreibt die Nachricht aber als UTF-8-Bytes: ein roh interpolierter Umlaut
// landet damit als 0xC3 0xBC im Header und wird vom Client als Latin-1 gelesen
// ("Kündigung" -> "KÃ¼ndigung"). Der Body war nie betroffen, er traegt ein
// eigenes `charset=UTF-8`. Vorfall 2026-09-30, Test in `_mime.test.ts`.

const NICHT_ASCII = /[^\x00-\x7F]/;

/**
 * Kodiert einen Header-Wert als RFC-2047-encoded-word, aber nur wenn noetig.
 * Reines ASCII bleibt byte-identisch, damit sich am bisherigen Verhalten nichts
 * aendert und der Header im Rohformat lesbar bleibt.
 */
export function encodeHeaderValue(value: string): string {
  if (!value || !NICHT_ASCII.test(value)) return value;
  // Rahmen "=?UTF-8?B?" + "?=" kostet 12 Zeichen; RFC 2047 erlaubt 75 je Wort.
  // base64 laeuft in 4er-Bloecken -> 60 Ausgabe-Zeichen -> 45 Quell-Bytes.
  const MAX_BYTES = 45;
  const teile: string[] = [];
  let aktuell: number[] = [];
  // Iteration ueber Codepoints, damit nie mitten durch ein Mehrbyte-Zeichen
  // geschnitten wird -- ein solcher Schnitt erzeugt beim Dekodieren U+FFFD.
  for (const zeichen of value) {
    const bytes = Array.from(Buffer.from(zeichen, 'utf-8'));
    if (aktuell.length + bytes.length > MAX_BYTES) {
      teile.push(Buffer.from(aktuell).toString('base64'));
      aktuell = [];
    }
    aktuell.push(...bytes);
  }
  if (aktuell.length) teile.push(Buffer.from(aktuell).toString('base64'));
  // Folgewoerter werden gefaltet (CRLF + Space), wie RFC 2047 es verlangt.
  return teile.map((t) => `=?UTF-8?B?${t}?=`).join('\r\n ');
}

/**
 * Kodiert NUR den Anzeigenamen einer Adressliste. Die Adresse selbst bleibt roh,
 * sonst ist sie nicht mehr zustellbar.
 */
export function encodeAddressList(list: string): string {
  if (!list || !NICHT_ASCII.test(list)) return list;
  return list
    .split(',')
    .map((eintrag) => {
      const roh = eintrag.trim();
      const treffer = roh.match(/^(.*?)\s*<([^>]+)>$/);
      if (!treffer) return roh; // nackte Adresse ohne Anzeigename
      const name = treffer[1].replace(/^"|"$/g, '').trim();
      return name ? `${encodeHeaderValue(name)} <${treffer[2]}>` : `<${treffer[2]}>`;
    })
    .join(', ');
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
  if (from) mime += `From: ${encodeAddressList(from)}\r\n`;
  mime += `To: ${encodeAddressList(to)}\r\n`;
  if (cc) mime += `Cc: ${encodeAddressList(cc)}\r\n`;
  if (bcc) mime += `Bcc: ${encodeAddressList(bcc)}\r\n`;
  mime += `Subject: ${encodeHeaderValue(subject)}\r\n`;
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
    mime += `Content-Type: ${att.mimeType}; name="${encodeHeaderValue(att.filename)}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${encodeHeaderValue(att.filename)}"\r\n`;
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
