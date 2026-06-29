import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { getDriveClient } from '../../clients.js';
import * as pdfParse from 'pdf-parse';

// Text-ish mime types whose bytes are safe to return as UTF-8 text.
// Everything else (images, video, audio, zip, office binaries, ...) is binary
// and MUST NOT be utf-8-stringified — that corrupts the bytes. Binary files
// are written to disk via saveToPath instead.
function isTextMime(mime: string): boolean {
  if (!mime) return false;
  if (mime.startsWith('text/')) return true;
  return /(json|xml|javascript|ecmascript|csv|x-yaml|yaml|x-ndjson|x-sh|x-www-form-urlencoded|markdown)/i.test(
    mime
  );
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'readDriveFile',
    description:
      'Reads a file from Google Drive. Text files and PDFs return their text content. ' +
      'For BINARY files (images, video, audio, zip, office docs), pass saveToPath to download ' +
      'the file to a local absolute path (binary-safe) — it returns metadata (path + byteCount), ' +
      'not the bytes. Returning binary content inline is intentionally refused because it corrupts ' +
      'the data. saveToPath also works for text/PDF files (writes the raw original). For native ' +
      'Google Docs use readDocument; to export a Google Doc/Sheet/Slides use exportFile.',
    parameters: z.object({
      fileId: z.string().describe('ID of the Google Drive file to read.'),
      saveToPath: z
        .string()
        .optional()
        .describe(
          'Absolute local path to write the raw file bytes to (binary-safe). Required for binary ' +
            'files like images. If set, the bytes are written to disk and only metadata is returned.'
        ),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Reading Drive file: ${args.fileId}`);

      // Get file metadata first
      let meta: any;
      try {
        const metaRes = await drive.files.get({
          fileId: args.fileId,
          fields: 'id,name,mimeType',
          supportsAllDrives: true,
        });
        meta = metaRes.data;
      } catch (error: any) {
        if (error.code === 404) throw new UserError('File not found. Check the file ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you have access to this file.');
        throw new UserError(`Failed to get file metadata: ${error.message || 'Unknown error'}`);
      }

      log.info(`File: ${meta.name} (${meta.mimeType})`);

      try {
        // Download the raw file content (arraybuffer = exact bytes, no corruption)
        const response = await drive.files.get(
          { fileId: args.fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'arraybuffer' }
        );
        const buffer = Buffer.from(response.data as ArrayBuffer);

        // saveToPath: write the raw original bytes to disk (works for ANY file type).
        if (args.saveToPath) {
          await writeFile(args.saveToPath, buffer);
          return JSON.stringify({
            name: meta.name,
            mimeType: meta.mimeType,
            savedTo: args.saveToPath,
            byteCount: buffer.length,
          });
        }

        if (meta.mimeType === 'application/pdf') {
          const pdf = (pdfParse as any).default ?? pdfParse;
          const parsed = await pdf(buffer);
          return JSON.stringify({
            name: meta.name,
            mimeType: meta.mimeType,
            pages: parsed.numpages,
            text: parsed.text,
          });
        }

        if (isTextMime(meta.mimeType)) {
          return JSON.stringify({
            name: meta.name,
            mimeType: meta.mimeType,
            text: buffer.toString('utf-8'),
          });
        }

        // Binary file without saveToPath: refuse to stringify (would corrupt) and guide.
        throw new UserError(
          `'${meta.name}' is a binary file (${meta.mimeType}). Pass saveToPath (an absolute local ` +
            `path) to download it to disk. Reading binary content inline is not supported because it ` +
            `corrupts the bytes.`
        );
      } catch (error: any) {
        if (error instanceof UserError) throw error;
        log.error(`Error reading file: ${error.message || error}`);
        throw new UserError(`Failed to read file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
