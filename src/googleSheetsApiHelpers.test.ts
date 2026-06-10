import { describe, it, expect, vi } from 'vitest';
import {
  formatCells,
  setBorders,
  listConditionalFormatRules,
  deleteConditionalFormatRule,
  setRowHeights,
  hexToRgb,
  parseA1ToGridRange,
} from './googleSheetsApiHelpers.js';

// --- Mock Helpers ---

/**
 * Builds a mock `sheets` client whose `spreadsheets.batchUpdate` captures every
 * request body it receives, and whose `spreadsheets.get` returns the provided
 * metadata (used by resolveSheetId + listConditionalFormatRules).
 */
function buildMockSheets(options?: { metadata?: any; getData?: any }) {
  const batchUpdate = vi.fn(async () => ({ data: { replies: [] } }));
  const defaultMetadata = {
    sheets: [
      { properties: { sheetId: 0, title: 'Sheet1' } },
      { properties: { sheetId: 123, title: 'Data' } },
    ],
  };
  const get = vi.fn(async () => ({
    data: options?.getData ?? options?.metadata ?? defaultMetadata,
  }));
  const sheets = {
    spreadsheets: {
      batchUpdate,
      get,
    },
  };
  return { sheets, batchUpdate, get };
}

/** Returns the requests array from the first batchUpdate call. */
function firstRequests(batchUpdate: ReturnType<typeof vi.fn>) {
  return batchUpdate.mock.calls[0][0].requestBody.requests;
}

// --- Sanity: shared utils used by the new helpers ---

describe('hexToRgb (used by new helpers)', () => {
  it('converts #FF0000 to {1,0,0}', () => {
    expect(hexToRgb('#FF0000')).toEqual({ red: 1, green: 0, blue: 0 });
  });
  it('converts #000000 to {0,0,0}', () => {
    expect(hexToRgb('#000000')).toEqual({ red: 0, green: 0, blue: 0 });
  });
});

// --- (a) formatCells: fontFamily, wrapStrategy, verticalAlignment ---

describe('formatCells - new format params', () => {
  it('passes fontFamily into userEnteredFormat.textFormat.fontFamily', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await formatCells(sheets as any, 'sid', 'Data!A1:B2', {
      textFormat: { fontFamily: 'Roboto' },
    });

    const req = firstRequests(batchUpdate)[0].repeatCell;
    expect(req.cell.userEnteredFormat.textFormat.fontFamily).toBe('Roboto');
    // textFormat is in the base fields mask
    expect(req.fields).toContain('textFormat');
  });

  it('passes verticalAlignment into userEnteredFormat', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await formatCells(sheets as any, 'sid', 'Data!A1:B2', {
      verticalAlignment: 'MIDDLE',
    });

    const req = firstRequests(batchUpdate)[0].repeatCell;
    expect(req.cell.userEnteredFormat.verticalAlignment).toBe('MIDDLE');
    expect(req.fields).toContain('verticalAlignment');
  });

  it('includes wrapStrategy in fields mask ONLY when wrapStrategy is provided', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await formatCells(sheets as any, 'sid', 'Data!A1:B2', {
      wrapStrategy: 'WRAP',
    });

    const req = firstRequests(batchUpdate)[0].repeatCell;
    expect(req.cell.userEnteredFormat.wrapStrategy).toBe('WRAP');
    expect(req.fields).toContain('wrapStrategy');
  });

  it('does NOT include wrapStrategy in fields mask when wrapStrategy is absent', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await formatCells(sheets as any, 'sid', 'Data!A1:B2', {
      textFormat: { bold: true },
    });

    const req = firstRequests(batchUpdate)[0].repeatCell;
    expect(req.fields).not.toContain('wrapStrategy');
  });

  it('resolves the sheet name from the range into the correct sheetId', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await formatCells(sheets as any, 'sid', 'Data!A1:B2', { textFormat: { bold: true } });

    const req = firstRequests(batchUpdate)[0].repeatCell;
    expect(req.range.sheetId).toBe(123);
    expect(req.range.startRowIndex).toBe(0);
    expect(req.range.endRowIndex).toBe(2);
  });
});

