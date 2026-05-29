import { describe, it, expect, vi } from 'vitest';
import { executeForwardEmail } from './forwardEmail.js';
import { UserError } from 'fastmcp';

function encodeBase64Url(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function makeMockGmailForForward(opts: {
  origPayload?: any;
  attachmentData?: Record<string, string>;
  sendResponse?: { id?: string; threadId?: string };
  sendError?: { code: number };
}) {
  return {
    users: {
      messages: {
        get: vi.fn(async () => ({
          data: { payload: opts.origPayload ?? null },
        })),
        attachments: {
          get: vi.fn(async (req: any) => ({
            data: { data: opts.attachmentData?.[req.id] ?? null },
          })),
        },
        send: vi.fn(async (req: any) => {
          if (opts.sendError) {
            const err: any = new Error('mocked send error');
            err.code = opts.sendError.code;
            throw err;
          }
          return {
            data: {
              id: opts.sendResponse?.id ?? 'new-msg-id',
              threadId: opts.sendResponse?.threadId ?? 'new-thread-id',
            },
          };
        }),
      },
    },
  };
}

const SAMPLE_ORIG_PAYLOAD = {
  headers: [
    { name: 'Subject', value: 'Wichtige Abmahnung' },
    { name: 'From', value: 'sender@example.com' },
    { name: 'To', value: 'tom@grundwerk.digital' },
    { name: 'Date', value: 'Thu, 29 May 2026 10:00:00 +0000' },
    { name: 'Message-ID', value: '<original-msg-id@mail.example.com>' },
  ],
  parts: [
    {
      mimeType: 'text/plain',
      body: { data: encodeBase64Url('Bitte sofort prüfen.') },
    },
    {
      mimeType: 'application/pdf',
      filename: 'schriftsatz.pdf',
      body: { attachmentId: 'att1' },
    },
  ],
};

describe('forwardEmail', () => {
  it('returns success with new messageId + threadId', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('PDF binary content') },
      sendResponse: { id: 'newmsg42', threadId: 'thread99' },
    });

    const result = await executeForwardEmail(
      {
        messageId: 'origmsg',
        to: 'anwalt@kanzlei.de',
      },
      mockGmail as any
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('newmsg42');
    expect(result.threadId).toBe('thread99');
  });

  it('builds MIME body with Forwarded-message-separator + original headers + body', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('content') },
    });

    await executeForwardEmail(
      { messageId: 'origmsg', to: 'anwalt@kanzlei.de' },
      mockGmail as any
    );

    const sentRaw = mockGmail.users.messages.send.mock.calls[0][0].requestBody.raw;
    const decodedMime = decodeBase64Url(sentRaw);

    expect(decodedMime).toContain('---------- Forwarded message ----------');
    expect(decodedMime).toContain('From: sender@example.com');
    expect(decodedMime).toContain('Subject: Wichtige Abmahnung');
    expect(decodedMime).toContain('To: tom@grundwerk.digital');
    expect(decodedMime).toContain('Bitte sofort prüfen.');
  });

  it('prepends additionalMessage BEFORE the Forwarded separator', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('x') },
    });

    await executeForwardEmail(
      {
        messageId: 'origmsg',
        to: 'anwalt@kanzlei.de',
        additionalMessage: 'FYI bitte juristisch prüfen.',
      },
      mockGmail as any
    );

    const decodedMime = decodeBase64Url(
      mockGmail.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    const additionalIdx = decodedMime.indexOf('FYI bitte juristisch prüfen.');
    const separatorIdx = decodedMime.indexOf('---------- Forwarded message ----------');
    expect(additionalIdx).toBeGreaterThan(-1);
    expect(additionalIdx).toBeLessThan(separatorIdx);
  });

  it('preserves Attachments (Content-Disposition + filename in MIME)', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('PDF-bytes') },
    });

    await executeForwardEmail(
      { messageId: 'origmsg', to: 'anwalt@kanzlei.de' },
      mockGmail as any
    );

    const decodedMime = decodeBase64Url(
      mockGmail.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    expect(decodedMime).toContain('Content-Type: application/pdf');
    expect(decodedMime).toContain('filename="schriftsatz.pdf"');
    expect(decodedMime).toContain('Content-Disposition: attachment');
  });

  it('sets References + In-Reply-To header to original Message-ID', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('x') },
    });

    await executeForwardEmail(
      { messageId: 'origmsg', to: 'anwalt@kanzlei.de' },
      mockGmail as any
    );

    const decodedMime = decodeBase64Url(
      mockGmail.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    expect(decodedMime).toContain('References: <original-msg-id@mail.example.com>');
    expect(decodedMime).toContain('In-Reply-To: <original-msg-id@mail.example.com>');
  });

  it('prefixes Subject with "Fwd: " (unless already present)', async () => {
    const mockGmail1 = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('x') },
    });
    await executeForwardEmail(
      { messageId: 'm', to: 'a@b.de' },
      mockGmail1 as any
    );
    const mime1 = decodeBase64Url(
      mockGmail1.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    expect(mime1).toContain('Subject: Fwd: Wichtige Abmahnung');

    // Case: already prefixed
    const payloadAlreadyFwd = {
      ...SAMPLE_ORIG_PAYLOAD,
      headers: [
        { name: 'Subject', value: 'Fwd: Already Forwarded' },
        { name: 'From', value: 'x@x.de' },
        { name: 'To', value: 'y@y.de' },
        { name: 'Date', value: 'now' },
        { name: 'Message-ID', value: '<id@x>' },
      ],
    };
    const mockGmail2 = makeMockGmailForForward({
      origPayload: payloadAlreadyFwd,
      attachmentData: { att1: encodeBase64Url('x') },
    });
    await executeForwardEmail(
      { messageId: 'm', to: 'a@b.de' },
      mockGmail2 as any
    );
    const mime2 = decodeBase64Url(
      mockGmail2.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    expect(mime2).toContain('Subject: Fwd: Already Forwarded');
    // Should NOT double-prefix
    expect(mime2).not.toContain('Subject: Fwd: Fwd:');
  });

  it('handles email with NO attachments (single text/plain part)', async () => {
    const simplePayload = {
      headers: [
        { name: 'Subject', value: 'Simple email' },
        { name: 'From', value: 'a@b.de' },
        { name: 'To', value: 'c@d.de' },
        { name: 'Date', value: 'now' },
        { name: 'Message-ID', value: '<simple@x>' },
      ],
      mimeType: 'text/plain',
      body: { data: encodeBase64Url('Hello there.') },
    };
    const mockGmail = makeMockGmailForForward({ origPayload: simplePayload });

    const result = await executeForwardEmail(
      { messageId: 'm', to: 'fwd@x.de' },
      mockGmail as any
    );
    expect(result.success).toBe(true);
    const mime = decodeBase64Url(
      mockGmail.users.messages.send.mock.calls[0][0].requestBody.raw
    );
    expect(mime).toContain('Hello there.');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).not.toContain('multipart/mixed');
  });

  it('throws UserError on 403 (gmail.send scope missing)', async () => {
    const mockGmail = makeMockGmailForForward({
      origPayload: SAMPLE_ORIG_PAYLOAD,
      attachmentData: { att1: encodeBase64Url('x') },
      sendError: { code: 403 },
    });

    await expect(
      executeForwardEmail({ messageId: 'm', to: 'x@x.de' }, mockGmail as any)
    ).rejects.toThrow();
  });
});
