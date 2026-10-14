import { getHostname } from '../../../lib/index.js';

// Operational use, independent of historical collection admission. Reuses the
// existing browser ingress, foreground owner and one-minute inventory; no timer,
// listener, DOM/media observer or second tab registry is installed here.
export function createTrackingEnsoCadenceBridge({ admission, tracker, windowIdNone = -1 }) {
  let focusedWindowId = null;
  let foregroundTabId = null;
  function capture(label, args, at = Date.now()) {
    const activeTabId = foregroundTabId;
    let expectedTabId = null;
    let navigation = false, expectedHostname = null;
    let relevant = false;
    if (label === 'windows.onFocusChanged') {
      focusedWindowId = args[0] === windowIdNone ? null : args[0];
      relevant = true;
    } else if (label === 'tabs.onActivated') {
      expectedTabId = args[0].tabId;
      relevant = focusedWindowId !== null && args[0].windowId === focusedWindowId;
    } else if (label === 'tabs.onUpdated') {
      expectedTabId = args[0];
      relevant = expectedTabId === activeTabId && (!!args[1]?.status || !!args[1]?.url);
      navigation = !!args[1]?.url || args[1]?.status === 'loading';
      if (navigation) expectedHostname = getHostname(args[2]?.url || args[1]?.url || '');
    } else if (label === 'tabs.onRemoved' || label === 'tabs.onReplaced') {
      expectedTabId = label === 'tabs.onRemoved' ? args[0] : args[1];
      relevant = expectedTabId === activeTabId;
    } else if (label === 'webNavigation.onCommitted' || label === 'webNavigation.onHistoryStateUpdated') {
      expectedTabId = args[0]?.tabId;
      relevant = args[0]?.frameId === 0 && expectedTabId === activeTabId;
      navigation = true; expectedHostname = getHostname(args[0]?.url || '');
    }
    if (!relevant) return null;
    if (label === 'tabs.onActivated') foregroundTabId = expectedTabId;
    return { ...admission.captureEnsoCadenceBoundary(at), expectedTabId, navigation, expectedHostname };
  }

  async function refresh(receipt) {
    if (!receipt || receipt.revision !== admission.captureEnsoCadenceObservation()) return;
    const current = tracker.getActiveTabInfo();
    const identityKnown = focusedWindowId !== null && tracker.getFocusedWindowId() === focusedWindowId
      && Number.isSafeInteger(current?.tabId) && current.tabId >= 0
      && (receipt.expectedTabId === null || current.tabId === receipt.expectedTabId);
    const foregroundKnown = identityKnown && current.hostname
      && (!receipt.navigation || (receipt.expectedHostname && current.hostname === receipt.expectedHostname));
    let mode = 'unknown';
    let tabId = identityKnown ? current.tabId : null;
    if (foregroundKnown) {
      const protectedScope = await tracker.readProtectedTabScope({ url: `https://${current.hostname}/` }, Date.now());
      const idleState = tracker.getOperationalIdleState();
      tabId = current.tabId;
      // Foreground exposure is observable; quiet reading and silent video are
      // not distinguishable from an idle page. Native idle is not a veto.
      if (protectedScope === true) mode = ['active', 'idle'].includes(idleState) ? 'consuming' : idleState === 'locked' ? 'paused' : 'unknown';
      else if (protectedScope === false) mode = 'paused';
    }
    // A foreground transition does not prove the absence of audio in other
    // tabs. Only the complete existing inventory can certify operational away.
    await admission.observeEnsoCadence({ observedAt: Date.now(), tabId, mode }, {
      revision: receipt.revision,
      isCurrent: () => receipt.revision === admission.captureEnsoCadenceObservation()
        && (!foregroundKnown || tracker.getActiveTabInfo().tabId === current.tabId),
    });
    if (receipt.revision === admission.captureEnsoCadenceObservation()) foregroundTabId = tabId;
  }

  async function observeBatch({ point, focusedWindowId: observedWindowId, revision, isCurrent }) {
    if (!isCurrent() || revision !== admission.captureEnsoCadenceObservation()) return;
    focusedWindowId = observedWindowId;
    foregroundTabId = point.tabId;
    await admission.observeEnsoCadence(point, { revision, isCurrent });
  }

  return { capture, refresh, observeBatch,
    interruptDeparture: observedAt => admission.interruptEnsoDeparture(observedAt),
    settle: receipt => receipt ? admission.settleEnsoCadenceBoundary(receipt) : Promise.resolve(),
    captureObservation: () => admission.captureEnsoCadenceObservation() };
}
