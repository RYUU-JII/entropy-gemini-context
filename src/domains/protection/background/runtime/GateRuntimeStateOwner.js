import { GateEntryApprovalRepository } from '../../../../platform/storage/runtime/GateEntryApprovalRepository.js';
import { GateReturnLockRepository } from '../../../../platform/storage/runtime/GateReturnLockRepository.js';
import { approveGateEntry, createGateEntryApproval, observeGateEntryApproval } from './gateEntryApprovalPolicy.js';
import {
  createGateReturnLockState,
  observeGateReturnSitePresence,
  resolveGateReturnLock,
  resolveGateReturnSiteKey,
} from './gateReturnLockPolicy.js';
import {
  extendTimeWindowUntil,
  normalizeTimeWindowTimestamp,
  resolveTimeWindowUntil,
} from '../../../../lib/timeWindow.js';
import {
  createGateInterventionPassLedger,
} from './gateInterventionPassLedger.js';
import { resolveGateDecisionPassGrants } from './gateInterventionPassPolicy.js';

const GATE_EVENT_WINDOW_MS = 5 * 60_000;
const GATE_EVENT_LIMIT = 24;
export const GATE_KIND_IDS = Object.freeze([
  'entryCheckpoint',
  'returnGuard',
  'detourSpreadGuard',
]);
const GATE_KIND_SET = new Set(GATE_KIND_IDS);

const EMPTY_GATE_FOREGROUND_SCOPE = Object.freeze({
  hostname: '',
  tabId: null,
  activeAt: 0,
});

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeTabId(tabId, fallback = null) {
  return typeof tabId === 'number' && Number.isInteger(tabId) && tabId >= 0
    ? tabId : fallback;
}

function normalizeRuntimeNonNegativeMs(value, fallback = 0) {
  return normalizeTimeWindowTimestamp(value, fallback);
}

function normalizeRuntimeNowMs(now = Date.now()) {
  const numeric = Number(now);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return normalizeRuntimeNonNegativeMs(Date.now());
  }
  return normalizeRuntimeNonNegativeMs(numeric);
}

function normalizeGateEventTimes(eventTimes = [], now = Date.now()) {
  const normalizedNow = normalizeRuntimeNowMs(now);
  return (Array.isArray(eventTimes) ? eventTimes : [])
    .map((value) => normalizeRuntimeNonNegativeMs(value))
    .filter((value) => value > 0 && normalizedNow - value <= GATE_EVENT_WINDOW_MS)
    .slice(-GATE_EVENT_LIMIT);
}

function createEmptyGateHostState(hostname) {
  return {
    hostname,
    lastEnteredAt: 0,
    lastExitAt: 0,
    lastReturnAt: 0,
    lastTabId: null,
    recentSwitchInAts: [],
    lastContinueAt: 0,
    lastContinueKind: '',
    lastDecisionAt: 0,
    lastDecisionKind: '',
    lastDecisionOutcome: '',
    lastContinuityRelation: '',
    lastContinuityAt: 0,
    mediaMaintenanceUntil: 0,
    lastMediaMaintenanceReturnAt: 0,
    lastInterventionShownAt: 0,
    lastInterventionShownKind: '',
  };
}

function normalizeGateHostState(snapshot = null, now = Date.now()) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    hostname: normalizeHost(source.hostname || ''),
    lastEnteredAt: normalizeRuntimeNonNegativeMs(source.lastEnteredAt),
    lastExitAt: normalizeRuntimeNonNegativeMs(source.lastExitAt),
    lastReturnAt: normalizeRuntimeNonNegativeMs(source.lastReturnAt),
    lastTabId: normalizeTabId(source.lastTabId, null),
    recentSwitchInAts: normalizeGateEventTimes(source.recentSwitchInAts, now),
    lastContinueAt: normalizeRuntimeNonNegativeMs(source.lastContinueAt),
    lastContinueKind: GATE_KIND_SET.has(source.lastContinueKind) ? source.lastContinueKind : '',
    lastDecisionAt: normalizeRuntimeNonNegativeMs(source.lastDecisionAt),
    lastDecisionKind: GATE_KIND_SET.has(source.lastDecisionKind) ? source.lastDecisionKind : '',
    lastDecisionOutcome: source.lastDecisionOutcome === 'leave' ? 'leave' : (
      source.lastDecisionOutcome === 'continue' ? 'continue' : ''
    ),
    lastContinuityRelation: typeof source.lastContinuityRelation === 'string'
      ? source.lastContinuityRelation
      : '',
    lastContinuityAt: normalizeRuntimeNonNegativeMs(source.lastContinuityAt),
    mediaMaintenanceUntil: normalizeTimeWindowTimestamp(source.mediaMaintenanceUntil),
    lastMediaMaintenanceReturnAt: normalizeRuntimeNonNegativeMs(source.lastMediaMaintenanceReturnAt),
    lastInterventionShownAt: normalizeRuntimeNonNegativeMs(source.lastInterventionShownAt),
    lastInterventionShownKind: GATE_KIND_SET.has(source.lastInterventionShownKind) ? source.lastInterventionShownKind : '',
  };
}

