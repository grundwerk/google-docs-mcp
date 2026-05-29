import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { gmail_v1, drive_v3 } from 'googleapis';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import { getGmailClient, getDriveClient } from '../../clients.js';
import { executeDownloadEmailAttachment } from './downloadEmailAttachment.js';

const ABMAHNUNGEN_FOLDER_ID = '1sW-Dfy7lFyplRnGbwZ5ZM81Sk6dkHwB9';

export const saveAttachmentToDriveParams = z.object({
  messageId: z.string().describe('The Gmail message ID containing the attachment.'),
  attachmentId: z.string().describe('The Gmail attachment ID.'),
  driveFolderId: z
    .string()
    .optional()
    .default(ABMAHNUNGEN_FOLDER_ID)
    .describe(
      `Google Drive folder ID where the attachment will be saved. Defaults to the Abmahnungen folder (${ABMAHNUNGEN_FOLDER_ID}).`
    ),
  fileName: z
    .string()
    .optional()
    .describe('Optional override for the file name in Drive. Defaults to the attachment original filename.'),
});

export type SaveAttachmentToDriveArgs = z.infer<typeof saveAttachmentToDriveParams>;

export interface SaveAttachmentToDriveResult {
  success: true;
  driveFileId: string;
  webViewLink: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function executeSaveAttachmentToDrive(
  args: SaveAttachmentToDriveArgs,
  gmail: gmail_v1.Gmail,
  drive: drive_v3.Drive
): Promise<SaveAttachmentToDriveResult> {
  const downloadResult = await executeDownloadEmailAttachment(
    {
      messageId: args.messageId,
      attachmentId: args.attachmentId,
      savePath: '/tmp/mcp-drive-upload/',
    },
    gmail
  );

  const finalFileName = args.fileName || downloadResult.fileName;

  try {
    const uploadResp = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [args.driveFolderId],
      },
      media: {
        mimeType: downloadResult.mimeType,
        body: createReadStream(downloadResult.filePath),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    await fs.unlink(downloadResult.filePath).catch(() => {});

    if (!uploadResp.data.id || !uploadResp.data.webViewLink) {
      throw new UserError(
        `Drive upload returned without id/webViewLink (folder=${args.driveFolderId}, file=${finalFileName}).`
      );
    }

    return {
      success: true,
      driveFileId: uploadResp.data.id,
      webViewLink: uploadResp.data.webViewLink,
      fileName: finalFileName,
      mimeType: downloadResult.mimeType,
      sizeBytes: downloadResult.sizeBytes,
    };
  } catch (error) {
    await fs.unlink(downloadResult.filePath).catch(() => {});
    throw error;
  }
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'saveAttachmentToDrive',
    description:
      `Downloads a Gmail email attachment AND uploads it to a Google Drive folder in one step. Default destination is the Abmahnungen folder (${ABMAHNUNGEN_FOLDER_ID}) for legal-correspondence handling. Returns driveFileId + webViewLink so you can immediately link to the saved file. Requires Drive scope (already granted) and gmail.readonly scope.`,
    parameters: saveAttachmentToDriveParams,
    execute: async (args, { log }) => {
      log.info(
        `Saving attachment ${args.attachmentId} from message ${args.messageId} to Drive folder ${args.driveFolderId}`
      );
      try {
        const gmail = await getGmailClient();
        const drive = await getDriveClient();
        const result = await executeSaveAttachmentToDrive(args, gmail, drive);
        log.info(`Uploaded to Drive: ${result.driveFileId} (${result.webViewLink})`);
        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        if (error instanceof UserError) throw error;
        log.error(`Error saving attachment to Drive: ${error.message || error}`);
        if (error.code === 404) {
          throw new UserError(
            `Email, attachment, or Drive folder not found: msg=${args.messageId} att=${args.attachmentId} folder=${args.driveFolderId}`
          );
        }
        if (error.code === 403) {
          throw new UserError(
            'Permission denied. The Drive folder may be private to another account, or gmail.readonly/drive scopes are missing.'
          );
        }
        throw new UserError(`Failed to save attachment to Drive: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
