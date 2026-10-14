import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import {
  requireNavigationCheckpointReadResult,
  requireNavigationContinuitySnapshot,
} from './navigationContinuityCheckpoint.js';
import {
  MEDIA_CONTINUITY_WINDOW_MS,
  NEW_TAB_CONTEXT_WINDOW_MS,
  TAB_NAVIGATION_STATE_SCHEMA_VERSION,
  TAB_NAVIGATION_STATE_TTL_MS,
  buildEntryIntent,
  hasActiveMediaSignal,
  normalizeCreatedTabEntry,
  normalizeForegroundScope,
  normalizeHostState,
  normalizeHostname,
  normalizeTabId,
  normalizeTimestamp,
  normalizeTransitionQualifiers,
  normalizeTransitionType,
  normalizeUrlForVisit,
  readLatestPersistedEntries,
  selectCreatedTabEntries,
  selectForegroundEvents,
  selectHostEntries,
  selectRecentNavigationEntries,
} from './navigationContinuityState.js';

const DUPLICATE_TAB_COMPLETE_WINDOW_MS = 3000;
const SESSION_STORE_REQUIRED_ERROR = 'NAVIGATION_CONTINUITY_SESSION_STORE_REQUIRED';
const SESSION_KEY_REQUIRED_ERROR = 'NAVIGATION_CONTINUITY_SESSION_KEY_REQUIRED';

export const NAVIGATION_CONTINUITY_RELATIONS = Object.freeze({
  TAB_CONTEXT_UNAVAILABLE: 'tab_context_unavailable',
  FOREGROUND_INITIAL_ENTRY: 'foreground_initial_entry',
  HOST_CHANGED_ENTRY: 'same_tab_host_changed',
  NEW_TAB_HOST_ENTRY: 'new_tab_host_entry',
  SAME_TAB_SAME_HOST_NAVIGATION: 'same_tab_same_host_navigation',
  SAME_HOST_FOREGROUND: 'same_host_foreground',
  EXISTING_TAB_SAME_HOST_SWITCH: 'existing_tab_same_host_switch',
  EXISTING_TAB_SAME_HOST_RETURN: 'existing_tab_same_host_return',
});

function requireNavigationContinuitySessionStore(sessionStore) {
  if (
    !sessionStore
    || typeof sessionStore.readOptional !== 'function'
    || typeof sessionStore.set !== 'function'
  ) {
    throw new Error(SESSION_STORE_REQUIRED_ERROR);
  }
  return sessionStore;
}

function requireNavigationContinuitySessionKey(sessionKey) {
  if (typeof sessionKey !== 'string' || !sessionKey.trim()) {
    throw new Error(SESSION_KEY_REQUIRED_ERROR);
  }
  return sessionKey;
}

