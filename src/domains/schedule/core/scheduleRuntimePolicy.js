import { resolveScheduleWindowOccurrence, requireCanonicalScheduleWindows } from './schedulePlan.js';
import { normalizeSpecialSessionState } from '../../settings/config/specialSession.js';

// One temporal policy for scope, filter attenuation, status, and transitions.
// The persisted setting keeps its physical name; blocks are the storage DTO,
// windows are the recurring-plan DTO. This is the only runtime adapter.
export function resolveScheduleRuntimePolicy({ schedule, specialSession = null,
  skippedOccurrenceId = null, capExceeded = false, now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw new Error('SCHEDULE_RUNTIME_TIME_INVALID');
  if (schedule !== null && schedule !== undefined
    && (schedule.schemaVersion !== 1 || !Array.isArray(schedule.blocks) || !Array.isArray(schedule.days))) {
    throw new Error('SCHEDULE_RUNTIME_PLAN_INVALID');
  }
  if (schedule != null) requireCanonicalScheduleWindows(schedule.blocks);
  const occurrence = schedule == null ? null : resolveScheduleWindowOccurrence({
    ...schedule, windows: schedule.blocks,
  }, now);
  const manual = normalizeSpecialSessionState(specialSession, { now });
  const activeOccurrence = occurrence?.occurrenceId === skippedOccurrenceId ? null : occurrence;
  let mode = 'protected';
  let source = 'base';
  let sessionId = null;
  let startedAt = null;
  let endsAt = null;
  let windowId = null;
  let name = '';
  let notificationMode = 'auto';
  let isolationSession = manual;
  if (manual.active) {
    mode = 'isolation'; source = 'manual'; sessionId = manual.id;
    startedAt = manual.startedAt; endsAt = manual.endsAt;
  } else if (activeOccurrence) {
    const { window } = activeOccurrence;
    if (window.intent === 'isolation' || !capExceeded) {
      mode = window.intent; source = 'schedule'; sessionId = activeOccurrence.occurrenceId;
      startedAt = activeOccurrence.startedAt; endsAt = activeOccurrence.endsAt;
      windowId = window.id; name = window.name || '';
      notificationMode = window.notificationMode === undefined ? 'none' : window.notificationMode;
      if (mode === 'isolation') isolationSession = {
        schemaVersion: 1, active: true, mode: 'isolation', id: sessionId,
        startedAt, endsAt, durationMinutes: (endsAt - startedAt) / 60_000,
        temporaryAllowedHosts: [],
      };
    }
  }
  return { mode, source, sessionId, windowId, name, startedAt, endsAt,
    scheduledOccurrenceId: occurrence?.occurrenceId ?? null,
    capExceeded, isolationSession, notificationMode };
}
