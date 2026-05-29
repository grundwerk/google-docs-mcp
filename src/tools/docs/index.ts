import type { FastMCP } from 'fastmcp';

// Core read/write
import { register as readGoogleDoc } from './readGoogleDoc.js';
import { register as listDocumentTabs } from './listDocumentTabs.js';
import { register as renameTab } from './renameTab.js';
import { register as createTab } from './createTab.js';
import { register as deleteTab } from './deleteTab.js';
import { register as appendToGoogleDoc } from './appendToGoogleDoc.js';
import { register as insertText } from './insertText.js';
import { register as deleteRange } from './deleteRange.js';

// Structure
import { register as insertTable } from './insertTable.js';
import { register as insertTableWithData } from './insertTableWithData.js';
import { register as insertPageBreak } from './insertPageBreak.js';
import { register as insertImage } from './insertImage.js';

// Sub-domains
import { registerCommentTools } from './comments/index.js';
import { registerFormattingTools } from './formatting/index.js';

// Phase 5 — MED Docs
import { register as findReplaceDocs } from './findReplaceDocs.js';
import { register as insertHeaderFooter } from './insertHeaderFooter.js';
import { register as insertTOC } from './insertTOC.js';
import { register as createBookmark } from './createBookmark.js';
import { register as listBookmarks } from './listBookmarks.js';
import { register as deleteBookmark } from './deleteBookmark.js';
import { register as insertImageFromUrl } from './insertImageFromUrl.js';

export function registerDocsTools(server: FastMCP) {
  // Core read/write
  readGoogleDoc(server);
  listDocumentTabs(server);
  renameTab(server);
  createTab(server);
  deleteTab(server);
  appendToGoogleDoc(server);
  insertText(server);
  deleteRange(server);

  // Structure
  insertTable(server);
  insertTableWithData(server);
  insertPageBreak(server);
  insertImage(server);

  // Sub-domains
  registerFormattingTools(server);
  registerCommentTools(server);

  // Phase 5 — MED Docs
  findReplaceDocs(server);
  insertHeaderFooter(server);
  insertTOC(server);
  createBookmark(server);
  listBookmarks(server);
  deleteBookmark(server);
  insertImageFromUrl(server);
}
