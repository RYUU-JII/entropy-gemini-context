import observerHub from '../../../lib/dom/ObserverHub.js';
import { videoElementObserver } from '../video/VideoElementObserver.js';
import {
  acquireFrictionDebugLease,
  FRICTION_DEBUG_FLAG_STORAGE_KEY,
  isFrictionDebugEnabled,
} from '@friction-debug-flags';
import {
  beginRuntimeDiscoverySession,
  readRuntimeDiscoveryLedgerSnapshot,
  stopRuntimeDiscoverySession,
} from '@runtime-discovery-ledger';
import {
  beginRuntimeContentionSession,
  projectRuntimeContentionWindow,
  readRuntimeContentionLedgerSnapshot,
  stopRuntimeContentionSession,
} from '@runtime-contention-ledger';
import {
  readPageLocalBooleanFlag,
  readPageLocalStorageItem,
  removePageLocalStorageItem,
  writePageLocalStorageItem,
} from '../../../platform/browser/pageLocalStorage.js';
import {
  beginLoadedSocialMetricsDebugMeasurementEpoch,
  getLoadedSocialMetricsDebugSnapshot,
  setSocialMetricsDebugAuditMode,
} from '../visual/lazySocialMetricsManager.js';
import {
  createProtectionDiagnosticsSnapshot,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import InteractionManager from '../interactionManager.js';
import TextShuffleManager from '../textShuffleManager.js';
import RuntimeDebuggerFeedProbe from './RuntimeDebuggerFeedProbe.js';
import RuntimeDebuggerOverlay from './RuntimeDebuggerOverlay.js';
import RuntimeDebuggerSentinelProbe from './RuntimeDebuggerSentinelProbe.js';
import RuntimeDebuggerEffectProbe from './RuntimeDebuggerEffectProbe.js';
import RuntimeDebuggerShortFormOracle from './RuntimeDebuggerShortFormOracle.js';
import {
  buildRuntimeDebuggerFullReport,
  buildRuntimeDebuggerItemReport,
  createRuntimeDebuggerCrossOwnerDiscoveryLedger,
  createRuntimeDebuggerSession,
  createRuntimeDebuggerSessionPayload,
  recordRuntimeDebuggerEvidenceGap,
  recordRuntimeDebuggerEvent,
  recordRuntimeDebuggerSample,
  sanitizeRuntimeDebuggerValue,
} from './core/index.js';
import {
  createRuntimeDebuggerProbeResults,
  RUNTIME_DEBUGGER_TAB_TO_PROBE_ID,
} from './RuntimeDebuggerProbeCatalog.js';
import {
  CLICK_GATE_TAB_ID,
  createClickGateSnapshot,
  formatSelectorMatchSummary,
  formatYouTubeContractSummary,
  summarizeClickRoutingDecision,
  summarizeClickRoutingTimeline,
} from './RuntimeDebuggerClickGate.js';
import FeedTerminusController from '../feed-flow/terminus/FeedTerminusController.js';
import { SENTINEL_TELEMETRY_GLOBAL_KEY } from '../nudge/nudgeGameHudTelemetry.js';
import feedHorizonInspection from '@feed-horizon-inspection';
import interventionAdmissionClient from '../runtime/interventionAdmissionClient.js';
import { ENSO_SPAWN_SOURCES } from '../interaction/ensoSpawnSources.js';

const OPEN_FLAG_KEY = 'entropy.runtimeDebugger.open';
const TERMINUS_FLAG_KEY = 'entropy.runtimeDebugger.terminus';
const CAPTURE_KIND_FLAG_KEY = 'entropy.runtimeDebugger.captureKind';
const SAMPLE_INTERVAL_MS = 750;
const MAX_ERRORS = 24;
const TERMINUS_DRY_RUN_ADMISSION = Object.freeze({
  version: 1,
  status: 'admitted',
  admitted: true,
  source: 'runtime_debugger',
  episodeKind: 'feed_horizon',
  reasons: Object.freeze(['runtime_debugger_dry_run']),
});

function readOpenFlag() {
  return readPageLocalBooleanFlag(OPEN_FLAG_KEY, { fallback: false });
}

function writeOpenFlag(enabled) {
  return enabled ? writePageLocalStorageItem(OPEN_FLAG_KEY, '1')
    : removePageLocalStorageItem(OPEN_FLAG_KEY);
}

function readTerminusFlag() {
  return readPageLocalBooleanFlag(TERMINUS_FLAG_KEY, { fallback: false });
}

function writeTerminusFlag(enabled) {
  if (enabled) writePageLocalStorageItem(TERMINUS_FLAG_KEY, '1');
  else removePageLocalStorageItem(TERMINUS_FLAG_KEY);
}

function resolveTerminusDryRunPhase(enabled, endpoint = null) {
  if (!enabled) return 'inactive';
  if (endpoint?.continueIntentPending === true) return 'release_pending';
  if (endpoint?.controlsLive === true) return 'controls_live';
  if (endpoint?.boundaryReached === true) return 'feed_dry';
  if (endpoint?.active === true || endpoint?.leaseState === 'committed') return 'feed_drying';
  if (endpoint?.armed === true) return 'endpoint_pending';
  return 'arming';
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function readCaptureKindFlag() {
  const captureKind = readPageLocalStorageItem(CAPTURE_KIND_FLAG_KEY, null);
  return captureKind === 'reload' ? 'reload' : 'live';
}

function consumeCaptureKindFlag() {
  const captureKind = readCaptureKindFlag();
  removePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY);
  return captureKind;
}

function getRuntimeDebuggerErrorMessage(error, fallback = 'RUNTIME_DEBUGGER_FAILURE') {
  return String(error?.message || error || fallback);
}

function createEnsoGateAutomationSurfaceSnapshot(documentRef) {
  const surfaces = documentRef?.querySelectorAll?.('.friction-click-enso-gate');
  const surfaceCount = Number(surfaces?.length) || 0;
  if (surfaceCount > 1) {
    throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_SURFACE_DUPLICATE');
  }
  const surface = surfaceCount === 1 ? surfaces[0] : null;
  const readState = (fieldName) => {
    const value = surface?.dataset?.[fieldName];
    return typeof value === 'string' && value ? value : null;
  };
  return Object.freeze({
    active: surface !== null,
    surfaceCount,
    entry: readState('entry'),
    zone: readState('zone'),
    feedback: readState('feedback'),
    resolving: surface?.dataset?.resolving === 'true',
    outcome: readState('outcome'),
    canvasPresent: surface !== null && surface.querySelector(
      '.friction-click-enso-gate__gesture-canvas',
    ) !== null,
  });
}

function fmtNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '0';
}

function getLatestProtection(payload = {}) {
  return payload.latest?.protection || {};
}

function getLatestClickGate(payload = {}) {
  return payload.latest?.clickGate || createClickGateSnapshot(getLatestProtection(payload));
}

function getPayloadErrors(payload = {}) {
  if (Array.isArray(payload.errors)) return payload.errors;
  return Array.isArray(payload.latest?.debugger?.errors) ? payload.latest.debugger.errors : [];
}

