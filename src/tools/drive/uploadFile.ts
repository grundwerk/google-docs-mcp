import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { drive_v3 } from 'googleapis';
import { createReadStream, statSync } from 'fs';
import { basename, resolve, isAbsolute } from 'path';
import { getDriveClient } from '../../clients.js';

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  for (const ext of Object.keys(MIME_BY_EXT)) {
    if (lower.endsWith(ext)) return MIME_BY_EXT[ext]!;
  }
  return 'application/octet-stream';
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'uploadFile',
    description:
      'Uploads a local binary file (PDF, MP4, HTML, etc.) directly to Google Drive as a standalone file (not embedded in a Doc). Supports any file type. Returns the new file ID and webViewLink.',
    parameters: z.object({
      localPath: z
        .string()
        .describe(
          'Absolute path to the local file to upload (e.g. /Users/foo/Downloads/slideshow.pdf).'
        ),
      parentFolderId: z
        .string()
        .optional()
        .describe(
          'ID of the Drive folder where the file should be uploaded. If omitted, file goes to Drive root.'
        ),
      newName: z
        .string()
        .optional()
        .describe(
          'Optional name override. If omitted, uses the local filename (e.g. "slideshow.pdf").'
        ),
      mimeType: z
        .string()
        .optional()
        .describe(
          'Optional MIME type override. If omitted, auto-detected from file extension (.pdf -> application/pdf, .mp4 -> video/mp4, etc.).'
        ),
      convertToGoogleDoc: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'If true, converts the uploaded file to a native Google Docs/Sheets/Slides format (only works for .docx, .pdf, .csv, etc.). Default false (keeps original format).'
        ),
    }),
    execute: async (args, { log }) => {
      const absPath = isAbsolute(args.localPath) ? args.localPath : resolve(args.localPath);

      // Verify file exists + is readable
      let fileStats;
      try {
        fileStats = statSync(absPath);
      } catch (err: any) {
        throw new UserError(`Local file not found or not readable: ${absPath}`);
      }
      if (!fileStats.isFile()) {
        throw new UserError(`Path is not a regular file: ${absPath}`);
      }

      const fileName = args.newName || basename(absPath);
      const mimeType = args.mimeType || mimeFromPath(absPath);

      log.info(
        `Uploading ${absPath} (${(fileStats.size / 1024).toFixed(1)} KB, ${mimeType}) ${args.parentFolderId ? `to folder ${args.parentFolderId}` : 'to Drive root'}`
      );

      const drive = await getDriveClient();

      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
      };

      if (args.parentFolderId) {
        fileMetadata.parents = [args.parentFolderId];
      }

      // If convertToGoogleDoc, set destination MIME type
      if (args.convertToGoogleDoc) {
        const sourceMime = mimeType;
        if (sourceMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            sourceMime === 'application/pdf' ||
            sourceMime === 'text/plain' ||
            sourceMime === 'text/markdown') {
          fileMetadata.mimeType = 'application/vnd.google-apps.document';
        } else if (sourceMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   sourceMime === 'text/csv') {
          fileMetadata.mimeType = 'application/vnd.google-apps.spreadsheet';
        } else if (sourceMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
          fileMetadata.mimeType = 'application/vnd.google-apps.presentation';
        }
        // For other types, conversion is skipped (file uploaded as-is)
      }

      try {
        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: mimeType,
            body: createReadStream(absPath),
          },
          fields: 'id,name,webViewLink,mimeType,size',
          supportsAllDrives: true,
        });

        const uploaded = response.data;
        return JSON.stringify(
          {
            id: uploaded.id,
            name: uploaded.name,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.size,
            url: uploaded.webViewLink,
            parentFolderId: args.parentFolderId,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error uploading file: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(
            'Destination folder not found. Check parentFolderId.'
          );
        if (error.code === 403)
          throw new UserError(
            'Permission denied. Check that the OAuth account has write access to the destination folder.'
          );
        if (error.code === 401)
          throw new UserError('Authentication failed. Re-run the OAuth flow.');
        throw new UserError(`Failed to upload file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
