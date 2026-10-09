import { describe, it, expect, vi } from 'vitest';
import { executeCreateFolder } from './createFolder.js';

const ROOT_ID = '0AAbCdEfGhIjKlMnOpQ';

function makeMockDrive() {
  return {
    files: {
      get: vi.fn(async () => ({ data: { id: ROOT_ID } })),
      create: vi.fn(async (req: any) => ({
        data: {
          id: 'new-folder-1',
          name: req.requestBody.name,
          parents: req.requestBody.parents,
          webViewLink: 'https://drive.google.com/drive/folders/new-folder-1',
        },
      })),
    },
  } as any;
}

describe('createFolder: never into the private My-Drive root', () => {
  // Vorfall 2026-10-09: 6 Kundenordner lagen im privaten Root, weil ein Aufruf
  // ohne parentFolderId stillschweigend dort anlegte. Kein Mitarbeiter hatte Zugriff.
  it.each([
    ['fehlt', undefined],
    ['leer', ''],
    ['nur Leerzeichen', '   '],
    ['root', 'root'],
    ['ROOT', 'ROOT'],
    ['echte Root-ID', ROOT_ID],
  ])('lehnt Elternangabe ab: %s', async (_label, parentFolderId) => {
    const drive = makeMockDrive();
    await expect(executeCreateFolder(drive, { name: 'Birdsview', parentFolderId })).rejects.toThrow(
      /root/i
    );
    expect(drive.files.create).not.toHaveBeenCalled();
  });

  it('legt mit echter Elternangabe genau dort an', async () => {
    const drive = makeMockDrive();
    const out = JSON.parse(
      await executeCreateFolder(drive, { name: 'BAFA Antrag', parentFolderId: 'client-folder-17' })
    );
    expect(drive.files.create).toHaveBeenCalledTimes(1);
    expect(drive.files.create.mock.calls[0][0].requestBody.parents).toEqual(['client-folder-17']);
    expect(out).toEqual({
      id: 'new-folder-1',
      name: 'BAFA Antrag',
      url: 'https://drive.google.com/drive/folders/new-folder-1',
    });
  });
});
