import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  executeDownloadEmailAttachment,
  listAttachments,
  pickAttachment,
} from './downloadEmailAttachment.js';
import { UserError } from 'fastmcp';

const TEST_DIR = '/tmp/downloadEmailAttachment-test/';

function encodeBase64Url(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeMockGmail(opts: {
  messagePayload?: any;
  attachmentData?: string | null;
  attachmentError?: { code: number };
}): any {
  return {
    users: {
      messages: {
        attachments: {
          get: vi.fn(async () => {
            if (opts.attachmentError) {
              const err: any = new Error('mocked Gmail error');
              err.code = opts.attachmentError.code;
              throw err;
            }
            return { data: { data: opts.attachmentData ?? null } };
          }),
        },
        get: vi.fn(async () => ({
          data: { payload: opts.messagePayload ?? null },
        })),
      },
    },
  };
}

describe('downloadEmailAttachment', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns success with filePath, fileName, mimeType, sizeBytes for valid attachment (matching ID)', async () => {
    const contents = 'Hello PDF content!';
    const mockGmail = makeMockGmail({
      attachmentData: encodeBase64Url(contents),
      messagePayload: {
        parts: [
          {
            filename: 'schriftsatz.pdf',
            mimeType: 'application/pdf',
            body: { attachmentId: 'att123', size: contents.length },
          },
        ],
      },
    });

    const result = await executeDownloadEmailAttachment(
      { messageId: 'msg1', attachmentId: 'att123', savePath: TEST_DIR },
      mockGmail
    );

    expect(result.success).toBe(true);
    expect(result.fileName).toBe('schriftsatz.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(contents.length);
    expect(result.filePath).toBe(path.join(TEST_DIR, 'schriftsatz.pdf'));

    const written = await fs.readFile(result.filePath, 'utf-8');
    expect(written).toBe(contents);
  });

  it('handles stale attachmentId by falling back to single attachment in payload', async () => {
    // Simulates Gmail-quirk: user passes attachmentId from old messages.get,
    // but current payload has a different (fresh) ID for same physical attachment.
    const mockGmail = makeMockGmail({
      attachmentData: encodeBase64Url('content'),
      messagePayload: {
        parts: [
          {
            filename: 'fresh.pdf',
            mimeType: 'application/pdf',
            body: { attachmentId: 'fresh-id-xyz', size: 7 },
          },
        ],
      },
    });

    const result = await executeDownloadEmailAttachment(
      { messageId: 'msg', attachmentId: 'stale-old-id', savePath: TEST_DIR },
      mockGmail
    );
    expect(result.fileName).toBe('fresh.pdf');
    expect(result.sizeBytes).toBe(7);
  });

  it('throws UserError with available attachment list when ID mismatch + multiple attachments', async () => {
    const mockGmail = makeMockGmail({
      messagePayload: {
        parts: [
          { filename: 'a.pdf', mimeType: 'application/pdf', body: { attachmentId: 'id1' } },
          { filename: 'b.pdf', mimeType: 'application/pdf', body: { attachmentId: 'id2' } },
        ],
      },
    });

    await expect(
      executeDownloadEmailAttachment(
        { messageId: 'm', attachmentId: 'unknown-id', savePath: TEST_DIR },
        mockGmail
      )
    ).rejects.toThrow(/attachmentId not found/);
  });

  it('throws UserError when message has no attachments', async () => {
    const mockGmail = makeMockGmail({
      messagePayload: { parts: [{ mimeType: 'text/plain', body: { data: 'aGVsbG8' } }] },
    });
    await expect(
      executeDownloadEmailAttachment(
        { messageId: 'm', attachmentId: 'id', savePath: TEST_DIR },
        mockGmail
      )
    ).rejects.toThrow(/has no attachments/);
  });

  it('fallback filename when payload-part has no filename field (uses short attachmentId stub)', async () => {
    const mockGmail = makeMockGmail({
      attachmentData: encodeBase64Url('binary-data'),
      messagePayload: {
        parts: [
          {
            mimeType: 'application/octet-stream',
            body: { attachmentId: 'attXYZ' },
          },
        ],
      },
    });

    const result = await executeDownloadEmailAttachment(
      { messageId: 'msg', attachmentId: 'attXYZ', savePath: TEST_DIR },
      mockGmail
    );
    expect(result.fileName).toMatch(/^attachment-attXYZ.*\.bin$/);
    expect(result.fileName.length).toBeLessThan(60);
    expect(result.mimeType).toBe('application/octet-stream');
  });

  it('recurses into nested multipart parts to find attachment', async () => {
    const mockGmail = makeMockGmail({
      attachmentData: encodeBase64Url('nested-content'),
      messagePayload: {
        parts: [
          { mimeType: 'text/plain', body: { data: 'aGVsbG8' } },
          {
            mimeType: 'multipart/mixed',
            parts: [
              {
                filename: 'inner.pdf',
                mimeType: 'application/pdf',
                body: { attachmentId: 'deepAtt' },
              },
            ],
          },
        ],
      },
    });

    const result = await executeDownloadEmailAttachment(
      { messageId: 'msg', attachmentId: 'deepAtt', savePath: TEST_DIR },
      mockGmail
    );
    expect(result.fileName).toBe('inner.pdf');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('throws UserError when attachment data is null from Gmail', async () => {
    const mockGmail = makeMockGmail({
      attachmentData: null,
      messagePayload: {
        parts: [
          { filename: 'a.pdf', mimeType: 'application/pdf', body: { attachmentId: 'ax' } },
        ],
      },
    });
    await expect(
      executeDownloadEmailAttachment(
        { messageId: 'm', attachmentId: 'ax', savePath: TEST_DIR },
        mockGmail
      )
    ).rejects.toThrow(UserError);
  });

  it('creates savePath directory if it does not exist', async () => {
    const nestedPath = path.join(TEST_DIR, 'nested', 'deep/');
    const mockGmail = makeMockGmail({
      attachmentData: encodeBase64Url('test'),
      messagePayload: {
        parts: [
          {
            filename: 'a.txt',
            mimeType: 'text/plain',
            body: { attachmentId: 'a' },
          },
        ],
      },
    });

    const result = await executeDownloadEmailAttachment(
      { messageId: 'm', attachmentId: 'a', savePath: nestedPath },
      mockGmail
    );
    expect(result.filePath).toBe(path.join(nestedPath, 'a.txt'));
    const exists = await fs
      .stat(result.filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});

describe('listAttachments helper', () => {
  it('returns empty for null payload', () => {
    expect(listAttachments(null)).toEqual([]);
  });

  it('collects flat attachments', () => {
    const result = listAttachments({
      parts: [
        { filename: 'a.pdf', mimeType: 'application/pdf', body: { attachmentId: 'a1', size: 100 } },
        { filename: 'b.png', mimeType: 'image/png', body: { attachmentId: 'b1', size: 200 } },
      ],
    } as any);
    expect(result).toHaveLength(2);
    expect(result[0]?.filename).toBe('a.pdf');
    expect(result[1]?.attachmentId).toBe('b1');
  });

  it('collects nested attachments via recursive walk', () => {
    const result = listAttachments({
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: 'aGk' } },
            { mimeType: 'text/html', body: { data: 'PGh0bWw+' } },
          ],
        },
        {
          mimeType: 'multipart/mixed',
          parts: [
            { filename: 'deep.pdf', mimeType: 'application/pdf', body: { attachmentId: 'deep1' } },
          ],
        },
      ],
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.attachmentId).toBe('deep1');
  });
});

describe('pickAttachment helper', () => {
  const sample = [
    { attachmentId: 'a1', filename: 'one.pdf', mimeType: 'application/pdf', size: 100 },
    { attachmentId: 'a2', filename: 'two.pdf', mimeType: 'application/pdf', size: 200 },
  ];

  it('matches exact attachmentId', () => {
    expect(pickAttachment(sample, 'a2', 'm').attachmentId).toBe('a2');
  });

  it('falls back to single attachment when ID mismatch but only 1 attachment', () => {
    expect(pickAttachment([sample[0]!], 'unknown', 'm').attachmentId).toBe('a1');
  });

  it('throws UserError with attachment list when ID mismatch + multiple', () => {
    expect(() => pickAttachment(sample, 'unknown', 'm')).toThrow(/not found/);
  });

  it('throws UserError when no attachments at all', () => {
    expect(() => pickAttachment([], 'any', 'm')).toThrow(/has no attachments/);
  });
});
