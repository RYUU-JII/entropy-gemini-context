let enabled = false;
let aborted = false;
const cleanups = new Map();

export function enableQaChildAbortCleanup() { enabled = true; }

export function registerQaChildAbortCleanup(release, { phase = 'resource' } = {}) {
  if (typeof release !== 'function' || !['protocol', 'resource'].includes(phase)) {
    throw new Error('QA_CHILD_ABORT_CLEANUP_INVALID');
  }
  if (aborted) throw new Error('QA_RUN_ABORTED:child_cleanup_started');
  if (!enabled) return () => {};
  const id = Symbol();
  cleanups.set(id, { release, phase });
  return () => cleanups.delete(id);
}

export async function disposeQaChildResources() {
  aborted = true;
  const failures = [];
  for (const phase of ['protocol', 'resource']) {
    for (const [id, cleanup] of [...cleanups].reverse()) {
      if (cleanup.phase !== phase || !cleanups.has(id)) continue;
      try { await cleanup.release(); cleanups.delete(id); }
      catch (error) { failures.push(error); }
    }
  }
  if (failures.length) throw new AggregateError(failures, 'QA_CHILD_COOPERATIVE_CLEANUP_FAILED');
}
