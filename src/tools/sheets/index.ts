import type { FastMCP } from 'fastmcp';
import { register as readSpreadsheet } from './readSpreadsheet.js';
import { register as writeSpreadsheet } from './writeSpreadsheet.js';
import { register as batchWrite } from './batchWrite.js';
import { register as appendSpreadsheetRows } from './appendSpreadsheetRows.js';
import { register as clearSpreadsheetRange } from './clearSpreadsheetRange.js';
import { register as getSpreadsheetInfo } from './getSpreadsheetInfo.js';
import { register as addSpreadsheetSheet } from './addSpreadsheetSheet.js';
import { register as createSpreadsheet } from './createSpreadsheet.js';
import { register as listGoogleSheets } from './listGoogleSheets.js';
import { register as deleteSheet } from './deleteSheet.js';
import { register as renameSheet } from './renameSheet.js';
import { register as duplicateSheet } from './duplicateSheet.js';
import { register as deleteRows } from './deleteRows.js';
import { register as deleteRowByValue } from './deleteRowByValue.js';

// Power-Editing (Phase 4)
import { register as sortRange } from './sortRange.js';
import { register as findReplace } from './findReplace.js';
import { register as insertRowsAt } from './insertRowsAt.js';
import { register as setRowVisibility } from './setRowVisibility.js';
import { register as setColumnVisibility } from './setColumnVisibility.js';
import { register as mergeCells } from './mergeCells.js';
import { register as unmergeCells } from './unmergeCells.js';
import { register as insertHyperlink } from './insertHyperlink.js';

// Named Ranges
import { register as createNamedRange } from './createNamedRange.js';
import { register as listNamedRanges } from './listNamedRanges.js';
import { register as updateNamedRange } from './updateNamedRange.js';
import { register as deleteNamedRange } from './deleteNamedRange.js';

// Protected Ranges
import { register as createProtectedRange } from './createProtectedRange.js';
import { register as listProtectedRanges } from './listProtectedRanges.js';
import { register as updateProtectedRange } from './updateProtectedRange.js';
import { register as deleteProtectedRange } from './deleteProtectedRange.js';

// Power-Features
import { register as createChart } from './createChart.js';
import { register as createPivotTable } from './createPivotTable.js';

// Formatting & validation
import { register as formatCells } from './formatCells.js';
import { register as readCellFormat } from './readCellFormat.js';
import { register as copyFormatting } from './copyFormatting.js';
import { register as freezeRowsAndColumns } from './freezeRowsAndColumns.js';
import { register as setGridlinesVisibility } from './setGridlinesVisibility.js';
import { register as setColumnWidths } from './setColumnWidths.js';
import { register as setRowHeights } from './setRowHeights.js';
import { register as autoResizeColumns } from './autoResizeColumns.js';
import { register as setDropdownValidation } from './setDropdownValidation.js';
import { register as setBorders } from './setBorders.js';
import { register as addConditionalFormatting } from './addConditionalFormatting.js';
import { register as listConditionalFormatRules } from './listConditionalFormatRules.js';
import { register as deleteConditionalFormatting } from './deleteConditionalFormatting.js';

// Tables
import { register as createTable } from './createTable.js';
import { register as listTables } from './listTables.js';
import { register as getTable } from './getTable.js';
import { register as deleteTable } from './deleteTable.js';
import { register as updateTableRange } from './updateTableRange.js';
import { register as appendTableRows } from './appendTableRows.js';

export function registerSheetsTools(server: FastMCP) {
  readSpreadsheet(server);
  writeSpreadsheet(server);
  batchWrite(server);
  appendSpreadsheetRows(server);
  clearSpreadsheetRange(server);
  getSpreadsheetInfo(server);
  addSpreadsheetSheet(server);
  createSpreadsheet(server);
  listGoogleSheets(server);
  deleteSheet(server);
  renameSheet(server);
  duplicateSheet(server);
  deleteRows(server);
  deleteRowByValue(server);

  // Formatting & validation
  formatCells(server);
  readCellFormat(server);
  copyFormatting(server);
  freezeRowsAndColumns(server);
  setGridlinesVisibility(server);
  setColumnWidths(server);
  setRowHeights(server);
  autoResizeColumns(server);
  setDropdownValidation(server);
  setBorders(server);
  addConditionalFormatting(server);
  listConditionalFormatRules(server);
  deleteConditionalFormatting(server);

  // Tables
  createTable(server);
  listTables(server);
  getTable(server);
  deleteTable(server);
  updateTableRange(server);
  appendTableRows(server);

  // Power-Editing
  sortRange(server);
  findReplace(server);
  insertRowsAt(server);
  setRowVisibility(server);
  setColumnVisibility(server);
  mergeCells(server);
  unmergeCells(server);
  insertHyperlink(server);

  // Named Ranges
  createNamedRange(server);
  listNamedRanges(server);
  updateNamedRange(server);
  deleteNamedRange(server);

  // Protected Ranges
  createProtectedRange(server);
  listProtectedRanges(server);
  updateProtectedRange(server);
  deleteProtectedRange(server);

  // Power-Features
  createChart(server);
  createPivotTable(server);
}
