import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDriveClient } from '../../clients.js';

const MIME_PRESETS: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  rtf: 'application/rtf',
  html: 'text/html',
  epub: 'application/epub+zip',
  zip: 'application/zip',
};

export function register(server: FastMCP) {
  server.addTool({
    name: 'exportFile',
    description:
      "Exports a Google-native file (Doc/Sheet/Slides) to a downloadable format like PDF/XLSX/DOCX/CSV. Set saveToPath to write to disk, otherwise returns base64 payload. mimeType supports presets ('pdf', 'csv', 'xlsx', 'docx', etc.) or a full MIME string.",
    parameters: z.object({
      fileId: z.string().describe('The Google-native file ID (Doc/Sheet/Slides).'),
      mimeType: z
        .string()
        .describe(
          "Target format. Either a preset ('pdf'/'csv'/'xlsx'/'docx'/'pptx'/'txt'/'html'/'odt'/'ods'/'odp'/'rtf'/'epub'/'zip') or a full MIME string."
        ),
      saveToPath: z
        .string()
        .optional()
        .describe(
          'Optional absolute path to save the exported file. If omitted, payload is returned as base64 in the response.'
        ),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      const resolvedMime = MIME_PRESETS[args.mimeType.toLowerCase()] || args.mimeType;
      log.info(`Exporting file ${args.fileId} as ${resolvedMime}`);

      try {
        const resp = await drive.files.export(
          { fileId: args.fileId, mimeType: resolvedMime },
          { responseType: 'arraybuffer' }
        );
        const buf = Buffer.from(resp.data as ArrayBuffer);

        if (args.saveToPath) {
          const abs = path.resolve(args.saveToPath);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, buf);
          return JSON.stringify(
            {
              success: true,
              fileId: args.fileId,
              mimeType: resolvedMime,
              savedTo: abs,
              byteCount: buf.length,
            },
            null,
            2
          );
        }

        return JSON.stringify(
          {
            success: true,
            fileId: args.fileId,
            mimeType: resolvedMime,
            byteCount: buf.length,
            base64: buf.toString('base64'),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error exporting file: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError(
            'Permission denied. Need at least reader access on the file. (Or the file is a binary upload, not a Google-native format — use readDriveFile instead.)'
          );
        throw new UserError(`Failed to export file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
