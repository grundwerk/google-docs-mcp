import type { FastMCP } from 'fastmcp';
import { register as listCalendarEvents } from './listCalendarEvents.js';
import { register as getCalendarEvent } from './getCalendarEvent.js';
import { register as createCalendarEvent } from './createCalendarEvent.js';
import { register as listCalendars } from './listCalendars.js';

// Phase 7 — MED Calendar
import { register as updateEvent } from './updateEvent.js';
import { register as deleteEvent } from './deleteEvent.js';

// Phase 9 — LOW Calendar
import { register as freeBusyQuery } from './freeBusyQuery.js';
import { register as quickAddEvent } from './quickAddEvent.js';
import { register as moveEvent } from './moveEvent.js';
import { register as addMeetLink } from './addMeetLink.js';
import { register as listCalendarACL } from './listCalendarACL.js';
import { register as setCalendarACL } from './setCalendarACL.js';

export function registerCalendarTools(server: FastMCP) {
  listCalendarEvents(server);
  getCalendarEvent(server);
  createCalendarEvent(server);
  listCalendars(server);

  // Phase 7 — MED Calendar
  updateEvent(server);
  deleteEvent(server);

  // Phase 9 — LOW Calendar
  freeBusyQuery(server);
  quickAddEvent(server);
  moveEvent(server);
  addMeetLink(server);
  listCalendarACL(server);
  setCalendarACL(server);
}
