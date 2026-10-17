import { describe, it, expect, vi } from 'vitest';
import {
  executeSlidesBatchUpdate,
  executeDocsBatchUpdate,
  executeSheetsBatchUpdate,
} from './batchUpdate.js';

describe('raw batchUpdate pass-through', () => {
  it('Slides: reicht die Requests unverändert durch und gibt die Antworten zurück', async () => {
    const slides: any = {
      presentations: {
        batchUpdate: vi.fn(async () => ({
          data: { presentationId: 'p1', replies: [{ createShape: { objectId: 'box1' } }] },
        })),
      },
    };
    const requests = [
      { createShape: { objectId: 'box1', shapeType: 'TEXT_BOX', elementProperties: {} } },
      { insertText: { objectId: 'box1', text: 'Hallo' } },
    ];
    const out = JSON.parse(
      await executeSlidesBatchUpdate(slides, { presentationId: 'p1', requests })
    );
    expect(slides.presentations.batchUpdate).toHaveBeenCalledWith({
      presentationId: 'p1',
      requestBody: { requests },
    });
    expect(out.replies).toEqual([{ createShape: { objectId: 'box1' } }]);
  });

  it('Slides: lehnt eine leere Request-Liste ab, ohne Google aufzurufen', async () => {
    const slides: any = { presentations: { batchUpdate: vi.fn() } };
    await expect(
      executeSlidesBatchUpdate(slides, { presentationId: 'p1', requests: [] })
    ).rejects.toThrow(/mindestens|at least/i);
    expect(slides.presentations.batchUpdate).not.toHaveBeenCalled();
  });

  it('Docs: gibt writeControl mit, wenn gesetzt', async () => {
    const docs: any = {
      documents: { batchUpdate: vi.fn(async () => ({ data: { documentId: 'd1', replies: [] } })) },
    };
    await executeDocsBatchUpdate(docs, {
      documentId: 'd1',
      requests: [{ insertText: { location: { index: 1 }, text: 'x' } }],
      writeControl: { requiredRevisionId: 'r1' },
    });
    expect(docs.documents.batchUpdate.mock.calls[0][0].requestBody.writeControl).toEqual({
      requiredRevisionId: 'r1',
    });
  });

  it('Sheets: reicht Requests an spreadsheets.batchUpdate durch', async () => {
    const sheets: any = {
      spreadsheets: {
        batchUpdate: vi.fn(async () => ({ data: { spreadsheetId: 's1', replies: [{}] } })),
      },
    };
    const out = JSON.parse(
      await executeSheetsBatchUpdate(sheets, {
        spreadsheetId: 's1',
        requests: [{ addSheet: { properties: { title: 'Neu' } } }],
      })
    );
    expect(sheets.spreadsheets.batchUpdate.mock.calls[0][0].spreadsheetId).toBe('s1');
    expect(out.replies).toEqual([{}]);
  });

  it('meldet Googles Fehlertext samt Status', async () => {
    const slides: any = {
      presentations: {
        batchUpdate: vi.fn(async () => {
          const err: any = new Error('Request failed');
          err.response = {
            status: 400,
            data: { error: { message: 'Invalid value at requests[0]' } },
          };
          throw err;
        }),
      },
    };
    await expect(
      executeSlidesBatchUpdate(slides, { presentationId: 'p1', requests: [{ x: 1 }] })
    ).rejects.toThrow(/400.*Invalid value/);
  });
});
