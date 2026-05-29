// src/tools/index.ts
import type { FastMCP } from 'fastmcp';
import { registerDocsTools } from './docs/index.js';
import { registerDriveTools } from './drive/index.js';
import { registerSheetsTools } from './sheets/index.js';
import { registerUtilsTools } from './utils/index.js';
import { registerCalendarTools } from './calendar/index.js';
import { registerGmailTools } from './gmail/index.js';
import { registerSlidesTools } from './slides/index.js';
import { registerFormsTools } from './forms/index.js';
import { registerTasksTools } from './tasks/index.js';
import { registerScriptTools } from './script/index.js';
import { registerPeopleTools } from './people/index.js';

/**
 * Registers all tools with the FastMCP server.
 */
export function registerAllTools(server: FastMCP) {
  registerDocsTools(server);
  registerDriveTools(server);
  registerSheetsTools(server);
  registerUtilsTools(server);
  registerCalendarTools(server);
  registerGmailTools(server);
  registerSlidesTools(server);
  registerFormsTools(server);
  registerTasksTools(server);
  registerScriptTools(server);
  registerPeopleTools(server);
}
