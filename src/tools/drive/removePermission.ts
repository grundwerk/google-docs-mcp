import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'removePermission',
    description:
      "Removes a permission (revokes someone's access) from a Drive file/folder. Lifecycle counterpart to shareFile. Use listFilePermissions first to get the permissionId.",
    parameters: z.object({
      fileId: z.string().describe('The Drive file/folder ID.'),
      permissionId: z
        .string()
        .describe('The permission ID (from listFilePermissions or shareFile response).'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Removing permission ${args.permissionId} from file ${args.fileId}`);

      try {
        await drive.permissions.delete({
          fileId: args.fileId,
          permissionId: args.permissionId,
          supportsAllDrives: true,
        });

        return JSON.stringify(
          {
            success: true,
            fileId: args.fileId,
            removedPermissionId: args.permissionId,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error removing permission: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(
            `Permission ${args.permissionId} not found on file ${args.fileId}. Use listFilePermissions to get valid IDs.`
          );
        if (error.code === 403)
          throw new UserError(
            "Permission denied. Need owner or fileOrganizer access to remove permissions. Cannot remove the file owner's permission."
          );
        throw new UserError(`Failed to remove permission: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