function cloneGateHostState(state) {
  if (!state) return null;
  return {
    ...state,
    recentSwitchInAts: [...state.recentSwitchInAts],
  };
}

function normalizeGateForegroundScope(scope = null) {
  const source = scope && typeof scope === 'object' ? scope : {};
  return {
    hostname: normalizeHost(source.hostname || ''),
    tabId: normalizeTabId(source.tabId, null),
    activeAt: normalizeRuntimeNonNegativeMs(source.activeAt),
  };
}

function isReturningToKnownGateHostSession(previousState = null, tabId = null) {
  if (!previousState?.hostname || normalizeTabId(tabId) === null) return false;
  return previousState.lastTabId === tabId
    && previousState.lastEnteredAt > 0
    && previousState.lastExitAt > previousState.lastEnteredAt;
}

function normalizeGateContinuityFacts({
  continuity = null,
  hostname = '',
  tabId = null,
} = {}) {
  if (!continuity || typeof continuity !== 'object') return null;
  const normalizedHostname = normalizeHost(hostname);
  const continuityHostname = normalizeHost(continuity.hostname);
  if (!continuityHostname) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:hostname');
  }
  if (!normalizedHostname || normalizedHostname !== continuityHostname) return null;
  const normalizedTabId = normalizeTabId(tabId, null);
  const continuityTabId = normalizeTabId(continuity.tabId, null);
  if (normalizedTabId !== null && continuityTabId === null) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:tabId');
  }
  if (normalizedTabId !== null && continuityTabId !== null && normalizedTabId !== continuityTabId) {
    return null;
  }
  const relation = typeof continuity.relation === 'string' && continuity.relation.trim()
    ? continuity.relation.trim()
    : null;
  if (!relation) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:relation');
  }
  if (typeof continuity.entryIntent?.shouldRecordEntry !== 'boolean') {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:entryIntent');
  }
  const continuityAt = normalizeRuntimeNonNegativeMs(continuity.at);
  if (!Number.isFinite(continuityAt) || continuityAt <= 0) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:at');
  }
  const hasMediaMaintenanceReturn = Object.prototype.hasOwnProperty.call(
    continuity,
    'mediaMaintenanceReturn',
  );
  if (hasMediaMaintenanceReturn && typeof continuity.mediaMaintenanceReturn !== 'boolean') {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:mediaMaintenanceReturn');
  }
  const hasRecentlyAudibleUntil = Object.prototype.hasOwnProperty.call(
    continuity,
    'recentlyAudibleUntil',
  );
  const rawRecentlyAudibleUntil = hasRecentlyAudibleUntil
    ? Number(continuity.recentlyAudibleUntil)
    : 0;
  if (
    hasRecentlyAudibleUntil
    && (!Number.isFinite(rawRecentlyAudibleUntil) || rawRecentlyAudibleUntil < 0)
  ) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:recentlyAudibleUntil');
  }
  const recentlyAudibleUntil = hasRecentlyAudibleUntil
    ? Math.floor(rawRecentlyAudibleUntil)
    : 0;
  const mediaMaintenanceReturn = continuity.mediaMaintenanceReturn === true;
  if (mediaMaintenanceReturn && recentlyAudibleUntil <= 0) {
    throw new Error('PROTECTION_GATE_CONTINUITY_FACTS_INVALID:recentlyAudibleUntil');
  }

  return {
    relation,
    entryIntentShouldRecord: continuity.entryIntent.shouldRecordEntry,
    mediaMaintenanceReturn,
    recentlyAudibleUntil,
    at: continuityAt,
  };
}

