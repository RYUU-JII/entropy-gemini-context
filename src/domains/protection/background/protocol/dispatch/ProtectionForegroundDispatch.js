const FOREGROUND_SOURCES = new Set([
  'tabs.onActivated',
  'windows.onFocusChanged',
  'tabs.onReplaced',
]);
const NAVIGATION_REASONS = new Set([
  'web_navigation_committed',
  'web_navigation_history_state_updated',
]);
const REMOVAL_REASONS = new Set(['tab_removed', 'tab_replaced']);
const issuedCancellations = new WeakSet();

export function requireForegroundDispatchSource(source = null) {
  if (source !== null && !FOREGROUND_SOURCES.has(source)) {
    throw new Error('PROTECTION_FOREGROUND_DISPATCH_SOURCE_INVALID');
  }
  return source;
}

export function isProtectionForegroundDispatchCancellation(value) {
  return !!value && issuedCancellations.has(value);
}

export function settleForegroundDispatchCancellation({
  error, queue, task, tabId, source, route, recordDiagnostic,
}) {
  requireForegroundDispatchSource(source);
  const evidence = queue.getTaskInvalidation(error, task);
  const navigationCancelled = evidence?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_INVALIDATED'
    && NAVIGATION_REASONS.has(evidence.reason)
    && Number.isSafeInteger(evidence.invalidationTag) && evidence.invalidationTag > 0;
  const removalCancelled = evidence?.code === 'PROTECTION_DISPATCH_SERIAL_QUEUE_TAB_EVICTED'
    && REMOVAL_REASONS.has(evidence.reason);
  if (!source || evidence?.tabId !== tabId || (!navigationCancelled && !removalCancelled)) {
    throw error;
  }
  // The private dispatcher queue is invalidated only by its raw lifecycle owners.
  // Its exact-task evidence proves cancellation even if the live ledger was evicted.
  const outcome = Object.freeze({
    status: 'cancelled',
    source,
    route,
    tabId,
    code: evidence.code,
    reason: evidence.reason,
    phase: evidence.phase,
    invalidationTag: navigationCancelled ? evidence.invalidationTag : null,
  });
  issuedCancellations.add(outcome);
  recordDiagnostic('foreground_protection_dispatch_cancelled', outcome);
  return outcome;
}
