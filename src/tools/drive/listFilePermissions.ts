import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listFilePermissions',
    description:
      "Lists all permissions on a Drive file/folder (who has read/comment/write/owner access). Use this for offboarding (find permission IDs to remove via removePermission) or audits (who has access to this Sheet?).",
    parameters: z.object({
      fileId: z.string().describe('The Drive file/folder ID.'),
      fields: z
        .string()
        .optional()
        .default('permissions(id,type,role,emailAddress,domain,displayName,deleted,pendingOwner)')
        .describe('Fields selector. Default returns id+type+role+emailAddress+domain+displayName+deleted.'),
      pageSize: z
        .number()
        .int()
        .optional()
        .default(100)
        .describe('Permissions per page (max 100).'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Listing permissions for file ${args.fileId}`);

      try {
        const allPermissions: any[] = [];
        let pageToken: string | undefined;
        do {
          const resp = await drive.permissions.list({
            fileId: args.fileId,
            fields: `nextPageToken,${args.fields}`,
            pageSize: args.pageSize,
            pageToken,
            supportsAllDrives: true,
          });
          if (resp.data.permissions) {
            allPermissions.push(...resp.data.permissions);
          }
          pageToken = resp.data.nextPageToken || undefined;
        } while (pageToken);

        return JSON.stringify(
          {
            success: true,
            fileId: args.fileId,
            permissionCount: allPermissions.length,
            permissions: allPermissions,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing permissions: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`File ${args.fileId} not found.`);
        if (error.code === 403)
          throw new UserError('Permission denied. Need at least reader access on the file.');
        throw new UserError(`Failed to list permissions: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
