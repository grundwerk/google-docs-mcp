import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { createReadStream } from 'fs';
import { isAbsolute } from 'path';
import type { drive_v3 } from 'googleapis';
import { getDriveClient } from '../../clients.js';
import { toGoogleUserError } from './errors.js';

// uploadFile always creates a NEW file with a new ID and link. Incident 2026-10-17: every
// correction of a deck produced a new presentation link, while the user had handed over one
// specific presentation to fill. This replaces the content of an existing file in place.

const MIME_BY_EXT: Record<string, string> = {
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  const ext = Object.keys(MIME_BY_EXT).find((e) => lower.endsWith(e));
  return ext ? MIME_BY_EXT[ext]! : 'application/octet-stream';
}

export async function executeUpdateFileContent(
  drive: drive_v3.Drive,
  args: { fileId: string; localPath: string; mimeType?: string }
): Promise<string> {
  if (!isAbsolute(args.localPath)) {
    throw new UserError('localPath must be an absolute path.');
  }
  try {
    const res = await drive.files.update({
      fileId: args.fileId,
      media: {
        mimeType: args.mimeType || mimeFromPath(args.localPath),
        body: createReadStream(args.localPath),
      },
      fields: 'id,name,mimeType,modifiedTime,webViewLink',
      supportsAllDrives: true,
    });
    return JSON.stringify(res.data, null, 2);
  } catch (error: any) {
    throw toGoogleUserError('Drive files.update (content) failed', error);
  }
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateFileContent',
    description:
      'Replaces the CONTENT of an existing Drive file with a local file. File ID, link, sharing and name stay the same. ' +
      'For a native Google file (Slides/Docs/Sheets) the upload is converted, e.g. a .pptx into an existing Google presentation. ' +
      'Overwrites everything in that file, older states stay in the version history.',
    parameters: z.object({
      fileId: z.string().describe('ID of the existing Drive file to overwrite.'),
      localPath: z.string().describe('Absolute path of the local file with the new content.'),
      mimeType: z
        .string()
        .optional()
        .describe('MIME type of the local file. Auto-detected from the extension if omitted.'),
    }),
    execute: async (args) => executeUpdateFileContent(await getDriveClient(), args),
  });
}
