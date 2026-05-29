import type { FastMCP } from 'fastmcp';
import { register as searchEmails } from './searchEmails.js';
import { register as readEmail } from './readEmail.js';
import { register as trashEmail } from './trashEmail.js';
import { register as batchTrashEmails } from './batchTrashEmails.js';

export function registerGmailTools(server: FastMCP) {
  searchEmails(server);
  readEmail(server);
  trashEmail(server);
  batchTrashEmails(server);
}
