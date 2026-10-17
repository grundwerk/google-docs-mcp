import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { executeGetPresentationJson } from './getPresentationJson.js';
import { executeUpdateFileContent } from './updateFileContent.js';

describe('getPresentationJson', () => {
  it('liefert die volle Präsentation inklusive Element-IDs, optional eingeschränkt über fields', async () => {
    const slides: any = {
      presentations: {
        get: vi.fn(async () => ({
          data: { slides: [{ objectId: 'p1', pageElements: [{ objectId: 'e1' }] }] },
        })),
      },
    };
    const out = JSON.parse(
      await executeGetPresentationJson(slides, {
        presentationId: 'abc',
        fields: 'slides(objectId)',
      })
    );
    expect(slides.presentations.get).toHaveBeenCalledWith({
      presentationId: 'abc',
      fields: 'slides(objectId)',
    });
    expect(out.slides[0].pageElements[0].objectId).toBe('e1');
  });

  it('schreibt große Präsentationen in eine Datei statt sie abzuschneiden', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pres-'));
    const target = join(dir, 'p.json');
    const slides: any = { presentations: { get: vi.fn(async () => ({ data: { title: 'X' } })) } };
    const out = JSON.parse(
      await executeGetPresentationJson(slides, { presentationId: 'abc', saveToPath: target })
    );
    expect(JSON.parse(readFileSync(target, 'utf8')).title).toBe('X');
    expect(out.savedTo).toBe(target);
  });
});

describe('updateFileContent: Inhalt ersetzen, Datei-ID und Link bleiben', () => {
  it('ruft files.update auf genau dieser Datei-ID mit dem lokalen Inhalt auf', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'upd-'));
    const file = join(dir, 'deck.pptx');
    writeFileSync(file, Buffer.from('PPTX'));
    const drive: any = {
      files: {
        update: vi.fn(async (req: any) => ({
          data: {
            id: req.fileId,
            name: 'Deck',
            mimeType: 'application/vnd.google-apps.presentation',
          },
        })),
      },
    };
    const out = JSON.parse(
      await executeUpdateFileContent(drive, { fileId: 'keep-me', localPath: file })
    );
    const req = drive.files.update.mock.calls[0][0];
    expect(req.fileId).toBe('keep-me');
    expect(req.media.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(out.id).toBe('keep-me');
  });

  it('lehnt relative Pfade ab, ohne Drive aufzurufen', async () => {
    const drive: any = { files: { update: vi.fn() } };
    await expect(
      executeUpdateFileContent(drive, { fileId: 'x', localPath: 'deck.pptx' })
    ).rejects.toThrow(/absolute/);
    expect(drive.files.update).not.toHaveBeenCalled();
  });
});
