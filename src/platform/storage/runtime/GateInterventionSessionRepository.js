import { requireShishiConsumptionLevel } from '../../../domains/protection/domain/shishiConsumptionLevel.js';
import GateInterventionSessionStore from '../internal/chrome-storage/session/GateInterventionSessionStore.js';
import { STORAGE_SESSION_KEYS } from '../internal/chrome-storage/storageKeyRegistry.js';

const GATE_INTERSTITIAL_STORAGE_KEY = STORAGE_SESSION_KEYS.GATE_INTERSTITIAL_SESSIONS;
export const GATE_INTERVENTION_SESSION_VERSION = 1;
const GATE_INTERVENTION_SESSION_RECORD_KEYS = Object.freeze([
  'sessionId',
  'tabId',
  'gateKind',
  'interactionId',
  'originalUrl',
  'gatePageUrl',
  'hostname',
  'severity',
  'planLevel',
  'holdDurationMs',
  'holdUntil',
  'issuedAt',
  'activeChildIds',
  'pressureSignals',
  'directTriggers',
  'metrics',
  'protectedTabs',
  'themeId',
  'gatekeeperStyleVariant',
  'gatekeeperCopyVariant',
  'gatekeeperRendererId',
  'gatekeeperInterstitialRendererId',
  'status',
  'resumeRequestedAt',
  'lastUpdatedAt',
]);
const DEFAULT_GATE_INTERSTITIAL_STATE = Object.freeze({
  version: GATE_INTERVENTION_SESSION_VERSION,
  sessionsById: Object.freeze({}),
  sessionIdByTabId: Object.freeze({}),
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isDeepExactMatch(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => isDeepExactMatch(entry, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(right, key)
      && isDeepExactMatch(left[key], right[key])
    ));
}

function normalizeSessionId(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function normalizeTabId(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return fallback;
  return numeric;
}

function normalizeSessionStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'pending' || normalized === 'resuming') return normalized;
  return 'pending';
}

function normalizeTimestamp(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function normalizeProtectedTabs(values = []) {
  if (!Array.isArray(values)) return [];
  const seenTabIds = new Set();
  return values.reduce((acc, entry) => {
    if (!isPlainObject(entry)) return acc;
    const tabId = normalizeTabId(entry.tabId, null);
    const hostname = typeof entry.hostname === 'string' ? entry.hostname.trim().toLowerCase() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    if (tabId === null || seenTabIds.has(tabId) || !hostname || !url) return acc;
    seenTabIds.add(tabId);
    const protectedTab = {
      tabId,
      hostname,
      url,
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      favIconUrl: typeof entry.favIconUrl === 'string' ? entry.favIconUrl.trim() : '',
      active: entry.active === true,
    };
    if (Object.prototype.hasOwnProperty.call(entry, 'windowId')) {
      const windowId = normalizeTabId(entry.windowId, null);
      if (windowId === null) return acc;
      protectedTab.windowId = windowId;
    }
    if (Object.prototype.hasOwnProperty.call(entry, 'index')) {
      const index = normalizeTabId(entry.index, null);
      if (index === null) return acc;
      protectedTab.index = index;
    }
    if (Object.prototype.hasOwnProperty.call(entry, 'openerTabId')) {
      const openerTabId = normalizeTabId(entry.openerTabId, null);
      if (openerTabId === null) return acc;
      protectedTab.openerTabId = openerTabId;
    }
    acc.push(protectedTab);
    return acc;
  }, []);
}

function cloneObject(source = {}) {
  return Object.fromEntries(Object.entries(source));
}

function normalizeSessionRecord(rawValue, sessionIdFallback = '') {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const sessionId = normalizeSessionId(source.sessionId || sessionIdFallback);
  const tabId = normalizeTabId(source.tabId, null);
  const originalUrl = typeof source.originalUrl === 'string' ? source.originalUrl.trim() : '';
  const gatePageUrl = typeof source.gatePageUrl === 'string' ? source.gatePageUrl.trim() : '';
  const hostname = typeof source.hostname === 'string' ? source.hostname.trim().toLowerCase() : '';
  if (!sessionId || tabId === null || !originalUrl || !gatePageUrl || !hostname) return null;
  if (isPlainObject(source.metrics) && Object.hasOwn(source.metrics, 'shishiIntensity')) {
    requireShishiConsumptionLevel(source.metrics.shishiIntensity);
  }

  return {
    sessionId,
    tabId,
    gateKind: typeof source.gateKind === 'string' ? source.gateKind.trim() : '',
    interactionId: typeof source.interactionId === 'string' ? source.interactionId.trim() : '',
    originalUrl,
    gatePageUrl,
    hostname,
    severity: typeof source.severity === 'string' ? source.severity.trim().toLowerCase() : 'mid',
    planLevel: Math.max(1, Math.floor(Number(source.planLevel) || 1)),
    holdDurationMs: Math.max(0, Math.floor(Number(source.holdDurationMs) || 0)),
    holdUntil: normalizeTimestamp(source.holdUntil),
    issuedAt: normalizeTimestamp(source.issuedAt),
    activeChildIds: Array.isArray(source.activeChildIds)
      ? source.activeChildIds
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())
      : [],
    pressureSignals: Array.isArray(source.pressureSignals)
      ? source.pressureSignals
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())
      : [],
    directTriggers: Array.isArray(source.directTriggers)
      ? source.directTriggers
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())
      : [],
    metrics: isPlainObject(source.metrics) ? { ...source.metrics } : {},
    protectedTabs: normalizeProtectedTabs(source.protectedTabs),
    themeId: typeof source.themeId === 'string' ? source.themeId.trim() : '',
    gatekeeperStyleVariant: typeof source.gatekeeperStyleVariant === 'string'
      ? source.gatekeeperStyleVariant.trim()
      : '',
    gatekeeperCopyVariant: typeof source.gatekeeperCopyVariant === 'string'
      ? source.gatekeeperCopyVariant.trim()
      : '',
    gatekeeperRendererId: typeof source.gatekeeperRendererId === 'string'
      ? source.gatekeeperRendererId.trim()
      : '',
    gatekeeperInterstitialRendererId: typeof source.gatekeeperInterstitialRendererId === 'string'
      ? source.gatekeeperInterstitialRendererId.trim()
      : '',
    status: normalizeSessionStatus(source.status),
    resumeRequestedAt: normalizeTimestamp(source.resumeRequestedAt),
    lastUpdatedAt: normalizeTimestamp(source.lastUpdatedAt),
  };
}

