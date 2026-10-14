import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '@/domains/settings/config/index.js';
import {
  DEFAULT_GATE_CONFIG,
  normalizeGateConfig,
} from '@/domains/settings/config/gateConfig.js';
import {
  DEFAULT_NUDGE_SETTINGS,
  normalizeStoredNudgeConfig,
  hasEnabledGoalEnd,
} from '@/domains/settings/config/nudgeConfig.js';
import { selectCanonicalProtectionArtifactChildRuntimeStates } from '@/domains/protection/runtime/canonicalArtifactTelemetry.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function resolveConfiguredChildEnabled(childState = null) {
  const source = isPlainObject(childState) ? childState : {};
  if (Object.prototype.hasOwnProperty.call(source, 'configuredEnabled')) {
    return source.configuredEnabled === true;
  }
  return source.enabled === true;
}

function resolveConfiguredChildSignal(childState = null) {
  const source = isPlainObject(childState) ? childState : {};
  if (!resolveConfiguredChildEnabled(source)) return 0;
  const max = Math.max(0, Number(source.max) || 0);
  if (max > 1) {
    return clamp01((Number(source.level) || 1) / max);
  }
  return 1;
}

function resolveRuntimeChildSignal(childState = null) {
  const source = isPlainObject(childState) ? childState : {};
  if (source.isActive === true || source.state === 'engaged') {
    const max = Math.max(0, Number(source.intensityMax) || 0);
    if (max > 0) return clamp01((Number(source.intensityLevel) || 1) / max);
    return 1;
  }
  if (source.state === 'armed') return 0.5;
  return 0;
}

function maxSignal(...values) {
  return Math.max(...values.map(clamp01));
}

function createCausalitySignal({ configured, observed }) {
  return Object.freeze({
    configured: clamp01(configured),
    observed: clamp01(observed),
  });
}

function createBinaryChildState(enabled) {
  return Object.freeze({
    enabled: enabled === true,
    configuredEnabled: enabled === true,
  });
}

export function buildArtifactDisclosureSignals({
  artifactFamilies = {},
  artifactRuntimeSnapshot = null,
} = {}) {
  const brakeChildren = artifactFamilies.brake?.children || {};
  const gateChildren = artifactFamilies.gate?.children || {};
  const echoChildren = artifactFamilies.echo?.children || {};
  const flareChildren = artifactFamilies.flare?.children || {};
  const barrierChildren = artifactFamilies.barrier?.children || {};
  const brakeRuntime = selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, 'brake');
  const gateRuntime = selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, 'gate');
  const echoRuntime = selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, 'echo');
  const flareRuntime = selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, 'flare');
  const barrierRuntime = selectCanonicalProtectionArtifactChildRuntimeStates(artifactRuntimeSnapshot, 'barrier');
  const flareSentinelMetrics = isPlainObject(flareRuntime.sentinelFlare?.metrics)
    ? flareRuntime.sentinelFlare.metrics
    : {};
  const flareTargetOverrun = Math.max(
    Number(flareSentinelMetrics.referenceExceededCount) || 0,
    Number(flareRuntime.sentinelFlare?.intensityLevel) || 0,
  );
  const flareSitesInScope = Math.max(
    1,
    Number(flareSentinelMetrics.sitesInScopeCount) || Number(flareRuntime.sentinelFlare?.intensityMax) || 1,
  );

  return Object.freeze({
    support: Object.freeze({
      brake: Object.freeze({
        clickPause: maxSignal(
          resolveConfiguredChildSignal(brakeChildren.clickPause),
          resolveRuntimeChildSignal(brakeRuntime.clickPause),
        ),
        scrollFriction: maxSignal(
          resolveConfiguredChildSignal(brakeChildren.scrollFriction),
          resolveRuntimeChildSignal(brakeRuntime.scrollFriction),
        ),
        navigationButtonLock: maxSignal(
          resolveConfiguredChildSignal(brakeChildren.navigationButtonLock),
          resolveRuntimeChildSignal(brakeRuntime.navigationButtonLock),
        ),
      }),
      gate: Object.freeze({
        entryCheckpoint: maxSignal(
          resolveConfiguredChildSignal(gateChildren.entryCheckpoint),
          resolveRuntimeChildSignal(gateRuntime.entryCheckpoint),
        ),
        returnGuard: maxSignal(
          resolveConfiguredChildSignal(gateChildren.returnGuard),
          resolveRuntimeChildSignal(gateRuntime.returnGuard),
        ),
        rapidReturn: maxSignal(resolveRuntimeChildSignal(gateRuntime.returnGuard)),
      }),
      echo: Object.freeze({
        historyCleanup: maxSignal(
          resolveConfiguredChildSignal(echoChildren.historyCleanup),
          resolveRuntimeChildSignal(echoRuntime.historyCleanup),
        ),
        bookmarkConceal: maxSignal(
          resolveConfiguredChildSignal(echoChildren.bookmarkConceal),
          resolveRuntimeChildSignal(echoRuntime.bookmarkConceal),
        ),
      }),
      flare: Object.freeze({
        sentinelFlare: maxSignal(
          resolveConfiguredChildSignal(flareChildren.sentinelFlare),
          resolveRuntimeChildSignal(flareRuntime.sentinelFlare),
        ),
        targetOverrun: clamp01(flareTargetOverrun / flareSitesInScope),
      }),
    }),
    causality: Object.freeze({
      intentThreshold: createCausalitySignal({
        configured: resolveConfiguredChildSignal(barrierChildren.intentThreshold),
        observed: resolveRuntimeChildSignal(barrierRuntime.intentThreshold),
      }),
      textRhythm: createCausalitySignal({
        configured: resolveConfiguredChildSignal(barrierChildren.textRhythm),
        observed: resolveRuntimeChildSignal(barrierRuntime.textRhythm),
      }),
      detourSpreadGuard: createCausalitySignal({
        configured: resolveConfiguredChildSignal(barrierChildren.detourSpreadGuard),
        observed: resolveRuntimeChildSignal(barrierRuntime.detourSpreadGuard),
      }),
    }),
  });
}