// --- (b) setBorders ---

describe('setBorders', () => {
  it('builds an updateBorders request with the resolved gridRange and per-side styles', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await setBorders(sheets as any, 'sid', 'Data!A1:C3', {
      top: { style: 'SOLID', color: '#FF0000' },
      bottom: { style: 'SOLID_THICK' },
    });

    const req = firstRequests(batchUpdate)[0].updateBorders;
    expect(req).toBeDefined();
    // gridRange resolved from "Data" sheet
    expect(req.range.sheetId).toBe(123);
    expect(req.range.startRowIndex).toBe(0);
    expect(req.range.endRowIndex).toBe(3);
    expect(req.range.startColumnIndex).toBe(0);
    expect(req.range.endColumnIndex).toBe(3);

    // top border with hex->rgb color
    expect(req.top.style).toBe('SOLID');
    expect(req.top.color).toEqual({ red: 1, green: 0, blue: 0 });

    // bottom border without color
    expect(req.bottom.style).toBe('SOLID_THICK');
    expect(req.bottom.color).toBeUndefined();
  });

  it('only includes the sides that were provided', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await setBorders(sheets as any, 'sid', 'A1:B2', {
      innerHorizontal: { style: 'DASHED' },
      innerVertical: { style: 'DOTTED' },
    });

    const req = firstRequests(batchUpdate)[0].updateBorders;
    expect(req.innerHorizontal.style).toBe('DASHED');
    expect(req.innerVertical.style).toBe('DOTTED');
    expect(req.top).toBeUndefined();
    expect(req.bottom).toBeUndefined();
    expect(req.left).toBeUndefined();
    expect(req.right).toBeUndefined();
  });

  it('does NOT include a fields mask (updateBorders has none)', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await setBorders(sheets as any, 'sid', 'A1:B2', {
      left: { style: 'DOUBLE' },
    });

    const req = firstRequests(batchUpdate)[0].updateBorders;
    expect(req.fields).toBeUndefined();
  });
});

// --- (c) listConditionalFormatRules ---

describe('listConditionalFormatRules', () => {
  it('returns per-sheet rules with their 0-based index, range, bg and condition', async () => {
    const getData = {
      sheets: [
        {
          properties: { sheetId: 0, title: 'Sheet1' },
          conditionalFormats: [
            {
              ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: 10 }],
              booleanRule: {
                condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '5' }] },
                format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
              },
            },
            {
              ranges: [{ sheetId: 0, startColumnIndex: 0, endColumnIndex: 2 }],
              booleanRule: {
                condition: { type: 'NOT_BLANK' },
                format: { backgroundColor: { red: 0, green: 1, blue: 0 } },
              },
            },
          ],
        },
        {
          properties: { sheetId: 123, title: 'Data' },
        },
      ],
    };
    const { sheets, get } = buildMockSheets({ getData });

    const result = await listConditionalFormatRules(sheets as any, 'sid');

    // get was called with the conditionalFormats fields mask
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'sid',
        fields: 'sheets(properties(sheetId,title),conditionalFormats)',
      })
    );

    expect(result).toHaveLength(2);
    const sheet1 = result.find((s: any) => s.sheetName === 'Sheet1');
    expect(sheet1.sheetId).toBe(0);
    expect(sheet1.rules).toHaveLength(2);
    expect(sheet1.rules[0].index).toBe(0);
    expect(sheet1.rules[0].condition.type).toBe('NUMBER_GREATER');
    expect(sheet1.rules[1].index).toBe(1);
    expect(sheet1.rules[1].condition.type).toBe('NOT_BLANK');

    const dataSheet = result.find((s: any) => s.sheetName === 'Data');
    expect(dataSheet.rules).toHaveLength(0);
  });

  it('filters to a single sheet when sheetName is provided', async () => {
    const getData = {
      sheets: [
        {
          properties: { sheetId: 0, title: 'Sheet1' },
          conditionalFormats: [
            {
              ranges: [{ sheetId: 0 }],
              booleanRule: { condition: { type: 'BLANK' }, format: {} },
            },
          ],
        },
        {
          properties: { sheetId: 123, title: 'Data' },
          conditionalFormats: [
            {
              ranges: [{ sheetId: 123 }],
              booleanRule: { condition: { type: 'NOT_BLANK' }, format: {} },
            },
          ],
        },
      ],
    };
    const { sheets } = buildMockSheets({ getData });

    const result = await listConditionalFormatRules(sheets as any, 'sid', 'Data');
    expect(result).toHaveLength(1);
    expect(result[0].sheetName).toBe('Data');
    expect(result[0].rules[0].condition.type).toBe('NOT_BLANK');
  });
});

