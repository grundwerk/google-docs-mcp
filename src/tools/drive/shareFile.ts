import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'shareFile',
    description:
      "Shares a Google Drive file (Sheet, Doc, Folder etc.) with a user, group, domain, or anyone via Drive API permissions.create. Defaults to role='writer' (editor) and sendNotificationEmail=false (no spam to recipient). Returns the created permission ID.",
    parameters: z.object({
      fileId: z
        .string()
        .describe(
          'The Drive file/folder ID — the long string between /d/ and /edit in a Sheets/Docs URL, or the folder ID from a Drive URL.'
        ),
      emailAddress: z
        .string()
        .optional()
        .describe(
          "Recipient email (required when type='user' or type='group'). E.g. 'melina.uhlmann@trifinance.de'."
        ),
      domain: z
        .string()
        .optional()
        .describe(
          "Domain (required when type='domain'). E.g. 'grundwerk.digital' to share with everyone in that org."
        ),
      role: z
        .enum(['reader', 'commenter', 'writer', 'fileOrganizer', 'organizer', 'owner'])
        .default('writer')
        .describe(
          "Permission role. 'writer' = Editor (default). 'reader' = Viewer. 'commenter' = Comment-only. 'fileOrganizer'/'organizer' = Manage Drive content. 'owner' = transfer ownership (use with care)."
        ),
      type: z
        .enum(['user', 'group', 'domain', 'anyone'])
        .default('user')
        .describe(
          "Permission scope. 'user' (default) = single email. 'group' = Google Group email. 'domain' = whole Workspace org. 'anyone' = public link (use sparingly)."
        ),
      sendNotificationEmail: z
        .boolean()
        .default(false)
        .describe(
          'If true, Google sends an email notification to the recipient. Default false (silent share — recipient just sees the file appear).'
        ),
      emailMessage: z
        .string()
        .optional()
        .describe('Optional personal message included in the notification email (only used if sendNotificationEmail=true).'),
      transferOwnership: z
        .boolean()
        .default(false)
        .describe(
          "If role='owner', set this to true. Drive requires explicit confirmation for ownership transfer."
        ),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(
        `Sharing file ${args.fileId} with ${args.emailAddress || args.domain || 'anyone'} as ${args.role} (type=${args.type})`
      );

      if ((args.type === 'user' || args.type === 'group') && !args.emailAddress) {
        throw new UserError(
          `emailAddress is required when type='${args.type}'. Pass the recipient's Google account email.`
        );
      }
      if (args.type === 'domain' && !args.domain) {
        throw new UserError("domain is required when type='domain'. Pass the Workspace domain, e.g. 'grundwerk.digital'.");
      }
      if (args.role === 'owner' && !args.transferOwnership) {
        throw new UserError(
          "Granting role='owner' requires transferOwnership=true. This permanently transfers ownership."
        );
      }

      const requestBody: {
        role: string;
        type: string;
        emailAddress?: string;
        domain?: string;
      } = {
        role: args.role,
        type: args.type,
      };
      if (args.emailAddress) requestBody.emailAddress = args.emailAddress;
      if (args.domain) requestBody.domain = args.domain;

      try {
        const response = await drive.permissions.create({
          fileId: args.fileId,
          requestBody,
          sendNotificationEmail: args.sendNotificationEmail,
          emailMessage: args.emailMessage,
          transferOwnership: args.role === 'owner' ? true : undefined,
          supportsAllDrives: true,
          fields: 'id,type,role,emailAddress,domain,displayName',
        });

        const p = response.data;
        return JSON.stringify(
          {
            success: true,
            permissionId: p.id,
            type: p.type,
            role: p.role,
            emailAddress: p.emailAddress,
            domain: p.domain,
            displayName: p.displayName,
            fileId: args.fileId,
            notificationSent: args.sendNotificationEmail === true,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error sharing file: ${error.message || error}`);
        if (error.code === 404)
          throw new UserError(
            `File ${args.fileId} not found. Check the fileId (long string between /d/ and /edit in the URL).`
          );
        if (error.code === 403)
          throw new UserError(
            'Permission denied. The authenticated account needs editor/owner access on the file to grant new permissions.'
          );
        if (error.code === 400 && error.message?.includes('email'))
          throw new UserError(
            `Invalid email address: '${args.emailAddress}'. Make sure it's a valid Google account email.`
          );
        throw new UserError(`Failed to share file: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
