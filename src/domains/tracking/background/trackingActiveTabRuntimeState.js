import { getHostname } from '../../../lib/index.js';
import {
  createEmptyActiveTabCheckpoint,
  requireActiveTabCheckpointReadResult,
  requireStoredActiveTabCheckpoint,
} from './trackingActiveTabCheckpoint.js';

export function createEmptyActiveTabInfo() {
  return createEmptyActiveTabCheckpoint();
}

function normalizeRuntimeTabId(tabId) {
  if (tabId === null || typeof tabId === 'undefined' || tabId === '') return null;
  const numericTabId = Number(tabId);
  return Number.isInteger(numericTabId) && numericTabId >= 0 ? numericTabId : null;
}

function requireActiveTabSessionStore(sessionStore) {
  if (
    !sessionStore
    || typeof sessionStore.readOptional !== 'function'
    || typeof sessionStore.set !== 'function'
  ) {
    throw new Error('TRACKING_ACTIVE_TAB_STATE_SESSION_STORE_REQUIRED');
  }
  return sessionStore;
}

function requireActiveTabSessionKey(sessionActiveTabKey) {
  if (typeof sessionActiveTabKey !== 'string' || !sessionActiveTabKey.trim()) {
    throw new Error('TRACKING_ACTIVE_TAB_STATE_KEY_REQUIRED');
  }
  return sessionActiveTabKey;
}

function requireActiveTabIdleDetector(idleDetector) {
  if (!idleDetector || typeof idleDetector.isActive !== 'function') {
    throw new Error('TRACKING_ACTIVE_TAB_STATE_IDLE_DETECTOR_REQUIRED');
  }
  return idleDetector;
}

function requireProfileMutationAdmissionOwner(owner) {
  if (
    !owner
    || typeof owner.assertDrainingOrQuiesced !== 'function'
    || typeof owner.assertOpen !== 'function'
    || typeof owner.assertQuiesced !== 'function'
  ) {
    throw new Error('TRACKING_ACTIVE_TAB_PROFILE_MUTATION_ADMISSION_OWNER_REQUIRED');
  }
  return owner;
}