function readSentinelGameTelemetry(windowRef = null) {
  const snapshot = windowRef?.[SENTINEL_TELEMETRY_GLOBAL_KEY];
  if (!snapshot || typeof snapshot !== 'object') return null;
  return snapshot;
}

function attachSentinelGameTelemetry(snapshot = {}, windowRef = null) {
  const telemetry = readSentinelGameTelemetry(windowRef);
  if (!telemetry) return snapshot;
  return {
    ...snapshot,
    telemetry,
    game: telemetry.globalSentinel || null,
  };
}

function summarizeFeatureHistory(feature = {}, limit = 10) {
  const history = Array.isArray(feature.history) ? feature.history.slice(-limit).reverse() : [];
  if (history.length === 0) return '- 최근 feature 이벤트가 없습니다.';
  return history.map((entry, index) => {
    const label = entry.name || entry.type || '-';
    const details = entry.details && typeof entry.details === 'object'
      ? Object.entries(entry.details)
        .slice(0, 5)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' ')
      : '';
    return `${index + 1}. ${label}${entry.error ? ` error=${entry.error}` : ''}${details ? ` ${details}` : ''}`;
  }).join('\n');
}

const VIDEO_SKIP_SEEK_DECISION_EVENTS = Object.freeze([
  'seek_allowed_unattributed',
  'seek_detected_user',
  'seek_allowed_cooldown_started',
  'seek_ignored_small_delta',
  'seek_blocked_hard_block',
  'seek_blocked_cooldown',
  'seek_blocked_delayed_programmatic_followup',
  'seek_blocked_delayed_programmatic_replay',
  'seek_blocked_during_revert',
]);

function findLastVideoSeekDecision(feature = {}) {
  const history = Array.isArray(feature.history) ? feature.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.type === 'event' && VIDEO_SKIP_SEEK_DECISION_EVENTS.includes(entry.name)) {
      return entry;
    }
  }
  return null;
}

function summarizeVideoSeekDecision(feature = {}) {
  const entry = findLastVideoSeekDecision(feature);
  if (!entry) return '- 아직 seek 판단 이벤트가 없습니다.';
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  const frame = details.frame && typeof details.frame === 'object' ? details.frame : {};
  const event = details.seekingEvent && typeof details.seekingEvent === 'object' ? details.seekingEvent : {};
  const parts = [
    `event=${entry.name || '-'}`,
    details.reason ? `reason=${details.reason}` : '',
    Number.isFinite(Number(details.delta)) ? `delta=${details.delta}` : '',
    Number.isFinite(Number(details.from)) && Number.isFinite(Number(details.to))
      ? `range=${details.from}->${details.to}`
      : '',
    typeof details.userGestureRecent === 'boolean' ? `gestureRecent=${details.userGestureRecent}` : '',
    typeof details.mediaSeekGestureRecent === 'boolean' ? `mediaSeekRecent=${details.mediaSeekGestureRecent}` : '',
    details.gestureAgeMs !== null && details.gestureAgeMs !== undefined ? `gestureAgeMs=${details.gestureAgeMs}` : '',
    details.lastGesture?.type ? `lastGesture=${details.lastGesture.type}` : '',
    typeof details.lastGesture?.mediaSeekContext === 'boolean' ? `mediaContext=${details.lastGesture.mediaSeekContext}` : '',
    event.type ? `domEvent=${event.type}${event.isTrusted === true ? ':trusted' : ':untrusted'}` : '',
    typeof frame.topFrame === 'boolean' ? `topFrame=${frame.topFrame}` : '',
    frame.frameElementTagName ? `frame=${frame.frameElementTagName}` : '',
    details.policyMode ? `policy=${details.policyMode}` : '',
    Number.isFinite(Number(details.targetTime)) ? `target=${details.targetTime}` : '',
  ].filter(Boolean);
  return `- ${parts.join(' ')}`;
}

function createClickGateDiagnosticContext(payload) {
  const protection = getLatestProtection(payload);
  const clickGate = getLatestClickGate(payload);
  const feature = protection.features?.ensoGate || {};
  const lastDecision = clickGate.lastDecision || null;
  const details = lastDecision?.details && typeof lastDecision.details === 'object' ? lastDecision.details : {};
  const debuggerErrors = getPayloadErrors(payload).slice(-8);
  const evidence = {
    url: payload.url,
    capturedAt: payload.capturedAt,
    debugger: { errors: debuggerErrors },
    clickGate,
    ensoGate: {
      summary: protection.summary?.features?.ensoGate || null,
      eventCounts: feature.eventCounts || {},
      lastEvent: feature.lastEvent || null,
      lastError: feature.lastError || null,
      recentHistory: Array.isArray(feature.history) ? feature.history.slice(-20) : [],
    },
  };
  return [
    '컨트롤 클릭이 왜 bypass되지 않고 commit-pause/Enso-gate로 갔는지 판정할 때 selector match ladder, trusted gesture bypass, clickBoundary brake를 우선 확인하세요.',
    '',
    `- Enso Gate 상태: ${clickGate.status || '-'} / last=${feature.lastEvent?.name || '-'}`,
    `- 디버거 오류: ${fmtNum(debuggerErrors.length)}`,
    '',
    '### 마지막 클릭 라우팅 판정',
    summarizeClickRoutingDecision(lastDecision),
    '',
    '### 셀렉터 매치 사다리',
    `- ${formatSelectorMatchSummary(details.selectorMatches)}`,
    '',
    '### YouTube 컨트롤 계약',
    `- ${formatYouTubeContractSummary(details.youtube)}`,
    '',
    '### 클릭 경계 분류',
    `- ${details.clickBoundary ? JSON.stringify(details.clickBoundary) : '-'}`,
    '',
    '### 최근 클릭 라우팅 판정',
    summarizeClickRoutingTimeline(clickGate.recentDecisions),
    '',
    '### 클릭 전용 최신 근거',
    '```json',
    JSON.stringify(evidence, null, 2),
    '```',
  ].join('\n');
}

function createVideoDiagnosticContext(payload) {
  const protection = getLatestProtection(payload);
  const videoSkip = payload.latest?.videoSkip || {};
  const debuggerErrors = getPayloadErrors(payload).slice(-8);
  const evidence = {
    url: payload.url,
    capturedAt: payload.capturedAt,
    debugger: { errors: debuggerErrors },
    videoSkipGuard: videoSkip,
    recentRuntimeHistory: Array.isArray(protection.history) ? protection.history.slice(-20) : [],
  };
  return [
    'seek evidence로 사용자 제스처, 프로그램 seek, delayed follow-up 억제가 어떤 판정으로 흘렀는지 확인하세요.',
    '',
    `- 스킵가드: ${videoSkip.active ? 'active' : 'inactive'} / last=${videoSkip.lastEvent?.name || '-'}`,
    `- 디버거 오류: ${fmtNum(debuggerErrors.length)}`,
    '',
    '### 스킵가드 마지막 seek 판단',
    summarizeVideoSeekDecision(videoSkip),
    '',
    '### 스킵가드 최근 타임라인',
    summarizeFeatureHistory(videoSkip, 14),
    '',
    '### 스킵 전용 최신 근거',
    '```json',
    JSON.stringify(evidence, null, 2),
    '```',
  ].join('\n');
}

