import { runtimeOnMessageAddListener, runtimeOnMessageRemoveListener } from '../../../platform/chrome/ChromeService.js';
import { subscribeProtocolSettingsChanges } from '../../../platform/storage/protocol/ProtocolSettingsSubscriptionService.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { STATS_EVENT_TYPES, validateStatsEvent } from '../../stats/contracts/statsEvents.js';

const COMMIT_REFRESH_MIN_INTERVAL_MS = 1000;

// Popup lifetime only. Existing commit/settings signals invalidate the query;
// the background DTO supplies the next activity-day boundary. No usage clock.
export function createPopupSiteSnapshotRefresh({ readSnapshot, onSnapshot, onError, documentRef = document }) {
  let stopped = false;
  let inFlight = false;
  let dirty = false;
  let urgent = false;
  let generation = 0;
  let lastStartedAt = -Infinity;
  let refreshTimer = null;
  let boundaryTimer = null;
  let expiredResponseCount = 0;
  const visible = () => documentRef.hidden !== true && documentRef.visibilityState !== 'hidden';

  function clearTimers() {
    clearTimeout(refreshTimer);
    clearTimeout(boundaryTimer);
    refreshTimer = null;
    boundaryTimer = null;
  }

  function schedule() {
    if (stopped || inFlight || !dirty || !visible()) return;
    clearTimeout(refreshTimer);
    const delay = urgent ? 0 : Math.max(0, lastStartedAt + COMMIT_REFRESH_MIN_INTERVAL_MS - Date.now());
    refreshTimer = setTimeout(() => { refreshTimer = null; void run(); }, delay);
  }

  function refresh({ discardCurrent = true } = {}) {
    if (stopped) return;
    if (discardCurrent) {
      generation += 1;
      urgent = true;
      clearTimeout(boundaryTimer);
      boundaryTimer = null;
    }
    dirty = true;
    schedule();
  }

  async function run() {
    if (stopped || inFlight || !dirty || !visible()) return;
    inFlight = true;
    dirty = false;
    urgent = false;
    lastStartedAt = Date.now();
    const requestGeneration = generation;
    try {
      const snapshot = await readSnapshot();
      if (stopped || generation !== requestGeneration || !visible()) return;
      if (snapshot.site.supported && snapshot.refreshAt <= Date.now()) {
        // One read may straddle the boundary. Never display that old day or
        // repeatedly retry a broken owner returning the same expired snapshot.
        if (++expiredResponseCount > 1) throw new Error('POPUP_SITE_SNAPSHOT_EXPIRED');
        refresh();
        return;
      }
      expiredResponseCount = 0;
      clearTimeout(boundaryTimer);
      boundaryTimer = snapshot.site.supported
        ? setTimeout(() => { boundaryTimer = null; refresh(); }, snapshot.refreshAt - Date.now())
        : null;
      onSnapshot(snapshot);
    } catch (error) {
      if (!stopped && generation === requestGeneration && visible()) onError(error);
    } finally {
      inFlight = false;
      schedule();
    }
  }

  const onMessage = (message, sender) => {
    if (sender?.tab || message?.type !== MESSAGE_TYPES.STATS_EVENT) return false;
    if (!validateStatsEvent(message.payload).ok) return false;
    refresh({ discardCurrent: message.payload.type !== STATS_EVENT_TYPES.COMMITTED });
    return false;
  };
  const onVisibility = () => {
    generation += 1;
    clearTimers();
    if (visible()) refresh();
  };
  const onPageShow = () => refresh();
  const onPageHide = () => dispose();
  let unsubscribeSettings = null;
  let attached = false;
  function dispose() {
    if (stopped) return;
    stopped = true;
    generation += 1;
    clearTimers();
    if (attached) runtimeOnMessageRemoveListener(onMessage);
    unsubscribeSettings?.();
    documentRef.removeEventListener('visibilitychange', onVisibility);
    documentRef.defaultView?.removeEventListener('pageshow', onPageShow);
    documentRef.defaultView?.removeEventListener('pagehide', onPageHide);
  }
  try {
    attached = runtimeOnMessageAddListener(onMessage);
    if (!attached) throw new Error('POPUP_SNAPSHOT_SUBSCRIPTION_UNAVAILABLE');
    unsubscribeSettings = subscribeProtocolSettingsChanges(() => refresh());
    documentRef.addEventListener('visibilitychange', onVisibility);
    documentRef.defaultView?.addEventListener('pageshow', onPageShow);
    documentRef.defaultView?.addEventListener('pagehide', onPageHide);
    refresh();
  } catch (error) {
    dispose();
    throw error;
  }
  return { refresh, dispose };
}
