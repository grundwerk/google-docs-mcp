import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getPeopleClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'searchContacts',
    description:
      'Searches contacts by name/email/phone. Returns up to 30 matches. For lower latency, run a quick search first to warm the index.',
    parameters: z.object({
      query: z.string().describe('Search query (matches name/email/phone substrings).'),
      pageSize: z.number().int().min(1).max(30).optional().default(10),
      readMask: z
        .string()
        .optional()
        .default('names,emailAddresses,phoneNumbers,organizations')
        .describe('Comma-separated fields to return.'),
    }),
    execute: async (args, { log }) => {
      const people = await getPeopleClient();
      log.info(`Searching contacts for '${args.query}'`);
      try {
        // Warm up the index (returns nothing, but is required for first-time searches per docs)
        await people.people.searchContacts({ query: args.query, pageSize: 1, readMask: 'names' });
        const resp = await people.people.searchContacts({
          query: args.query,
          pageSize: args.pageSize,
          readMask: args.readMask,
        });
        return JSON.stringify(
          {
            success: true,
            count: resp.data.results?.length || 0,
            results: (resp.data.results || []).map((r) => r.person),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error searching contacts: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError("Permission denied. The 'contacts' scope is required.");
        throw new UserError(`Failed to search contacts: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
