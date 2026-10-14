import {
  describeErrorMessage,
} from '../../../../platform/diagnostics/runtimeDiagnosticConsole.js';

export const PROTECTION_RUNTIME_FEATURE_GROUPS = Object.freeze({
  lens: Object.freeze([
    'inputVisualBrake',
  ]),
  veil: Object.freeze([
    'ensoGate',
    'infiniteScrollGuard',
  ]),
  brake: Object.freeze([
    'clickDelay',
    'scrollFriction',
    'navigationButtonLock',
  ]),
  barrier: Object.freeze([
    'shortFormBlock',
    'videoSkipGuard',
  ]),
});

export const PROTECTION_RUNTIME_FEATURE_KEYS = Object.freeze([
  ...PROTECTION_RUNTIME_FEATURE_GROUPS.lens,
  ...PROTECTION_RUNTIME_FEATURE_GROUPS.brake,
  ...PROTECTION_RUNTIME_FEATURE_GROUPS.veil,
  ...PROTECTION_RUNTIME_FEATURE_GROUPS.barrier,
  'inputDelay',
]);

const GLOBAL_DIAGNOSTICS_KEY = '__entropyProtectionDiagnostics__';
const HISTORY_LIMIT = 120;
const EVENT_HISTORY_LIMIT = 80;
const MAX_OBJECT_KEYS = 16;
const MAX_ARRAY_ITEMS = 12;
const TOP_FRAME_ONLY_FEATURES = new Set([
  'scrollFriction',
  'navigationButtonLock',
  'shortFormBlock',
  'videoSkipGuard',
  'infiniteScrollGuard',
]);

function nowMs() {
  return Date.now();
}

function isObjectRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function getFrameKind() {
  try {
    return window.top === window ? 'top' : 'frame';
  } catch (_) {
    return 'frame';
  }
}

function readLocationSnapshot() {
  try {
    return {
      href: String(window.location?.href || ''),
      hostname: String(window.location?.hostname || '').toLowerCase(),
      frame: getFrameKind(),
    };
  } catch (_) {
    return {
      href: '',
      hostname: '',
      frame: 'unknown',
    };
  }
}

function readDocumentValue(reader, fallback) {
  try {
    if (typeof document === 'undefined') return fallback;
    return reader(document);
  } catch (_) {
    return fallback;
  }
}

function readEnvironmentSnapshot(extra = {}) {
  const location = readLocationSnapshot();
  const frameKind = location.frame || 'unknown';
  return {
    ...sanitizeDiagnosticValue(extra),
    ...location,
    frameKind,
    topFrame: frameKind === 'top',
    allFramesInjectionEnabled: false,
    crossOriginFramesCovered: false,
    readyState: readDocumentValue((doc) => doc.readyState || 'unknown', 'unknown'),
    visibilityState: readDocumentValue((doc) => doc.visibilityState || 'unknown', 'unknown'),
    htmlVideoElementAvailable: typeof HTMLVideoElement !== 'undefined',
    observedVideoCount: readDocumentValue(
      (doc) => (typeof doc.querySelectorAll === 'function' ? doc.querySelectorAll('video').length : 0),
      0,
    ),
    visualViewportAvailable: typeof window !== 'undefined' && !!window.visualViewport,
    pointerEventAvailable: typeof PointerEvent !== 'undefined',
    touchEventAvailable: typeof TouchEvent !== 'undefined',
    wheelEventAvailable: typeof WheelEvent !== 'undefined',
    generatedAt: nowMs(),
  };
}

function describeDomNode(value) {
  if (!value || typeof value !== 'object') return null;
  const hasElementCtor = typeof Element !== 'undefined';
  const hasDocumentCtor = typeof Document !== 'undefined';
  if (hasElementCtor && value instanceof Element) {
    return {
      kind: 'element',
      tagName: String(value.tagName || '').toLowerCase(),
      id: value.id || null,
      className: typeof value.className === 'string' ? value.className.slice(0, 120) : null,
      role: value.getAttribute?.('role') || null,
    };
  }
  if (hasDocumentCtor && value instanceof Document) {
    return { kind: 'document' };
  }
  if (typeof Window !== 'undefined' && value instanceof Window) {
    return { kind: 'window' };
  }
  return null;
}

