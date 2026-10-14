export const MAIN_THREAD_COOPERATIVE_SLICE_BUDGET_MS = 3;

export const MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS = Object.freeze({
  YIELD_UNAVAILABLE: 'MAIN_THREAD_COOPERATIVE_SCHEDULER_YIELD_UNAVAILABLE',
  SLICE_BUDGET_INVALID: 'MAIN_THREAD_COOPERATIVE_SCHEDULER_SLICE_BUDGET_INVALID',
});

function readMonotonicNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function requirePositiveSliceBudget(value) {
  const budgetMs = Number(value);
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
  }
  return budgetMs;
}

export function createMainThreadSliceDeadline({
  budgetMs = MAIN_THREAD_COOPERATIVE_SLICE_BUDGET_MS,
  now = readMonotonicNow,
} = {}) {
  if (typeof now !== 'function') {
    throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
  }
  const resolvedBudgetMs = requirePositiveSliceBudget(budgetMs);
  let startedAt = Number(now());
  if (!Number.isFinite(startedAt)) {
    throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
  }

  return Object.freeze({
    hasTime(processed = 0) {
      if (!Number.isSafeInteger(processed) || processed < 0) {
        throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
      }
      if (processed === 0) return true;
      const current = Number(now());
      if (!Number.isFinite(current)) {
        throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
      }
      return current - startedAt < resolvedBudgetMs;
    },
    reset() {
      const current = Number(now());
      if (!Number.isFinite(current)) {
        throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.SLICE_BUDGET_INVALID);
      }
      startedAt = current;
    },
  });
}

export async function yieldMainThreadContinuation() {
  const schedulingOwner = globalThis.scheduler;
  if (typeof schedulingOwner?.yield !== 'function') {
    throw new Error(MAIN_THREAD_COOPERATIVE_SCHEDULER_ERRORS.YIELD_UNAVAILABLE);
  }
  await schedulingOwner.yield();
}
