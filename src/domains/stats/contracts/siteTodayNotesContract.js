import { parseLocalDateParts } from '../shared/dateMath.js';

export const SITE_TODAY_NOTES_VERSION = 'sites-site-today-notes-v1';
export const SITE_TODAY_NOTES_BASIS = 'local-calendar-day-hour';
export const SITE_TODAY_NOTE_ORDER = Object.freeze([
  'short_sessions', 'peak_time_window', 'revisit_within_5m', 'friction_response',
]);

const STATUSES = new Set(['detail_not_loaded', 'missing', 'observed']);
const SOURCES = Object.freeze({
  short_sessions: 'todaySessionStats.shortCount',
  peak_time_window: 'todayHourly',
  revisit_within_5m: 'todayBehaviorStats.revisitWithin5m',
  friction_response: 'todayInterventionStats',
});

function fail() {
  const error = new Error('SITE_TODAY_NOTES_CONTRACT_INVALID');
  error.code = 'SITE_TODAY_NOTES_CONTRACT_INVALID';
  throw error;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function createUnloadedSiteTodayNotes() {
  return {
    version: SITE_TODAY_NOTES_VERSION,
    basis: SITE_TODAY_NOTES_BASIS,
    status: 'detail_not_loaded',
    dateStr: null,
    notes: [],
  };
}

function requireNote(note) {
  if (!isRecord(note) || !SITE_TODAY_NOTE_ORDER.includes(note.id)
    || note.source !== SOURCES[note.id]) fail();

  if (note.id === 'peak_time_window') {
    const window = note.window;
    if (note.unit !== 'duration_ms' || !isDuration(note.value)
      || !isDuration(note.denominator) || note.denominator === 0
      || note.value > note.denominator || !isRecord(window)
      || !isCount(window.startHour) || window.startHour > 22
      || window.durationHours !== 2 || window.endHourExclusive !== window.startHour + 2
      || window.wrapsMidnight !== false) fail();
  } else {
    if (note.unit !== 'count' || !isCount(note.value) || !isCount(note.denominator)
      || note.denominator === 0 || note.value > note.denominator
      || Object.hasOwn(note, 'window')) fail();
  }

  if (note.id === 'friction_response') {
    if (note.value !== note.denominator || !isRecord(note.responses)
      || !isCount(note.responses.continued) || !isCount(note.responses.left)) fail();
    // Responses are counted on their own occurrence date; they are not a
    // partition of the screens shown on this calendar date.
  } else if (Object.hasOwn(note, 'responses')) fail();
}

// Validates the published facts and their stable order. Family selection and
// the busiest two-hour window remain owned by the stats-query producer.
export function requireSiteTodayNotes(value) {
  if (!isRecord(value) || value.version !== SITE_TODAY_NOTES_VERSION
    || value.basis !== SITE_TODAY_NOTES_BASIS || !STATUSES.has(value.status)
    || !Array.isArray(value.notes)) fail();

  if (value.status === 'detail_not_loaded') {
    if (value.dateStr !== null || value.notes.length !== 0) fail();
    return value;
  }
  if (typeof value.dateStr !== 'string' || !parseLocalDateParts(value.dateStr)) fail();
  if (value.status === 'missing') {
    if (value.notes.length !== 0) fail();
    return value;
  }

  let previousIndex = -1;
  Array.from(value.notes).forEach(note => {
    requireNote(note);
    const index = SITE_TODAY_NOTE_ORDER.indexOf(note.id);
    if (index <= previousIndex) fail();
    previousIndex = index;
  });
  return value;
}
