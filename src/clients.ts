// src/clients.ts
import {
  google,
  docs_v1,
  drive_v3,
  sheets_v4,
  script_v1,
  calendar_v3,
  gmail_v1,
  slides_v1,
  forms_v1,
  tasks_v1,
  people_v1,
} from 'googleapis';
import { UserError } from 'fastmcp';
import { OAuth2Client } from 'google-auth-library';
import { authorize } from './auth.js';
import { logger } from './logger.js';

let authClient: OAuth2Client | null = null;
let googleDocs: docs_v1.Docs | null = null;
let googleDrive: drive_v3.Drive | null = null;
let googleSheets: sheets_v4.Sheets | null = null;
let googleScript: script_v1.Script | null = null;
let googleCalendar: calendar_v3.Calendar | null = null;
let googleGmail: gmail_v1.Gmail | null = null;
let googleSlides: slides_v1.Slides | null = null;
let googleForms: forms_v1.Forms | null = null;
let googleTasks: tasks_v1.Tasks | null = null;
let googlePeople: people_v1.People | null = null;

// --- Initialization ---
export async function initializeGoogleClient() {
  if (googleDocs && googleDrive && googleSheets && googleCalendar && googleGmail)
    return {
      authClient,
      googleDocs,
      googleDrive,
      googleSheets,
      googleScript,
      googleCalendar,
      googleGmail,
      googleSlides,
      googleForms,
      googleTasks,
      googlePeople,
    };
  if (!authClient) {
    try {
      logger.info('Attempting to authorize Google API client...');
      const client = await authorize();
      authClient = client;
      googleDocs = google.docs({ version: 'v1', auth: authClient });
      googleDrive = google.drive({ version: 'v3', auth: authClient });
      googleSheets = google.sheets({ version: 'v4', auth: authClient });
      googleScript = google.script({ version: 'v1', auth: authClient });
      googleCalendar = google.calendar({ version: 'v3', auth: authClient });
      googleGmail = google.gmail({ version: 'v1', auth: authClient });
      googleSlides = google.slides({ version: 'v1', auth: authClient });
      googleForms = google.forms({ version: 'v1', auth: authClient });
      googleTasks = google.tasks({ version: 'v1', auth: authClient });
      googlePeople = google.people({ version: 'v1', auth: authClient });
      logger.info('Google API client authorized successfully.');
    } catch (error) {
      logger.error('FATAL: Failed to initialize Google API client:', error);
      authClient = null;
      googleDocs = null;
      googleDrive = null;
      googleSheets = null;
      googleScript = null;
      googleCalendar = null;
      googleGmail = null;
      googleSlides = null;
      googleForms = null;
      googleTasks = null;
      googlePeople = null;
      throw new Error('Google client initialization failed. Cannot start server tools.');
    }
  }
  if (authClient && !googleDocs) googleDocs = google.docs({ version: 'v1', auth: authClient });
  if (authClient && !googleDrive) googleDrive = google.drive({ version: 'v3', auth: authClient });
  if (authClient && !googleSheets) googleSheets = google.sheets({ version: 'v4', auth: authClient });
  if (authClient && !googleScript) googleScript = google.script({ version: 'v1', auth: authClient });
  if (authClient && !googleCalendar) googleCalendar = google.calendar({ version: 'v3', auth: authClient });
  if (authClient && !googleGmail) googleGmail = google.gmail({ version: 'v1', auth: authClient });
  if (authClient && !googleSlides) googleSlides = google.slides({ version: 'v1', auth: authClient });
  if (authClient && !googleForms) googleForms = google.forms({ version: 'v1', auth: authClient });
  if (authClient && !googleTasks) googleTasks = google.tasks({ version: 'v1', auth: authClient });
  if (authClient && !googlePeople) googlePeople = google.people({ version: 'v1', auth: authClient });

  if (!googleDocs || !googleDrive || !googleSheets) {
    throw new Error('Google Docs, Drive, and Sheets clients could not be initialized.');
  }

  return {
    authClient,
    googleDocs,
    googleDrive,
    googleSheets,
    googleScript,
    googleCalendar,
    googleGmail,
    googleSlides,
    googleForms,
    googleTasks,
    googlePeople,
  };
}

// --- Helper to get Docs client within tools ---
export async function getDocsClient() {
  const { googleDocs: docs } = await initializeGoogleClient();
  if (!docs) {
    throw new UserError(
      'Google Docs client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return docs;
}

// --- Helper to get Drive client within tools ---
export async function getDriveClient() {
  const { googleDrive: drive } = await initializeGoogleClient();
  if (!drive) {
    throw new UserError(
      'Google Drive client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return drive;
}

// --- Helper to get Sheets client within tools ---
export async function getSheetsClient() {
  const { googleSheets: sheets } = await initializeGoogleClient();
  if (!sheets) {
    throw new UserError(
      'Google Sheets client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return sheets;
}

// --- Helper to get Auth client for direct API usage ---
export async function getAuthClient() {
  const { authClient: client } = await initializeGoogleClient();
  if (!client) {
    throw new UserError(
      'Auth client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return client;
}

// --- Helper to get Script client within tools ---
export async function getScriptClient() {
  const { googleScript: script } = await initializeGoogleClient();
  if (!script) {
    throw new UserError(
      'Google Script client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return script;
}

// --- Helper to get Calendar client within tools ---
export async function getCalendarClient() {
  const { googleCalendar: calendar } = await initializeGoogleClient();
  if (!calendar) {
    throw new UserError(
      'Google Calendar client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return calendar;
}

// --- Helper to get Gmail client within tools ---
export async function getGmailClient() {
  const { googleGmail: gmail } = await initializeGoogleClient();
  if (!gmail) {
    throw new UserError(
      'Google Gmail client is not initialized. Authentication might have failed during startup or lost connection.'
    );
  }
  return gmail;
}

// --- Helper to get Slides client within tools ---
export async function getSlidesClient() {
  const { googleSlides: slides } = await initializeGoogleClient();
  if (!slides) {
    throw new UserError(
      'Google Slides client is not initialized. Run `node dist/index.js auth` to re-authorize with the new presentations scope.'
    );
  }
  return slides;
}

// --- Helper to get Forms client within tools ---
export async function getFormsClient() {
  const { googleForms: forms } = await initializeGoogleClient();
  if (!forms) {
    throw new UserError(
      'Google Forms client is not initialized. Run `node dist/index.js auth` to re-authorize with the new forms.body scope.'
    );
  }
  return forms;
}

// --- Helper to get Tasks client within tools ---
export async function getTasksClient() {
  const { googleTasks: tasks } = await initializeGoogleClient();
  if (!tasks) {
    throw new UserError(
      'Google Tasks client is not initialized. Run `node dist/index.js auth` to re-authorize with the new tasks scope.'
    );
  }
  return tasks;
}

// --- Helper to get People client within tools ---
export async function getPeopleClient() {
  const { googlePeople: people } = await initializeGoogleClient();
  if (!people) {
    throw new UserError(
      'Google People client is not initialized. Run `node dist/index.js auth` to re-authorize with the new contacts scope.'
    );
  }
  return people;
}
