import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

const GOOGLE_TYPES: Record<string, string> = {
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation',
};

export function register(server: FastMCP) {
  server.addTool({
    name: 'convertFile',
    description:
      "Converts an uploaded Office file (.xlsx/.docx/.pptx) or PDF to the corresponding native Google format (Sheets/Docs/Slides) via drive.files.copy. Returns the NEW file ID — the original stays untouched.",
    parameters: z.object({
      fileId: z.string().describe('The source file ID to convert.'),
      targetType: z
        .enum(['doc', 'sheet', 'slides'])
        .describe("Target Google type: 'doc' (Docs), 'sheet' (Sheets), 'slides' (Slides)."),
      newName: z
        .string()
        .optional()
        .describe('Optional new name for the copy. Defaults to source filename.'),
      parentFolderId: z
        .string()
        .optional()
        .describe('Optional Drive folder ID to place the converted file in.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Converting ${args.fileId} → ${args.targetType}`);

      try {
        const resp = await drive.files.copy({
          fileId: args.fileId,
          requestBody: {
            mimeType: GOOGLE_TYPES[args.targetType],
            name: args.newName,
            parents: args.parentFolderId ? [args.parentFolderId] : undefined,
          },
          supportsAllDrives: true,
          fields: 'id,name,mimeType,parents,webViewLink',
        });

        return JSON.stringify({ success: true, file: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error converting file: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need at least reader access on the source file.');
        if (error.code === 400)
          throw new UserError(
            `Conversion not supported: source MIME may not be convertible to ${args.targetType}.`
          );
        throw new UserError(`Failed to convert file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
