import { resolveScheduleRuntimePolicy } from '../core/scheduleRuntimePolicy.js';
import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeFlagRepository.js';
import { NOTIFICATION_EVENT_TYPES } from '../../notifications/contracts/notificationTypes.js';
import { SCHEDULE_RUNTIME_CHANGED, requireScheduleRuntimeState } from '../contracts/scheduleRuntimeState.js';

const MAX_TRANSITION_LATENESS_MS = 90_000;

function requireApplyResult(result) {
  if (result?.success === true) return;
  const code = 'SCHEDULE_RUNTIME_APPLY_FAILED';
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const text = (value, limit) => typeof value === 'string'
    ? value.replace(/\b(?:https?|chrome-extension):\/\/[^\s"'<>]+/giu, '[url]').trim().slice(0, limit) : null;
  const failures = Array.isArray(result?.failures) ? result.failures : null;
  const details = {
    resultType: result === null ? 'null' : typeof result,
    success: typeof result?.success === 'boolean' ? result.success : null,
    mode: text(result?.mode, 64),
    attemptedCount: count(result?.attemptedCount), acknowledgedCount: count(result?.acknowledgedCount),
    skippedCount: count(result?.skippedCount), failedCount: count(result?.failedCount),
    failures: failures === null ? null : failures.slice(0, 8).map(failure => ({
      tabId: count(failure?.tabId), code: text(failure?.code, 96),
      reason: text(failure?.reason, 96), message: text(failure?.message, 240),
    })),
    omittedFailureCount: failures === null ? null : Math.max(0, failures.length - 8),
  };
  // Propagation persists code/message/name, so the failed dispatcher receipt must
  // survive this boundary there too. Never expose target URLs or raw payloads.
  throw Object.assign(new Error(`${code} summary=${JSON.stringify(details)}`), {
    code, phase: 'schedule_runtime_broadcast', details,
  });
}

export function createScheduleRuntimeCoordinator({ settingsService, settingsCache,
  runtimeFlagRepository, getGlobalCapState, applyProtection, notificationService, publishState } = {}) {
  for (const [name, fn] of Object.entries({ getGlobalCapState, applyProtection, publishState })) {
    if (typeof fn !== 'function') throw new Error(`SCHEDULE_RUNTIME_OWNER_REQUIRED:${name}`);
  }
  let tail = Promise.resolve();
  let appliedState = null;
  let manualSession = null;
  let skippedOccurrenceId = null;
  const serialize = (task) => {
    const result = tail.then(task);
    // A failed transaction remains rejected to its caller; the queue can retry.
    tail = result.then(() => undefined, () => undefined);
    return result;
  };

  async function reconcile(now, { cause = 'clock', forceApply = false, applyOptions = {}, onApplied } = {}) {
    await settingsService.ensureSettingsCache();
    const flags = await runtimeFlagRepository.get({
      [STORAGE_SESSION_KEYS.SPECIAL_SESSION]: null,
      [STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP]: null,
    });
    skippedOccurrenceId = flags[STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP];
    manualSession = flags[STORAGE_SESSION_KEYS.SPECIAL_SESSION];
    if (skippedOccurrenceId !== null && typeof skippedOccurrenceId !== 'string') {
      throw new Error('SCHEDULE_RUNTIME_SKIP_INVALID');
    }
    const cap = await getGlobalCapState(now);
    if (typeof cap?.exceeded !== 'boolean') throw new Error('SCHEDULE_RUNTIME_CAP_INVALID');
    const next = resolveScheduleRuntimePolicy({ schedule: settingsCache.relaxationSchedule,
      specialSession: flags[STORAGE_SESSION_KEYS.SPECIAL_SESSION], skippedOccurrenceId,
      capExceeded: cap.exceeded, now });
    const previous = appliedState;
    const changed = JSON.stringify(previous) !== JSON.stringify(next);
    if (changed || forceApply) {
      const result = await applyProtection({ ...applyOptions, capStateOverride: cap, nowOverride: now });
      requireApplyResult(result);
      onApplied?.(result);
      // This checkpoint is a receipt, never a substitute for policy inputs.
      await runtimeFlagRepository.set({ [STORAGE_SESSION_KEYS.SCHEDULE_STATE]: {
        schemaVersion: 2, appliedAt: now, state: next,
      } });
      appliedState = requireScheduleRuntimeState(next);
      await publishState({ type: SCHEDULE_RUNTIME_CHANGED, payload: { state: next } });
    }
    if (skippedOccurrenceId && next.scheduledOccurrenceId !== skippedOccurrenceId) {
      await runtimeFlagRepository.set({ [STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP]: null });
      skippedOccurrenceId = null;
    }
    // Bootstrap, user edits, and explicit actions are inline feedback. Never
    // replay elapsed boundaries after sleep, or turn metadata edits into alerts.
    if (!previous || cause !== 'clock' || previous.mode === next.mode
      || (!previous.capExceeded && next.capExceeded)) return next;
    const easeAfterBoundary = next.mode === 'relaxation' && previous.mode === 'isolation';
    const starting = next.mode !== 'protected' && !easeAfterBoundary;
    const subject = starting ? next : previous;
    const edgeAt = starting ? subject.startedAt : subject.endsAt;
    if (!Number.isFinite(edgeAt) || now < edgeAt || now - edgeAt > MAX_TRANSITION_LATENESS_MS) return next;
    if (starting && subject.source === 'manual') return next;
    if (!starting && subject.source === 'manual' && now < subject.endsAt) return next;
    // At a shared boundary, announce the destination once. Relaxation starts
    // are quiet by default; isolation starts and all natural ends are opt-in.
    if (starting && subject.mode === 'relaxation' && subject.notificationMode !== 'both') return next;
    await notify(subject, starting, now);
    return next;
  }

  async function notify(state, starting, now) {
    if (state.notificationMode === 'none' || (starting && state.notificationMode === 'end')) return;
    const isolation = state.mode === 'isolation';
    const type = isolation
      ? (starting ? NOTIFICATION_EVENT_TYPES.ISOLATION_SESSION_STARTED : NOTIFICATION_EVENT_TYPES.ISOLATION_SESSION_ENDED)
      : (starting ? NOTIFICATION_EVENT_TYPES.SCHEDULE_WINDOW_STARTED : NOTIFICATION_EVENT_TYPES.SCHEDULE_WINDOW_ENDED);
    const result = await notificationService.handleEvent({ type,
      deliveryKey: `schedule:${starting ? 'start' : 'end'}:${state.sessionId}:${state.mode}`,
      occurredAt: now, sessionId: state.sessionId, windowKey: state.windowId,
      startedAt: state.startedAt, expectedEndAt: state.endsAt, endedAt: starting ? null : now,
      durationMs: now - state.startedAt, endedBy: 'runtime_transition',
      appliedTransition: true, mode: state.mode, source: state.source, notificationMode: state.notificationMode,
    });
    if (typeof result?.dispatched !== 'boolean') throw new Error('SCHEDULE_RUNTIME_NOTIFICATION_RESULT_INVALID');
  }

  function checkScheduleStatus(now = Date.now(), options = {}) {
    return serialize(() => reconcile(now, options));
  }
  function applyScheduleRuntimeSettings(applyOptions) {
    return serialize(async () => {
      let result;
      await reconcile(Date.now(), { cause: 'settings', forceApply: true, applyOptions,
        onApplied: (applied) => { result = applied; } });
      return result;
    });
  }
  function runManualSessionMutation(task) {
    return serialize(async () => {
      const current = await reconcile(Date.now(), { cause: 'observation' });
      const session = await task(current);
      await reconcile(Date.now(), { cause: 'manual', forceApply: true });
      return session;
    });
  }
  function endScheduleOccurrence({ sessionId, now = Date.now() } = {}) {
    return serialize(async () => {
      const state = await reconcile(now, { cause: 'observation' });
      if (state.source !== 'schedule' || state.sessionId !== sessionId) {
        throw new Error('SCHEDULE_RUNTIME_OCCURRENCE_CHANGED');
      }
      await runtimeFlagRepository.set({ [STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP]: sessionId });
      return reconcile(now, { cause: 'manual', forceApply: true });
    });
  }
  return { checkScheduleStatus, endScheduleOccurrence, applyScheduleRuntimeSettings, runManualSessionMutation,
    getManualSession: () => manualSession, getSkippedOccurrenceId: () => skippedOccurrenceId };
}
