import { applyFullscreenVisualPolicy, FULLSCREEN_VISUAL_FEATURE_KEYS } from '../../runtime/fullscreenVisualPolicy.js';
import { normalizeCanonicalBinaryFilterEntry } from '../../../settings/config/canonicalBinaryFilterProfiles.js';
import {
  applyProtectionEffects,
  applyProtectionEffectsCooperatively,
} from '../ProtectionStateApplier.js';
import { clearAllProtectionEffects } from '../ProtectionRegistry.js';
import { recordProtectionFeatureError } from './protectionRuntimeDiagnostics.js';

const runtimeState = {
  sourceFilters: null,
  resolvedFilters: null,
  effectOptions: null,
  videoFullscreen: false,
  fullscreenListeners: [],
  fullscreenChangeHandler: null,
  effectApplicationEpoch: 0,
};

function reportFrictionModifierRuntimeFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: String(error?.message || error || 'FRICTION_MODIFIER_RUNTIME_FAILURE'),
    ...details,
  };
  recordProtectionFeatureError('visualManager', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[ProtectionFrictionModifierRuntime] runtime failure', diagnostic);
  }
  return diagnostic;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasRelaxableFullscreenVisualFilters(filters = {}) {
  return FULLSCREEN_VISUAL_FEATURE_KEYS.some((featureKey) => filters?.[featureKey]?.isActive === true);
}

function isFullscreenVisualRelaxationConfigured(filters = {}) {
  const preference = filters.fullscreenVisualRelaxation;
  if (!preference) return false; // Partial/inactive effect plans contain no preference.
  return normalizeCanonicalBinaryFilterEntry('fullscreenVisualRelaxation', {
    isActive: preference.isActive, value: preference.value,
  }).isActive;
}

function shouldTrackFullscreenVisualRelaxation(filters = {}) {
  return isFullscreenVisualRelaxationConfigured(filters)
    && hasRelaxableFullscreenVisualFilters(filters);
}

function getFullscreenVideoElement() {
  if (typeof document === 'undefined' || typeof HTMLVideoElement === 'undefined') return null;
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
  if (!fullscreenElement) return null;
  if (fullscreenElement instanceof HTMLVideoElement) return fullscreenElement;
  if (typeof fullscreenElement.querySelector !== 'function') return null;
  const video = fullscreenElement.querySelector('video');
  return video instanceof HTMLVideoElement ? video : null;
}

function getFullscreenVisualRelaxationChangeHandler() {
  if (!runtimeState.fullscreenChangeHandler) {
    runtimeState.fullscreenChangeHandler = () => handleFullscreenVisualRelaxationChange();
  }
  return runtimeState.fullscreenChangeHandler;
}

function ensureFullscreenVisualRelaxationTracking() {
  if (runtimeState.fullscreenListeners.length > 0) return true;
  if (typeof document === 'undefined') return false;

  const handler = getFullscreenVisualRelaxationChangeHandler();
  const listeners = [
    [document, 'fullscreenchange', handler, false],
    [document, 'webkitfullscreenchange', handler, false],
  ];
  const installed = [];

  for (const [target, eventName, listener, options] of listeners) {
    try {
      target.addEventListener(eventName, listener, options);
      installed.push([target, eventName, listener, options]);
    } catch (error) {
      reportFrictionModifierRuntimeFailure('fullscreen_visual_relaxation_tracking_install', error, { eventName });
      installed.forEach(([installedTarget, installedEventName, installedListener, installedOptions]) => {
        try {
          installedTarget.removeEventListener(installedEventName, installedListener, installedOptions);
        } catch (removeError) {
          reportFrictionModifierRuntimeFailure('fullscreen_visual_relaxation_tracking_install_rollback', removeError, {
            eventName: installedEventName,
          });
        }
      });
      runtimeState.fullscreenListeners = [];
      return false;
    }
  }

  runtimeState.fullscreenListeners = installed;
  return true;
}

function teardownFullscreenVisualRelaxationTracking() {
  if (runtimeState.fullscreenListeners.length === 0) return;
  const listeners = runtimeState.fullscreenListeners;
  runtimeState.fullscreenListeners = [];
  listeners.forEach(([target, eventName, listener, options]) => {
    try {
      target.removeEventListener(eventName, listener, options);
    } catch (error) {
      reportFrictionModifierRuntimeFailure('fullscreen_visual_relaxation_tracking_teardown', error, { eventName });
    }
  });
}

function syncFullscreenVisualRelaxationState(filters = {}) {
  const previous = runtimeState.videoFullscreen;
  if (!shouldTrackFullscreenVisualRelaxation(filters)) {
    teardownFullscreenVisualRelaxationTracking();
    runtimeState.videoFullscreen = false;
  } else {
    runtimeState.videoFullscreen = ensureFullscreenVisualRelaxationTracking() && !!getFullscreenVideoElement();
  }
  return previous !== runtimeState.videoFullscreen;
}