function resolveContinuityEntryIntent(continuityFacts, fallback) {
  return typeof continuityFacts?.entryIntentShouldRecord === 'boolean'
    ? continuityFacts.entryIntentShouldRecord
    : fallback;
}

function resolveContinuityPatch(continuityFacts, previousState = null, normalizedNow = Date.now()) {
  if (!continuityFacts) return {};
  const mediaMaintenanceUntil = Math.max(
    normalizeTimeWindowTimestamp(previousState?.mediaMaintenanceUntil),
    normalizeTimeWindowTimestamp(continuityFacts.recentlyAudibleUntil),
  );
  const patch = {
    lastContinuityRelation: continuityFacts.relation,
    lastContinuityAt: continuityFacts.at || normalizedNow,
  };
  if (mediaMaintenanceUntil > 0) {
    patch.mediaMaintenanceUntil = mediaMaintenanceUntil;
  }
  if (continuityFacts.mediaMaintenanceReturn && mediaMaintenanceUntil > normalizedNow) {
    patch.lastMediaMaintenanceReturnAt = normalizedNow;
  }
  return patch;
}

export function createGateRuntimeStateOwner({
  entryApprovalRepository = new GateEntryApprovalRepository(),
  returnLockRepository = new GateReturnLockRepository(),
} = {}) {
  const gateStateByHost = new Map();
  let returnLockTail = Promise.resolve();
  function withReturnLock(work) {
    const pending = returnLockTail.then(async () => {
      const stored = await returnLockRepository.read();
      return work(stored.found ? stored.value : null);
    });
    // Only the queue tail absorbs rejection; the caller receives every failure.
    returnLockTail = pending.then(() => undefined, () => undefined);
    return pending;
  }
  /**
   * Folds the sites that have a real tab open into the return lock.
   * `hostnames` are the protected hosts of real (non-Gate) tabs. With the
   * return lock off nothing is tracked and held state is dropped, so turning it
   * on later starts from whatever is open then.
   */
  function observeGateSitePresence({ hostnames, observedAt, enabled }) {
    if (!Array.isArray(hostnames) || typeof enabled !== 'boolean') {
      throw new Error('GATE_RETURN_LOCK_PRESENCE_INVALID');
    }
    return withReturnLock(async (stored) => {
      if (!enabled) {
        if (stored) await returnLockRepository.write(createGateReturnLockState());
        return { outcome: 'disabled' };
      }
      const previous = stored || createGateReturnLockState();
      const siteKeys = [...new Set(hostnames.map(resolveGateReturnSiteKey).filter(Boolean))];
      const next = observeGateReturnSitePresence(previous, { siteKeys, observedAt });
      if (next === previous) return { outcome: 'stale' };
      await returnLockRepository.write(next);
      return { outcome: 'observed', lockedSiteKeys: Object.keys(next.locks) };
    });
  }
  function getGateReturnLock({ hostname, now }) {
    return withReturnLock((stored) => resolveGateReturnLock(
      stored || createGateReturnLockState(),
      resolveGateReturnSiteKey(hostname),
      now,
    ));
  }
  let approvalTail = Promise.resolve();
  function withEntryApproval(work) {
    const pending = approvalTail.then(async () => {
      const stored = await entryApprovalRepository.read();
      const previous = stored.found ? stored.value : createGateEntryApproval();
      return work(previous);
    });
    // Only the queue tail absorbs rejection; the caller receives every failure.
    approvalTail = pending.then(() => undefined, () => undefined);
    return pending;
  }
  function getGateEntryApproval() {
    return withEntryApproval((previous) => ({ ...previous }));
  }
  // Exact-run cleanup for the trusted dev QA route; never a production rearm path.
  function releaseGateEntryApprovalForQa({ sessionId }) {
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('GATE_ENTRY_QA_SESSION_REQUIRED');
    return withEntryApproval(async (previous) => {
      if (previous.sessionId !== sessionId) return { released: false, reason: 'different_session' };
      await entryApprovalRepository.write({ ...previous, approved: false, awaySince: null });
      return { released: true };
    });
  }
  function observeGateEntryPresence({ point, isCurrent }) {
    if (typeof isCurrent !== 'function') throw new Error('GATE_ENTRY_OBSERVATION_AUTHORITY_REQUIRED');
    return withEntryApproval(async (previous) => {
      if (!isCurrent()) return { outcome: 'stale' };
      const next = observeGateEntryApproval(previous, point);
      if (next === previous) return { outcome: 'stale' };
      if (previous.approved) await entryApprovalRepository.write(next);
      if (!isCurrent()) {
        // Browser/settings ingress invalidated the sample during persistence.
        // Restore under the same lane before any reader or newer event runs.
        if (previous.approved) await entryApprovalRepository.write(previous);
        return { outcome: 'stale' };
      }
      return { outcome: 'observed', approved: next.approved };
    });
  }
  const gatePassLedger = createGateInterventionPassLedger({ gateKinds: ['entryCheckpoint'] });
  let gateForegroundScope = EMPTY_GATE_FOREGROUND_SCOPE;
  // The spread guard wears two faces and they are owed different debts, so the
  // levels they have settled are tracked apart:
  //
  //   noticed  - the level the user has been *told* about. The corner notice
  //              arrives uninvited, so it must not re-announce a spread it has
  //              already announced.
  //   reviewed - the level the user has actually *dealt with*, by resolving the
  //              gate. Only that silences the review gate, because being shown
  //              a notice is not the same as having handled anything.
  //
  // Being told is implied by having reviewed, so a decision raises both. Both
  // are browser-wide, like the protected-tab count they track, and neither is a
  // clock: a new spread is new whether it happened a second or an hour later.
  let detourSpreadNoticedCount = 0;
  let detourSpreadReviewedCount = 0;
  // Membership is evidence from the last canonical inventory, not another tab
  // query owner. It lets an exact removal lower the settled level even when a
  // new tab restores the count before the next protection snapshot.
  let observedProtectedTabIds = null;

  function readGateHostState(hostname, now = Date.now()) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;

    const normalizedState = normalizeGateHostState(
      gateStateByHost.get(normalizedHostname),
      now,
    );
    if (!normalizedState.hostname) {
      return createEmptyGateHostState(normalizedHostname);
    }
    gateStateByHost.set(normalizedHostname, normalizedState);
    return normalizedState;
  }

  function writeGateHostState(hostname, updater, now = Date.now()) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname || typeof updater !== 'function') return null;

    const previousState = readGateHostState(normalizedHostname, now);
    const nextState = normalizeGateHostState(
      updater(previousState || null) || previousState,
      now,
    );
    nextState.hostname = normalizedHostname;
    gateStateByHost.set(normalizedHostname, nextState);
    return cloneGateHostState(nextState);
  }

  function noteGateHostExit(hostname, {
    now = Date.now(),
    tabId = null,
    activeAt = 0,
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;
    const normalizedNow = normalizeRuntimeNowMs(now);
    return writeGateHostState(normalizedHostname, (previousState) => ({
      ...(previousState || {}),
      hostname: normalizedHostname,
      lastExitAt: normalizedNow,
    }), normalizedNow);
  }

  // A foreground return to a host is an entry boundary for the entry
  // checkpoint. It is not the return lock, which follows whole-site departure.
  function resolveGateReturnPatch(previousState, normalizedNow) {
    const lastExitAt = normalizeRuntimeNonNegativeMs(previousState?.lastExitAt);
    return lastExitAt > 0 && normalizedNow > lastExitAt ? { lastReturnAt: normalizedNow } : {};
  }

  function noteGateForegroundTab({
    hostname = '',
    tabId = null,
    now = Date.now(),
    continuity = null,
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    const normalizedTabId = normalizeTabId(tabId, null);
    const normalizedNow = normalizeRuntimeNowMs(now);
    const previousScope = normalizeGateForegroundScope(gateForegroundScope);
    if (!normalizedHostname) {
      if (previousScope.hostname) {
        noteGateHostExit(previousScope.hostname, {
          now: normalizedNow,
          tabId: previousScope.tabId,
          activeAt: previousScope.activeAt,
        });
      }
      gateForegroundScope = EMPTY_GATE_FOREGROUND_SCOPE;
      return null;
    }

    const changedHost = !!previousScope.hostname && previousScope.hostname !== normalizedHostname;
    const changedTab = previousScope.hostname === normalizedHostname
      && previousScope.tabId !== null
      && normalizedTabId !== null
      && previousScope.tabId !== normalizedTabId;
    const continuityFacts = normalizeGateContinuityFacts({
      continuity,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
    });

    if (previousScope.hostname && changedHost) {
      noteGateHostExit(previousScope.hostname, {
        now: normalizedNow,
        tabId: previousScope.tabId,
        activeAt: previousScope.activeAt,
      });
    }

    const nextState = writeGateHostState(normalizedHostname, (previousState) => {
      const switchInTimes = [...(previousState?.recentSwitchInAts || [])];
      const returnPatch = (!previousScope.hostname || changedHost)
        ? resolveGateReturnPatch(previousState, normalizedNow)
        : {};
      const fallbackShouldRecordEntry = changedHost || changedTab || (
        !previousScope.hostname
        && !isReturningToKnownGateHostSession(previousState, normalizedTabId)
      );
      const shouldRecordEntry = resolveContinuityEntryIntent(
        continuityFacts,
        fallbackShouldRecordEntry,
      );
      const continuityPatch = resolveContinuityPatch(
        continuityFacts,
        previousState,
        normalizedNow,
      );
      if (shouldRecordEntry) {
        switchInTimes.push(normalizedNow);
      }

      return {
        ...(previousState || {}),
        ...returnPatch,
        ...continuityPatch,
        hostname: normalizedHostname,
        lastEnteredAt: shouldRecordEntry
          ? normalizedNow
          : normalizeRuntimeNonNegativeMs(previousState?.lastEnteredAt),
        lastTabId: normalizedTabId,
        recentSwitchInAts: switchInTimes,
      };
    }, normalizedNow);

    gateForegroundScope = normalizeGateForegroundScope({
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      activeAt: normalizedNow,
    });
    return nextState;
  }

  function noteGateActiveNavigation({
    hostname = '',
    tabId = null,
    now = Date.now(),
    continuity = null,
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    const normalizedTabId = normalizeTabId(tabId, null);
    const normalizedNow = normalizeRuntimeNowMs(now);
    const previousScope = normalizeGateForegroundScope(gateForegroundScope);

    if (!normalizedHostname) {
      if (previousScope.hostname) {
        noteGateHostExit(previousScope.hostname, {
          now: normalizedNow,
          tabId: previousScope.tabId,
          activeAt: previousScope.activeAt,
        });
      }
      gateForegroundScope = EMPTY_GATE_FOREGROUND_SCOPE;
      return null;
    }

    const sameForegroundTab = previousScope.tabId !== null
      && normalizedTabId !== null
      && previousScope.tabId === normalizedTabId;
    const crossedWebHosts = sameForegroundTab
      && !!previousScope.hostname
      && previousScope.hostname !== normalizedHostname;
    const continuityFacts = normalizeGateContinuityFacts({
      continuity,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
    });

    if (crossedWebHosts) {
      noteGateHostExit(previousScope.hostname, {
        now: normalizedNow,
        tabId: previousScope.tabId,
        activeAt: previousScope.activeAt,
      });
    }

    const nextState = writeGateHostState(normalizedHostname, (previousState) => {
      const switchInTimes = [...(previousState?.recentSwitchInAts || [])];
      const changedHost = !!previousScope.hostname && previousScope.hostname !== normalizedHostname;
      const changedTab = previousScope.hostname === normalizedHostname
        && previousScope.tabId !== null
        && normalizedTabId !== null
        && previousScope.tabId !== normalizedTabId;
      const fallbackShouldRecordEntry = changedHost || changedTab || (
        !previousScope.hostname
        && !isReturningToKnownGateHostSession(previousState, normalizedTabId)
      );
      const shouldRecordEntry = resolveContinuityEntryIntent(
        continuityFacts,
        fallbackShouldRecordEntry,
      );

      if (shouldRecordEntry) {
        switchInTimes.push(normalizedNow);
      }

      const returnPatch = (!previousScope.hostname || crossedWebHosts)
        ? resolveGateReturnPatch(previousState, normalizedNow)
        : {};
      const continuityPatch = resolveContinuityPatch(
        continuityFacts,
        previousState,
        normalizedNow,
      );

      return {
        ...(previousState || {}),
        ...returnPatch,
        ...continuityPatch,
        hostname: normalizedHostname,
        lastEnteredAt: shouldRecordEntry
          ? normalizedNow
          : normalizeRuntimeNonNegativeMs(previousState?.lastEnteredAt),
        lastTabId: normalizedTabId,
        recentSwitchInAts: switchInTimes,
      };
    }, normalizedNow);

    gateForegroundScope = normalizeGateForegroundScope({
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      activeAt: normalizedNow,
    });
    return nextState;
  }

  function noteGateForegroundBlur({
    now = Date.now(),
  } = {}) {
    const previousScope = normalizeGateForegroundScope(gateForegroundScope);
    if (previousScope.hostname) {
      noteGateHostExit(previousScope.hostname, {
        now,
        tabId: previousScope.tabId,
        activeAt: previousScope.activeAt,
      });
    }
    gateForegroundScope = EMPTY_GATE_FOREGROUND_SCOPE;
    return previousScope;
  }

  function noteGateTabClosed({
    tabId = null,
    now = Date.now(),
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId, null);
    if (normalizedTabId === null) return null;
    gatePassLedger.evictTab(normalizedTabId);
    if (observedProtectedTabIds?.delete(normalizedTabId)) {
      detourSpreadNoticedCount = Math.min(detourSpreadNoticedCount, observedProtectedTabIds.size);
      detourSpreadReviewedCount = Math.min(detourSpreadReviewedCount, observedProtectedTabIds.size);
    }
    const previousScope = normalizeGateForegroundScope(gateForegroundScope);
    if (previousScope.tabId !== normalizedTabId) return null;
    return noteGateForegroundBlur({ now });
  }

  async function applyGateInterventionDecision({
    hostname = '',
    gateKind = '',
    decision = 'continue',
    tabId = null,
    protectedTabCount = null,
    sessionId,
    manual = false,
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    const normalizedKind = GATE_KIND_SET.has(gateKind) ? gateKind : '';
    const normalizedDecision = decision === 'leave' ? 'leave' : 'continue';
    const normalizedNow = normalizeRuntimeNowMs(now);
    if (!normalizedHostname || !normalizedKind) {
      return { state: null, grantedPasses: [] };
    }

    // Only the entry checkpoint is an entry decision. Continuing past an
    // expired return lock just lets the site be judged again, so it neither
    // grants nor renews approval.
    if (!manual && normalizedDecision === 'continue' && normalizedKind === 'entryCheckpoint') {
      await withEntryApproval(async (previous) => {
        const next = approveGateEntry(previous, { sessionId, now: normalizedNow });
        await entryApprovalRepository.write(next);
      });
    }

    const state = writeGateHostState(normalizedHostname, (previousState) => {
      const nextState = {
        ...(previousState || {}),
        hostname: normalizedHostname,
        lastDecisionAt: normalizedNow,
        lastDecisionKind: normalizedKind,
        lastDecisionOutcome: normalizedDecision,
      };

      if (normalizedDecision !== 'continue') return nextState;

      nextState.lastContinueAt = normalizedNow;
      nextState.lastContinueKind = normalizedKind;

      return nextState;
    }, normalizedNow);

    // Every pass this decision pre-authorizes comes from one declared rule set,
    // so "which gate did this decision cover, and how far" is answerable in one
    // place instead of being spread across per-kind branches.
    if (normalizedKind === 'detourSpreadGuard' && Number.isInteger(protectedTabCount)) {
      // The spread has now been handled, not merely announced. Being told is
      // implied by having reviewed, so the notice level moves up with it and
      // the two can never cross.
      detourSpreadReviewedCount = Math.max(detourSpreadReviewedCount, protectedTabCount);
      detourSpreadNoticedCount = Math.max(detourSpreadNoticedCount, protectedTabCount);
    }

    const grantedPasses = resolveGateDecisionPassGrants({
      gateKind: normalizedKind,
      decision: normalizedDecision,
      hostname: normalizedHostname,
      tabId,
      now: normalizedNow,
    }).map((pass) => {
      gatePassLedger.grant({ ...pass, now: normalizedNow });
      return pass;
    });

    return { state, grantedPasses };
  }

  function recordGateInterventionShown({
    hostname = '',
    gateKind = '',
    protectedTabCount = null,
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    const normalizedKind = GATE_KIND_SET.has(gateKind) ? gateKind : '';
    const normalizedNow = normalizeRuntimeNowMs(now);
    if (!normalizedHostname || !normalizedKind) return null;

    if (normalizedKind === 'detourSpreadGuard') {
      // Presenting settles what the user has been told, and nothing more. The
      // review gate is still owed, which is why this does not touch the
      // reviewed level: ignoring a notice and then opening one of the spread
      // tabs must still meet the gate.
      if (!Number.isInteger(protectedTabCount) || protectedTabCount < 0) {
        throw new Error('GATE_RUNTIME_DETOUR_SPREAD_LEVEL_REQUIRED');
      }
      detourSpreadNoticedCount = Math.max(detourSpreadNoticedCount, protectedTabCount);
    }

    return writeGateHostState(normalizedHostname, (previousState) => ({
      ...(previousState || {}),
      hostname: normalizedHostname,
      lastInterventionShownAt: normalizedNow,
      lastInterventionShownKind: normalizedKind,
    }), normalizedNow);
  }

  function getGateHostSnapshot({
    hostname = '',
    tabId = null,
    now = Date.now(),
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;

    const normalizedNow = normalizeRuntimeNowMs(now);
    const state = readGateHostState(normalizedHostname, normalizedNow);
    const foregroundScope = normalizeGateForegroundScope(gateForegroundScope);
    // Only the tab explicitly kept during detour review receives a timed pass.
    const passSnapshot = gatePassLedger.snapshotFor({
      hostname: normalizedHostname,
      tabId,
      now: normalizedNow,
    });

    return {
      ...cloneGateHostState(state || createEmptyGateHostState(normalizedHostname)),
      keptTabPassUntil: passSnapshot.entryCheckpoint,
      isForeground: foregroundScope.hostname === normalizedHostname,
      foregroundTabId: foregroundScope.hostname === normalizedHostname ? foregroundScope.tabId : null,
      foregroundActiveAt: foregroundScope.hostname === normalizedHostname ? foregroundScope.activeAt : 0,
    };
  }

  /**
   * Reconciles both settled levels with the level actually present. Neither can
   * sit above the current count, so closing tabs by any route - the gate, the
   * tab strip, evaporation - re-arms the guard for the next rise. Exact removal
   * also updates the last observed membership between inventory reads.
   */
  function observeGateDetourSpreadLevel({
    protectedTabCount,
    protectedTabIds,
  } = {}) {
    if (!Number.isInteger(protectedTabCount) || protectedTabCount < 0
      || !Array.isArray(protectedTabIds) || protectedTabIds.length !== protectedTabCount
      || protectedTabIds.some((tabId) => normalizeTabId(tabId) === null)
      || new Set(protectedTabIds).size !== protectedTabCount) {
      throw new Error('GATE_RUNTIME_DETOUR_SPREAD_INVENTORY_INVALID');
    }
    // Equal totals can conceal a removed/outside tab plus a newly opened tab.
    // Only retained membership still belongs to the previously settled spread.
    const retainedCount = observedProtectedTabIds === null
      ? protectedTabCount
      : protectedTabIds.filter((tabId) => observedProtectedTabIds.has(tabId)).length;
    observedProtectedTabIds = new Set(protectedTabIds);
    detourSpreadNoticedCount = Math.min(detourSpreadNoticedCount, retainedCount);
    detourSpreadReviewedCount = Math.min(detourSpreadReviewedCount, retainedCount);
    return {
      detourSpreadNoticedCount,
      detourSpreadReviewedCount,
    };
  }

  return {
    getGateEntryApproval,
    releaseGateEntryApprovalForQa,
    observeGateEntryPresence,
    observeGateSitePresence,
    getGateReturnLock,
    noteGateForegroundTab,
    noteGateActiveNavigation,
    noteGateForegroundBlur,
    noteGateTabClosed,
    applyGateInterventionDecision,
    recordGateInterventionShown,
    getGateHostSnapshot,
    observeGateDetourSpreadLevel,
    describeGateInterventionPass: gatePassLedger.describeFor,
  };
}
