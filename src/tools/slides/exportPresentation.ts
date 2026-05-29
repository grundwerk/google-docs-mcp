import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDriveClient } from '../../clients.js';

const PRESETS: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
};

export function register(server: FastMCP) {
  server.addTool({
    name: 'exportPresentation',
    description:
      'Exports a presentation to PPTX/PDF/ODP/TXT via Drive export. Set saveToPath to save to disk, otherwise base64-encoded payload is returned.',
    parameters: z.object({
      presentationId: z.string().describe('The presentation ID.'),
      mimeType: z
        .string()
        .describe("Format: 'pptx', 'pdf', 'odp', 'txt' (preset) or full MIME string."),
      saveToPath: z.string().optional().describe('Optional absolute file path to save to.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      const mime = PRESETS[args.mimeType.toLowerCase()] || args.mimeType;
      log.info(`Exporting presentation ${args.presentationId} as ${mime}`);
      try {
        const resp = await drive.files.export(
          { fileId: args.presentationId, mimeType: mime },
          { responseType: 'arraybuffer' }
        );
        const buf = Buffer.from(resp.data as ArrayBuffer);
        if (args.saveToPath) {
          const abs = path.resolve(args.saveToPath);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, buf);
          return JSON.stringify(
            { success: true, savedTo: abs, mimeType: mime, byteCount: buf.length },
            null,
            2
          );
        }
        return JSON.stringify(
          { success: true, mimeType: mime, byteCount: buf.length, base64: buf.toString('base64') },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error exporting presentation: ${error.message || error}`);
        throw new UserError(`Failed to export presentation: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
