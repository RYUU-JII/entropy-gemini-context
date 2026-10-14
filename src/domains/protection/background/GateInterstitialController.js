import { baselineShishiConsumptionLevel, requireShishiConsumptionLevel } from '../domain/shishiConsumptionLevel.js';
import { requireGateRecentConsumption } from '../domain/gateRecentConsumption.js';
import { GatePruningPresentationStore } from '../../../platform/storage/presentation/GatePruningPresentationStore.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { getInterventionAdmissionService } from './runtime/InterventionAdmissionService.js';
import { resolveTrustedSenderTabId, resolveSenderPageUrl, resolveSenderDocumentId } from '../../../platform/security/senderTrust.js';
import { DEFAULT_THEME_ID, assertCanonicalThemeId } from '../../../themes/core/ids.js';
import { resolveGatekeeperTheme } from '../../../themes/core/friction/runtime.js';
import { getHostname } from '../../../lib/index.js';
import { resolveGateInterventionInstruction } from './gateInterventionPayload.js';
import {
  INTERVENTION_DECISIONS,
  INTERVENTION_PHASES,
  resolveGateKindSurfaceId,
} from '../contracts/interventionLedgerContract.js';
import {
  TAB_CLOSURE_OUTCOMES,
  TAB_CLOSURE_REQUESTERS,
} from '../contracts/tabClosureContract.js';

const GATE_PAGE_PATH = 'src/pages/gate.html';
const GATE_INTERSTITIAL_SESSION_STALE = 'GATE_INTERSTITIAL_SESSION_STALE';
const GATE_INTERSTITIAL_SESSION_UNAVAILABLE = 'GATE_INTERSTITIAL_SESSION_UNAVAILABLE';
const GATE_DOCUMENT_DISPOSITIONS = Object.freeze({
  PRESERVED: 'preserved',
  REDIRECTED: 'redirected',
});
const REQUIRED_INTERVENTION_STATS_RECORDER_METHODS = Object.freeze([
  'recordGateShown',
  'recordGateDecision',
  'recordGateReentry',
  'recordGateEscape',
]);

function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function normalizeUrl(url) {
  return typeof url === 'string' ? url.trim() : '';
}

function normalizeNavigationObservedAt(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function resolveResumeHostname(session) {
  return typeof session?.hostname === 'string'
    ? session.hostname.trim().toLowerCase()
    : '';
}

function resolveUrlHostname(url) {
  return getHostname(normalizeUrl(url)) || '';
}

function resolveResumeAllowance(session, normalizedUrl) {
  if (session?.status !== 'resuming') {
    return { allowed: false, reason: '' };
  }
  if (normalizedUrl === session.originalUrl) {
    return { allowed: true, reason: 'resume_allowed' };
  }
  if (session.gateKind === 'detourSpreadGuard') return { allowed: false, reason: '' };

  const expectedHostname = resolveResumeHostname(session);
  const nextHostname = resolveUrlHostname(normalizedUrl);
  if (expectedHostname && nextHostname && expectedHostname === nextHostname) {
    return { allowed: true, reason: 'resume_allowed_same_host' };
  }

  return { allowed: false, reason: '' };
}

function normalizeSessionId(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function resolveContentDocumentId(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    ? value
    : null;
}

function normalizeGateDecision(value) {
  return value === 'leave' ? 'leave' : 'continue';
}


function normalizeTabId(value, fallback = null) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function normalizeTabIdSelection(values) {
  if (!Array.isArray(values)) return null;
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const tabId = normalizeTabId(value, null);
    if (tabId === null) return null;
    if (!seen.has(tabId)) {
      seen.add(tabId);
      normalized.push(tabId);
    }
  }
  return normalized;
}

function normalizeProtectedTabs(values = []) {
  if (!Array.isArray(values)) return [];
  const seenTabIds = new Set();
  return values.reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return acc;
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
    if (Number.isInteger(Number(entry.windowId)) && Number(entry.windowId) >= 0) {
      protectedTab.windowId = Number(entry.windowId);
    }
    if (Number.isInteger(Number(entry.index)) && Number(entry.index) >= 0) {
      protectedTab.index = Number(entry.index);
    }
    if (Number.isInteger(Number(entry.openerTabId)) && Number(entry.openerTabId) >= 0) {
      protectedTab.openerTabId = Number(entry.openerTabId);
    }
    acc.push(protectedTab);
    return acc;
  }, []);
}


function resolveAlreadySubmittedDecisionResult(session, decision) {
  const normalizedDecision = normalizeGateDecision(decision);
  const sessionStatus = typeof session?.status === 'string' && session.status.trim()
    ? session.status.trim().toLowerCase()
    : 'pending';
  if (sessionStatus === 'resuming' && normalizedDecision === 'continue') {
    return {
      success: true,
      decision: normalizedDecision,
      alreadySubmitted: true,
    };
  }

  return {
    success: false,
    error: 'GATE_INTERSTITIAL_DECISION_ALREADY_SUBMITTED',
    decision: normalizedDecision,
    alreadySubmitted: true,
  };
}

function buildGateSessionUnavailableResult(error = GATE_INTERSTITIAL_SESSION_UNAVAILABLE) {
  return {
    session: null,
    error,
    stale: error === GATE_INTERSTITIAL_SESSION_STALE,
  };
}

function resolveGatePresentationThemeId(themePresentation) {
  const candidateThemeId = themePresentation?.themeId;
  if (typeof candidateThemeId === 'string' && candidateThemeId.trim()) {
    return assertCanonicalThemeId(candidateThemeId, 'gate interstitial theme presentation');
  }
  return assertCanonicalThemeId(DEFAULT_THEME_ID, 'gate interstitial default theme');
}

