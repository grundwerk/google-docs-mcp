import type { FastMCP } from 'fastmcp';
import { register as searchEmails } from './searchEmails.js';
import { register as readEmail } from './readEmail.js';
import { register as trashEmail } from './trashEmail.js';
import { register as batchTrashEmails } from './batchTrashEmails.js';
import { register as downloadEmailAttachment } from './downloadEmailAttachment.js';
import { register as forwardEmail } from './forwardEmail.js';
import { register as saveAttachmentToDrive } from './saveAttachmentToDrive.js';
import { register as sendEmail } from './sendEmail.js';
import { register as createDraft } from './createDraft.js';
import { register as sendDraft } from './sendDraft.js';

// Phase 6 — MED Gmail
import { register as applyLabel } from './applyLabel.js';
import { register as removeLabel } from './removeLabel.js';
import { register as markRead } from './markRead.js';
import { register as markUnread } from './markUnread.js';
import { register as archiveEmail } from './archiveEmail.js';
import { register as starEmail } from './starEmail.js';
import { register as unstarEmail } from './unstarEmail.js';
import { register as listLabels } from './listLabels.js';
import { register as createLabel } from './createLabel.js';
import { register as deleteLabel } from './deleteLabel.js';

export function registerGmailTools(server: FastMCP) {
  searchEmails(server);
  readEmail(server);
  trashEmail(server);
  batchTrashEmails(server);
  downloadEmailAttachment(server);
  forwardEmail(server);
  saveAttachmentToDrive(server);
  sendEmail(server);
  createDraft(server);
  sendDraft(server);

  // Phase 6 — MED Gmail
  applyLabel(server);
  removeLabel(server);
  markRead(server);
  markUnread(server);
  archiveEmail(server);
  starEmail(server);
  unstarEmail(server);
  listLabels(server);
  createLabel(server);
  deleteLabel(server);
}
