import type { FastMCP } from 'fastmcp';
import { register as createPresentation } from './createPresentation.js';
import { register as listPresentations } from './listPresentations.js';
import { register as getPresentation } from './getPresentation.js';
import { register as addSlide } from './addSlide.js';
import { register as duplicateSlide } from './duplicateSlide.js';
import { register as replacePlaceholderText } from './replacePlaceholderText.js';
import { register as replaceImage } from './replaceImage.js';
import { register as exportPresentation } from './exportPresentation.js';

export function registerSlidesTools(server: FastMCP) {
  createPresentation(server);
  listPresentations(server);
  getPresentation(server);
  addSlide(server);
  duplicateSlide(server);
  replacePlaceholderText(server);
  replaceImage(server);
  exportPresentation(server);
}
