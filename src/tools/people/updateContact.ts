import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getPeopleClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateContact',
    description:
      "Updates a contact. Must pass the contact's etag (from listContacts/searchContacts) to detect concurrent modifications. updatePersonFields lists which fields to overwrite.",
    parameters: z.object({
      resourceName: z.string().describe("Contact's resourceName (e.g. 'people/c123456789')."),
      etag: z.string().describe('Etag returned by listContacts/searchContacts (concurrency token).'),
      updatePersonFields: z
        .string()
        .describe(
          "Comma-separated fields to update (e.g. 'names,emailAddresses,phoneNumbers,organizations,biographies')."
        ),
      givenName: z.string().optional(),
      familyName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      organization: z.string().optional(),
      jobTitle: z.string().optional(),
      notes: z.string().optional(),
    }),
    execute: async (args, { log }) => {
      const people = await getPeopleClient();
      log.info(`Updating contact ${args.resourceName}`);

      const requestBody: any = { etag: args.etag };
      const fields = args.updatePersonFields.split(',').map((s) => s.trim());
      if (fields.includes('names') && (args.givenName || args.familyName)) {
        requestBody.names = [{ givenName: args.givenName, familyName: args.familyName }];
      }
      if (fields.includes('emailAddresses') && args.email) {
        requestBody.emailAddresses = [{ value: args.email }];
      }
      if (fields.includes('phoneNumbers') && args.phone) {
        requestBody.phoneNumbers = [{ value: args.phone }];
      }
      if (fields.includes('organizations') && (args.organization || args.jobTitle)) {
        requestBody.organizations = [{ name: args.organization, title: args.jobTitle }];
      }
      if (fields.includes('biographies') && args.notes) {
        requestBody.biographies = [{ value: args.notes, contentType: 'TEXT_PLAIN' }];
      }

      try {
        const resp = await people.people.updateContact({
          resourceName: args.resourceName,
          updatePersonFields: args.updatePersonFields,
          requestBody,
        });
        return JSON.stringify({ success: true, contact: resp.data }, null, 2);
      } catch (error: any) {
        log.error(`Error updating contact: ${error.message || error}`);
        if (error.code === 409)
          throw new UserError('Etag mismatch — contact was modified by someone else. Re-fetch and retry.');
        if (error.code === 404) throw new UserError(`Contact ${args.resourceName} not found.`);
        throw new UserError(`Failed to update contact: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