function readStoredSessionRecord(rawValue, sessionIdKey) {
  if (!hasExactKeys(rawValue, GATE_INTERVENTION_SESSION_RECORD_KEYS)) {
    throw new Error('GATE_INTERVENTION_SESSION_STORED_RECORD_INVALID');
  }
  const canonical = normalizeSessionRecord(rawValue);
  if (
    !canonical
    || canonical.sessionId !== sessionIdKey
    || !isDeepExactMatch(rawValue, canonical)
  ) {
    throw new Error('GATE_INTERVENTION_SESSION_STORED_RECORD_INVALID');
  }
  return canonical;
}

function normalizeStoredState(rawValue) {
  if (!isPlainObject(rawValue)) {
    throw new Error('GATE_INTERVENTION_STATE_INVALID');
  }
  const source = rawValue;
  if (
    source.version !== GATE_INTERVENTION_SESSION_VERSION
    || Object.keys(source).length !== 3
    || !isPlainObject(source.sessionsById)
    || !isPlainObject(source.sessionIdByTabId)
  ) {
    throw new Error('GATE_INTERVENTION_STATE_CONTRACT_INVALID');
  }
  const sessionsById = source.sessionsById;
  const sessionIdByTabId = source.sessionIdByTabId;
  const normalizedSessionsById = {};
  const normalizedSessionIdByTabId = {};

  Object.entries(sessionsById).forEach(([sessionId, sessionValue]) => {
    const normalizedSession = readStoredSessionRecord(sessionValue, sessionId);
    normalizedSessionsById[normalizedSession.sessionId] = normalizedSession;
    normalizedSessionIdByTabId[String(normalizedSession.tabId)] = normalizedSession.sessionId;
  });

  Object.entries(sessionIdByTabId).forEach(([tabIdKey, sessionIdValue]) => {
    const tabId = normalizeTabId(tabIdKey, null);
    const sessionId = normalizeSessionId(sessionIdValue);
    if (
      tabId === null
      || String(tabId) !== tabIdKey
      || !sessionId
      || sessionIdValue !== sessionId
      || !normalizedSessionsById[sessionId]
      || normalizedSessionsById[sessionId].tabId !== tabId
      || normalizedSessionIdByTabId[tabIdKey] !== sessionId
    ) {
      throw new Error('GATE_INTERVENTION_STATE_INDEX_INVALID');
    }
  });
  if (Object.keys(normalizedSessionIdByTabId).length !== Object.keys(sessionIdByTabId).length) {
    throw new Error('GATE_INTERVENTION_STATE_INDEX_INVALID');
  }

  return {
    version: GATE_INTERVENTION_SESSION_VERSION,
    sessionsById: normalizedSessionsById,
    sessionIdByTabId: normalizedSessionIdByTabId,
  };
}

function cloneState(state = DEFAULT_GATE_INTERSTITIAL_STATE) {
  return {
    version: GATE_INTERVENTION_SESSION_VERSION,
    sessionsById: Object.fromEntries(
      Object.entries(state.sessionsById || {}).map(([sessionId, sessionValue]) => [
        sessionId,
        normalizeSessionRecord(sessionValue, sessionId),
      ]).filter(([, sessionValue]) => !!sessionValue)
    ),
    sessionIdByTabId: cloneObject(state.sessionIdByTabId || {}),
  };
}

function removeSessionFromState(state, sessionId) {
  const nextState = cloneState(state);
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) return nextState;
  const existingSession = nextState.sessionsById[normalizedSessionId] || null;
  if (!existingSession) return nextState;

  delete nextState.sessionsById[normalizedSessionId];
  delete nextState.sessionIdByTabId[String(existingSession.tabId)];
  return nextState;
}

