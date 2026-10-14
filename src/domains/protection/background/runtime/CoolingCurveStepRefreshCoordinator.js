import { requireCoolingCurveRuntimeState } from '../../contracts/coolingCurveRuntimeContract.js';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new Error(`COOLING_CURVE_REFRESH_OWNER_REQUIRED:${name}`);
  return value;
}

function requireProjection(value) {
  if (!value || typeof value !== 'object' || value.activityDay?.basis !== 'activity-day'
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.activityDay.dateStr)
    || !Number.isInteger(value.activityDay.resetHour) || value.activityDay.resetHour < 0 || value.activityDay.resetHour > 23) {
    throw new Error('COOLING_CURVE_REFRESH_ACTIVITY_DAY_INVALID');
  }
  const curve = requireCoolingCurveRuntimeState(value.coolingCurve);
  if (![null, 'release', 'max_filter'].includes(value.applicationOverride)) throw new Error('COOLING_CURVE_REFRESH_OVERRIDE_INVALID');
  return JSON.stringify([value.activityDay.dateStr, value.activityDay.resetHour,
    curve.state, curve.step, curve.ended, curve.preset, value.applicationOverride]);
}

function dispatchSucceeded(result) {
  return result?.sendResult?.ok === true || result?.skipped === 'unchanged_signature'
    || result?.handled === 'gate_interstitial';
}

/** Disposable worker state, checked only after the existing tracking tick settles.
 * The normal dispatcher still owns permissions, document fencing and exact ACKs. */
export function createCoolingCurveStepRefreshCoordinator({
  trackingProtectionService, sendProtectionUpdate, syncManagedContentScripts,
  frictionBootstrapCoordinator, refreshFrictionBootstrapForHostname,
} = {}) {
  const readInventory = requireFunction(trackingProtectionService?.readProtectedTabInventory, 'readProtectedTabInventory');
  const readProjection = requireFunction(trackingProtectionService?.readCoolingCurveRuntimeState, 'readCoolingCurveRuntimeState');
  requireFunction(sendProtectionUpdate, 'sendProtectionUpdate');
  requireFunction(syncManagedContentScripts, 'syncManagedContentScripts');
  const needsBootstrapRefresh = requireFunction(frictionBootstrapCoordinator?.needsRefreshForHost, 'needsRefreshForHost');
  requireFunction(refreshFrictionBootstrapForHostname, 'refreshFrictionBootstrapForHostname');
  const lastStepByHost = new Map();
  let registrationPending = false;

  async function checkCoolingCurveSteps(now) {
    if (!Number.isFinite(now) || now < 0) throw new Error('COOLING_CURVE_REFRESH_NOW_INVALID');
    const inventory = await readInventory({ now, includeGateSessions: false });
    if (!Array.isArray(inventory?.protectedTabs)) throw new Error('COOLING_CURVE_REFRESH_INVENTORY_INVALID');
    const tabsByHost = new Map();
    for (const tab of inventory.protectedTabs) {
      if (!Number.isInteger(tab?.tabId) || tab.tabId < 0 || typeof tab.hostname !== 'string' || !tab.hostname
        || typeof tab.url !== 'string' || !/^https?:\/\//.test(tab.url)) throw new Error('COOLING_CURVE_REFRESH_TAB_INVALID');
      if (!tabsByHost.has(tab.hostname)) tabsByHost.set(tab.hostname, []);
      tabsByHost.get(tab.hostname).push(tab);
    }
    for (const host of lastStepByHost.keys()) if (!tabsByHost.has(host)) lastStepByHost.delete(host);
    const completed = new Map();
    const renewalHosts = [];
    const failures = [];
    for (const [hostname, tabs] of tabsByHost) {
      const signature = requireProjection(await readProjection({ hostname, now }));
      if (lastStepByHost.get(hostname) === signature) {
        const needsRefresh = needsBootstrapRefresh({ hostname, now });
        if (typeof needsRefresh !== 'boolean') throw new Error('COOLING_CURVE_REFRESH_FRESHNESS_RESULT_INVALID');
        if (needsRefresh) {
          registrationPending = true;
          await refreshFrictionBootstrapForHostname({ hostname, now });
          renewalHosts.push(hostname);
        }
        continue;
      }
      const results = await Promise.allSettled(tabs.map(tab => sendProtectionUpdate(tab.tabId, tab.url, { nowOverride: now })));
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.status === 'rejected' || !dispatchSucceeded(result.value)) failures.push(new Error(
          `COOLING_CURVE_REFRESH_DISPATCH_FAILED:${hostname}:${tabs[index].tabId}`,
          { cause: result.status === 'rejected' ? result.reason : result.value },
        ));
      }
      if (results.every(result => result.status === 'fulfilled' && dispatchSucceeded(result.value))) {
        registrationPending = true;
        await refreshFrictionBootstrapForHostname({ hostname, now });
        completed.set(hostname, signature);
      }
    }
    if (registrationPending) {
      // The existing registration tail consumes snapshots written by exact-ACK
      // dispatches. It neither injects open tabs nor adds a new registration lane.
      const registration = await syncManagedContentScripts({ injectOpenTabs: false, reason: 'cooling_curve_steps' });
      if (registration?.hasScripting !== true || !Array.isArray(registration.missingDomains)) {
        throw new Error('COOLING_CURVE_REFRESH_REGISTRATION_FAILED');
      }
      registrationPending = false;
      for (const hostname of tabsByHost.keys()) {
        if (registration.missingDomains.includes(hostname)) {
          registrationPending = true;
          failures.push(new Error(`COOLING_CURVE_REFRESH_PERMISSION_MISSING:${hostname}`));
        }
      }
      for (const [hostname, signature] of completed) {
        if (!registration.missingDomains.includes(hostname)) lastStepByHost.set(hostname, signature);
      }
    }
    if (failures.length) throw new AggregateError(failures, 'COOLING_CURVE_REFRESH_INCOMPLETE');
    return { refreshedHosts: [...completed.keys()], renewalHosts };
  }
  return { checkCoolingCurveSteps };
}
