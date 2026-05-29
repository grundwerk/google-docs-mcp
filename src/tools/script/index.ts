import type { FastMCP } from 'fastmcp';
import { register as executeAppsScript } from './executeAppsScript.js';
import { register as listScriptProjects } from './listScriptProjects.js';
import { register as getScriptProject } from './getScriptProject.js';

export function registerScriptTools(server: FastMCP) {
  executeAppsScript(server);
  listScriptProjects(server);
  getScriptProject(server);
}
