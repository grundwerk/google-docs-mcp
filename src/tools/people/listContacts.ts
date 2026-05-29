import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getPeopleClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listContacts',
    description:
      'Lists contacts from the authenticated user\'s "Other contacts" and "My contacts" groups. Returns paginated results.',
    parameters: z.object({
      pageSize: z.number().int().min(1).max(1000).optional().default(100),
      pageToken: z.string().optional(),
      personFields: z
        .string()
        .optional()
        .default('names,emailAddresses,phoneNumbers,organizations,metadata')
        .describe('Comma-separated fields to return.'),
    }),
    execute: async (args, { log }) => {
      const people = await getPeopleClient();
      log.info('Listing contacts');
      try {
        const resp = await people.people.connections.list({
          resourceName: 'people/me',
          pageSize: args.pageSize,
          pageToken: args.pageToken,
          personFields: args.personFields,
        });
        return JSON.stringify(
          {
            success: true,
            count: resp.data.connections?.length || 0,
            totalPeople: resp.data.totalPeople,
            nextPageToken: resp.data.nextPageToken,
            contacts: resp.data.connections || [],
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing contacts: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError(
            "Permission denied. The 'contacts' scope must be granted. Run `node dist/index.js auth` to re-authorize."
          );
        throw new UserError(`Failed to list contacts: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
