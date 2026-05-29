import type { FastMCP } from 'fastmcp';
import { register as createForm } from './createForm.js';
import { register as getForm } from './getForm.js';
import { register as listFormResponses } from './listFormResponses.js';
import { register as addFormQuestion } from './addFormQuestion.js';

export function registerFormsTools(server: FastMCP) {
  createForm(server);
  getForm(server);
  listFormResponses(server);
  addFormQuestion(server);
}