function resolveRuntimeFilters(filters = runtimeState.sourceFilters || {}) {
  const source = isPlainObject(filters) ? filters : {};
  return applyFullscreenVisualPolicy(source, {
    videoFullscreen: runtimeState.videoFullscreen,
  });
}

function commitProtectionRuntimeEffects() {
  if (!runtimeState.effectOptions) return runtimeState.resolvedFilters || {};
  runtimeState.effectApplicationEpoch += 1;
  const resolvedFilters = resolveRuntimeFilters();
  runtimeState.resolvedFilters = resolvedFilters;
  applyProtectionEffects(resolvedFilters, runtimeState.effectOptions);
  return resolvedFilters;
}

async function commitProtectionRuntimeEffectsCooperatively({ onStartupApplied = null } = {}) {
  if (!runtimeState.effectOptions) {
    return Object.freeze({
      completed: true,
      superseded: false,
      invokedEffects: 0,
      resolvedFilters: runtimeState.resolvedFilters || {},
    });
  }
  runtimeState.effectApplicationEpoch += 1;
  const applicationEpoch = runtimeState.effectApplicationEpoch;
  const resolvedFilters = resolveRuntimeFilters();
  runtimeState.resolvedFilters = resolvedFilters;
  const result = await applyProtectionEffectsCooperatively(
    resolvedFilters,
    {
      ...runtimeState.effectOptions,
      onStartupApplied,
      isCurrent: () => runtimeState.effectApplicationEpoch === applicationEpoch,
    },
  );
  return Object.freeze({ ...result, resolvedFilters });
}

function handleFullscreenVisualRelaxationChange() {
  const changed = syncFullscreenVisualRelaxationState(runtimeState.sourceFilters || {});
  if (!changed) return;
  try {
    commitProtectionRuntimeEffects();
  } catch (error) {
    reportFrictionModifierRuntimeFailure('fullscreen_visual_relaxation_commit', error);
  }
}

export function applyProtectionRuntimeEffects(filters, {
  globalEffects = [],
  keyedEffects = [],
  context = null,
} = {}) {
  runtimeState.sourceFilters = isPlainObject(filters) ? filters : {};
  runtimeState.effectOptions = {
    globalEffects,
    keyedEffects,
    context,
  };
  syncFullscreenVisualRelaxationState(runtimeState.sourceFilters);
  return commitProtectionRuntimeEffects();
}

export function applyProtectionRuntimeEffectsCooperatively(filters, {
  globalEffects = [],
  keyedEffects = [],
  context = null,
  onStartupApplied = null,
} = {}) {
  runtimeState.sourceFilters = isPlainObject(filters) ? filters : {};
  runtimeState.effectOptions = {
    globalEffects,
    keyedEffects,
    context,
  };
  syncFullscreenVisualRelaxationState(runtimeState.sourceFilters);
  return commitProtectionRuntimeEffectsCooperatively({ onStartupApplied });
}

export async function clearProtectionRuntimeEffects() {
  runtimeState.effectApplicationEpoch += 1;
  const applicationEpoch = runtimeState.effectApplicationEpoch;
  teardownFullscreenVisualRelaxationTracking();
  runtimeState.videoFullscreen = false;
  runtimeState.sourceFilters = null;
  runtimeState.resolvedFilters = null;
  runtimeState.effectOptions = null;
  try {
    await clearAllProtectionEffects();
  } catch (error) {
    if (runtimeState.effectApplicationEpoch === applicationEpoch) throw error;
  }
  const superseded = runtimeState.effectApplicationEpoch !== applicationEpoch;
  return Object.freeze({ completed: !superseded, superseded });
}

export function resetProtectionFrictionModifierRuntimeForTest() {
  teardownFullscreenVisualRelaxationTracking();
  runtimeState.videoFullscreen = false;
  runtimeState.sourceFilters = null;
  runtimeState.resolvedFilters = null;
  runtimeState.effectOptions = null;
  runtimeState.fullscreenChangeHandler = null;
  runtimeState.effectApplicationEpoch = 0;
}

export function getProtectionFrictionModifierRuntimeStateForTest() {
  return {
    videoFullscreen: runtimeState.videoFullscreen,
    resolvedFilters: runtimeState.resolvedFilters,
    sourceFilters: runtimeState.sourceFilters,
    fullscreenTrackingActive: runtimeState.fullscreenListeners.length > 0,
    effectApplicationEpoch: runtimeState.effectApplicationEpoch,
  };
}
