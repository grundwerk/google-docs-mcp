import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updatePermission',
    description:
      "Updates an existing Drive permission's role (e.g. reader → writer, writer → fileOrganizer) without recreating it. Cheaper than removePermission + shareFile. Use listFilePermissions to get permissionId.",
    parameters: z.object({
      fileId: z.string().describe('The Drive file/folder ID.'),
      permissionId: z.string().describe('Permission ID (from listFilePermissions).'),
      role: z
        .enum(['reader', 'commenter', 'writer', 'fileOrganizer', 'organizer', 'owner'])
        .describe('New role.'),
      transferOwnership: z
        .boolean()
        .optional()
        .default(false)
        .describe("Set true if role='owner'."),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Updating permission ${args.permissionId} on ${args.fileId} to ${args.role}`);

      if (args.role === 'owner' && !args.transferOwnership) {
        throw new UserError("Granting role='owner' requires transferOwnership=true.");
      }

      try {
        const resp = await drive.permissions.update({
          fileId: args.fileId,
          permissionId: args.permissionId,
          requestBody: { role: args.role },
          transferOwnership: args.role === 'owner' ? true : undefined,
          supportsAllDrives: true,
          fields: 'id,type,role,emailAddress,domain,displayName',
        });

        return JSON.stringify({ success: true, fileId: args.fileId, permission: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error updating permission: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(
            `Permission ${args.permissionId} not found on file ${args.fileId}.`
          );
        if (error.code === 403)
          throw new UserError('Permission denied. Need editor/owner access on the file.');
        throw new UserError(`Failed to update permission: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
