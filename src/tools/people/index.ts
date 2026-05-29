import type { FastMCP } from 'fastmcp';
import { register as listContacts } from './listContacts.js';
import { register as searchContacts } from './searchContacts.js';
import { register as createContact } from './createContact.js';
import { register as updateContact } from './updateContact.js';

export function registerPeopleTools(server: FastMCP) {
  listContacts(server);
  searchContacts(server);
  createContact(server);
  updateContact(server);
}