export function createTrackingActiveTabRuntimeState({
  sessionStore,
  sessionActiveTabKey,
  idleDetector,
  queryTabs,
  windowIdNone = -1,
  profileMutationAdmissionOwner,
} = {}) {
  const resolvedSessionStore = requireActiveTabSessionStore(sessionStore);
  const resolvedSessionActiveTabKey = requireActiveTabSessionKey(sessionActiveTabKey);
  const resolvedIdleDetector = requireActiveTabIdleDetector(idleDetector);
  const profileMutationAdmission = requireProfileMutationAdmissionOwner(
    profileMutationAdmissionOwner,
  );
  if (typeof queryTabs !== 'function') {
    throw new Error('TRACKING_ACTIVE_TAB_STATE_QUERY_TABS_REQUIRED');
  }
  let activeTabInfo = createEmptyActiveTabInfo();
  let lastActiveTabId = null;
  let focusedWindowId = null;
  let activeTabRevision = 0;
  let activeTabIdentityEpoch = 0;
  let activeTabCheckpointWriteTail = Promise.resolve();

  const tabEntryTimes = new Map();
  const tabLastActiveAt = new Map();
  const lastDomainUrls = new Map();

  function replaceActiveTabInfo(nextActiveTabInfo, { identityChanged = true } = {}) {
    activeTabInfo = requireStoredActiveTabCheckpoint(nextActiveTabInfo);
    activeTabRevision += 1;
    if (identityChanged) activeTabIdentityEpoch += 1;
    return activeTabInfo;
  }

  const enqueueCheckpointMutation = (task) => {
    profileMutationAdmission.assertOpen();
    const write = task;
    const operation = activeTabCheckpointWriteTail.then(write, write);
    activeTabCheckpointWriteTail = operation.catch(() => undefined);
    return operation;
  };

  function enqueueActiveTabCheckpoint(snapshot) {
    const checkpoint = requireStoredActiveTabCheckpoint(snapshot);
    return enqueueCheckpointMutation(() => resolvedSessionStore.set({
      [resolvedSessionActiveTabKey]: checkpoint,
    }));
  }

  function init() {
    return enqueueCheckpointMutation(async () => {
      const readResult = requireActiveTabCheckpointReadResult(
        await resolvedSessionStore.readOptional(resolvedSessionActiveTabKey),
      );
      if (!readResult.found) return;

      const storedActive = requireStoredActiveTabCheckpoint(readResult.value);
      replaceActiveTabInfo(storedActive);
      if (storedActive.tabId !== null) lastActiveTabId = storedActive.tabId;
    });
  }

  const getActiveTabInfo = () => {
    profileMutationAdmission.assertOpen();
    return { ...activeTabInfo };
  };

  const getLastActiveTabId = () => {
    profileMutationAdmission.assertOpen();
    return lastActiveTabId;
  };

  const getFocusedWindowId = () => {
    profileMutationAdmission.assertOpen();
    return focusedWindowId;
  };

  const setFocusedWindowId = (windowId) => {
    profileMutationAdmission.assertOpen();
    if (focusedWindowId !== windowId) activeTabRevision += 1;
    focusedWindowId = windowId;
  };

  const getTabEntryTime = (tabId) => {
    profileMutationAdmission.assertOpen();
    return tabEntryTimes.get(tabId);
  };

  const setTabEntryTime = (tabId, time) => {
    profileMutationAdmission.assertOpen();
    tabEntryTimes.set(tabId, time);
  };

  function deleteTabEntryTime(tabId) {
    profileMutationAdmission.assertOpen();
    return tabEntryTimes.delete(tabId);
  }

  function setTabLastActiveAt(tabId, time) {
    profileMutationAdmission.assertOpen();
    tabLastActiveAt.set(tabId, time);
  }

  function deleteTabLastActiveAt(tabId) {
    profileMutationAdmission.assertOpen();
    tabLastActiveAt.delete(tabId);
  }

  function getTabLastActiveAt(tabId) {
    profileMutationAdmission.assertOpen();
    return tabLastActiveAt.get(tabId);
  }

  function rememberLastDomainUrl(url) {
    profileMutationAdmission.assertOpen();
    const hostname = getHostname(url);
    if (hostname && url) {
      const existing = lastDomainUrls.get(hostname) || {};
      lastDomainUrls.set(hostname, { ...existing, url });
    }
  }

  function updateDomainCache(hostname, data = {}) {
    profileMutationAdmission.assertOpen();
    if (!hostname) return;
    const existing = lastDomainUrls.get(hostname) || {};
    lastDomainUrls.set(hostname, { ...existing, ...data });
  }

  function getDomainCache(hostname) {
    profileMutationAdmission.assertOpen();
    return lastDomainUrls.get(hostname);
  }

  function getLastDomainUrl(hostname) {
    profileMutationAdmission.assertOpen();
    return lastDomainUrls.get(hostname)?.url || null;
  }

  async function persistActiveTabInfo() {
    profileMutationAdmission.assertOpen();
    const snapshot = requireStoredActiveTabCheckpoint(activeTabInfo);
    await enqueueActiveTabCheckpoint(snapshot);
  }

  async function updateActiveTabInfo(tab, now, { foregroundObserved = false } = {}) {
    profileMutationAdmission.assertOpen();
    if (!tab || !tab.url) {
      replaceActiveTabInfo(createEmptyActiveTabInfo());
      await persistActiveTabInfo();
      return;
    }
    const hostname = getHostname(tab.url);
    const tabId = normalizeRuntimeTabId(tab.id);
    if (!hostname) {
      replaceActiveTabInfo({ tabId, hostname: null, startedAt: null, audible: !!tab.audible });
      await persistActiveTabInfo();
      return;
    }
    const isAudible = typeof tab.audible === 'boolean' ? tab.audible : activeTabInfo?.audible;
    const isUserActive = resolvedIdleDetector.isActive();
    const shouldOpenForegroundSegment = foregroundObserved === true || isUserActive || isAudible;
    replaceActiveTabInfo({
      tabId,
      hostname,
      startedAt: shouldOpenForegroundSegment ? now : null,
      audible: !!isAudible,
    });
    if (tabId !== null) {
      lastActiveTabId = tabId;
      tabLastActiveAt.set(tabId, now);
    }
    await persistActiveTabInfo();
  }

  async function updateUntrackedActiveTabInfo(tab, now = Date.now()) {
    profileMutationAdmission.assertOpen();
    if (!tab) {
      replaceActiveTabInfo(createEmptyActiveTabInfo());
      await persistActiveTabInfo();
      return;
    }

    const tabId = normalizeRuntimeTabId(tab.id);
    replaceActiveTabInfo({
      tabId,
      hostname: null,
      startedAt: null,
      audible: !!tab.audible,
    });
    if (tabId !== null) {
      lastActiveTabId = tabId;
      tabLastActiveAt.set(tabId, now);
    }
    await persistActiveTabInfo();
  }

  async function setActiveTabAudible(isAudible, now = Date.now(), { onAudibleStopWhileIdle = null } = {}) {
    profileMutationAdmission.assertOpen();
    if (!activeTabInfo) return;
    const nextAudible = !!isAudible;
    if (activeTabInfo.audible === nextAudible) return;
    const targetIdentityEpoch = activeTabIdentityEpoch;
    replaceActiveTabInfo({
      ...activeTabInfo,
      audible: nextAudible,
      startedAt: !resolvedIdleDetector.isActive() && nextAudible
        ? now
        : activeTabInfo.startedAt,
    }, { identityChanged: false });

    if (!resolvedIdleDetector.isActive()) {
      if (!nextAudible) {
        if (typeof onAudibleStopWhileIdle === 'function') {
          await onAudibleStopWhileIdle(now);
        }
        profileMutationAdmission.assertOpen();
        if (activeTabIdentityEpoch !== targetIdentityEpoch) return;
        replaceActiveTabInfo({
          ...activeTabInfo,
          startedAt: null,
        }, { identityChanged: false });
      }
    }
    await persistActiveTabInfo();
  }

  async function setActiveTabSegmentStartedAt(startedAt) {
    profileMutationAdmission.assertOpen();
    const nextStartedAt = startedAt === null ? null : startedAt;
    if (activeTabInfo.startedAt === nextStartedAt) return;
    replaceActiveTabInfo({
      ...activeTabInfo,
      startedAt: nextStartedAt,
    }, { identityChanged: false });
    await persistActiveTabInfo();
  }

  async function getActiveTabAudible() {
    profileMutationAdmission.assertOpen();
    if (activeTabInfo && typeof activeTabInfo.audible === 'boolean') return activeTabInfo.audible;
    return false;
  }

  function checkAndResetEntryTime(tabId, now) {
    profileMutationAdmission.assertOpen();
    let isShortDwell = false;
    if (tabEntryTimes.has(tabId)) {
      const stay = now - tabEntryTimes.get(tabId);
      if (stay < 5000) isShortDwell = true;
      tabEntryTimes.delete(tabId);
    }
    return isShortDwell;
  }

  function handleTabClosed(tabId, now) {
    profileMutationAdmission.assertOpen();
    let isShortDwell = false;
    if (tabEntryTimes.has(tabId)) {
      const stay = now - tabEntryTimes.get(tabId);
      if (stay < 5000) isShortDwell = true;
      tabEntryTimes.delete(tabId);
    }
    tabLastActiveAt.delete(tabId);
    return isShortDwell;
  }

  async function buildBackgroundContext(now) {
    profileMutationAdmission.assertOpen();
    const tabs = await queryTabs({});
    profileMutationAdmission.assertOpen();
    if (!Array.isArray(tabs)) throw new Error('TRACKING_BACKGROUND_CONTEXT_TAB_INVENTORY_INVALID');
    const audibleTabs = new Set();
    const idleTabs = new Set();
    const isWindowFocused = focusedWindowId !== null && focusedWindowId !== windowIdNone;

    for (const tab of tabs) {
      const hostname = getHostname(tab.url);
      if (!hostname || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;

      if (tab.audible) audibleTabs.add(hostname);

      const isActive = isWindowFocused && tab.active && tab.windowId === focusedWindowId;
      if (isActive) continue;

      const lastActiveAt = tabLastActiveAt.get(tab.id);
      if (lastActiveAt && now - lastActiveAt >= 30 * 60 * 1000) {
        idleTabs.add(hostname);
      }
    }

    return {
      totalTabs: tabs.length,
      audibleTabs: Array.from(audibleTabs),
      idleTabs: Array.from(idleTabs),
    };
  }

  async function resetState() {
    profileMutationAdmission.assertOpen();
    const resetRevision = activeTabRevision;
    await enqueueActiveTabCheckpoint(createEmptyActiveTabInfo());
    if (activeTabRevision !== resetRevision) return;
    replaceActiveTabInfo(createEmptyActiveTabInfo());
    lastActiveTabId = null;
    focusedWindowId = null;
    tabEntryTimes.clear();
    tabLastActiveAt.clear();
    lastDomainUrls.clear();
  }

  const drainForProfileMutation = async () => {
    profileMutationAdmission.assertDrainingOrQuiesced();
    while (true) {
      const observedTail = activeTabCheckpointWriteTail;
      await observedTail;
      if (observedTail === activeTabCheckpointWriteTail) return;
    }
  };

  const resetForTerminalProfileMutation = async () => {
    profileMutationAdmission.assertQuiesced();
    await drainForProfileMutation();
    replaceActiveTabInfo(createEmptyActiveTabInfo());
    lastActiveTabId = null;
    focusedWindowId = null;
    tabEntryTimes.clear();
    tabLastActiveAt.clear();
    lastDomainUrls.clear();
  };

  return {
    getObservationRevision: () => {
      profileMutationAdmission.assertOpen();
      return activeTabRevision;
    },
    buildBackgroundContext,
    checkAndResetEntryTime,
    deleteTabEntryTime,
    deleteTabLastActiveAt,
    drainForProfileMutation,
    getActiveTabAudible,
    getActiveTabInfo,
    getDomainCache,
    getFocusedWindowId,
    getLastActiveTabId,
    getLastDomainUrl,
    getTabEntryTime,
    getTabLastActiveAt,
    handleTabClosed,
    init,
    persistActiveTabInfo,
    rememberLastDomainUrl,
    resetForTerminalProfileMutation,
    resetState,
    setActiveTabAudible,
    setActiveTabSegmentStartedAt,
    setFocusedWindowId,
    setTabEntryTime,
    setTabLastActiveAt,
    updateActiveTabInfo,
    updateDomainCache,
    updateUntrackedActiveTabInfo,
  };
}
