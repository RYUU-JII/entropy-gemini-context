import { getHostname } from '../../../lib/index.js';
import { isDataCollectionConsentGranted, shouldCollectDomainUsage } from '../../settings/config/dataCollectionPolicy.js';
import { resolveObservedForegroundTab } from './trackingForegroundObservation.js';

const KEYS = ['observedAt', 'admission', 'foreground', 'protectedMedia', 'idleState'];
export function requireConsumptionEnvironment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== KEYS.length || KEYS.some((key) => !Object.hasOwn(value, key))
    || !Number.isSafeInteger(value.observedAt) || value.observedAt < 0
    || !['enabled', 'disabled'].includes(value.admission)
    || !['protected', 'outside', 'unknown'].includes(value.foreground)
    || !['present', 'absent', 'unknown'].includes(value.protectedMedia)
    || !['active', 'idle', 'locked', 'unknown'].includes(value.idleState)
    || (value.admission === 'disabled' && (value.foreground !== 'unknown'
      || value.protectedMedia !== 'unknown' || value.idleState !== 'unknown'))) {
    throw new Error('TRACKING_CONSUMPTION_ENVIRONMENT_INVALID');
  }
  return value;
}

// Point observation, never elapsed use. Reuses the existing batch's inventory
// plus the existing browser port's window read; lastFocusedWindow is not focus.
export async function buildConsumptionEnvironment({
  ...input
}) {
  return buildBrowserEnvironment(input, true);
}

// The same already-acquired inventory also serves operational entry policy.
// This projection carries no identities/history and is independent of analytics consent.
export async function buildGateEntryPresence(input) {
  const point = await buildBrowserEnvironment(input, false);
  const unfocused = input.focusedWindow?.focused === false;
  const engaged = point.protectedMedia === 'present'
    || (point.foreground === 'protected' && point.idleState !== 'locked');
  const away = point.protectedMedia === 'absent' && (point.foreground === 'outside'
    || unfocused || point.idleState === 'locked');
  return { observedAt: point.observedAt, presence: engaged ? 'engaged' : away ? 'away' : 'unknown' };
}

async function buildBrowserEnvironment({
  tabs, focusedActiveTabs, focusedWindow, now, idleState, settings,
  resolveScope,
}, collectionRequired) {
  if (!Array.isArray(tabs) || !Array.isArray(focusedActiveTabs)) throw new Error('TRACKING_CONSUMPTION_TABS_INVALID');
  if (typeof resolveScope !== 'function') throw new Error('TRACKING_CONSUMPTION_SCOPE_OWNER_REQUIRED');
  const snapshot = {
    observedAt: now,
    admission: !collectionRequired || isDataCollectionConsentGranted(settings) ? 'enabled' : 'disabled',
    foreground: 'unknown', protectedMedia: 'unknown', idleState: 'unknown',
  };
  if (snapshot.admission === 'disabled') return requireConsumptionEnvironment(snapshot);
  if (!['active', 'idle', 'locked'].includes(idleState)) throw new Error('TRACKING_CONSUMPTION_IDLE_INVALID');
  snapshot.idleState = idleState;
  const scopeByHost = new Map();
  async function classify(tab) {
    const url = typeof tab?.url === 'string' ? tab.url : '';
    if (!/^https?:\/\//.test(url)) return 'unknown';
    const hostname = getHostname(url);
    if (!hostname || (collectionRequired && !shouldCollectDomainUsage(hostname, settings))) return 'unknown';
    if (tab.pendingUrl && getHostname(tab.pendingUrl) !== hostname) return 'unknown';
    if (!scopeByHost.has(hostname)) {
      const scope = await resolveScope({ hostname, settings, now });
      if (!scope || typeof scope.ok !== 'boolean' || typeof scope.isBlockedDomain !== 'boolean') {
        throw new Error('TRACKING_CONSUMPTION_SCOPE_INVALID');
      }
      scopeByHost.set(hostname, !scope.ok ? 'unknown' : scope.isBlockedDomain ? 'protected' : 'outside');
    }
    return scopeByHost.get(hostname);
  }

  const foregroundTab = resolveObservedForegroundTab({ tabs, focusedActiveTabs, focusedWindow });
  if (foregroundTab !== null) snapshot.foreground = await classify(foregroundTab);

  let unknownMedia = false;
  let presentMedia = false;
  for (const tab of tabs) {
    if (tab?.audible === false) continue;
    if (tab?.audible !== true) { unknownMedia = true; continue; }
    const scope = await classify(tab);
    if (scope === 'protected') presentMedia = true;
    if (scope === 'unknown') unknownMedia = true;
  }
  snapshot.protectedMedia = presentMedia ? 'present' : unknownMedia ? 'unknown' : 'absent';
  return requireConsumptionEnvironment(snapshot);
}
