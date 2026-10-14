import { getLocalDateStr } from '../../../lib/index.js';
import { resolveFocusedActiveTabSnapshot } from './trackingTabActivityBatchDiagnostics.js';

export const TRACKING_OBSERVATION_SUPERSEDED = 'TRACKING_TAB_ACTIVITY_OBSERVATION_SUPERSEDED';

export function requireRolloverObservationContext({ previousDateStr, boundaryTs } = {}) {
  if (!Number.isSafeInteger(boundaryTs) || boundaryTs <= 0
    || getLocalDateStr(boundaryTs - 1) !== previousDateStr
    || getLocalDateStr(boundaryTs) === previousDateStr) {
    throw new Error('TRACKING_ROLLOVER_OBSERVATION_CONTEXT_INVALID');
  }
  return Object.freeze({ previousDateStr, boundaryTs });
}

// Acquisition has no stats writes. Receipts belong to this tracker lifetime,
// are single-use, and cannot turn a caller-supplied DTO into browser evidence.
export function createTrackingTabActivityObservation({
  queryTabs, readWindow, settingsService, idleDetector, consumptionLedger,
  activeTabRuntimeState, windowIdNone,
}) {
  const observations = new WeakMap();

  function assertCurrent(snapshot, now, { historicalBoundary = false } = {}) {
    const current = consumptionLedger.captureMediaObservation(settingsService.getSettingsChangeVersion());
    let reason = null;
    if (snapshot.mediaReceipt.revision !== current.revision) reason = 'browser_event';
    else if (snapshot.mediaReceipt.settingsVersion !== current.settingsVersion) reason = 'settings_changed';
    else if (snapshot.activeRevision !== activeTabRuntimeState.getObservationRevision()) reason = 'foreground_changed';
    else if (snapshot.idleState !== idleDetector.getCurrentIdleState()) reason = 'idle_changed';
    else if (!historicalBoundary && getLocalDateStr(snapshot.observedAt) !== getLocalDateStr(now)) reason = 'calendar_changed';
    if (reason !== null) {
      const error = new Error(`${TRACKING_OBSERVATION_SUPERSEDED}:${reason}`);
      error.code = TRACKING_OBSERVATION_SUPERSEDED;
      error.reason = reason;
      error.beforeMutation = true;
      throw error;
    }
  }

  async function acquire({ refreshIdle = false, rolloverContext = null } = {}) {
    const rollover = rolloverContext === null ? null : requireRolloverObservationContext(rolloverContext);
    // getIdleState can await the idle transition's stats batch. Never run that
    // refresh while holding the mutation lane (including calendar rollover).
    if (refreshIdle) await idleDetector.getIdleState();
    await settingsService.ensureSettingsCache();
    const snapshot = {
      observedAt: Date.now(),
      mediaReceipt: consumptionLedger.captureMediaObservation(settingsService.getSettingsChangeVersion()),
      activeRevision: activeTabRuntimeState.getObservationRevision(),
      idleState: idleDetector.getCurrentIdleState(),
      rolloverContext: rollover,
    };
    const [tabs, activeTabs] = await Promise.all([
      queryTabs({}), queryTabs({ active: true, lastFocusedWindow: true }),
    ]);
    if (!Array.isArray(tabs) || !Array.isArray(activeTabs)) throw new Error('TRACKING_FOREGROUND_INVENTORY_INVALID');
    // Retain only fields used by the classification owners, detached from ports.
    const copyTab = ({ id, windowId, url, pendingUrl, active, audible }) => (
      { id, windowId, url, pendingUrl, active, audible }
    );
    snapshot.queriedTabs = tabs.map(copyTab);
    snapshot.focusedActiveTabs = activeTabs.map(copyTab);
    const focused = resolveFocusedActiveTabSnapshot(snapshot.focusedActiveTabs, { windowIdNone });
    const window = Number.isInteger(focused?.windowId) && focused.windowId >= 0
      ? await readWindow(focused.windowId) : null;
    snapshot.consumptionFocusedWindow = window === null ? null : { id: window.id, focused: window.focused };
    const receipt = Object.freeze({ observedAt: snapshot.observedAt });
    observations.set(receipt, snapshot);
    return receipt;
  }

  function consume(receipt, now, options = {}) {
    const snapshot = observations.get(receipt);
    if (!snapshot) throw new Error('TRACKING_TAB_ACTIVITY_OBSERVATION_RECEIPT_INVALID');
    observations.delete(receipt);
    const expected = options.rolloverContext ?? null;
    if ((snapshot.rolloverContext === null) !== (expected === null)
      || (expected !== null && (snapshot.rolloverContext.previousDateStr !== expected.previousDateStr
        || snapshot.rolloverContext.boundaryTs !== expected.boundaryTs || now !== expected.boundaryTs))) {
      throw new Error('TRACKING_ROLLOVER_OBSERVATION_CONTEXT_MISMATCH');
    }
    assertCurrent(snapshot, now, options);
    return snapshot;
  }

  return { acquire, consume, assertCurrent };
}