function requireGatekeeperThemeString(gatekeeperTheme, key) {
  const value = gatekeeperTheme?.[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  throw new Error(`GATEKEEPER_THEME_${key.toUpperCase()}_REQUIRED`);
}

async function resolveGatekeeperThemeAsync(themeId) {
  return resolveGatekeeperTheme(themeId);
}

function generateSessionId() {
  try {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch (_) {
  }
  return `gate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveGateBrowserPort(browserPort) {
  // Closing a tab is no longer this port's business: it goes through the tab
  // closure arbiter, which owns the browser call and the authority check.
  if (
    typeof browserPort?.runtimeGetURL !== 'function'
    || typeof browserPort?.tabsUpdate !== 'function'
    || typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.beforeGateNavigation !== 'function'
  ) {
    throw new Error('GATE_INTERSTITIAL_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

function requireGateInterstitialFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireGateMutationFence(mutationFence) {
  if (
    !mutationFence
    || typeof mutationFence !== 'object'
    || Array.isArray(mutationFence)
    || typeof mutationFence.assertCurrent !== 'function'
  ) {
    throw new Error('GATE_INTERSTITIAL_MUTATION_FENCE_REQUIRED');
  }
  return mutationFence;
}

function assertGateMutationFenceCurrent(mutationFence, phase) {
  const result = mutationFence.assertCurrent(phase);
  if (result && typeof result.then === 'function') {
    throw new Error('GATE_INTERSTITIAL_MUTATION_FENCE_MUST_BE_SYNCHRONOUS');
  }
}


function preserveGateDocument(result) {
  return {
    ...result,
    documentDisposition: GATE_DOCUMENT_DISPOSITIONS.PRESERVED,
  };
}

function commitGateDocumentRedirect(result) {
  return {
    ...result,
    documentDisposition: GATE_DOCUMENT_DISPOSITIONS.REDIRECTED,
  };
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return String(error || 'UNKNOWN_ERROR');
}

function stableSessionValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSessionValue(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== 'lastUpdatedAt')
        .sort()
        .map((key) => [key, stableSessionValue(value[key])]),
    );
  }
  return value;
}

function isExactGateSessionMutation(currentSession, expectedSession) {
  return !!currentSession
    && !!expectedSession
    && JSON.stringify(stableSessionValue(currentSession))
      === JSON.stringify(stableSessionValue(expectedSession));
}

function resolveInterventionStatsRecorder(interventionStatsRecorder) {
  const missingMethod = REQUIRED_INTERVENTION_STATS_RECORDER_METHODS
    .find((method) => typeof interventionStatsRecorder?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`GATE_INTERSTITIAL_STATS_RECORDER_METHOD_REQUIRED:${missingMethod}`);
  }
  return interventionStatsRecorder;
}

function resolveGateInterventionLedger(interventionLedger) {
  if (typeof interventionLedger?.recordDetached !== 'function') {
    throw new Error('GATE_INTERSTITIAL_INTERVENTION_LEDGER_REQUIRED');
  }
  return interventionLedger;
}

function buildGatePageBaseUrl(browserPort) {
  return browserPort.runtimeGetURL(GATE_PAGE_PATH) || '';
}

function setGatePageHint(searchParams, key, value) {
  if (value === undefined || value === null) {
    return;
  }
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!normalizedValue) {
    return;
  }
  searchParams.set(key, normalizedValue);
}

function buildGatePageUrl(sessionId, browserPort, gatePageHints = null) {
  const baseUrl = buildGatePageBaseUrl(browserPort);
  if (!baseUrl || !sessionId) return '';
  const url = new URL(baseUrl);
  url.searchParams.set('session', sessionId);
  const hints = gatePageHints && typeof gatePageHints === 'object' ? gatePageHints : {};
  setGatePageHint(url.searchParams, 'theme', hints.themeId);
  setGatePageHint(url.searchParams, 'style', hints.gatekeeperStyleVariant);
  setGatePageHint(url.searchParams, 'copy', hints.gatekeeperCopyVariant);
  setGatePageHint(url.searchParams, 'renderer', hints.gatekeeperInterstitialRendererId);
  setGatePageHint(url.searchParams, 'kind', hints.gateKind);
  setGatePageHint(url.searchParams, 'host', hints.hostname);
  setGatePageHint(url.searchParams, 'severity', hints.severity);
  setGatePageHint(url.searchParams, 'plan', hints.planLevel);
  setGatePageHint(url.searchParams, 'holdDuration', hints.holdDurationMs);
  setGatePageHint(url.searchParams, 'holdUntil', hints.holdUntil);
  setGatePageHint(url.searchParams, 'issuedAt', hints.issuedAt);
  setGatePageHint(url.searchParams, 'surface', hints.surface);
  return url.toString();
}

function isGatePageUrlWithPort(url, browserPort) {
  const normalizedUrl = normalizeUrl(url);
  const baseUrl = buildGatePageBaseUrl(browserPort);
  return !!normalizedUrl && !!baseUrl && normalizedUrl.startsWith(baseUrl);
}

function resolveGatePageSessionId(url) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return '';
  try {
    const parsed = new URL(normalizedUrl);
    return normalizeSessionId(parsed.searchParams.get('session'));
  } catch (_) {
    return '';
  }
}

function updateTabUrl(browserPort, tabId, url) {
  if (!Number.isInteger(Number(tabId)) || !url) {
    return Promise.resolve({ tab: null, error: 'TABS_UPDATE_UNAVAILABLE' });
  }
  return browserPort.tabsUpdate(Number(tabId), { url });
}

/**
 * The gate sits at the top of the interruption ladder, so the arbiter never
 * outranks it. A refusal reaching here would mean the ladder changed under this
 * call site, which is worth its own error rather than a generic close failure.
 */
function adaptClosureResult(result) {
  if (result?.outcome === TAB_CLOSURE_OUTCOMES.CLOSED) {
    return { success: true, error: null };
  }
  if (result?.outcome === TAB_CLOSURE_OUTCOMES.REFUSED) {
    return {
      success: false,
      error: `TAB_CLOSURE_REFUSED:${result.refusalReason || 'unknown'}`,
    };
  }
  return { success: false, error: result?.error || 'TABS_REMOVE_FAILED' };
}

async function closeTab(requestTabClosure, requester, tabId, context = {}) {
  if (!Number.isInteger(Number(tabId))) {
    return { success: false, error: 'TABS_REMOVE_UNAVAILABLE' };
  }
  return adaptClosureResult(await requestTabClosure({
    ...context,
    requester,
    tabId: Number(tabId),
  }));
}

async function closeTabs(requestTabClosure, requester, tabIds, context = {}) {
  const normalizedTabIds = normalizeTabIdSelection(tabIds);
  if (!normalizedTabIds?.length) {
    return { success: true, error: null };
  }
  return adaptClosureResult(await requestTabClosure({
    ...context,
    requester,
    tabIds: normalizedTabIds,
  }));
}

function resolveGateShownProtectedTabCount(session) {
  const protectedTabCount = Number(session?.metrics?.protectedTabCount);
  return Number.isInteger(protectedTabCount) && protectedTabCount >= 0
    ? protectedTabCount
    : null;
}


function resolveDetourSpreadProtectedTabBudget(session) {
  const protectedTabThreshold = Number(session?.metrics?.protectedTabThreshold);
  if (!Number.isInteger(protectedTabThreshold) || protectedTabThreshold < 1) {
    return null;
  }
  return protectedTabThreshold - 1;
}


function buildSessionPayload({
  sessionId,
  tabId,
  originalUrl,
  payload,
  themeId,
  gatekeeperTheme,
  browserPort,
  presentationMode = 'blocking',
}) {
  const gateKind = typeof payload.gateKind === 'string' ? payload.gateKind.trim() : '';
  const hostname = typeof payload.hostname === 'string' ? payload.hostname.trim().toLowerCase() : '';
  const severity = typeof payload.severity === 'string' ? payload.severity.trim().toLowerCase() : 'mid';
  const planLevel = Math.max(1, Math.floor(Number(payload.planLevel) || 1));
  const holdDurationMs = Math.max(0, Math.floor(Number(payload.holdDurationMs) || 0));
  const holdUntil = Math.max(0, Math.floor(Number(payload.holdUntil) || 0));
  const issuedAt = Math.max(0, Math.floor(Number(payload.issuedAt) || Date.now()));
  const gatekeeperStyleVariant = gatekeeperTheme?.styleVariant || themeId;
  const gatekeeperCopyVariant = gatekeeperTheme?.copyVariant || 'default';
  const gatekeeperRendererId = requireGatekeeperThemeString(gatekeeperTheme, 'rendererId');
  const gatekeeperInterstitialRendererId = requireGatekeeperThemeString(gatekeeperTheme, 'interstitialRendererId');
  const gatePageUrl = buildGatePageUrl(sessionId, browserPort, {
    themeId,
    gatekeeperStyleVariant,
    gatekeeperCopyVariant,
    gatekeeperInterstitialRendererId,
    gateKind,
    hostname,
    severity,
    planLevel,
    holdDurationMs,
    holdUntil,
    issuedAt,
  });
  if (!sessionId || !Number.isInteger(Number(tabId)) || !originalUrl || !gatePageUrl) {
    return null;
  }

  const protectedTabs = normalizeProtectedTabs(payload.protectedTabs);
  if (
    gateKind === 'detourSpreadGuard'
    && !protectedTabs.some((entry) => entry.tabId === Number(tabId))
  ) {
    protectedTabs.push({
      tabId: Number(tabId),
      hostname,
      url: originalUrl,
      title: hostname,
      favIconUrl: '',
      active: true,
    });
  }

  return {
    sessionId,
    tabId: Number(tabId),
    gateKind,
    interactionId: typeof payload.interactionId === 'string' ? payload.interactionId.trim() : '',
    originalUrl,
    gatePageUrl,
    hostname,
    severity,
    planLevel,
    holdDurationMs,
    holdUntil,
    issuedAt,
    activeChildIds: Array.isArray(payload.activeChildIds) ? payload.activeChildIds : [],
    pressureSignals: Array.isArray(payload.pressureSignals) ? payload.pressureSignals : [],
    directTriggers: Array.isArray(payload.directTriggers) ? payload.directTriggers : [],
    metrics: {
      ...(payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {}),
      ...(payload.metrics && Object.hasOwn(payload.metrics, 'recentConsumption')
        ? { recentConsumption: structuredClone(requireGateRecentConsumption(payload.metrics.recentConsumption)) } : {}),
      ...(gateKind === 'entryCheckpoint' ? { shishiIntensity: structuredClone(
        requireShishiConsumptionLevel(payload.metrics?.shishiIntensity),
      ) } : {}),
      ...(gateKind === 'detourSpreadGuard'
        ? { presentationMode: 'blocking' }
        : {}),
    },
    protectedTabs,
    themeId,
    gatekeeperStyleVariant,
    gatekeeperCopyVariant,
    gatekeeperRendererId,
    gatekeeperInterstitialRendererId,
    status: 'pending',
    resumeRequestedAt: 0,
    lastUpdatedAt: Date.now(),
  };
}

function buildInterventionStatsPayload(session, {
  now = Date.now(),
  shownAt = null,
  decision = null,
} = {}) {
  if (!session || typeof session !== 'object') return {};
  const resolvedShownAt = Number.isFinite(Number(shownAt))
    ? Number(shownAt)
    : Number.isFinite(Number(session.issuedAt))
      ? Number(session.issuedAt)
      : null;
  return {
    exposureId: session.sessionId,
    hostname: session.hostname,
    gateKind: session.gateKind,
    artifactFamily: 'gate_interstitial',
    artifactId: session.gatekeeperInterstitialRendererId,
    themeId: session.themeId,
    rendererId: session.gatekeeperInterstitialRendererId,
    level: session.planLevel,
    activeChildIds: session.activeChildIds,
    pressureSignals: session.pressureSignals,
    directTriggers: session.directTriggers,
    severity: session.severity,
    holdDurationMs: session.holdDurationMs,
    holdUntil: session.holdUntil,
    intensityVector: {
      level: session.planLevel,
      severity: session.severity,
      holdDurationMs: session.holdDurationMs,
      ...(session.metrics && Object.hasOwn(session.metrics, 'shishiIntensity') ? {
        shishiWaitExtensionMs: requireShishiConsumptionLevel(session.metrics.shishiIntensity).waitExtensionMs,
        shishiIntensityReason: session.metrics.shishiIntensity.reason,
      } : {}),
    },
    policyContextHash: session.interactionId || '',
    now,
    shownAt: resolvedShownAt,
    decision,
  };
}

export function createGateInterstitialController({
  gateInterventionSessionRepository,
  pruningPresentationStore = new GatePruningPresentationStore(),
  interventionLedger,
  applyGateInterventionDecision,
  recordGateInterventionShown,
  interventionStatsRecorder,
  recordDiagnostic,
  runProfileMutationAdmittedTask,
  requestTabClosure,
  readProtectedTabInventory,
  browserPort,
  admissionService = null,
} = {}) {
  if (
    !gateInterventionSessionRepository
    || typeof gateInterventionSessionRepository.getSession !== 'function'
    || typeof gateInterventionSessionRepository.getSessionByTabId !== 'function'
    || typeof gateInterventionSessionRepository.upsertSession !== 'function'
    || typeof gateInterventionSessionRepository.updateSession !== 'function'
    || typeof gateInterventionSessionRepository.readState !== 'function'
    || typeof gateInterventionSessionRepository.removeSession !== 'function'
    || typeof gateInterventionSessionRepository.removeTabSession !== 'function'
  ) {
    throw new Error('GATE_INTERSTITIAL_SESSION_REPOSITORY_REQUIRED');
  }
  const resolvedBrowserPort = resolveGateBrowserPort(browserPort);
  const readProtectedTabInventoryOwner = requireGateInterstitialFunction(
    readProtectedTabInventory, 'GATE_INTERSTITIAL_PROTECTED_TAB_INVENTORY_OWNER_REQUIRED',
  );
  const resolvedInterventionLedger = resolveGateInterventionLedger(interventionLedger);
  const requestTabClosureOwner = requireGateInterstitialFunction(
    requestTabClosure,
    'GATE_INTERSTITIAL_TAB_CLOSURE_ARBITER_REQUIRED',
  );
  const applyGateInterventionDecisionOwner = requireGateInterstitialFunction(
    applyGateInterventionDecision,
    'GATE_INTERSTITIAL_DECISION_HANDLER_REQUIRED',
  );
  const recordGateInterventionShownOwner = requireGateInterstitialFunction(
    recordGateInterventionShown,
    'GATE_INTERSTITIAL_SHOWN_RECORDER_REQUIRED',
  );
  const resolvedInterventionStatsRecorder = resolveInterventionStatsRecorder(interventionStatsRecorder);
  const recordGateStatsDiagnosticOwner = requireGateInterstitialFunction(
    recordDiagnostic,
    'GATE_INTERSTITIAL_DIAGNOSTICS_REQUIRED',
  );
  const runProfileMutationAdmittedTaskOwner = requireGateInterstitialFunction(
    runProfileMutationAdmittedTask,
    'GATE_INTERSTITIAL_PROFILE_MUTATION_RUNTIME_TASK_OWNER_REQUIRED',
  );
  const activeGatePresentationCounts = new Map();
  if (typeof pruningPresentationStore?.readCompleted !== 'function'
    || typeof pruningPresentationStore?.markCompleted !== 'function') {
    throw new Error('GATE_PRUNING_PRESENTATION_STORE_REQUIRED');
  }

  function closePruningSelection(tabIds, close) {
    if (!tabIds.length) return close();
    // Acquire before browser removal so a profile reset drains both the close
    // and its receipt. The gate document may disappear before this settles.
    return runProfileMutationAdmittedTaskOwner({
      label: 'gate_pruning_completion',
      task: async () => {
        const result = await close();
        if (result.success) await pruningPresentationStore.markCompleted();
        return result;
      },
    });
  }
  const gatePresentationTailsByTabId = new Map();
  // Only unsettled work is retained. A session has at most the five history
  // event kinds; duplicate delivery shares that event's task, not another queue item.
  const historyTasksBySession = new Map();
  const pendingDecisionsBySession = new Map();
  const admission = () => admissionService || getInterventionAdmissionService();

  async function removeGateSession(sessionId) {
    const removed = await gateInterventionSessionRepository.removeSession(sessionId);
    await admission().endGate(sessionId);
    return removed;
  }

  function beginGatePresentation(tabId) {
    const normalizedTabId = Number(tabId);
    activeGatePresentationCounts.set(
      normalizedTabId,
      (activeGatePresentationCounts.get(normalizedTabId) || 0) + 1,
    );
  }

  function endGatePresentation(tabId) {
    const normalizedTabId = Number(tabId);
    const nextCount = (activeGatePresentationCounts.get(normalizedTabId) || 0) - 1;
    if (nextCount > 0) {
      activeGatePresentationCounts.set(normalizedTabId, nextCount);
      return;
    }
    activeGatePresentationCounts.delete(normalizedTabId);
  }

  function isGatePresentationActive(tabId) {
    return (activeGatePresentationCounts.get(Number(tabId)) || 0) > 0;
  }

  async function serializeGatePresentation(tabId, task) {
    const normalizedTabId = normalizeTabId(tabId, null);
    if (normalizedTabId === null) return task();
    const predecessor = gatePresentationTailsByTabId.get(normalizedTabId)
      || Promise.resolve();
    const execution = predecessor
      .catch(() => undefined)
      .then(task);
    gatePresentationTailsByTabId.set(normalizedTabId, execution);
    try {
      return await execution;
    } finally {
      if (gatePresentationTailsByTabId.get(normalizedTabId) === execution) {
        gatePresentationTailsByTabId.delete(normalizedTabId);
      }
    }
  }

  function recordGateStats(method, payload = {}) {
    const fn = resolvedInterventionStatsRecorder[method];
    return Promise.resolve().then(() => fn(payload));
  }

  function snapshotHistoryPayload(payload) {
    const freeze = value => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
      return value;
    };
    return freeze(structuredClone(payload));
  }

  function enqueueGateHistory(sessionId, event, work, presentation = null, preparation = null, effectCompletion) {
    let tasks = historyTasksBySession.get(sessionId);
    const existing = tasks?.events.get(event);
    if (existing) {
      if (presentation && (existing.presentation.tabId !== presentation.tabId
        || existing.presentation.presentedAt !== presentation.presentedAt)) throw new Error('GATE_HISTORY_PRESENTATION_CONFLICT');
      return existing;
    }
    if (!tasks && historyTasksBySession.size >= 128) throw new Error('GATE_HISTORY_CAPACITY_EXCEEDED');
    const predecessor = tasks?.settled || Promise.resolve();
    const completion = runProfileMutationAdmittedTaskOwner({
      label: `gate_intervention_history:${event}`,
      task: async () => {
        // Failed browser work releases its admitted slot immediately, even
        // while shown history is held. A later explicit retry gets a new slot.
        if (effectCompletion !== undefined && await effectCompletion !== true) return false;
        // Settlement sequences distinct outcomes; the separate shown dependency
        // below requires successful presentation history, including its marker.
        await predecessor;
        return work();
      },
    });
    if (!completion || typeof completion.then !== 'function') throw new Error('GATE_INTERSTITIAL_PROFILE_MUTATION_RUNTIME_TASK_INVALID');
    tasks ||= { events: new Map(), settled: Promise.resolve() };
    const entry = Object.freeze({ completion, presentation, preparation });
    tasks.events.set(event, entry);
    historyTasksBySession.set(sessionId, tasks);
    const settle = () => {
      tasks.events.delete(event);
      if (tasks.events.size === 0 && historyTasksBySession.get(sessionId) === tasks) historyTasksBySession.delete(sessionId);
    };
    // These handlers observe rejection immediately, even before the admission
    // lane returns the boxed receipt. They do not turn completion into success.
    tasks.settled = completion.then(settle, settle);
    return entry;
  }

  async function captureShownHistory(session) {
    const pending = historyTasksBySession.get(session.sessionId)?.events.get('shown');
    if (pending) return Object.freeze({ completion: pending.completion, confirmed: true });
    if (session.metrics?.admissionPresentedAt > 0) return Object.freeze({ confirmed: true });
    // The caller's snapshot can predate a just-completed marker. Consult the
    // canonical session before the caller removes it; never wait on history here.
    const current = await gateInterventionSessionRepository.getSession(session.sessionId);
    const latest = historyTasksBySession.get(session.sessionId)?.events.get('shown');
    if (latest) return Object.freeze({ completion: latest.completion, confirmed: true });
    return Object.freeze({ confirmed: current?.metrics?.admissionPresentedAt > 0 });
  }

  function recordDetachedGateStatsFailure(method, payload, error) {
    const diagnostic = {
      method,
      sessionId: normalizeSessionId(payload.exposureId || payload.sessionId),
      hostname: resolveResumeHostname(payload),
      decision: payload.decision || null,
      error: toErrorMessage(error),
    };
    recordGateStatsDiagnosticOwner('gate_intervention_stats_record_detached_failed', diagnostic);
    console.warn('[GateInterstitialController] detached intervention stats record failed:', diagnostic);
  }

  function recordDetachedGateStats(method, payload = {}, shownHistory, effectCompletion) {
    try {
      const captured = snapshotHistoryPayload(payload);
      const event = method === 'recordGateDecision' ? (payload.decision === 'leave' ? 'left' : 'continued')
        : method === 'recordGateReentry' ? 'reentered' : 'escape_closed';
      return enqueueGateHistory(captured.exposureId, event, async () => {
        try {
          if (shownHistory?.confirmed !== true) throw new Error('GATE_HISTORY_PRESENTATION_UNCONFIRMED');
          if (shownHistory.completion) await shownHistory.completion;
          return await recordGateStats(method, captured);
        } catch (error) {
          recordDetachedGateStatsFailure(method, captured, error);
          throw error;
        }
      }, null, null, effectCompletion);
    } catch (error) {
      recordDetachedGateStatsFailure(method, payload, error);
      if (effectCompletion !== undefined) throw error;
    }
  }

  function recordGateLifecycleDiagnostic(event, payload = {}) {
    recordGateStatsDiagnosticOwner(event, {
      ...payload,
      sessionId: normalizeSessionId(payload.sessionId),
      tabId: normalizeTabId(payload.tabId, null),
    });
  }

  function recordGateLedgerEntry({
    gateKind,
    phase,
    hostname = '',
    tabId = null,
    sessionId = '',
    decision = null,
    reason = '',
    at,
  }) {
    const surfaceId = resolveGateKindSurfaceId(gateKind);
    if (!surfaceId) {
      recordGateLifecycleDiagnostic('intervention_ledger_gate_kind_unmapped', {
        gateKind: typeof gateKind === 'string' ? gateKind : '',
        phase,
        sessionId,
        tabId,
      });
      return;
    }
    resolvedInterventionLedger.recordDetached({
      surfaceId,
      phase,
      scope: { hostname, tabId },
      decision,
      reason,
      sessionId,
      at: Math.max(0, Math.floor(Number(at) || Date.now())),
    });
  }

  /**
   * Applies a gate decision and records every pass it pre-authorized.
   *
   * The exemption is written once, at grant time, rather than once per skipped
   * dispatch: one row answers "why did this gate stop firing" without the
   * ledger filling up while the pass is simply alive.
   */
  async function applyGateDecisionWithLedger({ session, decision, now }) {
    const result = await applyGateInterventionDecisionOwner({
      hostname: session.hostname,
      sessionId: session.sessionId,
      manual: session.metrics?.shishiIntensity?.reason === 'manual_qa_fixture',
      gateKind: session.gateKind,
      decision,
      tabId: session.tabId,
      // Settles the reviewed spread level: this is the moment the user actually
      // dealt with it, as opposed to merely having been shown it.
      protectedTabCount: resolveGateShownProtectedTabCount(session),
      level: session.planLevel,
      now,
    });
    const grantedPasses = Array.isArray(result?.grantedPasses) ? result.grantedPasses : [];
    grantedPasses.forEach((pass) => {
      recordGateLedgerEntry({
        gateKind: pass.gateKind,
        phase: INTERVENTION_PHASES.EXEMPTED,
        hostname: pass.hostname,
        tabId: pass.tabId,
        sessionId: session.sessionId,
        reason: `${pass.reason}:${pass.scope}`,
        at: now,
      });
    });
    return result;
  }

  function recordSuppressedGateLedgerEntries({
    suppressedChildIds,
    hostname,
    tabId,
    reason,
    at,
  }) {
    if (!Array.isArray(suppressedChildIds) || !suppressedChildIds.length) return;
    suppressedChildIds.forEach((gateKind) => {
      recordGateLedgerEntry({
        gateKind,
        phase: INTERVENTION_PHASES.SUPPRESSED,
        hostname,
        tabId,
        reason,
        at,
      });
    });
  }


  async function restoreStagedGateSessionAfterFailure(nextSession, previousSession, {
    phase,
    presentationError = null,
  } = {}) {
    try {
      const currentSession = await gateInterventionSessionRepository.getSessionByTabId(
        nextSession.tabId,
      );
      if (!currentSession && !previousSession) {
        return;
      }
      if (isExactGateSessionMutation(currentSession, nextSession)) {
        if (previousSession) {
          await gateInterventionSessionRepository.upsertSession(previousSession);
        } else {
          await removeGateSession(nextSession.sessionId);
        }
        return;
      }
      if (isExactGateSessionMutation(currentSession, previousSession)) {
        return;
      }
      if (currentSession?.sessionId !== nextSession.sessionId) {
        throw new Error('GATE_INTERSTITIAL_STAGED_SESSION_OWNERSHIP_LOST');
      }
      throw new Error('GATE_INTERSTITIAL_STAGED_SESSION_MUTATION_MISMATCH');
    } catch (cleanupError) {
      recordGateLifecycleDiagnostic('gate_interstitial_staged_session_cleanup_failed', {
        sessionId: nextSession.sessionId,
        tabId: nextSession.tabId,
        phase,
        presentationError: toErrorMessage(presentationError),
        cleanupError: toErrorMessage(cleanupError),
      });
      const error = new Error('GATE_INTERSTITIAL_STAGED_SESSION_CLEANUP_FAILED');
      error.code = 'GATE_INTERSTITIAL_STAGED_SESSION_CLEANUP_FAILED';
      error.cause = cleanupError;
      error.presentationError = presentationError;
      throw error;
    }
  }

  async function performGatePresentation({
    tabId,
    url,
    runtimeSnapshot,
    themePresentation = null,
    now = Date.now(),
    presentationMode = 'blocking',
    mutationFence,
  } = {}) {
    const resolvedMutationFence = requireGateMutationFence(mutationFence);
    assertGateMutationFenceCurrent(
      resolvedMutationFence,
      'gate_controller_dequeued',
    );
    const normalizedUrl = normalizeUrl(url);
    if (!Number.isInteger(Number(tabId)) || !isWebUrl(normalizedUrl)) {
      return preserveGateDocument({ handled: false, reason: 'unsupported_target' });
    }

    const hostname = getHostname(normalizedUrl);
    const documentId = resolveContentDocumentId(resolvedMutationFence.documentId);
    if (!hostname) {
      return preserveGateDocument({ handled: false, reason: 'hostname_unresolved' });
    }

    let existingSession = await gateInterventionSessionRepository.getSessionByTabId(tabId);
    assertGateMutationFenceCurrent(
      resolvedMutationFence,
      'gate_controller_after_session_read',
    );
    const presentationObservedAt = normalizeNavigationObservedAt(now) ?? Date.now();
    if (
      existingSession
      && (
        existingSession.status === 'pending'
        || existingSession.status === 'resuming'
      )
      && presentationObservedAt <= existingSession.issuedAt
    ) {
      recordGateLifecycleDiagnostic('gate_interstitial_stale_presentation_ignored', {
        sessionId: existingSession.sessionId,
        tabId,
        presentationObservedAt,
        sessionIssuedAt: existingSession.issuedAt,
      });
      return preserveGateDocument({
        handled: true,
        reason: 'stale_runtime_snapshot',
        sessionId: existingSession.sessionId,
        gatePageUrl: existingSession.gatePageUrl,
        gateKind: existingSession.gateKind,
        message: null,
      });
    }
    const gateInstruction = resolveGateInterventionInstruction(runtimeSnapshot, hostname, now);
    const gatePayload = gateInstruction.message.payload;
    if (existingSession?.status === 'pending' || existingSession?.status === 'resuming') {
      return preserveGateDocument({ handled: true, reason: 'blocking_session_owned',
        sessionId: existingSession.sessionId, gatePageUrl: existingSession.gatePageUrl,
        gateKind: existingSession.gateKind, message: null });
    }
    if (gateInstruction?.message?.type !== MESSAGE_TYPES.GATE_INTERVENTION_START) {
      return preserveGateDocument({ handled: false, reason: 'inactive', message: null });
    }
    const effectivePresentationMode = 'blocking';
    const themeId = resolveGatePresentationThemeId(themePresentation);
    const gatekeeperTheme = themePresentation?.gatekeeperTheme && typeof themePresentation.gatekeeperTheme === 'object'
      ? themePresentation.gatekeeperTheme
      : await resolveGatekeeperThemeAsync(themeId);
    assertGateMutationFenceCurrent(
      resolvedMutationFence,
      'gate_controller_after_theme_resolution',
    );
    const sessionId = generateSessionId();
    const nextSession = buildSessionPayload({
      sessionId,
      tabId,
      originalUrl: normalizedUrl,
      payload: gatePayload,
      themeId,
      gatekeeperTheme,
      browserPort: resolvedBrowserPort,
      presentationMode: effectivePresentationMode,
    });

    if (!nextSession) {
      return preserveGateDocument({ handled: false, reason: 'session_payload_invalid' });
    }
    if (nextSession.gateKind === 'detourSpreadGuard') {
      nextSession.metrics.contentDocumentId = documentId;
    }

    {
      const permission = await admission().request({
        kind: 'gate_interstitial', gateKind: nextSession.gateKind, tabId,
        documentId: `gate:${sessionId}`, requestId: sessionId, manual: false, observedAt: now,
      });
      if (!permission.accepted) {
        recordGateLifecycleDiagnostic('gate_admission_withheld', { tabId, sessionId, reason: permission.reason });
        return preserveGateDocument({ handled: false, reason: `admission:${permission.reason}` });
      }
    }


    let stageAttempted = false;
    let stagedSessionCleanupSettled = false;
    let redirectCommitted = false;
    const restoreStagedSession = async (phase, presentationError = null) => {
      if (!stageAttempted || stagedSessionCleanupSettled || redirectCommitted) return;
      stagedSessionCleanupSettled = true;
      await restoreStagedGateSessionAfterFailure(nextSession, existingSession, {
        phase,
        presentationError,
      });
    };
    beginGatePresentation(tabId);
    try {
      assertGateMutationFenceCurrent(
        resolvedMutationFence,
        'gate_controller_before_redirect_session_upsert',
      );
      stageAttempted = true;
      await gateInterventionSessionRepository.upsertSession(nextSession);
      assertGateMutationFenceCurrent(
        resolvedMutationFence,
        'gate_controller_after_redirect_session_upsert',
      );
      const navigationObservationFloor = Math.max(
        nextSession.issuedAt,
        Date.now(),
      );
      const stagedSessionMetrics = {
        ...nextSession.metrics,
        navigationObservationFloor,
      };
      const stagedSession = await gateInterventionSessionRepository.updateSession(
        nextSession.sessionId,
        (session) => ({
          ...session,
          metrics: stagedSessionMetrics,
        }),
      );
      if (!stagedSession) {
        throw new Error('GATE_INTERSTITIAL_PRESENTATION_COMMIT_LOST');
      }
      nextSession.metrics = stagedSessionMetrics;
      recordGateLedgerEntry({
        gateKind: nextSession.gateKind,
        phase: INTERVENTION_PHASES.OFFERED,
        hostname: nextSession.hostname || hostname,
        tabId: nextSession.tabId,
        sessionId: nextSession.sessionId,
        reason: 'redirect',
        at: nextSession.issuedAt,
      });
      recordSuppressedGateLedgerEntries({
        suppressedChildIds: gateInstruction.suppressedChildIds,
        hostname: nextSession.hostname || hostname,
        tabId: nextSession.tabId,
        reason: `preempted_by:${nextSession.gateKind}`,
        at: nextSession.issuedAt,
      });
      assertGateMutationFenceCurrent(
        resolvedMutationFence,
        'gate_controller_before_redirect_tabs_update',
      );
      await resolvedBrowserPort.beforeGateNavigation(Number(tabId));
      assertGateMutationFenceCurrent(resolvedMutationFence, 'gate_controller_after_group_release');
      const updateResult = await updateTabUrl(
        resolvedBrowserPort,
        tabId,
        nextSession.gatePageUrl,
      );
      if (updateResult.error) {
        await restoreStagedSession('redirect_failed', updateResult.error);
        recordGateLedgerEntry({
          gateKind: nextSession.gateKind,
          phase: INTERVENTION_PHASES.SUPPRESSED,
          hostname: nextSession.hostname || hostname,
          tabId: nextSession.tabId,
          sessionId: nextSession.sessionId,
          reason: 'redirect_failed',
          at: Date.now(),
        });
        return preserveGateDocument({
          handled: false,
          reason: 'redirect_failed',
          error: updateResult.error,
        });
      }
      redirectCommitted = true;
      // Navigation commits delivery. Visible page acknowledgement owns exposure.
    } catch (error) {
      await restoreStagedSession('redirect_presentation', error);
      throw error;
    } finally {
      endGatePresentation(tabId);
    }

    return commitGateDocumentRedirect({
      handled: true,
      reason: 'redirected',
      sessionId: nextSession.sessionId,
      gatePageUrl: nextSession.gatePageUrl,
    });
  }

  async function presentForRuntimeSnapshot(args = {}) {
    return serializeGatePresentation(
      args?.tabId,
      () => performGatePresentation(args),
    );
  }


  async function removeTabSession(tabId, {
    reason = 'external',
    observedAt = Date.now(),
  } = {}) {
    const session = await gateInterventionSessionRepository.getSessionByTabId(tabId);
    recordGateLifecycleDiagnostic('gate_interstitial_external_removal_requested', {
      sessionId: session?.sessionId || '',
      tabId,
      reason,
      observedAt,
      sessionIssuedAt: session?.issuedAt ?? null,
      presentationActive: isGatePresentationActive(tabId),
    });
    const removed = await gateInterventionSessionRepository.removeTabSession(tabId);
    if (session) await admission().endGate(session.sessionId);
    return removed;
  }

  async function handleTabNavigation({
    tabId,
    url,
    documentId = null,
    now = Date.now(),
    observedAt = null,
  } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) {
      return { skipProtectionDispatch: false, closedTab: false };
    }

    if (isGatePresentationActive(normalizedTabId)) {
      return {
        skipProtectionDispatch: true,
        closedTab: false,
        reason: 'gate_presentation_in_progress',
      };
    }
    const session = await gateInterventionSessionRepository.getSessionByTabId(normalizedTabId);
    if (!session) {
      return { skipProtectionDispatch: false, closedTab: false };
    }
    if (isGatePresentationActive(normalizedTabId)) {
      return {
        skipProtectionDispatch: true,
        closedTab: false,
        reason: 'gate_presentation_in_progress',
      };
    }

    const normalizedUrl = normalizeUrl(url);
    const normalizedObservedAt = normalizeNavigationObservedAt(observedAt);
    const navigationObservationFloor = Math.max(
      session.issuedAt,
      normalizeNavigationObservedAt(session.metrics?.navigationObservationFloor) || 0,
    );
    if (
      normalizedObservedAt !== null
      && normalizedObservedAt <= navigationObservationFloor
    ) {
      return {
        skipProtectionDispatch: true,
        closedTab: false,
        reason: 'pre_gate_navigation_observation',
      };
    }

    if (isGatePageUrlWithPort(normalizedUrl, resolvedBrowserPort)) {
      const gatePageSessionId = resolveGatePageSessionId(normalizedUrl);
      if (gatePageSessionId === session.sessionId) {
        return { skipProtectionDispatch: true, closedTab: false, reason: 'gate_page_active' };
      }
    }

    const resumeAllowance = resolveResumeAllowance(session, normalizedUrl);
    const shownHistory = await captureShownHistory(session);
    if (resumeAllowance.allowed) {
      await removeGateSession(session.sessionId);
      recordDetachedGateStats('recordGateReentry', {
        ...buildInterventionStatsPayload(session, {
          now,
          shownAt: session.resumeRequestedAt || session.issuedAt || null,
        }),
      }, shownHistory);
      return { skipProtectionDispatch: false, closedTab: false, reason: resumeAllowance.reason };
    }

    await removeGateSession(session.sessionId);
    recordGateLifecycleDiagnostic('gate_interstitial_navigation_rejected', {
      sessionId: session.sessionId,
      tabId: normalizedTabId,
      sessionStatus: session.status,
      observedAt: normalizedObservedAt,
      issuedAt: session.issuedAt,
      urlRelation: normalizedUrl === session.originalUrl
        ? 'original'
        : isGatePageUrlWithPort(normalizedUrl, resolvedBrowserPort)
          ? 'gate_mismatch'
          : 'other',
    });
    recordDetachedGateStats('recordGateEscape', {
      ...buildInterventionStatsPayload(session, { now }),
    }, shownHistory);
    recordGateLedgerEntry({
      gateKind: session.gateKind,
      phase: INTERVENTION_PHASES.RESOLVED,
      hostname: session.hostname,
      tabId: normalizedTabId,
      sessionId: session.sessionId,
      decision: INTERVENTION_DECISIONS.DISMISSED,
      reason: 'gate_escape',
      at: normalizedObservedAt ?? now,
    });
    const closeResult = await closeTab(
      requestTabClosureOwner,
      TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_ESCAPE,
      normalizedTabId,
      {
        hostname: session.hostname,
        sessionId: session.sessionId,
        reason: 'gate_escape',
        now: normalizedObservedAt ?? now,
      },
    );
    return {
      skipProtectionDispatch: true,
      closedTab: closeResult.success,
      reason: 'gate_escape_closed',
      error: closeResult.error,
    };
  }

  function recordUnauthorizedGateRequest(senderTabId, diagnostic = {}) {
    recordGateLifecycleDiagnostic('gate_interstitial_authorization_rejected', {
      ...diagnostic,
      tabId: senderTabId,
    });
  }

  async function resolveAuthorizedSession(sender, sessionId, { bindGateDocument = false } = {}) {
    const senderTabId = resolveTrustedSenderTabId(sender);
    const normalizedSessionId = normalizeSessionId(sessionId);
    const senderUrl = resolveSenderPageUrl(sender);
    const senderPageSessionId = resolveGatePageSessionId(senderUrl);

    if (senderTabId === null || !normalizedSessionId || senderPageSessionId !== normalizedSessionId) {
      const activeTabSession = senderTabId !== null
        ? await gateInterventionSessionRepository.getSessionByTabId(senderTabId)
        : null;
      if (activeTabSession) {
        recordUnauthorizedGateRequest(senderTabId, {
          reason: 'sender_identity_invalid',
          sessionId: normalizedSessionId,
          activeSessionId: activeTabSession.sessionId,
          senderPageSessionId,
          senderTabAvailable: senderTabId !== null,
        });
      } else {
        recordGateLifecycleDiagnostic('gate_interstitial_authorization_rejected', {
          reason: 'sender_identity_invalid_without_active_session',
          sessionId: normalizedSessionId,
          tabId: senderTabId,
          senderPageSessionId,
          senderTabAvailable: senderTabId !== null,
        });
      }
      return buildGateSessionUnavailableResult();
    }

    const session = await gateInterventionSessionRepository.getSession(normalizedSessionId);
    if (!session) {
      const activeTabSession = await gateInterventionSessionRepository.getSessionByTabId(senderTabId);
      recordGateLifecycleDiagnostic('gate_interstitial_session_stale', {
        reason: activeTabSession ? 'requested_session_replaced' : 'requested_session_missing',
        sessionId: normalizedSessionId,
        activeSessionId: activeTabSession?.sessionId || '',
        tabId: senderTabId,
        senderPageSessionId,
      });
      return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
    }

    if (session.tabId !== senderTabId) {
      recordUnauthorizedGateRequest(senderTabId, {
        reason: 'session_sender_mismatch',
        sessionId: normalizedSessionId,
        expectedTabId: session.tabId,
        senderPageSessionId,
        tabMatches: session.tabId === senderTabId,
        urlMatches: session.gatePageUrl === normalizeUrl(senderUrl),
        expectedUrlLength: session.gatePageUrl.length,
        senderUrlLength: normalizeUrl(senderUrl).length,
      });
      return buildGateSessionUnavailableResult();
    }
    if (session.gatePageUrl !== normalizeUrl(senderUrl)) {
      recordGateLifecycleDiagnostic('gate_interstitial_session_stale', {
        reason: 'presentation_replaced', sessionId: normalizedSessionId, tabId: senderTabId,
      });
      return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
    }
    if (session.gateKind === 'detourSpreadGuard') {
      const documentId = resolveSenderDocumentId(sender);
      if (sender?.frameId !== 0 || !documentId
        || (sender.documentLifecycle !== undefined && sender.documentLifecycle !== 'active')) {
        return buildGateSessionUnavailableResult();
      }
      const tab = await resolvedBrowserPort.tabsGet(senderTabId);
      if (tab?.id !== senderTabId || tab.url !== session.gatePageUrl
        || (tab.pendingUrl !== undefined && tab.pendingUrl !== '' && tab.pendingUrl !== tab.url)) {
        return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
      }
      const current = await gateInterventionSessionRepository.getSession(normalizedSessionId);
      if (!current || current.gatePageUrl !== session.gatePageUrl) {
        return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
      }
      if (bindGateDocument) {
        const bound = await gateInterventionSessionRepository.updateSession(normalizedSessionId, (previous) => {
          // Duplicate first reads can observe the same unbound snapshot. Only
          // their own document's committed bind is an idempotent successor.
          if (previous.gatePageUrl !== current.gatePageUrl || previous.tabId !== senderTabId
            || (previous.metrics.gateDocumentId !== current.metrics.gateDocumentId
              && previous.metrics.gateDocumentId !== documentId)) throw new Error(GATE_INTERSTITIAL_SESSION_STALE);
          return { ...previous, metrics: { ...previous.metrics, gateDocumentId: documentId } };
        });
        if (!bound) return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
        return { session: bound, error: null, stale: false };
      }
      if (current.metrics.gateDocumentId !== documentId) {
        return buildGateSessionUnavailableResult(GATE_INTERSTITIAL_SESSION_STALE);
      }
      return { session: current, error: null, stale: false };
    }

    return {
      session,
      error: null,
      stale: false,
    };
  }

  async function readFreshDetourSession(session, now) {
    const inventory = await readProtectedTabInventoryOwner({ now });
    const protectedTabs = normalizeProtectedTabs(inventory?.protectedTabs);
    if (!inventory || !Array.isArray(inventory.protectedTabs)
      || protectedTabs.length !== inventory.protectedTabs.length
      || inventory.protectedTabCount !== protectedTabs.length
      || !Number.isInteger(inventory.protectedTabBudget) || inventory.protectedTabBudget < 1
      || typeof inventory.detourEnabled !== 'boolean') {
      throw new Error('GATE_INTERSTITIAL_DETOUR_INVENTORY_INVALID');
    }
    const current = await gateInterventionSessionRepository.getSession(session.sessionId);
    if (!current || current.status !== 'pending' || current.gatePageUrl !== session.gatePageUrl
      || current.metrics.gateDocumentId !== session.metrics.gateDocumentId) return null;
    return gateInterventionSessionRepository.updateSession(session.sessionId, (previous) => {
      if (previous.status !== 'pending' || previous.gatePageUrl !== session.gatePageUrl
        || previous.metrics.gateDocumentId !== session.metrics.gateDocumentId) throw new Error(GATE_INTERSTITIAL_SESSION_STALE);
      return { ...previous, protectedTabs, metrics: { ...previous.metrics,
        protectedTabCount: protectedTabs.length, protectedTabThreshold: inventory.protectedTabBudget + 1,
        maxProtectedTabs: inventory.protectedTabBudget,
        detourEnabled: inventory.detourEnabled && protectedTabs.some(tab => tab.tabId === previous.tabId && tab.url === previous.originalUrl) }, lastUpdatedAt: now };
    });
  }

  async function resumeDetourSession(session, { now = Date.now(), explicitSelection = false } = {}) {
    const navigation = await admission().selectGate(session.sessionId, session.tabId, async () => {
      const fresh = await readFreshDetourSession(session, now);
      if (!fresh) return { error: GATE_INTERSTITIAL_SESSION_STALE };
      const budget = resolveDetourSpreadProtectedTabBudget(fresh);
      if (fresh.metrics.detourEnabled && fresh.protectedTabs.length > budget) {
        return { error: 'GATE_INTERSTITIAL_PROTECTED_TAB_BUDGET_NOT_CLEARED', session: fresh };
      }
      const live = await resolvedBrowserPort.tabsGet(session.tabId);
      if (live?.id !== session.tabId || live.url !== session.gatePageUrl
        || (live.pendingUrl !== undefined && live.pendingUrl !== '' && live.pendingUrl !== live.url)) {
        return { error: GATE_INTERSTITIAL_SESSION_STALE };
      }
      const current = await gateInterventionSessionRepository.getSession(session.sessionId);
      if (!current || current.status !== 'pending' || current.gatePageUrl !== fresh.gatePageUrl
        || current.metrics.gateDocumentId !== fresh.metrics.gateDocumentId) return { error: GATE_INTERSTITIAL_SESSION_STALE };
      if (explicitSelection) await applyGateDecisionWithLedger({ session: fresh, decision: 'continue', now });
      // Budget satisfaction is not an Entry/Return approval or a timed pass.
      const resuming = await gateInterventionSessionRepository.updateSession(session.sessionId, (previous) => {
        if (previous.status !== 'pending' || previous.gatePageUrl !== fresh.gatePageUrl
          || previous.metrics.gateDocumentId !== fresh.metrics.gateDocumentId) throw new Error(GATE_INTERSTITIAL_SESSION_STALE);
        return { ...previous, status: 'resuming', resumeRequestedAt: now,
          metrics: { ...previous.metrics, detourResolution: explicitSelection ? 'selection' : 'external_budget' } };
      });
      if (!resuming) return { error: GATE_INTERSTITIAL_SESSION_STALE };
      const result = await updateTabUrl(resolvedBrowserPort, session.tabId, session.originalUrl);
      if (result.error) await gateInterventionSessionRepository.updateSession(session.sessionId, (previous) => {
        if (previous.status !== 'resuming' || previous.gatePageUrl !== fresh.gatePageUrl
          || previous.metrics.gateDocumentId !== fresh.metrics.gateDocumentId) throw new Error(GATE_INTERSTITIAL_SESSION_STALE);
        return { ...previous, status: 'pending', resumeRequestedAt: 0 };
      });
      return result;
    }, { documentHandoff: true });
    if (navigation.outcome === 'refused') return { success: false, error: 'GATE_INTERSTITIAL_ADMISSION_NOT_PRESENTED' };
    return navigation.error ? { success: false, error: navigation.error, session: navigation.session }
      : { success: true, decision: 'continue', resuming: true };
  }

  async function refreshDetourSessions({ now = Date.now() } = {}) {
    const state = await gateInterventionSessionRepository.readState();
    for (const session of Object.values(state.sessionsById)) {
      if (session.gateKind !== 'detourSpreadGuard' || session.status !== 'pending'
        || pendingDecisionsBySession.has(session.sessionId)) continue;
      const fresh = await readFreshDetourSession(session, now);
      if (!fresh) continue;
      if (!fresh.metrics.detourEnabled || fresh.protectedTabs.length <= resolveDetourSpreadProtectedTabBudget(fresh)) {
        await resumeDetourSession(fresh, { now });
      }
    }
  }

  async function getGateInterstitialSession({ sender, sessionId } = {}) {
    const authorization = await resolveAuthorizedSession(sender, sessionId, { bindGateDocument: true });
    if (!authorization.session) {
      return {
        success: false,
        error: authorization.error || GATE_INTERSTITIAL_SESSION_UNAVAILABLE,
        session: null,
        stale: authorization.stale === true,
      };
    }

    let session = authorization.session;
    if (session.gateKind === 'detourSpreadGuard' && session.status === 'pending'
      && !pendingDecisionsBySession.has(session.sessionId)) {
      session = await readFreshDetourSession(session, Date.now());
      if (!session) return { success: false, stale: true, error: GATE_INTERSTITIAL_SESSION_STALE, session: null };
      if (!session.metrics.detourEnabled || session.protectedTabs.length <= resolveDetourSpreadProtectedTabBudget(session)) {
        const resumed = await resumeDetourSession(session);
        if (resumed.success) return { ...resumed, session };
        if (resumed.error !== 'GATE_INTERSTITIAL_ADMISSION_NOT_PRESENTED') return { ...resumed, session };
      }
    }
    return {
      success: true,
      session: session.gateKind === 'detourSpreadGuard'
        ? { ...session, pruningTutorialCompleted: await pruningPresentationStore.readCompleted() }
        : session,
    };
  }

  async function performGateInterstitialDecision({
    sender,
    sessionId,
    decision,
    tabIdsToClose,
    now = Date.now(),
  } = {}) {
    const authorization = await resolveAuthorizedSession(sender, sessionId);
    const session = authorization.session;
    if (!session) {
      return {
        success: false,
        error: authorization.error || GATE_INTERSTITIAL_SESSION_UNAVAILABLE,
        stale: authorization.stale === true,
      };
    }

    let normalizedDecision = normalizeGateDecision(decision);
    let closedProtectedTabIds = [];
    const sessionStatus = typeof session.status === 'string' && session.status.trim()
      ? session.status.trim().toLowerCase()
      : 'pending';
    if (sessionStatus !== 'pending') {
      return resolveAlreadySubmittedDecisionResult(session, normalizedDecision);
    }
    const shownHistory = await captureShownHistory(session);

    if (session.gateKind === 'detourSpreadGuard') {
      const selectedTabIds = normalizeTabIdSelection(tabIdsToClose);
      if (!selectedTabIds?.length) {
        return {
          success: false,
          error: 'GATE_INTERSTITIAL_PROTECTED_TAB_SELECTION_REQUIRED',
        };
      }
      const displayedTabs = normalizeProtectedTabs(session.protectedTabs);
      const fresh = await readFreshDetourSession(session, now);
      if (!fresh) return { success: false, stale: true, error: GATE_INTERSTITIAL_SESSION_STALE };
      const protectedTabs = normalizeProtectedTabs(fresh.protectedTabs);
      const protectedTabIdSet = new Set(protectedTabs.map((entry) => entry.tabId));
      if (selectedTabIds.some((tabId) => !protectedTabIdSet.has(tabId))) {
        return {
          success: false,
          error: 'GATE_INTERSTITIAL_PROTECTED_TAB_SELECTION_INVALID',
        };
      }
      if (selectedTabIds.some((tabId) => displayedTabs.find((tab) => tab.tabId === tabId)?.url
        !== protectedTabs.find((tab) => tab.tabId === tabId)?.url)) {
        return { success: false, error: 'TAB_CLOSURE_REFUSED:stale_gate_selection_target', session: fresh };
      }
      const protectedTabBudget = resolveDetourSpreadProtectedTabBudget(fresh);
      if (protectedTabBudget === null) {
        return {
          success: false,
          error: 'GATE_INTERSTITIAL_PROTECTED_TAB_BUDGET_INVALID',
        };
      }
      const selectedTabIdSet = new Set(selectedTabIds);
      const remainingProtectedTabCount = protectedTabs
        .filter((entry) => !selectedTabIdSet.has(entry.tabId))
        .length;
      if (remainingProtectedTabCount > protectedTabBudget) {
        return {
          success: false,
          error: 'GATE_INTERSTITIAL_PROTECTED_TAB_BUDGET_NOT_CLEARED',
          remainingProtectedTabCount,
          protectedTabBudget,
        };
      }

      normalizedDecision = selectedTabIdSet.has(session.tabId) ? 'leave' : 'continue';
      const closeResult = await closePruningSelection(selectedTabIds, () => closeTabs(
        requestTabClosureOwner,
        TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_SELECTION,
        selectedTabIds,
        {
          hostname: session.hostname,
          sessionId: session.sessionId,
          reason: 'detour_spread_selection',
          sourceTabId: session.tabId,
          selection: { gatePageUrl: session.gatePageUrl,
            sourceUrl: session.originalUrl, sourceDocumentId: session.metrics.gateDocumentId,
            targets: selectedTabIds.map((tabId) => ({ tabId, url: protectedTabs.find((entry) => entry.tabId === tabId).url })),
          },
          now,
        },
      ));
      if (!closeResult.success) {
        return {
          success: false,
          error: closeResult.error || 'GATE_INTERSTITIAL_PROTECTED_TAB_CLOSE_FAILED',
        };
      }
      closedProtectedTabIds = selectedTabIds;
      if (normalizedDecision === 'continue') {
        const currentSession = await gateInterventionSessionRepository.getSessionByTabId(session.tabId);
        if (currentSession?.sessionId !== session.sessionId || currentSession.gatePageUrl !== session.gatePageUrl) {
          return { success: false, stale: true, error: GATE_INTERSTITIAL_SESSION_STALE, closedTabIds: closedProtectedTabIds };
        }
        const resumed = await resumeDetourSession(currentSession, { now, explicitSelection: true });
        if (!resumed.success) return { ...resumed, closedTabIds: closedProtectedTabIds };
      } else {
        await removeGateSession(session.sessionId);
        await applyGateDecisionWithLedger({ session: fresh, decision: normalizedDecision, now });
      }
      // A successful batch may remove the source document/session before this
      // continuation. Retain the authorized choice for its receipt and history.
      recordDetachedGateStats('recordGateDecision', buildInterventionStatsPayload(session, {
        now, decision: normalizedDecision,
      }), shownHistory);
      recordGateLedgerEntry({
        gateKind: session.gateKind, phase: INTERVENTION_PHASES.RESOLVED,
        hostname: session.hostname, tabId: session.tabId, sessionId: session.sessionId,
        decision: normalizedDecision === 'leave' ? INTERVENTION_DECISIONS.LEAVE : INTERVENTION_DECISIONS.CONTINUE,
        reason: `user_decision:closed_${closedProtectedTabIds.length}`, at: now,
      });
      return { success: true, decision: normalizedDecision, closedTabIds: closedProtectedTabIds,
        ...(normalizedDecision === 'leave' ? { error: null } : { resuming: true }) };
    }

    if (
      normalizedDecision === 'continue'
      && session.gateKind !== 'detourSpreadGuard'
      && now < session.holdUntil
    ) {
      return {
        success: false,
        error: 'GATE_INTERVENTION_HOLD_ACTIVE',
        msRemaining: Math.max(0, session.holdUntil - now),
      };
    }

    if (normalizedDecision === 'leave') {
      // Retain the displayed session and admission authority until Chrome
      // confirms removal. A rejected close is still an unresolved choice.
      let completeEffect;
      const effectCompletion = new Promise(resolve => { completeEffect = resolve; });
      const leaveHistory = recordDetachedGateStats('recordGateDecision', buildInterventionStatsPayload(session, {
        now, decision: normalizedDecision,
      }), shownHistory, effectCompletion);
      let closeResult;
      try {
        closeResult = await closeTab(
          requestTabClosureOwner,
          TAB_CLOSURE_REQUESTERS.GATE_INTERSTITIAL_LEAVE,
          session.tabId,
          {
            hostname: session.hostname,
            sessionId: session.sessionId,
            reason: 'user_decision',
            now,
          },
        );
      } finally {
        completeEffect(closeResult?.success === true);
      }
      if (!closeResult.success) {
        await leaveHistory.completion;
        return { success: false, error: closeResult.error, decision: normalizedDecision, closedTabIds: [] };
      }
      await applyGateDecisionWithLedger({ session, decision: normalizedDecision, now });
      recordGateLedgerEntry({
        gateKind: session.gateKind,
        phase: INTERVENTION_PHASES.RESOLVED,
        hostname: session.hostname,
        tabId: session.tabId,
        sessionId: session.sessionId,
        decision: INTERVENTION_DECISIONS.LEAVE,
        reason: 'user_decision',
        at: now,
      });
      await removeGateSession(session.sessionId);
      return {
        success: closeResult.success,
        error: closeResult.error,
        decision: normalizedDecision,
        closedTabIds: closeResult.success
          ? [...closedProtectedTabIds, session.tabId]
          : closedProtectedTabIds,
      };
    }

    // Keep exact displayed-session authority through approval and navigation.
    // No admission call may run inside this serialized callback.
    const updateResult = await admission().selectGate(session.sessionId, session.tabId, async () => {
      const current = await gateInterventionSessionRepository.getSession(session.sessionId);
      if (!current) return { error: 'GATE_INTERSTITIAL_SESSION_UNAVAILABLE' };
      if (current.status !== 'pending') return resolveAlreadySubmittedDecisionResult(current, normalizedDecision);
      // Persist the explicit choice before claiming navigation. If persistence
      // fails the still-pending, still-owned decision can be retried safely.
      await applyGateDecisionWithLedger({ session: current, decision: normalizedDecision, now });
      const resumingSession = await gateInterventionSessionRepository.updateSession(session.sessionId, (previousSession) => ({
        ...previousSession,
        status: 'resuming',
        resumeRequestedAt: now,
      }));
      if (!resumingSession) {
        return { success: false, error: 'GATE_INTERSTITIAL_SESSION_UNAVAILABLE' };
      }

      recordDetachedGateStats('recordGateDecision', {
        ...buildInterventionStatsPayload(session, {
          now,
          decision: normalizedDecision,
        }),
      }, shownHistory);

      const navigation = await updateTabUrl(resolvedBrowserPort, session.tabId, session.originalUrl);
      if (navigation?.error) {
        await gateInterventionSessionRepository.updateSession(session.sessionId, (previousSession) => ({
          ...previousSession,
          status: 'pending',
          resumeRequestedAt: 0,
        }));
      }
      return navigation;
    }, { documentHandoff: true });
    if (updateResult.outcome === 'refused') {
      return { success: false, stale: true, error: 'GATE_INTERSTITIAL_SESSION_UNAVAILABLE' };
    }
    if (updateResult.alreadySubmitted) return updateResult;
    if (updateResult.error) {
      return {
        success: false,
        error: updateResult.error,
        decision: normalizedDecision,
      };
    }

    recordGateLedgerEntry({
      gateKind: session.gateKind,
      phase: INTERVENTION_PHASES.RESOLVED,
      hostname: session.hostname,
      tabId: session.tabId,
      sessionId: session.sessionId,
      decision: INTERVENTION_DECISIONS.CONTINUE,
      reason: 'user_decision',
      at: now,
    });
    return {
      success: true,
      decision: normalizedDecision,
      closedTabIds: closedProtectedTabIds,
    };
  }

  function submitGateInterstitialDecision(args = {}) {
    const sessionId = normalizeSessionId(args.sessionId);
    const signature = JSON.stringify([
      resolveTrustedSenderTabId(args.sender), resolveSenderPageUrl(args.sender),
      args.sender?.id, args.sender?.frameId, args.sender?.documentId,
      args.sender?.origin, args.sender?.documentLifecycle,
      normalizeGateDecision(args.decision), normalizeTabIdSelection(args.tabIdsToClose)?.sort((a, b) => a - b),
    ]);
    const pending = pendingDecisionsBySession.get(sessionId);
    if (pending) {
      return pending.signature === signature ? pending.task : Promise.resolve({
        success: false, error: 'GATE_INTERSTITIAL_DECISION_IN_PROGRESS',
      });
    }
    // Share exact duplicate work; this is no second admission/dispatch queue.
    // Closure authority remains in the existing admission lane and arbiter.
    const task = performGateInterstitialDecision(args).finally(() => {
      if (pendingDecisionsBySession.get(sessionId)?.task === task) pendingDecisionsBySession.delete(sessionId);
    });
    pendingDecisionsBySession.set(sessionId, { signature, task });
    return task;
  }

  // The single-target message uses the same fresh-budget batch decision owner.
  // It cannot become a second, less constrained pruning path.
  function closeGateInterstitialProtectedTab({ sender, sessionId, tabId, now = Date.now() } = {}) {
    return submitGateInterstitialDecision({ sender, sessionId, tabIdsToClose: [tabId], now });
  }

  async function releaseIsolationSessions({ hostname = '', now = Date.now() } = {}) {
    const normalizedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
    const state = await gateInterventionSessionRepository.readState();
    const isolationSessions = Object.values(state?.sessionsById || {}).filter((session) => (
      session?.gateKind === 'isolation'
      && (!normalizedHostname || session?.hostname === normalizedHostname)
    ));
    await Promise.all(isolationSessions.map((session) => (
      gateInterventionSessionRepository.updateSession(session.sessionId, (current) => ({
        ...current, holdDurationMs: 0, holdUntil: Math.max(0, Math.floor(Number(now) || Date.now())),
      }))
    )));
    return { released: isolationSessions.length };
  }

  async function preparePresented(sessionId, tabId, at) {
    const session = await gateInterventionSessionRepository.getSessionByTabId(tabId);
    if (!session || session.sessionId !== sessionId) throw new Error('GATE_PRESENTATION_SESSION_STALE');
    const presentation = Object.freeze({ sessionId, tabId, presentedAt: at });
    const pending = historyTasksBySession.get(sessionId)?.events.get('shown');
    if (pending) {
      if (pending.presentation.tabId !== tabId || pending.presentation.presentedAt !== at) throw new Error('GATE_HISTORY_PRESENTATION_CONFLICT');
      const prepared = await pending.preparation;
      if (!prepared.ok) throw prepared.error;
      return Object.freeze({ ...presentation, completion: pending.completion });
    }
    if (session.metrics?.admissionPresentedAt > 0) {
      if (session.metrics.admissionPresentedAt !== at) throw new Error('GATE_HISTORY_PRESENTATION_CONFLICT');
      return Object.freeze({ ...presentation, completion: Promise.resolve() });
    }
    const payload = snapshotHistoryPayload(buildInterventionStatsPayload(session, { now: at, shownAt: at }));
    let completePreparation;
    const preparation = new Promise(resolve => { completePreparation = resolve; });
    // Register before the operational await: a concurrent choice/navigation must
    // capture this dependency even while preparation is still in the admission lane.
    const { completion } = enqueueGateHistory(sessionId, 'shown', async () => {
      try {
        const prepared = await preparation;
        if (!prepared.ok) throw prepared.error;
        await recordGateStats('recordGateShown', payload);
        // updateSession returns null for removal. Never upsert a completed or
        // replaced Gate merely to retain a historical completion marker.
        await gateInterventionSessionRepository.updateSession(sessionId, (current) => ({
          ...current, metrics: { ...current.metrics, admissionPresentedAt: at },
        }));
      } catch (error) {
        recordGateLifecycleDiagnostic('gate_presentation_history_failed', {
          sessionId, tabId, presentedAt: at, error: toErrorMessage(error),
        });
        throw error;
      }
    }, presentation, preparation);
    try {
      await recordGateInterventionShownOwner({ hostname: session.hostname, gateKind: session.gateKind,
        protectedTabCount: resolveGateShownProtectedTabCount(session), now: at });
      // The ledger records visible presentation, not a historical commit ACK.
      recordGateLedgerEntry({ gateKind: session.gateKind, phase: INTERVENTION_PHASES.SHOWN,
        hostname: session.hostname, tabId, sessionId, reason: 'visible_presentation', at });
      completePreparation(Object.freeze({ ok: true }));
    } catch (error) {
      completePreparation(Object.freeze({ ok: false, error }));
      throw error;
    }
    return Object.freeze({ ...presentation, completion });
  }

  async function recordPresented(sessionId, tabId, at) {
    const receipt = await preparePresented(sessionId, tabId, at);
    await receipt.completion;
  }

  return {
    preparePresented,
    recordPresented,
    closeGateInterstitialProtectedTab,
    getGateInterstitialSession,
    releaseIsolationSessions,
    handleTabNavigation,
    isGatePageUrl: (url) => isGatePageUrlWithPort(url, resolvedBrowserPort),
    presentForRuntimeSnapshot,
    readTabSession: (tabId) => gateInterventionSessionRepository.getSessionByTabId(tabId),
    refreshDetourSessions,
    removeTabSession,
    submitGateInterstitialDecision,
  };
}

export default createGateInterstitialController;
