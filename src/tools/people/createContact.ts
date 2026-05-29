import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getPeopleClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createContact',
    description: 'Creates a new contact in Google Contacts.',
    parameters: z.object({
      givenName: z.string().optional().describe('First name.'),
      familyName: z.string().optional().describe('Last name.'),
      email: z.string().optional().describe('Primary email.'),
      phone: z.string().optional().describe('Primary phone.'),
      organization: z.string().optional().describe('Company name.'),
      jobTitle: z.string().optional().describe('Job title.'),
      notes: z.string().optional().describe('Notes / biography.'),
    }),
    execute: async (args, { log }) => {
      const people = await getPeopleClient();
      log.info(`Creating contact ${args.givenName || ''} ${args.familyName || ''}`);

      const requestBody: any = {};
      if (args.givenName || args.familyName) {
        requestBody.names = [{ givenName: args.givenName, familyName: args.familyName }];
      }
      if (args.email) requestBody.emailAddresses = [{ value: args.email }];
      if (args.phone) requestBody.phoneNumbers = [{ value: args.phone }];
      if (args.organization || args.jobTitle) {
        requestBody.organizations = [{ name: args.organization, title: args.jobTitle }];
      }
      if (args.notes) requestBody.biographies = [{ value: args.notes, contentType: 'TEXT_PLAIN' }];

      try {
        const resp = await people.people.createContact({ requestBody });
        return JSON.stringify({ success: true, resourceName: resp.data.resourceName, contact: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error creating contact: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError("Permission denied. The 'contacts' scope is required.");
        throw new UserError(`Failed to create contact: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