async function copyTextToClipboard(text, documentRef) {
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') return false;
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  documentRef.body.appendChild(textarea);
  textarea.select();
  try {
    return documentRef.execCommand('copy') === true;
  } finally {
    textarea.remove();
  }
}

export class RuntimeDebuggerRuntime {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    overlay = null,
    feedProbe = null,
    sentinelProbe = null,
    effectProbe = null,
    shortFormOracle = null,
    terminusController = null,
    feedActuationContextProvider = null,
    feedEpisodeSnapshotProvider = null,
    feedHorizonInspectionSession = feedHorizonInspection,
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._overlay = overlay || new RuntimeDebuggerOverlay({ documentRef });
    this._feedProbe = feedProbe || new RuntimeDebuggerFeedProbe({ windowRef, documentRef });
    this._sentinelProbe = sentinelProbe || new RuntimeDebuggerSentinelProbe();
    this._effectProbe = effectProbe || new RuntimeDebuggerEffectProbe();
    this._shortFormOracle = shortFormOracle || new RuntimeDebuggerShortFormOracle({
      windowRef,
      documentRef,
      hub: observerHub,
    });
    this._terminusController = terminusController
      || new FeedTerminusController({ windowRef, documentRef });
    this._feedActuationContextProvider = typeof feedActuationContextProvider === 'function'
      ? feedActuationContextProvider
      : null;
    this._feedEpisodeSnapshotProvider = typeof feedEpisodeSnapshotProvider === 'function'
      ? feedEpisodeSnapshotProvider
      : null;
    if (
      !feedHorizonInspectionSession
      || typeof feedHorizonInspectionSession.control !== 'function'
      || typeof feedHorizonInspectionSession.isActive !== 'function'
      || typeof feedHorizonInspectionSession.observeEpisodeSnapshot !== 'function'
      || typeof feedHorizonInspectionSession.prepareAutomationSession !== 'function'
      || typeof feedHorizonInspectionSession.clearSurface !== 'function'
    ) {
      throw new Error('RUNTIME_DEBUGGER_FEED_HORIZON_INSPECTION_SEAM_INVALID');
    }
    this._feedHorizonInspection = feedHorizonInspectionSession;
    this._feedHorizonControlRevision = 0;
    // Dry-run actuator uses the same live local endpoint context as protection;
    // it cannot synthesize a body/root fallback when no stable feed target exists.
    this._terminusDryRun = false;
    this._armed = false;
    this._running = false;
    this._paused = false;
    this._timer = null;
    this._errors = [];
    this._session = null;
    this._latest = null;
    this._startedAt = null;
    this._captureKind = 'live';
    this._releaseDebugLease = null;
    this._releaseVideoObservation = null;
    this._releaseAutomationDebugLease = null;
    this._forceDebugLeaseRequired = false;
    this._automationSessionActive = false;
    this._automationPresentationSuppressed = false;
    this._producerEventCursors = new Map();
    this._activeTab = 'observer';
    this._boundToggle = () => this._toggleSession();
    this._boundAction = (action) => this._handleAction(action);
    this._boundTab = (tab) => this._setActiveTab(tab);
    this._boundTick = () => this._tick();
  }

  setFeedActuationContextProvider(provider) {
    if (provider !== null && typeof provider !== 'function') {
      throw new Error('RUNTIME_DEBUGGER_FEED_ACTUATION_CONTEXT_PROVIDER_INVALID');
    }
    this._feedActuationContextProvider = provider;
  }

  setFeedEpisodeSnapshotProvider(provider) {
    if (provider !== null && typeof provider !== 'function') {
      throw new Error('RUNTIME_DEBUGGER_FEED_EPISODE_SNAPSHOT_PROVIDER_INVALID');
    }
    this._feedEpisodeSnapshotProvider = provider;
  }

  arm({ force = false, open = false } = {}) {
    if (!this._window || !this._document) return;
    if (!force && !isFrictionDebugEnabled()) return;
    if (force) {
      this._forceDebugLeaseRequired = true;
      if (open || readOpenFlag()) this._ensureRuntimeDebugLease();
    }
    if (open) writeOpenFlag(true);
    if (this._armed) {
      if (open) this._startSession();
      this._render();
      return;
    }
    this._terminusDryRun = readTerminusFlag();
    let mounted = false;
    try {
      mounted = this._overlay.mount({
        onToggle: this._boundToggle,
        onAction: this._boundAction,
        onTab: this._boundTab,
      });
    } catch (error) {
      this._recordFailure('overlay_mount', error);
      this._releaseRuntimeDebugLease();
      this._forceDebugLeaseRequired = false;
      return;
    }
    if (!mounted) {
      this._recordFailure('overlay_mount', new Error('RUNTIME_DEBUGGER_OVERLAY_MOUNT_FAILED'));
      this._releaseRuntimeDebugLease();
      this._forceDebugLeaseRequired = false;
      return;
    }
    this._armed = true;
    if (readOpenFlag()) this._startSession();
    this._render();
  }

  teardown() {
    this._stopSession({ persist: false });
    this._automationSessionActive = false;
    this._automationPresentationSuppressed = false;
    this._feedHorizonInspection.clearSurface();
    this._releaseAutomationRuntimeDebugLease();
    try {
      this._overlay.unmount();
    } catch (error) {
      this._recordFailure('overlay_unmount', error);
    }
    this._releaseRuntimeDebugLease();
    this._forceDebugLeaseRequired = false;
    this._armed = false;
  }

  releaseForcedArm() {
    if (!this._forceDebugLeaseRequired) return false;
    this._forceDebugLeaseRequired = false;
    this._releaseRuntimeDebugLease();
    if (isFrictionDebugEnabled()) {
      this._render();
      return false;
    }
    writeOpenFlag(false);
    this.teardown();
    return true;
  }

  _ensureRuntimeDebugLease() {
    if (!this._forceDebugLeaseRequired || this._releaseDebugLease) return;
    this._releaseDebugLease = acquireFrictionDebugLease('runtime_debugger');
  }

  _releaseRuntimeDebugLease() {
    if (!this._releaseDebugLease) return;
    const release = this._releaseDebugLease;
    this._releaseDebugLease = null;
    release();
    observerHub.refreshDebugMode?.(true);
  }

  _ensureAutomationRuntimeDebugLease() {
    if (this._releaseAutomationDebugLease) return;
    this._releaseAutomationDebugLease = acquireFrictionDebugLease(
      'runtime_debugger_automation',
    );
    observerHub.refreshDebugMode?.(true);
  }

  _releaseAutomationRuntimeDebugLease() {
    if (!this._releaseAutomationDebugLease) return;
    const release = this._releaseAutomationDebugLease;
    this._releaseAutomationDebugLease = null;
    release();
    observerHub.refreshDebugMode?.(true);
  }

  isSessionActive() {
    return this._running;
  }

  isFeedObservationActive() {
    return this._running;
  }

  startAutomationSession({ captureKind = 'live' } = {}) {
    if (this._running || this._automationSessionActive) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_SESSION_ALREADY_ACTIVE');
    }
    if (captureKind !== 'live' && captureKind !== 'reload') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_CAPTURE_KIND_INVALID');
    }
    this._automationSessionActive = true;
    this._automationPresentationSuppressed = true;
    this._terminusDryRun = false;
    try {
      this._feedHorizonInspection.prepareAutomationSession();
      this._ensureAutomationRuntimeDebugLease();
      const started = this._startSession({
        persist: false,
        captureKind,
        throwOnFailure: true,
      });
      if (!started) {
        throw new Error('RUNTIME_DEBUGGER_AUTOMATION_SESSION_START_FAILED');
      }
      return this.getSessionPayload();
    } catch (error) {
      this._automationSessionActive = false;
      this._automationPresentationSuppressed = false;
      this._feedHorizonInspection.clearSurface();
      this._releaseAutomationRuntimeDebugLease();
      throw error;
    }
  }

  resetAutomationSession() {
    this._assertAutomationSessionActive();
    this._resetSession({
      statusText: null,
      throwOnFailure: true,
    });
    return this.getSessionPayload();
  }

  snapshotAutomationSession() {
    this._assertAutomationSessionActive();
    this._tick({ force: true, throwOnFailure: true });
    return this.getSessionPayload();
  }

  projectRuntimeContentionWindowAutomation({ startedAt, endedAt } = {}) {
    this._assertAutomationSessionActive();
    return projectRuntimeContentionWindow({ startedAt, endedAt });
  }

  reportAutomationSession() {
    const payload = this.snapshotAutomationSession();
    return {
      payload,
      markdown: this._buildSummaryText('all'),
    };
  }

  setTerminusDryRunAutomation({ enabled } = {}) {
    this._assertAutomationSessionActive();
    if (typeof enabled !== 'boolean') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_TERMINUS_ENABLED_INVALID');
    }
    if (enabled && this._feedHorizonInspection.isActive()) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_FEED_HORIZON_MODE_CONFLICT');
    }
    this._terminusDryRun = enabled;
    this._syncTerminus();
    this._tick({ force: true, throwOnFailure: true });
    return this.getSessionPayload();
  }

  async controlFeedHorizonInspectionAutomation(control = {}) {
    this._assertAutomationSessionActive();
    const revision = ++this._feedHorizonControlRevision;
    if (control?.command !== 'disarm' && this._terminusDryRun) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_FEED_HORIZON_MODE_CONFLICT');
    }
    if (control.command === 'disarm') {
      this._feedHorizonInspection.control(control);
    } else {
      if (control.command === 'rearm' && this._feedHorizonInspection.isActive()) {
        this._feedHorizonInspection.control({ command: 'disarm' });
      }
      const admission = await interventionAdmissionClient.prepare({
        kind: 'enso_gate', source: ENSO_SPAWN_SOURCES.FEED_HORIZON, manual: true,
      });
      if (!admission.accepted) {
        throw new Error(`FEED_HORIZON_INSPECTION_RESERVATION_DENIED:${admission.reason}`);
      }
      try {
        this._assertAutomationSessionActive();
        if (revision !== this._feedHorizonControlRevision) {
          throw new Error('FEED_HORIZON_INSPECTION_COMMAND_CANCELLED');
        }
        this._feedHorizonInspection.control(control);
      } catch (error) {
        interventionAdmissionClient.abort(admission.lease);
        throw error;
      }
    }
    this._tick({ force: true, throwOnFailure: true });
    return this.getSessionPayload();
  }

  setFeedConsumptionResearchAutomation({ enabled } = {}) {
    this._assertAutomationSessionActive();
    if (typeof enabled !== 'boolean') {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_FEED_RESEARCH_ENABLED_INVALID');
    }
    // The live collector and its writer were retired. A successful-looking
    // no-op fence would falsely certify isolation to old browser journeys.
    throw new Error('RUNTIME_DEBUGGER_FEED_RESEARCH_OFFLINE_ONLY');
  }

  async forceEnsoGateAutomation(options = {}) {
    this._assertAutomationSessionActive();
    const result = await InteractionManager.forceEnsoGateForDebug(options);
    if (result?.ok !== true) {
      // The automation relay transports bounded error codes. Keep the actual
      // admission refusal so a missing prerequisite is distinguishable from a
      // rendering failure, without exposing arbitrary page text in that code.
      if (typeof result?.reason !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(result.reason)) {
        throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_FORCE_REASON_INVALID');
      }
      throw new Error(`RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_FORCE_REJECTED:${result.reason.toUpperCase()}`);
    }
    const surface = createEnsoGateAutomationSurfaceSnapshot(this._document);
    if (!surface.active || !surface.canvasPresent) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_FORCE_UNCONFIRMED');
    }
    return Object.freeze({
      forced: true,
      reason: result.reason || 'spawned',
      surface,
    });
  }

  dismissEnsoGateAutomation() {
    this._assertAutomationSessionActive();
    const before = createEnsoGateAutomationSurfaceSnapshot(this._document);
    const dismissed = InteractionManager.cancelEnsoGateForSource(
      'runtime_debugger',
      'runtime_debugger_automation_dismiss',
    );
    const surface = createEnsoGateAutomationSurfaceSnapshot(this._document);
    if ((before.active && dismissed !== true) || surface.active) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_DISMISS_UNCONFIRMED');
    }
    return Object.freeze({
      dismissed: dismissed === true,
      reason: dismissed === true ? 'dismissed' : 'already_inactive',
      surface,
    });
  }

  stopAutomationSession() {
    this._assertAutomationSessionActive();
    let result;
    try {
      result = this.reportAutomationSession();
    } finally {
      this._stopSession({ persist: false });
      this._automationSessionActive = false;
      this._automationPresentationSuppressed = false;
      this._releaseAutomationRuntimeDebugLease();
      if (this._armed) this._render();
    }
    return result;
  }

  _assertAutomationSessionActive() {
    if (!this._automationSessionActive || !this._running) {
      throw new Error('RUNTIME_DEBUGGER_AUTOMATION_SESSION_INACTIVE');
    }
  }

  _getCurrentUrl() {
    return String(this._window?.location?.href || '');
  }

  _captureSnapshot({ wallTime = Date.now(), mode = 'preview' } = {}) {
    const protection = createProtectionDiagnosticsSnapshot();
    let effectRead;
    if (mode === 'baseline') {
      effectRead = this._effectProbe.sample({ establishBaseline: true, capturedAt: wallTime });
    } else if (mode === 'sample') {
      effectRead = this._effectProbe.sample({ capturedAt: wallTime });
    } else {
      effectRead = { effects: this._effectProbe.getSnapshot(), events: [], evidenceGaps: [] };
    }
    const effects = effectRead.effects || {};
    const feedProbeSnapshot = mode === 'sample'
      ? this._feedProbe.sample(wallTime)
      : this._feedProbe.getSnapshot();
    if (!feedProbeSnapshot || typeof feedProbeSnapshot !== 'object') {
      throw new Error('RUNTIME_DEBUGGER_FEED_SNAPSHOT_INVALID');
    }
    const feedEpisode = this._feedEpisodeSnapshotProvider
      ? this._feedEpisodeSnapshotProvider({ now: wallTime })
      : null;
    if (
      this._feedEpisodeSnapshotProvider
      && (!feedEpisode || typeof feedEpisode !== 'object')
    ) {
      throw new Error('RUNTIME_DEBUGGER_FEED_EPISODE_SNAPSHOT_INVALID');
    }
    const inspectionSnapshot = this._feedHorizonInspection.observeEpisodeSnapshot(
      feedEpisode,
      { now: wallTime },
    );
    const projectedFeedEpisode = feedEpisode
      ? {
        ...feedEpisode,
        inspection: inspectionSnapshot,
      }
      : null;
    const dryRunEndpoint = typeof this._terminusController.getEndpointState === 'function'
      ? this._terminusController.getEndpointState({ now: wallTime })
      : null;
    const feedFlow = {
      ...feedProbeSnapshot,
      episode: projectedFeedEpisode,
      dryRun: {
        enabled: this._terminusDryRun,
        phase: resolveTerminusDryRunPhase(this._terminusDryRun, dryRunEndpoint),
        endpoint: dryRunEndpoint
          ? {
            armed: dryRunEndpoint.armed === true,
            active: dryRunEndpoint.active === true,
            controlsLive: dryRunEndpoint.controlsLive === true,
            continueIntentPending: dryRunEndpoint.continueIntentPending === true,
            boundaryReached: dryRunEndpoint.boundaryReached === true,
            leaseState: dryRunEndpoint.leaseState || 'unknown',
            resolutionStatus: dryRunEndpoint.resolutionStatus || 'unknown',
            resolutionReasons: Array.isArray(dryRunEndpoint.resolutionReasons)
              ? [...dryRunEndpoint.resolutionReasons]
              : [],
          }
          : null,
      },
    };
    const sentinelSnapshot = mode === 'sample'
      ? this._sentinelProbe.sample(wallTime)
      : this._sentinelProbe.getSnapshot();
    const videoSkip = protection.features?.videoSkipGuard || {};
    const observerHubSnapshot = observerHub.getDebugSnapshot?.() || {};
    const shortFormOwnerSnapshot = effects.shortForm || {};
    const shortFormCompleteness = this._shortFormOracle.getSnapshot({
      active: shortFormOwnerSnapshot.active === true,
      ownerAvailable: shortFormOwnerSnapshot.available !== false
        && shortFormOwnerSnapshot.loaded !== false,
      ownerObserverAttached: shortFormOwnerSnapshot.observerAttached === true,
      observerHubSnapshot,
      productOperations: shortFormOwnerSnapshot.recentOperations,
    });
    return {
      snapshot: {
        wallTime,
        elapsedMs: this._startedAt ? Math.max(0, wallTime - this._startedAt) : 0,
        perfNow: Number(nowMs().toFixed(2)),
        runtimeContention: readRuntimeContentionLedgerSnapshot(),
        observerHub: observerHubSnapshot,
        socialMetrics: getLoadedSocialMetricsDebugSnapshot(),
        visual: effects.visual || {},
        textShuffle: effects.textShuffle || {},
        shortForm: {
          ...shortFormOwnerSnapshot,
          completeness: shortFormCompleteness,
        },
        videoObservation: effects.videoObservation || {},
        feedFlow,
        protection,
        clickGate: createClickGateSnapshot(protection),
        videoSkip,
        sentinel: attachSentinelGameTelemetry(sentinelSnapshot, this._window),
        debugger: {
          activeTab: this._activeTab,
          paused: this._paused,
          captureKind: this._captureKind,
          errors: [...this._errors],
        },
      },
      events: Array.isArray(effectRead.events) ? effectRead.events : [],
      evidenceGaps: Array.isArray(effectRead.evidenceGaps) ? effectRead.evidenceGaps : [],
    };
  }

  _createSessionBaseline({ captureKind = 'live', startedAt = Date.now() } = {}) {
    this._captureKind = captureKind;
    this._startedAt = startedAt;
    beginRuntimeContentionSession();
    beginRuntimeDiscoverySession();
    beginLoadedSocialMetricsDebugMeasurementEpoch();
    this._effectProbe.resetEventCursors?.();
    const { snapshot } = this._captureSnapshot({ wallTime: startedAt, mode: 'baseline' });
    this._session = createRuntimeDebuggerSession({
      baseline: snapshot,
      startedAt,
      url: this._getCurrentUrl(),
      captureKind,
    });
    this._latest = snapshot;
    this._primeProducerEventCursors(snapshot);
    return this._session;
  }

  _ensureSession() {
    if (this._session) return this._session;
    return this._createSessionBaseline({ captureKind: 'idle', startedAt: Date.now() });
  }

  _primeProducerEventCursors(snapshot = {}) {
    this._producerEventCursors.clear();
    this._producerEventCursors.set(
      'observerHub',
      Number(snapshot.observerHub?.lastFlushId) || 0,
    );
    this._producerEventCursors.set(
      'socialMetrics',
      Number(snapshot.socialMetrics?.operations ?? snapshot.socialMetrics?.stats?.scanOperations) || 0,
    );
  }

  _recordSessionEvent(event, capturedAt = Date.now()) {
    if (!this._session) return;
    recordRuntimeDebuggerEvent(this._session, event, { capturedAt });
  }

  _recordProducerEvents(
    snapshot,
    effectEvents = [],
    effectEvidenceGaps = [],
    capturedAt = Date.now(),
  ) {
    effectEvents.forEach((event) => this._recordSessionEvent(event, capturedAt));
    effectEvidenceGaps.forEach((gap) => {
      recordRuntimeDebuggerEvidenceGap(this._session, gap, { capturedAt });
    });

    const observerCursor = Number(this._producerEventCursors.get('observerHub')) || 0;
    const flushes = Array.isArray(snapshot.observerHub?.recentFlushes)
      ? snapshot.observerHub.recentFlushes
      : [];
    const observerLastFlushId = Number(snapshot.observerHub?.lastFlushId) || observerCursor;
    const addedFlushes = flushes.filter((entry) => Number(entry?.flushId) > observerCursor);
    recordRuntimeDebuggerEvidenceGap(this._session, {
      probeId: 'observerHub',
      source: 'recent_flushes',
      expectedOperations: Math.max(0, observerLastFlushId - observerCursor),
      retainedEvents: addedFlushes.length,
    }, { capturedAt });
    addedFlushes.forEach((entry) => this._recordSessionEvent({
      probeId: 'observerHub',
      type: 'mutation_flush',
      details: entry,
    }, capturedAt));
    this._producerEventCursors.set(
      'observerHub',
      observerLastFlushId,
    );

    const socialCursor = Number(this._producerEventCursors.get('socialMetrics')) || 0;
    const socialCount = Number(
      snapshot.socialMetrics?.operations ?? snapshot.socialMetrics?.stats?.scanOperations,
    ) || 0;
    const addedSocialOperations = Math.max(0, socialCount - socialCursor);
    const socialOperations = Array.isArray(snapshot.socialMetrics?.recentOperations)
      ? snapshot.socialMetrics.recentOperations
      : [];
    const addedSocialEvents = addedSocialOperations > 0
      ? socialOperations.slice(-Math.min(addedSocialOperations, socialOperations.length))
      : [];
    recordRuntimeDebuggerEvidenceGap(this._session, {
      probeId: 'socialMetrics',
      source: 'recent_operations',
      expectedOperations: addedSocialOperations,
      retainedEvents: addedSocialEvents.length,
    }, { capturedAt });
    addedSocialEvents.forEach((entry) => this._recordSessionEvent({
      probeId: 'socialMetrics',
      type: 'scan_operation',
      details: entry,
    }, capturedAt));
    this._producerEventCursors.set('socialMetrics', socialCount);
  }

  _getProbeResults() {
    return createRuntimeDebuggerProbeResults(this._ensureSession());
  }

  getSessionPayload() {
    const session = this._ensureSession();
    const payload = createRuntimeDebuggerSessionPayload(session, {
      probeResults: this._getProbeResults(),
    });
    const discoveryOwnerLedger = createRuntimeDebuggerCrossOwnerDiscoveryLedger({
      events: payload.events,
      evidenceGaps: payload.evidenceGaps,
      exactEvidence: readRuntimeDiscoveryLedgerSnapshot(),
      owners: {
        socialMetrics: {
          active: payload.latest.socialMetrics?.active === true,
          available: payload.latest.socialMetrics?.loaded === true,
          observerAttached: payload.latest.socialMetrics?.observerAttached === true,
        },
        shortForm: {
          active: payload.latest.shortForm?.active === true,
          available: payload.latest.shortForm?.available !== false
            && payload.latest.shortForm?.loaded !== false,
          observerAttached: payload.latest.shortForm?.observerAttached === true,
        },
      },
    });
    payload.latest.debugger = sanitizeRuntimeDebuggerValue({
      activeTab: this._activeTab,
      paused: this._paused,
      captureKind: this._captureKind,
      errors: [...this._errors],
      discoveryOwnerLedger,
    });
    return payload;
  }

  _toggleSession() {
    if (this._running) this._stopSession({ persist: true });
    else this._startSession();
  }

  _startSession({
    persist = true,
    captureKind = null,
    throwOnFailure = false,
  } = {}) {
    if (this._running || !this._window || !this._document) return false;
    this._ensureRuntimeDebugLease();
    this._running = true;
    this._paused = false;
    this._errors = [];
    try {
      if (persist) writeOpenFlag(true);
      observerHub.refreshDebugMode?.(true);
      if (!this._releaseVideoObservation) {
        this._releaseVideoObservation = videoElementObserver.subscribe({
          onVideo: () => {}, observe: true,
          debugLabel: 'RuntimeDebugger.videoObservation',
        });
      }
      this._shortFormOracle.start({ observeInitial: false });
      this._feedProbe.resetLedger?.();
      this._createSessionBaseline({
        captureKind: captureKind || consumeCaptureKindFlag(),
        startedAt: Date.now(),
      });
      this._shortFormOracle.observeDocument();
      this._feedProbe.start();
      this._sentinelProbe.start();
      this._timer = this._window.setInterval(this._boundTick, SAMPLE_INTERVAL_MS);
      this._syncTerminus();
      this._tick({ force: true, throwOnFailure });
      return true;
    } catch (error) {
      this._recordFailure('session_start', error);
      this._stopSession({ persist });
      if (throwOnFailure) throw error;
      return false;
    }
  }

  _stopSession({ persist = true } = {}) {
    this._feedHorizonControlRevision += 1;
    if (this._releaseVideoObservation) {
      try {
        this._releaseVideoObservation();
        this._releaseVideoObservation = null;
      } catch (error) {
        this._recordFailure('video_observation_release', error);
      }
    }
    if (this._feedHorizonInspection.isActive()) {
      try {
        this._feedHorizonInspection.control({ command: 'disarm' });
      } catch (error) {
        this._recordFailure('feed_horizon_inspection_stop', error);
      }
    }
    this._feedHorizonInspection.clearSurface();
    try {
      InteractionManager.cancelEnsoGateForSource(
        'runtime_debugger',
        'runtime_debugger_session_stop',
      );
    } catch (error) {
      this._recordFailure('enso_debug_gate_stop', error);
    }
    if (!this._running) {
      stopRuntimeContentionSession();
      stopRuntimeDiscoverySession();
      if (persist) writeOpenFlag(false);
      this._render();
      return;
    }
    this._running = false;
    this._paused = false;
    if (persist) writeOpenFlag(false);
    if (this._timer) {
      try {
        this._window?.clearInterval(this._timer);
      } catch (error) {
        this._recordFailure('session_timer_clear', error);
      }
      this._timer = null;
    }
    try {
      this._terminusController.disarm();
    } catch (error) {
      this._recordFailure('terminus_disarm', error);
    }
    try {
      this._feedProbe.stop();
    } catch (error) {
      this._recordFailure('feed_probe_stop', error);
    }
    try {
      this._sentinelProbe.stop();
    } catch (error) {
      this._recordFailure('sentinel_probe_stop', error);
    }
    try {
      this._shortFormOracle.stop();
    } catch (error) {
      this._recordFailure('short_form_oracle_stop', error);
    }
    try {
      if (getLoadedSocialMetricsDebugSnapshot().auditMode === 'deep') {
        setSocialMetricsDebugAuditMode('standard', { reset: false });
      }
    } catch (error) {
      this._recordFailure('social_audit_mode_release', error);
    }
    try {
      if (TextShuffleManager.isHighlightDebugEnabled?.()) {
        TextShuffleManager.setHighlightDebugEnabled?.(false);
      }
    } catch (error) {
      this._recordFailure('text_shuffle_highlight_release', error);
    }
    stopRuntimeContentionSession();
    stopRuntimeDiscoverySession();
    if (this._forceDebugLeaseRequired) this._releaseRuntimeDebugLease();
    this._render();
  }

  _syncTerminus() {
    const shouldRun = this._running && this._terminusDryRun;
    let armed = false;
    try {
      armed = this._terminusController.isArmed();
    } catch (error) {
      this._recordFailure('terminus_state_read', error);
      return;
    }
    try {
      if (shouldRun && !armed) {
        const mounted = this._terminusController.arm({
          getDecision: () => ({
            decisionId: 'runtime_debugger_terminus_dry_run',
            state: 'interrupt',
            readiness: {
              status: 'ready',
              capability: 'anchored_continuous',
            },
            actuationSafety: {
              status: 'safe',
              capability: 'anchored_continuous',
              reasons: ['runtime_debugger_dry_run'],
            },
          }),
          getAdmission: () => TERMINUS_DRY_RUN_ADMISSION,
          getActuationContext: () => this._feedActuationContextProvider?.() || null,
          onEndpointAttached: () => true,
          onHorizonEngaged: () => true,
          onContinueIntent: () => this._resolveTerminusDryRun('continue'),
          onRetreat: () => this._resolveTerminusDryRun('retreat'),
        });
        if (mounted === false) {
          this._recordFailure('terminus_dry_run_arm', new Error('RUNTIME_DEBUGGER_TERMINUS_ARM_FAILED'));
        }
      } else if (!shouldRun && armed) {
        this._terminusController.disarm();
      }
    } catch (error) {
      this._recordFailure(shouldRun ? 'terminus_dry_run_arm' : 'terminus_dry_run_disarm', error);
    }
  }

  _resolveTerminusDryRun(reason) {
    try {
      writeTerminusFlag(false);
    } catch (error) {
      this._recordFailure('terminus_dry_run_release', error);
      return false;
    }
    this._terminusDryRun = false;
    this._setStatus(`터미너스 dry-run 종료: ${reason}`);
    const sync = () => {
      this._syncTerminus();
      this._render();
    };
    if (typeof this._window?.setTimeout === 'function') this._window.setTimeout(sync, 0);
    else setTimeout(sync, 0);
    return true;
  }

  _toggleTerminus() {
    const nextEnabled = !this._terminusDryRun;
    this._terminusDryRun = nextEnabled;
    try {
      writeTerminusFlag(this._terminusDryRun);
      this._syncTerminus();
    } catch (error) {
      this._recordFailure('terminus_toggle', error);
    }
    this._setStatus(
      this._terminusDryRun
        ? (this._running ? '터미너스 dry-run 활성' : '터미너스 dry-run 대기')
        : '터미너스 dry-run 꺼짐',
    );
    this._render();
  }

  _setActiveTab(tab) {
    if (![
      'observer',
      'protection',
      CLICK_GATE_TAB_ID,
      'video',
      'social',
      'visual',
      'text',
      'short',
      'video-observer',
      'feed',
      'sentinel',
      'log',
    ].includes(tab)) return;
    this._activeTab = tab;
    this._render();
  }

  _handleAction(action) {
    if (action === 'pause') {
      const nextPaused = !this._paused;
      this._paused = nextPaused;
      if (nextPaused && this._running) this._tick({ force: true });
      else this._render();
      return;
    }
    if (action === 'reset') {
      this._resetSession();
      return;
    }
    if (action === 'terminus') {
      this._toggleTerminus();
      return;
    }
    if (action === 'copy') {
      void this._copySession();
      return;
    }
    if (action === 'copy-summary') {
      void this._copySummary();
      return;
    }
    if (action === 'copy-active-summary') {
      void this._copySummary(this._activeTab);
      return;
    }
    if (action === 'copy-active-log') {
      void this._copyActiveLog(this._activeTab);
      return;
    }
    if (action === 'social-audit-mode') {
      this._toggleSocialAuditMode();
      return;
    }
    if (action === 'text-shuffle-highlight') {
      this._toggleTextShuffleHighlight();
      return;
    }
    if (action === 'enso-force-spawn') {
      this._forceEnsoGate();
      return;
    }
    if (action === 'sentinel-site') {
      void this._launchSentinel({ protocolScope: 'site' });
      return;
    }
    if (action === 'sentinel-global') {
      void this._launchSentinel({ protocolScope: 'global' });
      return;
    }
    if (action === 'reload-observe') {
      void this._reloadForObservation();
    }
  }

  async _forceEnsoGate() {
    try {
      const result = await InteractionManager.forceEnsoGateForDebug();
      if (result?.ok) {
        this._setStatus('Enso 게이트 강제스폰');
      } else {
        this._setStatus(`Enso 강제스폰 실패: ${result?.reason || 'unknown'}`);
      }
      this._tick({ force: true });
    } catch (error) {
      this._recordFailure('enso_force_spawn', error);
    }
  }

  _toggleSocialAuditMode() {
    try {
      const current = this._latest?.socialMetrics?.auditMode
        || getLoadedSocialMetricsDebugSnapshot().auditMode
        || 'standard';
      const next = current === 'deep' ? 'standard' : 'deep';
      setSocialMetricsDebugAuditMode(next, { reset: true });
      this._resetSession({ statusText: `Social ${next} 감사 · 새 기준점` });
    } catch (error) {
      this._recordFailure('social_audit_mode_toggle', error);
    }
  }

  _toggleTextShuffleHighlight() {
    try {
      const current = TextShuffleManager.isHighlightDebugEnabled?.() === true;
      const next = !current;
      TextShuffleManager.setHighlightDebugEnabled?.(next);
      this._setStatus(`셔플 하이라이트 ${next ? '켜짐' : '꺼짐'}`);
      if (!this._tick({ force: true })) {
        this._render();
      }
    } catch (error) {
      this._recordFailure('text_shuffle_highlight_toggle', error);
    }
  }

  _resetSession({
    statusText = '새 기준점을 설정했습니다',
    throwOnFailure = false,
  } = {}) {
    try {
      observerHub.refreshDebugMode?.(true);
      this._errors = [];
      this._shortFormOracle.reset();
      this._feedProbe.resetLedger?.();
      this._createSessionBaseline({
        captureKind: this._captureKind === 'reload' ? 'reload' : 'live',
        startedAt: Date.now(),
      });
      this._shortFormOracle.observeDocument();
    } catch (error) {
      this._recordFailure('session_reset', error);
      if (throwOnFailure) throw error;
      return false;
    }
    if (statusText) this._setStatus(statusText);
    if (this._running) this._tick({ force: true, throwOnFailure });
    else this._render();
    return true;
  }

  async _copySession() {
    await this._copyText({
      phase: 'copy_session',
      successStatus: '원본 로그를 복사했습니다',
      text: JSON.stringify(this.getSessionPayload(), null, 2),
    });
  }

  async _copyActiveLog(tab = this._activeTab) {
    const probeId = RUNTIME_DEBUGGER_TAB_TO_PROBE_ID[tab] || null;
    if (!probeId) {
      this._setStatus('개별 로그는 진단 항목 탭을 선택한 뒤 복사할 수 있습니다');
      return false;
    }
    const session = this._ensureSession();
    const probeResults = this._getProbeResults();
    const payload = createRuntimeDebuggerSessionPayload(session, {
      probeResults,
      selectedProbeId: probeId,
    });
    await this._copyText({
      phase: 'copy_active_log',
      successStatus: '항목 개별 로그를 복사했습니다',
      text: JSON.stringify(payload, null, 2),
    });
    return true;
  }

  _buildSummaryText(scope = 'all') {
    const session = this._ensureSession();
    const probeResults = this._getProbeResults();
    const probeId = RUNTIME_DEBUGGER_TAB_TO_PROBE_ID[scope] || null;
    if (scope !== 'all' && !probeId) {
      throw new Error('RUNTIME_DEBUGGER_REPORT_SCOPE_INVALID');
    }
    let text;
    if (scope === 'all') {
      text = buildRuntimeDebuggerFullReport(session, probeResults, {
        title: 'Entropy Runtime Debugger v2 진단 리포트',
      });
    } else {
      const probeResult = probeResults.find((entry) => entry.probeId === probeId);
      if (!probeResult) throw new Error(`RUNTIME_DEBUGGER_PROBE_RESULT_MISSING:${probeId}`);
      const diagnosticContext = scope === CLICK_GATE_TAB_ID
        ? createClickGateDiagnosticContext(this.getSessionPayload())
        : (scope === 'video' ? createVideoDiagnosticContext(this.getSessionPayload()) : null);
      const title = scope === CLICK_GATE_TAB_ID
        ? 'Entropy Click Gate 디버그 요약'
        : (scope === 'video'
          ? 'Entropy Video Skip 디버그 요약'
          : `Entropy Runtime Debugger: ${probeResult.label}`);
      text = buildRuntimeDebuggerItemReport(session, probeResult, {
        title,
        diagnosticContext,
      });
    }
    return text;
  }

  async _copySummary(scope = 'all') {
    const probeId = RUNTIME_DEBUGGER_TAB_TO_PROBE_ID[scope] || null;
    if (scope !== 'all' && !probeId) {
      this._setStatus('항목 요약은 진단 항목 탭을 선택한 뒤 복사할 수 있습니다');
      return false;
    }
    const text = this._buildSummaryText(scope);
    await this._copyText({
      phase: 'copy_summary',
      successStatus: scope === 'all' ? '전체 리포트를 복사했습니다' : '항목 요약을 복사했습니다',
      text,
    });
    return true;
  }

  async _launchSentinel({ protocolScope }) {
    try {
      const result = await this._sentinelProbe.launch({ protocolScope, hudVisible: true });
      if (result?.success) {
        this._setStatus(protocolScope === 'global' ? 'Global Sentinel 실행 요청' : 'Site Furin prelude 실행 요청');
      } else {
        this._setStatus(`Sentinel 실행 실패: ${result?.error || 'unknown'}`);
      }
      this._tick({ force: true });
    } catch (error) {
      this._recordFailure('sentinel_launch', error, { protocolScope });
    }
  }

  async _reloadForObservation() {
    const pageLocalSaved = writePageLocalStorageItem(FRICTION_DEBUG_FLAG_STORAGE_KEY, '1');
    const captureKindSaved = writePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY, 'reload');
    const openFlagSaved = writeOpenFlag(true);
    if (!pageLocalSaved || !captureKindSaved || !openFlagSaved) {
      removePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY);
      this._setStatus('디버그 플래그 저장 실패');
      return;
    }

    const reload = this._window?.location?.reload;
    if (typeof reload !== 'function') {
      removePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY);
      this._recordFailure('reload_observe_reload', new Error('RUNTIME_DEBUGGER_RELOAD_UNAVAILABLE'));
      return;
    }

    this._setStatus('관측 플래그 저장, 새로고침합니다');
    try {
      reload.call(this._window.location);
    } catch (error) {
      removePageLocalStorageItem(CAPTURE_KIND_FLAG_KEY);
      this._recordFailure('reload_observe_reload', error);
    }
  }

  _tick({ force = false, throwOnFailure = false } = {}) {
    if (!this._running) return false;
    if (this._paused && !force) return false;
    try {
      observerHub.refreshDebugMode?.(true);
      const wallTime = Date.now();
      const { snapshot, events, evidenceGaps } = this._captureSnapshot({
        wallTime,
        mode: 'sample',
      });
      const session = this._ensureSession();
      recordRuntimeDebuggerSample(session, snapshot, { capturedAt: wallTime });
      this._recordProducerEvents(snapshot, events, evidenceGaps, wallTime);
      this._latest = snapshot;
    } catch (error) {
      this._recordFailure('sample_tick', error);
      this._paused = true;
      if (throwOnFailure) throw error;
      this._render();
      return false;
    }
    this._render();
    return true;
  }

  _render() {
    if (this._automationPresentationSuppressed) return;
    try {
      const preview = this._latest || this._captureSnapshot({ mode: 'preview' }).snapshot;
      const protection = preview.protection || createProtectionDiagnosticsSnapshot();
      const session = this._session;
      const probeResults = session ? this._getProbeResults() : [];
      this._overlay.render({
        open: this._running,
        paused: this._paused,
        terminusDryRun: this._terminusDryRun,
        activeTab: this._activeTab,
        observer: preview.observerHub || {},
        social: preview.socialMetrics || {},
        effects: {
          visual: preview.visual || {},
          textShuffle: preview.textShuffle || {},
          shortForm: preview.shortForm || {},
          videoObservation: preview.videoObservation || {},
        },
        feed: preview.feedFlow || {},
        protection,
        clickGate: preview.clickGate || createClickGateSnapshot(protection),
        sentinel: preview.sentinel || {},
        probeResults,
        sessionView: {
          captureKind: this._captureKind,
          startedAt: session?.startedAt || null,
          durationMs: session ? Math.max(0, session.latestCapturedAt - session.startedAt) : 0,
          sampleCount: session?.sampleReadCount || 0,
        },
        samples: session?.deltaSamples || [],
        events: session?.events || [],
        errors: this._errors,
      });
    } catch (error) {
      this._recordFailure('render', error);
    }
  }

  async _copyText({ phase, successStatus, text }) {
    try {
      const ok = await copyTextToClipboard(text, this._document);
      if (!ok) {
        this._recordFailure(phase, new Error('CLIPBOARD_UNAVAILABLE'));
        return;
      }
      this._setStatus(successStatus);
    } catch (error) {
      this._recordFailure(phase, error);
    }
  }

  _setStatus(text) {
    try {
      this._overlay?.setStatus?.(text);
    } catch (error) {
      this._recordFailure('status_update', error);
    }
  }

  _recordFailure(phase, error, details = {}) {
    const entry = {
      ts: Date.now(),
      phase,
      error: getRuntimeDebuggerErrorMessage(error),
      ...details,
    };
    this._errors.push(entry);
    if (this._errors.length > MAX_ERRORS) {
      this._errors.splice(0, this._errors.length - MAX_ERRORS);
    }
    this._recordSessionEvent({
      probeId: 'runtimeDebugger',
      type: 'debugger_error',
      details: entry,
    }, entry.ts);
    if (typeof console !== 'undefined') {
      console.warn?.('[RuntimeDebuggerRuntime] runtime failure', entry);
    }
    try {
      this._overlay?.setStatus?.(`디버거 오류: ${entry.phase}`);
    } catch (statusError) {
      const statusEntry = {
        ts: Date.now(),
        phase: 'status_update',
        error: getRuntimeDebuggerErrorMessage(statusError),
        sourcePhase: entry.phase,
      };
      this._errors.push(statusEntry);
      if (this._errors.length > MAX_ERRORS) {
        this._errors.splice(0, this._errors.length - MAX_ERRORS);
      }
      if (typeof console !== 'undefined') {
        console.warn?.('[RuntimeDebuggerRuntime] status failure', statusEntry);
      }
    }
    return entry;
  }
}

const runtimeDebugger = new RuntimeDebuggerRuntime();

export { runtimeDebugger };
export default runtimeDebugger;
