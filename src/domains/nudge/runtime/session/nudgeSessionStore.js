import NudgeSessionRepository from '../../../../platform/storage/runtime/NudgeSessionRepository.js';

let nudgeSessionLock = Promise.resolve();
const nudgeSessionRepository = NudgeSessionRepository.getInstance();
const reportedNudgeSessionLockFailureKeys = new Set();

export function reportNudgeSessionLockFailure(error, consoleRef = console) {
  const diagnostic = {
    code: 'nudge_session_lock_work_failed',
    error: String(error?.message || error || 'session_lock_work_failed'),
  };
  const reportKey = `${diagnostic.code}:${diagnostic.error}`;
  if (
    !reportedNudgeSessionLockFailureKeys.has(reportKey)
    && consoleRef
    && typeof consoleRef.warn === 'function'
  ) {
    reportedNudgeSessionLockFailureKeys.add(reportKey);
    consoleRef.warn('[nudge session] queued work failed', diagnostic);
  }
  return diagnostic;
}

function settleNudgeSessionLock(run, { consoleRef = console } = {}) {
  return run.then(
    () => undefined,
    (error) => {
      reportNudgeSessionLockFailure(error, consoleRef);
      return undefined;
    },
  );
}

export async function withNudgeSessionLock(work, { consoleRef = console } = {}) {
  const run = nudgeSessionLock
    .then(() => Promise.resolve().then(work));
  nudgeSessionLock = settleNudgeSessionLock(run, { consoleRef });
  return run;
}

export async function getSession(defaults) {
  return nudgeSessionRepository.get(defaults);
}

export async function setSession(patch) {
  await nudgeSessionRepository.set(patch);
}
