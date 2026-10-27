import { describe, it, expect, vi } from 'vitest';
import { executeGetFolderInfo } from './getFolderInfo.js';

// The Drive API returns ONLY the fields named in `fields`. The mock does the same, so a
// field the code checks but never requests comes back missing, exactly as in production.
function makeMockDrive(file: Record<string, unknown>) {
  return {
    files: {
      get: vi.fn(async (req: { fields: string }) => {
        const top = req.fields.split(',').map((f) => f.split('(')[0].trim());
        return { data: Object.fromEntries(Object.entries(file).filter(([k]) => top.includes(k))) };
      }),
    },
  } as any;
}

const FOLDER = {
  id: 'folder-1',
  name: 'RevRise (Google Ads Projekt Grundwerk x Neomotion)',
  mimeType: 'application/vnd.google-apps.folder',
  webViewLink: 'https://drive.google.com/drive/folders/folder-1',
  parents: ['parent-1'],
  shared: true,
};

describe('getFolderInfo: a real folder is recognised as a folder', () => {
  // Vorfall 2026-10-27: getFolderInfo meldete bei JEDEM Ordner "does not belong to a folder",
  // weil mimeType geprueft, aber nie angefordert wurde. Ein Agent musste auf rclone ausweichen.
  it('liefert die Ordnerdaten statt eines Fehlers', async () => {
    const drive = makeMockDrive(FOLDER);
    const out = JSON.parse(await executeGetFolderInfo(drive, { folderId: 'folder-1' }));
    expect(out).toMatchObject({
      id: 'folder-1',
      name: FOLDER.name,
      parentFolderId: 'parent-1',
      shared: true,
    });
    expect(drive.files.get.mock.calls[0][0].fields).toMatch(/(^|,)mimeType(,|$)/);
  });

  it('lehnt eine Datei ab, die kein Ordner ist', async () => {
    const drive = makeMockDrive({ ...FOLDER, mimeType: 'application/vnd.google-apps.document' });
    await expect(executeGetFolderInfo(drive, { folderId: 'doc-1' })).rejects.toThrow(
      /does not belong to a folder/
    );
  });
});