export function buildArtifactDisclosureSignalsFromProtocolState({
  filterSettings = CONFIG_DEFAULT_FILTER_SETTINGS,
  gateConfig = DEFAULT_GATE_CONFIG,
  nudgeConfig = DEFAULT_NUDGE_SETTINGS,
  historyCleanupForBlocked = false,
  concealBlockedBookmarks = false,
  artifactRuntimeSnapshot = null,
} = {}) {
  const filters = normalizeFilterSettings(filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS);
  const gate = normalizeGateConfig(gateConfig || DEFAULT_GATE_CONFIG);
  const nudge = normalizeStoredNudgeConfig(nudgeConfig, {
    defaults: DEFAULT_NUDGE_SETTINGS,
  });
  const artifactFamilies = Object.freeze({
    brake: Object.freeze({
      children: Object.freeze({
        clickPause: createBinaryChildState(filters.clickDelay?.isActive === true),
        scrollFriction: createBinaryChildState(filters.scrollFriction?.isActive === true),
        navigationButtonLock: createBinaryChildState(filters.navigationButtonLock?.isActive === true),
      }),
    }),
    gate: Object.freeze({
      children: Object.freeze({
        entryCheckpoint: createBinaryChildState(gate.entryCheckpoint?.enabled === true),
        returnGuard: createBinaryChildState(gate.returnGuard?.enabled === true),
      }),
    }),
    echo: Object.freeze({
      children: Object.freeze({
        historyCleanup: createBinaryChildState(historyCleanupForBlocked === true),
        bookmarkConceal: createBinaryChildState(concealBlockedBookmarks === true),
      }),
    }),
    flare: Object.freeze({
      children: Object.freeze({
        sentinelFlare: createBinaryChildState(hasEnabledGoalEnd(nudge)),
      }),
    }),
    barrier: Object.freeze({
      children: Object.freeze({
        intentThreshold: createBinaryChildState(filters.ensoGate?.isActive === true),
        textRhythm: createBinaryChildState(filters.textRhythm?.isActive === true),
        detourSpreadGuard: createBinaryChildState(gate.detourSpreadGuard?.enabled === true),
      }),
    }),
  });

  return buildArtifactDisclosureSignals({
    artifactFamilies,
    artifactRuntimeSnapshot,
  });
}
