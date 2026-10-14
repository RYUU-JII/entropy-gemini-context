// Cancellation withdraws this caller's admission, never a shared module/read.
export function throwIfDashboardPreloadAborted(signal) {
  if (signal?.aborted !== true) return;
  const error = new Error('DASHBOARD_PRELOAD_ABORTED');
  error.name = 'AbortError';
  error.code = 'DASHBOARD_PRELOAD_ABORTED';
  throw error;
}