export function createNavigationContinuityService({
  sessionStore,
  sessionKey = STORAGE_SESSION_KEYS.TAB_NAVIGATION_STATE,
} = {}) {
  const resolvedSessionStore = requireNavigationContinuitySessionStore(sessionStore);
  const resolvedSessionKey = requireNavigationContinuitySessionKey(sessionKey);
  const recentlyCreatedTabs = new Map();
  const lastCompletedNavigationByTabId = new Map();
  const lastCommittedNavigationByTabId = new Map();
  const hostStateByHostname = new Map();
  let foregroundScope = normalizeForegroundScope();
  let foregroundEvents = [];
  let stateLoaded = false;
  let stateLoadPromise = null;
  let checkpointWriteTail = Promise.resolve();

  function pruneRecentlyCreatedTabs(now = Date.now()) {
    const timestamp = normalizeTimestamp(now);
    for (const [tabId, entry] of recentlyCreatedTabs.entries()) {
      const createdAt = Number(entry?.createdAt);
      if (!Number.isFinite(createdAt) || timestamp - createdAt > NEW_TAB_CONTEXT_WINDOW_MS) {
        recentlyCreatedTabs.delete(tabId);
      }
    }
  }

  function pruneTabNavigationState(now = Date.now()) {
    const timestamp = normalizeTimestamp(now);
    const prune = (map, key) => {
      for (const [tabId, entry] of map.entries()) {
        const at = Number(entry?.[key]);
        if (!Number.isFinite(at) || timestamp - at > TAB_NAVIGATION_STATE_TTL_MS) {
          map.delete(tabId);
        }
      }
    };
    prune(lastCompletedNavigationByTabId, 'completedAt');
    prune(lastCommittedNavigationByTabId, 'committedAt');
    pruneRecentlyCreatedTabs(timestamp);
    foregroundEvents = selectForegroundEvents(foregroundEvents, timestamp);
  }

  function hydrate(snapshot = null, now = Date.now()) {
    const source = snapshot === null ? null : requireNavigationContinuitySnapshot(snapshot);
    if (!source) {
      pruneTabNavigationState(now);
      return;
    }
    const completedByTabId = readLatestPersistedEntries(source.completed, 'completedAt', now);
    const committedByTabId = readLatestPersistedEntries(source.committed, 'committedAt', now);

    completedByTabId.forEach((entry, tabId) => {
      lastCompletedNavigationByTabId.set(tabId, entry);
    });
    committedByTabId.forEach((entry, tabId) => {
      lastCommittedNavigationByTabId.set(tabId, entry);
    });

    (Array.isArray(source.created) ? source.created : []).forEach((entry) => {
      const tabId = normalizeTabId(entry?.tabId);
      const normalizedEntry = normalizeCreatedTabEntry(entry, now);
      if (tabId !== null && normalizedEntry) {
        recentlyCreatedTabs.set(tabId, normalizedEntry);
      }
    });

    (Array.isArray(source.hosts) ? source.hosts : []).forEach((entry) => {
      const normalizedEntry = normalizeHostState(entry, now);
      if (normalizedEntry.hostname) {
        hostStateByHostname.set(normalizedEntry.hostname, normalizedEntry);
      }
    });

    foregroundScope = normalizeForegroundScope(source.foreground);
    foregroundEvents = selectForegroundEvents(source.foregroundEvents, now);
    pruneTabNavigationState(now);
  }

  function buildSnapshot(now = Date.now()) {
    pruneTabNavigationState(now);
    return {
      schemaVersion: TAB_NAVIGATION_STATE_SCHEMA_VERSION,
      updatedAt: normalizeTimestamp(now),
      completed: selectRecentNavigationEntries(lastCompletedNavigationByTabId, 'completedAt'),
      committed: selectRecentNavigationEntries(lastCommittedNavigationByTabId, 'committedAt'),
      created: selectCreatedTabEntries(recentlyCreatedTabs, now),
      hosts: selectHostEntries(hostStateByHostname, now),
      foreground: normalizeForegroundScope(foregroundScope),
      foregroundEvents: selectForegroundEvents(foregroundEvents, now),
    };
  }

  async function ensureLoaded() {
    if (stateLoaded) return;
    if (stateLoadPromise) {
      await stateLoadPromise;
      return;
    }
    stateLoadPromise = (async () => {
      const result = requireNavigationCheckpointReadResult(
        await resolvedSessionStore.readOptional(resolvedSessionKey),
      );
      const snapshot = result.found
        ? requireNavigationContinuitySnapshot(result.value)
        : null;
      hydrate(snapshot, Date.now());
      stateLoaded = true;
    })();
    try {
      await stateLoadPromise;
    } finally {
      if (!stateLoaded) {
        stateLoadPromise = null;
      }
    }
  }

  function persist(now = Date.now()) {
    const snapshot = requireNavigationContinuitySnapshot(buildSnapshot(now));
    const write = () => resolvedSessionStore.set({
      [resolvedSessionKey]: snapshot,
    });
    const operation = checkpointWriteTail.then(write, write);
    checkpointWriteTail = operation.catch(() => undefined);
    return operation;
  }

  function noteTabCreated({
    tabId,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return null;
    const createdAt = normalizeTimestamp(now);
    recentlyCreatedTabs.set(normalizedTabId, {
      createdAt,
      tabContextConsumed: false,
    });
    pruneRecentlyCreatedTabs(createdAt);
    return { tabId: normalizedTabId, createdAt };
  }

  function isRecentlyCreatedTab({
    tabId,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return false;
    pruneRecentlyCreatedTabs(now);
    const entry = recentlyCreatedTabs.get(normalizedTabId);
    return !!normalizeCreatedTabEntry(entry, now);
  }

  function consumeNewTabSignal({
    tabId,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return false;
    pruneRecentlyCreatedTabs(now);
    const entry = normalizeCreatedTabEntry(recentlyCreatedTabs.get(normalizedTabId), now);
    if (!entry || entry.tabContextConsumed) return false;
    recentlyCreatedTabs.set(normalizedTabId, {
      ...entry,
      tabContextConsumed: true,
    });
    return true;
  }

  function getRecentCommittedNavigation(tabId, {
    hostname,
    url,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return null;
    const committed = lastCommittedNavigationByTabId.get(normalizedTabId);
    if (!committed) return null;
    const timestamp = normalizeTimestamp(now);
    if (!Number.isFinite(Number(committed.committedAt))) return null;
    if (Math.abs(timestamp - Number(committed.committedAt)) > TAB_NAVIGATION_STATE_TTL_MS) return null;
    if (hostname && committed.hostname && committed.hostname !== hostname) return null;
    const normalizedUrl = normalizeUrlForVisit(url);
    if (normalizedUrl && committed.normalizedUrl && committed.normalizedUrl !== normalizedUrl) return null;
    return committed;
  }

  function noteCommittedNavigation(details = {}, {
    hostname,
    url,
    now = Date.now(),
  } = {}) {
    const tabId = normalizeTabId(details?.tabId);
    const normalizedHostname = normalizeHostname(hostname);
    if (tabId === null || !normalizedHostname) return null;
    pruneTabNavigationState(now);
    const entry = {
      tabId,
      hostname: normalizedHostname,
      normalizedUrl: normalizeUrlForVisit(url),
      transitionType: normalizeTransitionType(details.transitionType),
      transitionQualifiers: normalizeTransitionQualifiers(details.transitionQualifiers),
      committedAt: normalizeTimestamp(now),
    };
    lastCommittedNavigationByTabId.set(tabId, entry);
    return { ...entry };
  }

  function resolveTabCompleteVisitIntent({
    tabId,
    hostname,
    url,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    const normalizedHostname = normalizeHostname(hostname);
    if (normalizedTabId === null || !normalizedHostname) {
      return {
        shouldRecordVisit: true,
        reason: 'tab_context_unavailable',
        relation: NAVIGATION_CONTINUITY_RELATIONS.TAB_CONTEXT_UNAVAILABLE,
      };
    }

    pruneTabNavigationState(now);
    const timestamp = normalizeTimestamp(now);
    const normalizedUrl = normalizeUrlForVisit(url);
    const previous = lastCompletedNavigationByTabId.get(normalizedTabId) || null;
    const committed = getRecentCommittedNavigation(normalizedTabId, {
      hostname: normalizedHostname,
      url,
      now: timestamp,
    });
    const transitionType = committed?.transitionType || null;
    let shouldRecordVisit = true;
    let reason = 'domain_entry';

    if (previous?.hostname === normalizedHostname) {
      shouldRecordVisit = false;
      if (transitionType === 'reload') {
        reason = 'same_domain_reload';
      } else if (
        previous.normalizedUrl
        && normalizedUrl
        && previous.normalizedUrl === normalizedUrl
        && timestamp - Number(previous.completedAt) <= DUPLICATE_TAB_COMPLETE_WINDOW_MS
      ) {
        reason = 'duplicate_tab_complete';
      } else if (previous.normalizedUrl && normalizedUrl && previous.normalizedUrl === normalizedUrl) {
        reason = 'same_url_complete';
      } else {
        reason = 'same_tab_same_domain_navigation';
      }
    } else if (previous?.hostname && previous.hostname !== normalizedHostname) {
      reason = 'same_tab_domain_changed';
    }

    lastCompletedNavigationByTabId.set(normalizedTabId, {
      tabId: normalizedTabId,
      hostname: normalizedHostname,
      normalizedUrl,
      completedAt: timestamp,
      visitIntentReason: reason,
    });

    return {
      shouldRecordVisit,
      reason,
      relation: reason,
      previousHostname: previous?.hostname || '',
      normalizedUrl,
    };
  }

  function readHostState(hostname, now = Date.now()) {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname) return null;
    const state = normalizeHostState(hostStateByHostname.get(normalizedHostname), now);
    state.hostname = normalizedHostname;
    return state;
  }

  function writeHostState(hostname, updater, now = Date.now()) {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname || typeof updater !== 'function') return null;
    const previous = readHostState(normalizedHostname, now);
    const next = normalizeHostState(updater(previous) || previous, now);
    next.hostname = normalizedHostname;
    hostStateByHostname.set(normalizedHostname, next);
    return next;
  }

  function noteHostExit(hostname, {
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname) return null;
    return writeHostState(normalizedHostname, (previous) => ({
      ...(previous || {}),
      hostname: normalizedHostname,
      lastExitAt: normalizeTimestamp(now),
    }), now);
  }

  function countInterruptedHosts(hostname, sinceAt = 0, now = Date.now()) {
    const normalizedHostname = normalizeHostname(hostname);
    const startedAt = Math.max(0, Number(sinceAt) || 0);
    if (!normalizedHostname || startedAt <= 0) return 0;
    const interrupted = new Set();
    selectForegroundEvents(foregroundEvents, now).forEach((event) => {
      if (event.at > startedAt && event.hostname && event.hostname !== normalizedHostname) {
        interrupted.add(event.hostname);
      }
    });
    return interrupted.size;
  }

  function countRecentForegroundSwitches(now = Date.now()) {
    return selectForegroundEvents(foregroundEvents, now).length;
  }

  function buildForegroundContinuity({
    hostname = '',
    tabId = null,
    url = '',
    now = Date.now(),
    audible = false,
    eventType = 'foreground_tab',
  } = {}) {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedTabId = normalizeTabId(tabId);
    const normalizedNow = normalizeTimestamp(now);
    const previousScope = normalizeForegroundScope(foregroundScope);
    const previousHostname = previousScope.hostname;
    const previousTabId = previousScope.tabId;

    if (!normalizedHostname) {
      if (previousHostname) {
        noteHostExit(previousHostname, { now: normalizedNow });
      }
      foregroundScope = normalizeForegroundScope();
      return {
        relation: NAVIGATION_CONTINUITY_RELATIONS.TAB_CONTEXT_UNAVAILABLE,
        hostname: '',
        tabId: normalizedTabId,
        previousHostname,
        previousTabId,
        entryIntent: buildEntryIntent(false, NAVIGATION_CONTINUITY_RELATIONS.TAB_CONTEXT_UNAVAILABLE),
      };
    }

    const hostState = readHostState(normalizedHostname, normalizedNow);
    const sameTab = previousTabId !== null
      && normalizedTabId !== null
      && previousTabId === normalizedTabId;
    const sameHost = !!previousHostname && previousHostname === normalizedHostname;
    const changedHost = !!previousHostname && previousHostname !== normalizedHostname;
    const changedTab = sameHost
      && previousTabId !== null
      && normalizedTabId !== null
      && previousTabId !== normalizedTabId;
    const recentCreated = isRecentlyCreatedTab({ tabId: normalizedTabId, now: normalizedNow });
    const hasPriorHostActivity = hostState.lastForegroundAt > 0 || hostState.lastExitAt > 0;
    const awayDurationMs = hostState.lastExitAt > 0 && normalizedNow > hostState.lastExitAt
      ? Math.max(0, normalizedNow - hostState.lastExitAt)
      : 0;
    const audibleNow = audible === true;
    const recentlyAudibleUntil = audibleNow
      ? Math.max(hostState.recentlyAudibleUntil, normalizedNow + MEDIA_CONTINUITY_WINDOW_MS)
      : hostState.recentlyAudibleUntil;
    const recentlyAudible = hasActiveMediaSignal({
      audible: audibleNow,
      recentlyAudibleUntil,
      now: normalizedNow,
    });
    const knownHostSession = hasPriorHostActivity || recentlyAudible;
    const foregroundReturn = !recentCreated
      && knownHostSession
      && (
        (
          hostState.lastExitAt > 0
          && normalizedNow > hostState.lastExitAt
          && (!sameHost || previousScope.activeAt <= hostState.lastExitAt)
        )
        || (!hasPriorHostActivity && recentlyAudible)
      );

    let relation = NAVIGATION_CONTINUITY_RELATIONS.FOREGROUND_INITIAL_ENTRY;
    let shouldRecordEntry = true;

    if (recentCreated) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.NEW_TAB_HOST_ENTRY;
      shouldRecordEntry = true;
    } else if (eventType === 'active_navigation' && sameTab && sameHost) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.SAME_TAB_SAME_HOST_NAVIGATION;
      shouldRecordEntry = false;
    } else if (eventType === 'active_navigation') {
      relation = changedHost
        ? NAVIGATION_CONTINUITY_RELATIONS.HOST_CHANGED_ENTRY
        : NAVIGATION_CONTINUITY_RELATIONS.FOREGROUND_INITIAL_ENTRY;
      shouldRecordEntry = true;
    } else if (foregroundReturn) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.EXISTING_TAB_SAME_HOST_RETURN;
      shouldRecordEntry = false;
    } else if (changedTab) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.EXISTING_TAB_SAME_HOST_SWITCH;
      shouldRecordEntry = false;
    } else if (sameHost) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.SAME_HOST_FOREGROUND;
      shouldRecordEntry = false;
    } else if (changedHost) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.HOST_CHANGED_ENTRY;
      shouldRecordEntry = true;
    } else if (knownHostSession) {
      relation = NAVIGATION_CONTINUITY_RELATIONS.EXISTING_TAB_SAME_HOST_RETURN;
      shouldRecordEntry = false;
    }

    if (changedHost) {
      noteHostExit(previousHostname, { now: normalizedNow });
    }

    const shouldAppendSwitch = !sameTab || changedHost || foregroundReturn || recentCreated || !previousHostname;
    if (shouldAppendSwitch) {
      foregroundEvents = selectForegroundEvents([
        ...foregroundEvents,
        {
          hostname: normalizedHostname,
          tabId: normalizedTabId,
          at: normalizedNow,
        },
      ], normalizedNow);
    }

    const mediaMaintenanceReturn = recentlyAudible
      && !recentCreated
      && (
        foregroundReturn
        || relation === NAVIGATION_CONTINUITY_RELATIONS.EXISTING_TAB_SAME_HOST_SWITCH
        || relation === NAVIGATION_CONTINUITY_RELATIONS.EXISTING_TAB_SAME_HOST_RETURN
      );

    const recentReturnAts = [...(hostState.recentReturnAts || [])];
    if (foregroundReturn) {
      recentReturnAts.push(normalizedNow);
    }
    const recentSwitchAts = [...(hostState.recentSwitchAts || [])];
    if (shouldAppendSwitch) {
      recentSwitchAts.push(normalizedNow);
    }

    writeHostState(normalizedHostname, (previous) => ({
      ...(previous || {}),
      hostname: normalizedHostname,
      lastForegroundAt: normalizedNow,
      lastTabId: normalizedTabId,
      lastUrl: typeof url === 'string' ? url : '',
      recentSwitchAts,
      recentReturnAts,
      recentlyAudibleUntil,
    }), normalizedNow);

    foregroundScope = normalizeForegroundScope({
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      activeAt: normalizedNow,
    });

    return {
      relation,
      eventType,
      at: normalizedNow,
      tabId: normalizedTabId,
      hostname: normalizedHostname,
      url: typeof url === 'string' ? url : '',
      previousHostname,
      previousTabId,
      sameTab,
      sameHost,
      changedHost,
      changedTab,
      foregroundReturn,
      newTabEntry: recentCreated,
      knownHostSession,
      awayDurationMs,
      interruptedHostCount: countInterruptedHosts(normalizedHostname, hostState.lastExitAt || hostState.lastForegroundAt, normalizedNow),
      recentSwitchCount: countRecentForegroundSwitches(normalizedNow),
      audible: audibleNow,
      recentlyAudible,
      recentlyAudibleUntil,
      mediaMaintenanceReturn,
      entryIntent: buildEntryIntent(shouldRecordEntry, relation),
    };
  }

  function noteForegroundTab(input = {}) {
    return buildForegroundContinuity({
      ...input,
      eventType: 'foreground_tab',
    });
  }

  function noteActiveNavigation(input = {}) {
    return buildForegroundContinuity({
      ...input,
      eventType: 'active_navigation',
    });
  }

  function noteForegroundBlur({
    now = Date.now(),
  } = {}) {
    const previousScope = normalizeForegroundScope(foregroundScope);
    if (previousScope.hostname) {
      noteHostExit(previousScope.hostname, { now });
    }
    foregroundScope = normalizeForegroundScope();
    return previousScope;
  }

  function noteTabAudible({
    tabId = null,
    hostname = '',
    audible = false,
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedTabId = normalizeTabId(tabId);
    if (!normalizedHostname) return null;
    const normalizedNow = normalizeTimestamp(now);
    return writeHostState(normalizedHostname, (previous) => ({
      ...(previous || {}),
      hostname: normalizedHostname,
      lastTabId: normalizedTabId ?? previous?.lastTabId ?? null,
      recentlyAudibleUntil: audible === true
        ? Math.max(Number(previous?.recentlyAudibleUntil) || 0, normalizedNow + MEDIA_CONTINUITY_WINDOW_MS)
        : Number(previous?.recentlyAudibleUntil) || 0,
    }), normalizedNow);
  }

  function evictTab({
    tabId,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return false;
    recentlyCreatedTabs.delete(normalizedTabId);
    lastCompletedNavigationByTabId.delete(normalizedTabId);
    lastCommittedNavigationByTabId.delete(normalizedTabId);
    if (foregroundScope.tabId === normalizedTabId) {
      noteForegroundBlur({ now });
    }
    return true;
  }

  return {
    buildSnapshot,
    consumeNewTabSignal,
    ensureLoaded,
    evictTab,
    hydrate,
    isRecentlyCreatedTab,
    noteActiveNavigation,
    noteCommittedNavigation,
    noteForegroundBlur,
    noteForegroundTab,
    noteTabAudible,
    noteTabCreated,
    persist,
    resolveTabCompleteVisitIntent,
  };
}

export const navigationContinuityTestInternals = Object.freeze({
  MEDIA_CONTINUITY_WINDOW_MS,
  NEW_TAB_CONTEXT_WINDOW_MS,
  TAB_NAVIGATION_STATE_TTL_MS,
  normalizeTransitionQualifiers,
  normalizeTransitionType,
  normalizeTimestamp,
});
