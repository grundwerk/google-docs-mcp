import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { drive_v3 } from 'googleapis';
import { getDriveClient } from '../../clients.js';

// The My-Drive root of this account is private and shared with no one. A folder created
// there is invisible to every colleague. Incident 2026-10-09: 6 client folders (incl.
// signed BAFA documents) sat in the root because a call without parentFolderId silently
// landed there. So the root is refused outright, with no opt-out: an agent that cannot
// find the right parent must stop and ask, not fall back to the private root.
const ROOT_REFUSED =
  'createFolder refuses to create folders in the My-Drive root: it is private and shared with ' +
  'no one, so colleagues cannot open anything inside it. Pass the ID of the intended parent ' +
  'folder (for a client: the client folder under 02_Active_Clients). If you cannot find the ' +
  'right parent, stop and ask instead of guessing.';

export async function executeCreateFolder(
  drive: drive_v3.Drive,
  args: { name: string; parentFolderId?: string }
): Promise<string> {
  const parent = (args.parentFolderId ?? '').trim();
  if (!parent || parent.toLowerCase() === 'root') {
    throw new UserError(ROOT_REFUSED);
  }

  const root = await drive.files.get({ fileId: 'root', fields: 'id' });
  if (root.data.id && root.data.id === parent) {
    throw new UserError(ROOT_REFUSED);
  }

  try {
    const response = await drive.files.create({
      requestBody: {
        name: args.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id,name,parents,webViewLink',
      supportsAllDrives: true,
    });

    const folder = response.data;
    return JSON.stringify(
      {
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink,
      },
      null,
      2
    );
  } catch (error: any) {
    if (error.code === 404)
      throw new UserError('Parent folder not found. Check the parent folder ID.');
    if (error.code === 403)
      throw new UserError(
        'Permission denied. Make sure you have write access to the parent folder.'
      );
    throw new UserError(`Failed to create folder: ${error.message || 'Unknown error'}`);
  }
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'createFolder',
    description:
      'Creates a new folder in Google Drive inside an existing parent folder. The parent is required; the private My-Drive root is refused.',
    parameters: z.object({
      name: z.string().min(1).describe('Name for the new folder.'),
      parentFolderId: z
        .string()
        .min(1)
        .describe(
          'Parent folder ID (required). "root" and the My-Drive root ID are refused because the root is private.'
        ),
    }),
    execute: async (args, { log }) => {
      log.info(`Creating folder "${args.name}" in parent ${args.parentFolderId}`);
      const drive = await getDriveClient();
      try {
        return await executeCreateFolder(drive, args);
      } catch (error: any) {
        log.error(`Error creating folder: ${error.message || error}`);
        throw error;
      }
    },
  });
}
