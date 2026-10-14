import { requireConsumptionEnvironment } from './trackingConsumptionEnvironment.js';

export const CONSUMPTION_MEDIA_WINDOW_MS = 60 * 60_000;
export const CONSUMPTION_MEDIA_INTERVAL_LIMIT = 256;
// Two existing one-minute Tracking beats. A missed/suspended observation is
// never extended indefinitely, even if the next inventory looks identical.
export const CONSUMPTION_MEDIA_MAX_BRIDGE_MS = 120_000;

function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('CONSUMPTION_MEDIA_TIME_INVALID');
}

export function requireConsumptionMediaWindow(value) {
  const keys = ['contract', 'observedThroughAt', 'intervals'];
  if (!value || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
    || value.contract !== 'consumption_browser_audible_window_v1' || !Array.isArray(value.intervals)
    || value.intervals.length > CONSUMPTION_MEDIA_INTERVAL_LIMIT) throw new Error('CONSUMPTION_MEDIA_WINDOW_INVALID');
  if (value.observedThroughAt === null) {
    if (value.intervals.length) throw new Error('CONSUMPTION_MEDIA_UNOBSERVED_INVALID');
    return value;
  }
  integer(value.observedThroughAt);
  let through = Math.max(0, value.observedThroughAt - CONSUMPTION_MEDIA_WINDOW_MS);
  for (const item of value.intervals) {
    if (!item || Object.keys(item).length !== 2 || !Object.hasOwn(item, 'startedAt') || !Object.hasOwn(item, 'endedAt')) throw new Error('CONSUMPTION_MEDIA_INTERVAL_INVALID');
    integer(item.startedAt); integer(item.endedAt);
    if (item.startedAt < through || item.endedAt <= item.startedAt || item.endedAt > value.observedThroughAt) throw new Error('CONSUMPTION_MEDIA_ORDER_INVALID');
    through = item.endedAt;
  }
  return value;
}

// Owned by the existing Tracking ledger. No tab registry, browser listener,
// timer, storage or absent-media inference. Restart deliberately loses anchors.
export function createConsumptionMediaWindow() {
  let revision = 0, anchor = null, observedThroughAt = null, intervals = [];
  function invalidate() { revision += 1; }
  function capture(settingsVersion) {
    integer(settingsVersion);
    return { revision, settingsVersion };
  }
  function observe(point, receipt, settingsVersion) {
    requireConsumptionEnvironment(point); integer(settingsVersion);
    if (!receipt || Object.keys(receipt).length !== 2) throw new Error('CONSUMPTION_MEDIA_RECEIPT_INVALID');
    integer(receipt.revision); integer(receipt.settingsVersion);
    if (receipt.revision > revision) throw new Error('CONSUMPTION_MEDIA_REVISION_INVALID');
    const at = point.observedAt;
    if (observedThroughAt !== null && at < observedThroughAt) throw new Error('CONSUMPTION_MEDIA_CLOCK_REGRESSED');
    const stable = receipt.revision === revision && receipt.settingsVersion === settingsVersion;
    if (stable && anchor && anchor.revision === revision && anchor.settingsVersion === settingsVersion
      && point.admission === 'enabled' && point.protectedMedia === 'present'
      && anchor.present && at > anchor.at && at - anchor.at <= CONSUMPTION_MEDIA_MAX_BRIDGE_MS) {
      const last = intervals.at(-1);
      if (last?.endedAt === anchor.at) last.endedAt = at;
      else intervals.push({ startedAt: anchor.at, endedAt: at });
    }
    anchor = stable ? { at, revision, settingsVersion,
      present: point.admission === 'enabled' && point.protectedMedia === 'present' } : null;
    observedThroughAt = at;
    const from = Math.max(0, at - CONSUMPTION_MEDIA_WINDOW_MS);
    intervals = intervals.filter((item) => item.endedAt > from).slice(-CONSUMPTION_MEDIA_INTERVAL_LIMIT)
      .map((item) => ({ startedAt: Math.max(from, item.startedAt), endedAt: item.endedAt }));
  }
  function snapshot() {
    return requireConsumptionMediaWindow({ contract: 'consumption_browser_audible_window_v1',
      observedThroughAt, intervals: intervals.map((item) => ({ ...item })) });
  }
  function reset() { invalidate(); anchor = null; observedThroughAt = null; intervals = []; }
  return { invalidate, capture, observe, snapshot, reset };
}
