import type { FastMCP } from 'fastmcp';
import { register as searchEmails } from './searchEmails.js';
import { register as readEmail } from './readEmail.js';
import { register as trashEmail } from './trashEmail.js';
import { register as batchTrashEmails } from './batchTrashEmails.js';
import { register as downloadEmailAttachment } from './downloadEmailAttachment.js';
import { register as forwardEmail } from './forwardEmail.js';
import { register as saveAttachmentToDrive } from './saveAttachmentToDrive.js';

export function registerGmailTools(server: FastMCP) {
  searchEmails(server);
  readEmail(server);
  trashEmail(server);
  batchTrashEmails(server);
  downloadEmailAttachment(server);
  forwardEmail(server);
  saveAttachmentToDrive(server);
}
