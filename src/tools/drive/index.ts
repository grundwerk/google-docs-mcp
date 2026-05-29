import type { FastMCP } from 'fastmcp';
import { register as listGoogleDocs } from './listGoogleDocs.js';
import { register as searchGoogleDocs } from './searchGoogleDocs.js';
import { register as getDocumentInfo } from './getDocumentInfo.js';
import { register as createFolder } from './createFolder.js';
import { register as listFolderContents } from './listFolderContents.js';
import { register as getFolderInfo } from './getFolderInfo.js';
import { register as moveFile } from './moveFile.js';
import { register as copyFile } from './copyFile.js';
import { register as renameFile } from './renameFile.js';
import { register as deleteFile } from './deleteFile.js';
import { register as createDocument } from './createDocument.js';
import { register as createFromTemplate } from './createFromTemplate.js';
import { register as readDriveFile } from './readDriveFile.js';
import { register as uploadFile } from './uploadFile.js';
import { register as shareFile } from './shareFile.js';
import { register as listFilePermissions } from './listFilePermissions.js';
import { register as removePermission } from './removePermission.js';
import { register as updatePermission } from './updatePermission.js';
import { register as trashFile } from './trashFile.js';
import { register as restoreFile } from './restoreFile.js';
import { register as emptyTrash } from './emptyTrash.js';
import { register as exportFile } from './exportFile.js';
import { register as convertFile } from './convertFile.js';
import { register as starFile } from './starFile.js';
import { register as unstarFile } from './unstarFile.js';

// Phase 8 — LOW Drive
import { register as listFileRevisions } from './listFileRevisions.js';
import { register as keepRevisionForever } from './keepRevisionForever.js';
import { register as deleteRevision } from './deleteRevision.js';
import { register as watchFile } from './watchFile.js';
import { register as getDriveAbout } from './getDriveAbout.js';

export function registerDriveTools(server: FastMCP) {
  listGoogleDocs(server);
  searchGoogleDocs(server);
  getDocumentInfo(server);
  createFolder(server);
  listFolderContents(server);
  getFolderInfo(server);
  moveFile(server);
  copyFile(server);
  renameFile(server);
  deleteFile(server);
  createDocument(server);
  createFromTemplate(server);
  readDriveFile(server);
  uploadFile(server);
  shareFile(server);
  listFilePermissions(server);
  removePermission(server);
  updatePermission(server);
  trashFile(server);
  restoreFile(server);
  emptyTrash(server);
  exportFile(server);
  convertFile(server);
  starFile(server);
  unstarFile(server);

  // Phase 8 — LOW Drive
  listFileRevisions(server);
  keepRevisionForever(server);
  deleteRevision(server);
  watchFile(server);
  getDriveAbout(server);
}
