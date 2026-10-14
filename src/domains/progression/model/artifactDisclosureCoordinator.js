import {
  DEFAULT_ACTIVITY_DAY_RESET_HOUR,
  resolveActivityDayWindow,
} from '../../stats/shared/activityDay.js';
import {
  normalizeArtifactDisclosureActivityDayKey,
} from '../policy/artifactDisclosurePolicy.js';

function assertProgressionService(progressionService) {
  if (
    !progressionService
    || typeof progressionService.recordSuccessfulManagedProtectionActivityDay !== 'function'
  ) {
    throw new Error('ARTIFACT_DISCLOSURE_PROGRESSION_SERVICE_REQUIRED');
  }
}

function defaultResolveActivityDayKey({ atMs }) {
  return resolveActivityDayWindow({
    now: atMs,
    resetHour: DEFAULT_ACTIVITY_DAY_RESET_HOUR,
  }).startDateStr;
}

function requireTimestamp(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('ARTIFACT_DISCLOSURE_TIMESTAMP_REQUIRED');
  }
  return value;
}

export function createArtifactDisclosureCoordinator({
  progressionService,
  resolveActivityDayKey = defaultResolveActivityDayKey,
  onQualifiedDayRecorded = null,
  now = () => Date.now(),
} = {}) {
  assertProgressionService(progressionService);
  if (typeof resolveActivityDayKey !== 'function') {
    throw new Error('ARTIFACT_DISCLOSURE_ACTIVITY_DAY_RESOLVER_REQUIRED');
  }
  if (typeof now !== 'function') {
    throw new Error('ARTIFACT_DISCLOSURE_CLOCK_REQUIRED');
  }
  if (onQualifiedDayRecorded !== null && typeof onQualifiedDayRecorded !== 'function') {
    throw new Error('ARTIFACT_DISCLOSURE_DAY_RECORDED_OBSERVER_INVALID');
  }

  let recordQueue = Promise.resolve();

  function enqueue(operation) {
    const pending = recordQueue.then(operation);
    recordQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  function recordManagedProtectedVisit({
    atMs = now(),
    activityDayKey = '',
  } = {}) {
    return enqueue(async () => {
      const timestamp = requireTimestamp(atMs);
      const resolvedActivityDayKey = activityDayKey || await resolveActivityDayKey({
        atMs: timestamp,
      });
      const result = await progressionService.recordSuccessfulManagedProtectionActivityDay({
        activityDayKey: normalizeArtifactDisclosureActivityDayKey(resolvedActivityDayKey),
        atMs: timestamp,
      });
      if (result.activityDayOutcome?.qualifiedDayRecorded === true && onQualifiedDayRecorded !== null) {
        // Alerts are optional post-commit work. They cannot fail visit settlement
        // or keep the serialized qualification lane waiting on notification UI.
        void Promise.resolve().then(() => onQualifiedDayRecorded(result, {
          activityDayKey: resolvedActivityDayKey, atMs: timestamp,
        })).catch((error) => console.error('[progression] qualified-day follow-up failed', error));
      }
      return result;
    });
  }

  return Object.freeze({
    recordManagedProtectedVisit,
  });
}

export default createArtifactDisclosureCoordinator;