export class GateInterventionSessionRepository {
  static getInstance() {
    if (!GateInterventionSessionRepository.instance) {
      GateInterventionSessionRepository.instance = new GateInterventionSessionRepository();
    }
    return GateInterventionSessionRepository.instance;
  }

  constructor({ gateSessionStore = GateInterventionSessionStore.getInstance() } = {}) {
    this.gateSessionStore = gateSessionStore;
    this.mutationTail = Promise.resolve();
  }

  async readState() {
    const items = await this.gateSessionStore.get({
      [GATE_INTERSTITIAL_STORAGE_KEY]: DEFAULT_GATE_INTERSTITIAL_STATE,
    });
    return normalizeStoredState(items[GATE_INTERSTITIAL_STORAGE_KEY]);
  }

  #enqueueMutation(work) {
    const task = this.mutationTail.then(work);
    this.mutationTail = task.catch(() => undefined);
    return task;
  }

  async #writeOwnedState(nextState) {
    const normalized = normalizeStoredState(nextState);
    await this.gateSessionStore.set({
      [GATE_INTERSTITIAL_STORAGE_KEY]: normalized,
    });
    return cloneState(normalized);
  }

  writeState(nextState) {
    return this.#enqueueMutation(() => this.#writeOwnedState(nextState));
  }

  updateState(updater) {
    // All Gate session mutations share this existing typed owner. In particular,
    // a historical completion marker must not overwrite removal or replacement.
    return this.#enqueueMutation(async () => {
      const currentState = await this.readState();
      const nextState = typeof updater === 'function'
        ? updater(cloneState(currentState))
        : currentState;
      return this.#writeOwnedState(nextState);
    });
  }

  async getSession(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return null;
    const state = await this.readState();
    const session = state.sessionsById[normalizedSessionId] || null;
    return session ? normalizeSessionRecord(session, normalizedSessionId) : null;
  }

  async getSessionByTabId(tabId) {
    const normalizedTabId = normalizeTabId(tabId, null);
    if (normalizedTabId === null) return null;
    const state = await this.readState();
    const sessionId = normalizeSessionId(state.sessionIdByTabId[String(normalizedTabId)]);
    if (!sessionId) return null;
    const session = state.sessionsById[sessionId] || null;
    return session ? normalizeSessionRecord(session, sessionId) : null;
  }

  async upsertSession(session) {
    const normalizedSession = normalizeSessionRecord(session);
    if (!normalizedSession) {
      throw new Error('GATE_INTERVENTION_SESSION_INVALID');
    }

    return this.updateState((state) => {
      let nextState = cloneState(state);
      const existingSessionId = normalizeSessionId(nextState.sessionIdByTabId[String(normalizedSession.tabId)]);
      if (existingSessionId && existingSessionId !== normalizedSession.sessionId) {
        nextState = removeSessionFromState(nextState, existingSessionId);
      }

      nextState.sessionsById[normalizedSession.sessionId] = {
        ...normalizedSession,
        lastUpdatedAt: Date.now(),
      };
      nextState.sessionIdByTabId[String(normalizedSession.tabId)] = normalizedSession.sessionId;
      return nextState;
    });
  }

  async updateSession(sessionId, updater) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId || typeof updater !== 'function') return null;

    let updatedSession = null;
    await this.updateState((state) => {
      const existingSession = state.sessionsById[normalizedSessionId] || null;
      if (!existingSession) return state;
      const candidate = updater(normalizeSessionRecord(existingSession, normalizedSessionId));
      const normalizedCandidate = normalizeSessionRecord(candidate, normalizedSessionId);
      if (!normalizedCandidate) {
        const nextState = removeSessionFromState(state, normalizedSessionId);
        updatedSession = null;
        return nextState;
      }

      const nextState = cloneState(state);
      nextState.sessionsById[normalizedSessionId] = {
        ...normalizedCandidate,
        lastUpdatedAt: Date.now(),
      };
      nextState.sessionIdByTabId[String(normalizedCandidate.tabId)] = normalizedSessionId;
      updatedSession = nextState.sessionsById[normalizedSessionId];
      return nextState;
    });

    return updatedSession ? normalizeSessionRecord(updatedSession, normalizedSessionId) : null;
  }

  async removeSession(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    await this.updateState((state) => removeSessionFromState(state, normalizedSessionId));
  }

  async removeTabSession(tabId) {
    const normalizedTabId = normalizeTabId(tabId, null);
    if (normalizedTabId === null) return;
    await this.updateState((state) => {
      const sessionId = normalizeSessionId(state.sessionIdByTabId[String(normalizedTabId)]);
      if (!sessionId) return state;
      return removeSessionFromState(state, sessionId);
    });
  }

  clearAll() {
    return this.#enqueueMutation(() => this.gateSessionStore.remove([GATE_INTERSTITIAL_STORAGE_KEY]));
  }
}

export default GateInterventionSessionRepository;