function sanitizeDiagnosticValue(value, depth = 0) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'function') return '[function]';

  const domDescription = describeDomNode(value);
  if (domDescription) return domDescription;

  if (Array.isArray(value)) {
    if (depth >= 2) return `[array:${value.length}]`;
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeDiagnosticValue(entry, depth + 1));
  }

  if (!isObjectRecord(value)) return String(value);
  if (depth >= 2) return '[object]';

  const out = {};
  Object.entries(value).slice(0, MAX_OBJECT_KEYS).forEach(([key, entry]) => {
    out[key] = sanitizeDiagnosticValue(entry, depth + 1);
  });
  return out;
}

function createFeatureState(key) {
  return {
    key,
    active: false,
    mountedAt: null,
    unmountedAt: null,
    applyCount: 0,
    unmountCount: 0,
    eventCounts: {},
    lastConfig: null,
    lastEvent: null,
    lastError: null,
    history: [],
  };
}

function createState() {
  const features = {};
  PROTECTION_RUNTIME_FEATURE_KEYS.forEach((key) => {
    features[key] = createFeatureState(key);
  });

  return {
    version: 1,
    createdAt: nowMs(),
    location: readLocationSnapshot(),
    environment: readEnvironmentSnapshot(),
    runtime: {
      source: 'init',
      shouldActivate: false,
      shouldClear: false,
      shouldMutate: true,
      domainClassId: null,
      traceId: null,
      revision: null,
      lastUpdatedAt: null,
    },
    runtimeAttempt: null,
    bootstrap: null,
    features,
    history: [],
  };
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function getGlobalContainer() {
  try {
    if (!globalThis[GLOBAL_DIAGNOSTICS_KEY]) {
      globalThis[GLOBAL_DIAGNOSTICS_KEY] = createState();
    }
    return globalThis[GLOBAL_DIAGNOSTICS_KEY];
  } catch (_) {
    return createState();
  }
}

function pushBounded(list, entry, limit) {
  if (!Array.isArray(list)) return;
  list.push(entry);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function recordHistory(state, entry) {
  pushBounded(state.history, entry, HISTORY_LIMIT);
}

function ensureFeature(key) {
  const state = getGlobalContainer();
  if (!state.features[key]) {
    state.features[key] = createFeatureState(key);
  }
  return {
    state,
    feature: state.features[key],
  };
}

function recordFeatureHistory(feature, entry) {
  pushBounded(feature.history, entry, EVENT_HISTORY_LIMIT);
}

export function createProtectionDiagnosticsSnapshot() {
  const state = getGlobalContainer();
  state.location = readLocationSnapshot();
  state.environment = readEnvironmentSnapshot(state.environment);
  return cloneJson({
    ...state,
    summary: buildProtectionDiagnosticsSummary(state),
  });
}

export function resetProtectionDiagnosticsForTest() {
  try {
    globalThis[GLOBAL_DIAGNOSTICS_KEY] = createState();
  } catch (_) { }
  return createProtectionDiagnosticsSnapshot();
}

export function recordProtectionRuntimeActivationAttempt(details = {}) {
  const state = getGlobalContainer();
  const ts = nowMs();
  state.location = readLocationSnapshot();
  state.environment = readEnvironmentSnapshot({
    phase: 'runtime_activation_attempt',
  });
  state.runtimeAttempt = {
    source: details.source || 'protection_update',
    shouldActivate: details.shouldActivate === true,
    shouldClear: details.shouldClear === true,
    shouldMutate: details.shouldMutate !== false,
    error: details.error || null,
    staleIgnored: details.staleIgnored === true,
    staleReason: details.staleReason || null,
    needsResync: details.needsResync === true,
    resyncReason: details.resyncReason || null,
    domainClassId: details.domainClassId || null,
    traceId: details.traceId || null,
    expectedBaseRevision: Number.isFinite(details.expectedBaseRevision)
      ? details.expectedBaseRevision
      : null,
    receivedBaseRevision: Number.isFinite(details.receivedBaseRevision)
      ? details.receivedBaseRevision
      : null,
    expectedRevision: Number.isFinite(details.expectedRevision)
      ? details.expectedRevision
      : null,
    receivedRevision: Number.isFinite(details.receivedRevision)
      ? details.receivedRevision
      : null,
    attemptedAt: ts,
  };
  recordHistory(state, {
    ts,
    type: 'runtime_activation_attempt',
    payload: sanitizeDiagnosticValue(state.runtimeAttempt),
  });
}

export function recordProtectionRuntimeActivationApplied(details = {}) {
  const state = getGlobalContainer();
  const ts = nowMs();
  state.location = readLocationSnapshot();
  state.environment = readEnvironmentSnapshot({
    phase: 'runtime_activation_applied',
  });
  state.runtime = {
    source: details.source || 'protection_update',
    shouldActivate: details.shouldActivate === true,
    shouldClear: details.shouldClear === true,
    shouldMutate: details.shouldMutate !== false,
    domainClassId: details.domainClassId || null,
    traceId: details.traceId || null,
    revision: Number.isFinite(details.revision) ? details.revision : null,
    featureStates: sanitizeDiagnosticValue(details.featureStates || {}),
    activeFilterKeys: Array.isArray(details.activeFilterKeys) ? [...details.activeFilterKeys] : [],
    lastUpdatedAt: ts,
  };
  recordHistory(state, {
    ts,
    type: 'runtime_activation_applied',
    payload: sanitizeDiagnosticValue(state.runtime),
  });
}

export function recordProtectionEnvironmentProbe(details = {}) {
  const state = getGlobalContainer();
  const ts = nowMs();
  state.location = readLocationSnapshot();
  state.environment = readEnvironmentSnapshot(details);
  recordHistory(state, {
    ts,
    type: 'environment_probe',
    payload: sanitizeDiagnosticValue(state.environment),
  });
}

export function recordProtectionBootstrap(details = {}) {
  const state = getGlobalContainer();
  const ts = nowMs();
  state.bootstrap = {
    source: details.source || 'content_bootstrap',
    applied: details.applied === true,
    reason: details.reason || null,
    hostname: details.hostname || readLocationSnapshot().hostname,
    runtimeKeys: Array.isArray(details.runtimeKeys) ? [...details.runtimeKeys] : [],
    decision: sanitizeDiagnosticValue(details.decision || null),
    error: details.error || null,
    ts,
  };
  recordHistory(state, {
    ts,
    type: 'bootstrap',
    payload: sanitizeDiagnosticValue(state.bootstrap),
  });
}

export function recordProtectionFeatureMount(key, config = null, details = {}) {
  const { state, feature } = ensureFeature(key);
  const ts = nowMs();
  feature.active = true;
  feature.mountedAt = ts;
  feature.unmountedAt = null;
  feature.applyCount += 1;
  feature.lastConfig = sanitizeDiagnosticValue(config || null);
  feature.lastError = null;

  const entry = {
    ts,
    type: 'mount',
    key,
    details: sanitizeDiagnosticValue(details),
  };
  recordFeatureHistory(feature, entry);
  recordHistory(state, entry);
}

export function recordProtectionFeatureUnmount(key, details = {}) {
  const { state, feature } = ensureFeature(key);
  const ts = nowMs();
  feature.active = false;
  feature.unmountedAt = ts;
  feature.unmountCount += 1;

  const entry = {
    ts,
    type: 'unmount',
    key,
    details: sanitizeDiagnosticValue(details),
  };
  recordFeatureHistory(feature, entry);
  recordHistory(state, entry);
}

export function recordProtectionInterventionEvent(eventName, details = {}) {
  recordHistory(getGlobalContainer(), {
    ts: nowMs(), type: 'intervention_lifecycle', name: eventName,
    details: sanitizeDiagnosticValue(details),
  });
}

export function recordProtectionFeatureEvent(key, eventName, details = {}) {
  if (!eventName) return;
  const { state, feature } = ensureFeature(key);
  const ts = nowMs();
  feature.eventCounts[eventName] = (feature.eventCounts[eventName] || 0) + 1;
  feature.lastEvent = {
    ts,
    name: eventName,
    details: sanitizeDiagnosticValue(details),
  };

  const entry = {
    ts,
    type: 'event',
    key,
    name: eventName,
    details: feature.lastEvent.details,
  };
  recordFeatureHistory(feature, entry);
  recordHistory(state, entry);
}

export function recordProtectionFeatureError(key, error, details = {}) {
  const { state, feature } = ensureFeature(key);
  const ts = nowMs();
  feature.lastError = {
    ts,
    message: describeErrorMessage(error, 'PROTECTION_FEATURE_ERROR'),
    details: sanitizeDiagnosticValue(details),
  };

  const entry = {
    ts,
    type: 'error',
    key,
    error: feature.lastError.message,
    details: feature.lastError.details,
  };
  recordFeatureHistory(feature, entry);
  recordHistory(state, entry);
}

function resolvePolicyState(state, key) {
  const featureStates = state?.runtime?.featureStates;
  if (!isObjectRecord(featureStates)) return null;
  const feature = featureStates[key];
  if (!isObjectRecord(feature)) return null;
  return {
    enabled: feature.enabled === true,
    reason: typeof feature.reason === 'string' && feature.reason ? feature.reason : null,
  };
}

function buildFeatureLimits(key, state) {
  const environment = state.environment || readEnvironmentSnapshot();
  const limits = [];
  if (TOP_FRAME_ONLY_FEATURES.has(key) && environment.crossOriginFramesCovered === false) {
    limits.push('cross_origin_iframe_content_not_covered');
  }
  if (TOP_FRAME_ONLY_FEATURES.has(key) && environment.topFrame === false) {
    limits.push('non_top_frame_context');
  }
  if (key === 'videoSkipGuard') {
    limits.push('html_video_only');
    limits.push('unattributed_seek_allowed_by_design');
  }
  if (key === 'clickDelay') {
    limits.push('synthetic_click_replay_cannot_preserve_trusted_gesture');
    limits.push('native_form_controls_bypassed');
    limits.push('sensitive_forms_bypassed');
    limits.push('special_links_bypassed');
  }
  if (key === 'ensoGate') {
    limits.push('reward_boundary_classification_required');
    limits.push('native_media_gestures_bypassed');
    limits.push('shared_click_surface_with_click_delay');
  }
  if (key === 'inputDelay') {
    limits.push('native_input_textarea_only');
  }
  if (key === 'inputVisualBrake') {
    limits.push('native_input_textarea_only');
    limits.push('value_free_visual_brake_only');
    limits.push('does_not_delay_dom_value');
  }
  if (key === 'scrollFriction') {
    limits.push('native_scroll_surface_required');
  }
  if (key === 'navigationButtonLock') {
    limits.push('page_document_mouse_event_required');
    limits.push('browser_ui_navigation_controls_not_covered');
  }
  return limits;
}

function buildFeatureHints(key, feature, state) {
  const hints = [];
  const eventCounts = feature.eventCounts || {};
  const policyState = resolvePolicyState(state, key);
  const runtime = state.runtime || {};

  if (runtime.shouldActivate === false) {
    hints.push('main_protection_inactive');
  }
  if (policyState && policyState.enabled === false) {
    hints.push(policyState.reason ? `policy_disabled:${policyState.reason}` : 'policy_disabled');
  }
  if (policyState?.enabled === true && !feature.active && feature.applyCount <= 0) {
    hints.push('configured_active_but_not_mounted_yet');
  }
  if (key === 'scrollFriction' && (eventCounts.custom_scroll_candidate || 0) > 0) {
    hints.push('custom_or_virtual_scroll_surface_candidate');
  }
  if (key === 'scrollFriction' && (eventCounts.managed_scroll_underread_bypass || 0) > 0) {
    hints.push('managed_scroll_underread_fail_open');
  }
  if (key === 'scrollFriction' && (eventCounts.wheel_no_scroll_target || 0) > 0) {
    hints.push('wheel_seen_without_native_scroll_target');
  }
  if (key === 'videoSkipGuard' && feature.active && (eventCounts.video_attached || 0) <= 0) {
    hints.push('no_top_frame_html_video_observed');
  }
  if (key === 'videoSkipGuard' && (eventCounts.seek_allowed_unattributed || 0) > 0) {
    hints.push('unattributed_seek_allowed');
  }
  if (key === 'videoSkipGuard' && (eventCounts.playback_rate_fast || 0) > 0) {
    hints.push('fast_playback_rate_observed_only');
  }
  if (key === 'inputDelay' && (eventCounts.unsupported_contenteditable || 0) > 0) {
    hints.push('contenteditable_not_supported');
  }
  if (key === 'shortFormBlock' && (eventCounts.rule_missing_for_host || 0) > 0) {
    hints.push('shortform_rule_missing_for_host');
  }
  return hints;
}

function buildProtectionDiagnosticsSummary(state) {
  const features = {};
  PROTECTION_RUNTIME_FEATURE_KEYS.forEach((key) => {
    const feature = state.features?.[key] || createFeatureState(key);
    const policyState = resolvePolicyState(state, key);
    const hints = buildFeatureHints(key, feature, state);
    const limits = buildFeatureLimits(key, state);
    features[key] = {
      status: feature.active ? 'active' : 'inactive',
      policyEnabled: policyState?.enabled ?? null,
      policyReason: policyState?.reason ?? null,
      applyCount: feature.applyCount,
      unmountCount: feature.unmountCount,
      lastEventName: feature.lastEvent?.name || null,
      lastError: feature.lastError?.message || null,
      hints,
      limits,
    };
  });

  return {
    generatedAt: nowMs(),
    environment: {
      frameKind: state.environment?.frameKind || 'unknown',
      topFrame: state.environment?.topFrame === true,
      crossOriginFramesCovered: state.environment?.crossOriginFramesCovered === true,
      observedVideoCount: Math.max(0, Number(state.environment?.observedVideoCount) || 0),
    },
    runtime: {
      source: state.runtime?.source || 'init',
      shouldActivate: state.runtime?.shouldActivate === true,
      shouldClear: state.runtime?.shouldClear === true,
      shouldMutate: state.runtime?.shouldMutate !== false,
      domainClassId: state.runtime?.domainClassId || null,
      traceId: state.runtime?.traceId || null,
      revision: Number.isFinite(state.runtime?.revision) ? state.runtime.revision : null,
      activeFilterKeys: Array.isArray(state.runtime?.activeFilterKeys)
        ? [...state.runtime.activeFilterKeys]
        : [],
      lastUpdatedAt: Number.isFinite(state.runtime?.lastUpdatedAt)
        ? state.runtime.lastUpdatedAt
        : null,
    },
    runtimeAttempt: state.runtimeAttempt
      ? {
        source: state.runtimeAttempt.source || 'protection_update',
        shouldActivate: state.runtimeAttempt.shouldActivate === true,
        shouldClear: state.runtimeAttempt.shouldClear === true,
        shouldMutate: state.runtimeAttempt.shouldMutate !== false,
        error: state.runtimeAttempt.error || null,
        staleIgnored: state.runtimeAttempt.staleIgnored === true,
        staleReason: state.runtimeAttempt.staleReason || null,
        needsResync: state.runtimeAttempt.needsResync === true,
        resyncReason: state.runtimeAttempt.resyncReason || null,
        domainClassId: state.runtimeAttempt.domainClassId || null,
        traceId: state.runtimeAttempt.traceId || null,
        expectedBaseRevision: Number.isFinite(state.runtimeAttempt.expectedBaseRevision)
          ? state.runtimeAttempt.expectedBaseRevision
          : null,
        receivedBaseRevision: Number.isFinite(state.runtimeAttempt.receivedBaseRevision)
          ? state.runtimeAttempt.receivedBaseRevision
          : null,
        expectedRevision: Number.isFinite(state.runtimeAttempt.expectedRevision)
          ? state.runtimeAttempt.expectedRevision
          : null,
        receivedRevision: Number.isFinite(state.runtimeAttempt.receivedRevision)
          ? state.runtimeAttempt.receivedRevision
          : null,
        attemptedAt: Number.isFinite(state.runtimeAttempt.attemptedAt)
          ? state.runtimeAttempt.attemptedAt
          : null,
      }
      : null,
    featureGroups: Object.entries(PROTECTION_RUNTIME_FEATURE_GROUPS).reduce((acc, [groupId, keys]) => {
      acc[groupId] = [...keys];
      return acc;
    }, {}),
    bootstrap: state.bootstrap
      ? {
        applied: state.bootstrap.applied === true,
        reason: state.bootstrap.reason || null,
        runtimeKeys: Array.isArray(state.bootstrap.runtimeKeys) ? [...state.bootstrap.runtimeKeys] : [],
      }
      : null,
    features,
  };
}

export function createProtectionDiagnosticsReport() {
  const state = getGlobalContainer();
  state.location = readLocationSnapshot();
  state.environment = readEnvironmentSnapshot(state.environment);
  return cloneJson(buildProtectionDiagnosticsSummary(state));
}

export function installProtectionDiagnosticsGlobal() {
  try {
    const state = getGlobalContainer();
    if (!state.apiInstalled) {
      Object.defineProperty(globalThis, '__entropyProtectionDiagnosticsSnapshot__', {
        configurable: true,
        value: () => createProtectionDiagnosticsSnapshot(),
      });
      Object.defineProperty(globalThis, '__entropyProtectionDiagnosticsReport__', {
        configurable: true,
        value: () => createProtectionDiagnosticsReport(),
      });
      state.apiInstalled = true;
    }
  } catch (_) { }
}

installProtectionDiagnosticsGlobal();
