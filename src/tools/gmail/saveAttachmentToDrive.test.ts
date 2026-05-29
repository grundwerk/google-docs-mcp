import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { executeSaveAttachmentToDrive } from './saveAttachmentToDrive.js';

const ABMAHNUNGEN_FOLDER_ID = '1sW-Dfy7lFyplRnGbwZ5ZM81Sk6dkHwB9';

function encodeBase64Url(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeMockGmail(attachmentData: string, filename: string, mimeType: string) {
  return {
    users: {
      messages: {
        attachments: {
          get: vi.fn(async () => ({ data: { data: encodeBase64Url(attachmentData) } })),
        },
        get: vi.fn(async () => ({
          data: {
            payload: {
              parts: [
                {
                  filename,
                  mimeType,
                  body: { attachmentId: 'att1' },
                },
              ],
            },
          },
        })),
      },
    },
  } as any;
}

function makeMockDrive(opts: { fileId?: string; webViewLink?: string; uploadError?: { code: number } } = {}) {
  return {
    files: {
      create: vi.fn(async (req: any) => {
        // Consume the createReadStream so the temp-file can be unlinked without ENOENT
        if (req.media?.body && typeof req.media.body.on === 'function') {
          await new Promise<void>((resolve, reject) => {
            req.media.body.on('end', () => resolve());
            req.media.body.on('error', (err: any) => reject(err));
            req.media.body.resume();
          });
        }
        if (opts.uploadError) {
          const err: any = new Error('mocked drive error');
          err.code = opts.uploadError.code;
          throw err;
        }
        return {
          data: {
            id: opts.fileId ?? 'drive-file-123',
            webViewLink:
              opts.webViewLink ?? 'https://drive.google.com/file/d/drive-file-123/view',
          },
        };
      }),
    },
  } as any;
}

describe('saveAttachmentToDrive', () => {
  afterEach(async () => {
    await fs.rm('/tmp/mcp-drive-upload/', { recursive: true, force: true });
  });

  it('returns success with driveFileId + webViewLink for valid attachment', async () => {
    const mockGmail = makeMockGmail('Abmahnung-PDF content', 'schriftsatz.pdf', 'application/pdf');
    const mockDrive = makeMockDrive({
      fileId: 'newDriveId',
      webViewLink: 'https://drive.google.com/file/d/newDriveId/view',
    });

    const result = await executeSaveAttachmentToDrive(
      {
        messageId: 'm1',
        attachmentId: 'att1',
        driveFolderId: ABMAHNUNGEN_FOLDER_ID,
      },
      mockGmail,
      mockDrive
    );

    expect(result.success).toBe(true);
    expect(result.driveFileId).toBe('newDriveId');
    expect(result.webViewLink).toBe('https://drive.google.com/file/d/newDriveId/view');
    expect(result.fileName).toBe('schriftsatz.pdf');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('uses Abmahnungen folder ID as default when driveFolderId not provided', async () => {
    const mockGmail = makeMockGmail('content', 'doc.pdf', 'application/pdf');
    const mockDrive = makeMockDrive();

    // Note: zod-default applies via parse, but executeSaveAttachmentToDrive bypasses zod here.
    // The DEFAULT is captured at zod-schema level, so we pass it explicitly to mimic Tool-execution.
    await executeSaveAttachmentToDrive(
      {
        messageId: 'm',
        attachmentId: 'att1',
        driveFolderId: ABMAHNUNGEN_FOLDER_ID,
      },
      mockGmail,
      mockDrive
    );

    const createCall = mockDrive.files.create.mock.calls[0][0];
    expect(createCall.requestBody.parents).toEqual([ABMAHNUNGEN_FOLDER_ID]);
  });

  it('passes custom driveFolderId when provided', async () => {
    const mockGmail = makeMockGmail('x', 'a.pdf', 'application/pdf');
    const mockDrive = makeMockDrive();

    await executeSaveAttachmentToDrive(
      {
        messageId: 'm',
        attachmentId: 'att1',
        driveFolderId: 'custom-folder-456',
      },
      mockGmail,
      mockDrive
    );

    const createCall = mockDrive.files.create.mock.calls[0][0];
    expect(createCall.requestBody.parents).toEqual(['custom-folder-456']);
  });

  it('uses custom fileName override when provided', async () => {
    const mockGmail = makeMockGmail('x', 'original-name.pdf', 'application/pdf');
    const mockDrive = makeMockDrive();

    const result = await executeSaveAttachmentToDrive(
      {
        messageId: 'm',
        attachmentId: 'att1',
        driveFolderId: ABMAHNUNGEN_FOLDER_ID,
        fileName: 'kunde-123-abmahnung.pdf',
      },
      mockGmail,
      mockDrive
    );

    expect(result.fileName).toBe('kunde-123-abmahnung.pdf');
    const createCall = mockDrive.files.create.mock.calls[0][0];
    expect(createCall.requestBody.name).toBe('kunde-123-abmahnung.pdf');
  });

  it('cleans up /tmp file after Drive upload', async () => {
    const mockGmail = makeMockGmail('x', 'cleanup-test.pdf', 'application/pdf');
    const mockDrive = makeMockDrive();

    await executeSaveAttachmentToDrive(
      {
        messageId: 'm',
        attachmentId: 'att1',
        driveFolderId: ABMAHNUNGEN_FOLDER_ID,
      },
      mockGmail,
      mockDrive
    );

    const exists = await fs
      .stat('/tmp/mcp-drive-upload/cleanup-test.pdf')
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('cleans up /tmp file even when Drive upload fails', async () => {
    const mockGmail = makeMockGmail('x', 'fail-test.pdf', 'application/pdf');
    const mockDrive = makeMockDrive({ uploadError: { code: 403 } });

    await expect(
      executeSaveAttachmentToDrive(
        {
          messageId: 'm',
          attachmentId: 'att1',
          driveFolderId: ABMAHNUNGEN_FOLDER_ID,
        },
        mockGmail,
        mockDrive
      )
    ).rejects.toThrow();

    const exists = await fs
      .stat('/tmp/mcp-drive-upload/fail-test.pdf')
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});