// --- (c) deleteConditionalFormatRule ---

describe('deleteConditionalFormatRule', () => {
  it('builds a deleteConditionalFormatRule request with the resolved sheetId and index', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await deleteConditionalFormatRule(sheets as any, 'sid', 'Data', 2);

    const req = firstRequests(batchUpdate)[0].deleteConditionalFormatRule;
    expect(req).toEqual({ sheetId: 123, index: 2 });
  });

  it('defaults to the first sheet when no sheetName is given', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await deleteConditionalFormatRule(sheets as any, 'sid', undefined, 0);

    const req = firstRequests(batchUpdate)[0].deleteConditionalFormatRule;
    expect(req).toEqual({ sheetId: 0, index: 0 });
  });
});

// --- (d) setRowHeights ---

describe('setRowHeights', () => {
  it('builds updateDimensionProperties requests for ROWS with 1-based->0-based conversion', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await setRowHeights(sheets as any, 'sid', 'Data', [
      { startRow: 1, endRow: 3, height: 40 },
      { startRow: 5, endRow: 5, height: 60 },
    ]);

    const requests = firstRequests(batchUpdate);
    expect(requests).toHaveLength(2);

    const first = requests[0].updateDimensionProperties;
    expect(first.range.sheetId).toBe(123);
    expect(first.range.dimension).toBe('ROWS');
    // startRow 1 (1-based inclusive) -> startIndex 0
    expect(first.range.startIndex).toBe(0);
    // endRow 3 (1-based inclusive) -> endIndex 3
    expect(first.range.endIndex).toBe(3);
    expect(first.properties.pixelSize).toBe(40);
    expect(first.fields).toBe('pixelSize');

    const second = requests[1].updateDimensionProperties;
    expect(second.range.startIndex).toBe(4);
    expect(second.range.endIndex).toBe(5);
    expect(second.properties.pixelSize).toBe(60);
  });

  it('defaults to the first sheet when sheetName is omitted', async () => {
    const { sheets, batchUpdate } = buildMockSheets();
    await setRowHeights(sheets as any, 'sid', undefined, [{ startRow: 2, endRow: 2, height: 30 }]);

    const req = firstRequests(batchUpdate)[0].updateDimensionProperties;
    expect(req.range.sheetId).toBe(0);
    expect(req.range.startIndex).toBe(1);
    expect(req.range.endIndex).toBe(2);
  });
});

// --- Sanity check that parseA1ToGridRange behaves as the helpers rely on ---

describe('parseA1ToGridRange (relied on by setBorders)', () => {
  it('parses A1:C3 into a bounded grid range', () => {
    const gr = parseA1ToGridRange('A1:C3', 7);
    expect(gr).toEqual({
      sheetId: 7,
      startRowIndex: 0,
      endRowIndex: 3,
      startColumnIndex: 0,
      endColumnIndex: 3,
    });
  });
});
