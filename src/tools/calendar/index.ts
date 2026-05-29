import type { FastMCP } from 'fastmcp';
import { register as listCalendarEvents } from './listCalendarEvents.js';
import { register as getCalendarEvent } from './getCalendarEvent.js';
import { register as createCalendarEvent } from './createCalendarEvent.js';
import { register as listCalendars } from './listCalendars.js';

export function registerCalendarTools(server: FastMCP) {
  listCalendarEvents(server);
  getCalendarEvent(server);
  createCalendarEvent(server);
  listCalendars(server);
}
