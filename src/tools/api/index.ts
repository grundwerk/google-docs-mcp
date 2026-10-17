import type { FastMCP } from 'fastmcp';
import { register as batchUpdate } from './batchUpdate.js';
import { register as getPresentationJson } from './getPresentationJson.js';
import { register as updateFileContent } from './updateFileContent.js';

export function registerApiTools(server: FastMCP) {
  batchUpdate(server);
  getPresentationJson(server);
  updateFileContent(server);
}
