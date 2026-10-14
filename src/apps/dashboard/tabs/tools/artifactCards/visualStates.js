import {
  clamp01,
  getArtifactFamilyChildren,
  resolveArtifactChildConfiguredEnabled,
} from './shared.jsx';
import { getCanonicalArtifactDefinition } from '../../../../../domains/protection/catalog/artifactFamilyCatalog.js';

function buildConfiguredChildVisualState(state, familyId) {
  const familyChildren = state?.artifactFamilies?.[familyId]?.children;
  const activation = state?.artifactActivationState;
  if (!familyChildren || typeof familyChildren !== 'object' || Array.isArray(familyChildren)
    || activation?.artifactId !== familyId || !activation.children
    || typeof activation.children !== 'object' || Array.isArray(activation.children)) {
    throw new Error(`ARTIFACT_VISUAL_CHILD_PROJECTION_REQUIRED:${familyId}`);
  }

  // These poses describe configured intent. Runtime activity and motion remain
  // on the existing activity/render channels, including destructive Echo work.
  const children = Object.fromEntries(getCanonicalArtifactDefinition(familyId).releaseChildren.map((childId) => {
    const child = familyChildren[childId];
    const childActivation = activation.children[childId];
    if (!child || typeof child !== 'object' || Array.isArray(child)
      || typeof child.enabled !== 'boolean'
      || (Object.hasOwn(child, 'configuredEnabled') && typeof child.configuredEnabled !== 'boolean')
      || !childActivation || typeof childActivation !== 'object' || Array.isArray(childActivation)
      || typeof childActivation.configuredEnabled !== 'boolean') {
      throw new Error(`ARTIFACT_VISUAL_CHILD_PROJECTION_INVALID:${familyId}:${childId}`);
    }
    const configuredEnabled = childActivation.configuredEnabled;
    return [childId, Object.freeze({
      enabled: configuredEnabled,
      configuredEnabled,
      ratio: configuredEnabled ? 1 : 0,
    })];
  }));
  return Object.freeze({ children: Object.freeze(children) });
}

export function buildBrakeVisualState(state) {
  return buildConfiguredChildVisualState(state, 'brake');
}

export function buildBarrierVisualState(state) {
  return buildConfiguredChildVisualState(state, 'barrier');
}

export function buildGateVisualState(state) {
  return buildConfiguredChildVisualState(state, 'gate');
}

export function buildFlareVisualState(state) {
  return buildConfiguredChildVisualState(state, 'flare');
}

export function buildEchoVisualState(state) {
  return buildConfiguredChildVisualState(state, 'echo');
}

const RUNTIME_STATE_INTENSITY_RATIO = Object.freeze({
  disabled: 0,
  armed: 0.35,
  engaged: 1,
  cleanup: 0.25,
});

export function resolveArtifactChildIntensityRatio({
  runtimeState = null,
  configuredEnabled = false,
  configuredLevel = 0,
  configuredMax = 1,
} = {}) {
  const safeMax = Math.max(0, Number(configuredMax) || 0);
  const safeLevel = Math.max(0, Number(configuredLevel) || 0);
  const configuredRatio = configuredEnabled
    ? (safeMax > 0 && safeLevel > 0 ? clamp01(safeLevel / safeMax) : 1)
    : 0;

  if (runtimeState?.available) {
    const runtimeMax = Math.max(0, Number(runtimeState?.intensityMax) || 0);
    const runtimeLevel = Math.max(0, Number(runtimeState?.intensityLevel) || 0);
    if (runtimeMax > 0) {
      const runtimeRatio = clamp01(runtimeLevel / runtimeMax);
      return runtimeState?.isActive ? runtimeRatio : configuredRatio;
    }
    if (runtimeState?.isActive) {
      return clamp01(RUNTIME_STATE_INTENSITY_RATIO[runtimeState.state] ?? 1);
    }
    return configuredRatio;
  }

  return configuredRatio;
}

export function buildLensVisualState(state = {}) {
  const { releaseChildren } = getCanonicalArtifactDefinition('lens');
  const children = Object.freeze(Object.fromEntries(releaseChildren.map((childId) => {
    const runtimeState = state.lensRuntimeChildren?.[childId];
    const configuredEnabled = resolveArtifactChildConfiguredEnabled(state, 'lens', childId);
    return [childId, Object.freeze({
      enabled: configuredEnabled,
      ratio: configuredEnabled ? getArtifactFamilyChildren(state, 'lens')[childId].value / 100 : 0,
      runtimeState: runtimeState?.state || '',
      runtimeAvailable: runtimeState?.available === true,
    })];
  })));

  return {
    manifestation: 'shoji',
    overallIntensity: clamp01(Object.values(children)
      .reduce((total, child) => total + child.ratio, 0) / releaseChildren.length),
    activeCount: Object.values(children).filter((child) => child.enabled).length,
    children,
  };
}

export function buildVeilVisualState(state = {}) {
  const veilChildren = getArtifactFamilyChildren(state, 'veil');
  const socialMetricsState = veilChildren.socialMetrics || {};
  const socialMetricsRuntime = state.veilRuntimeChildren?.socialMetrics || null;
  const timeSignalsRuntime = state.veilRuntimeChildren?.timeSignals || null;
  const shortformBlockRuntime = state.veilRuntimeChildren?.shortformBlock || null;
  const socialMetricsConfigured = resolveArtifactChildConfiguredEnabled(state, 'veil', 'socialMetrics');
  const timeSignalsConfigured = resolveArtifactChildConfiguredEnabled(state, 'veil', 'timeSignals');
  const shortformBlockConfigured = resolveArtifactChildConfiguredEnabled(state, 'veil', 'shortformBlock');
  const socialMetricsRatio = resolveArtifactChildIntensityRatio({
    runtimeState: socialMetricsRuntime,
    configuredEnabled: socialMetricsConfigured,
  });
  const timeSignalsRatio = resolveArtifactChildIntensityRatio({
    runtimeState: timeSignalsRuntime,
    configuredEnabled: timeSignalsConfigured,
    configuredLevel: timeSignalsConfigured ? 1 : 0,
    configuredMax: 1,
  });
  const shortformBlockRatio = resolveArtifactChildIntensityRatio({
    runtimeState: shortformBlockRuntime,
    configuredEnabled: shortformBlockConfigured,
  });

  return {
    manifestation: 'enso',
    overallIntensity: clamp01((socialMetricsRatio * 0.42) + (timeSignalsRatio * 0.28) + (shortformBlockRatio * 0.3)),
    activeCount: [
      socialMetricsConfigured,
      timeSignalsConfigured,
      shortformBlockConfigured,
    ].filter(Boolean).length,
    // The released signals stage the Enso; the social surface is not released.
    stageCount: getCanonicalArtifactDefinition('veil').releaseChildren.length,
    surfaceReady: false,
    children: Object.freeze({
      socialMetrics: Object.freeze({
        enabled: socialMetricsConfigured,
        ratio: socialMetricsRatio,
        scope: typeof socialMetricsState.value === 'string' ? socialMetricsState.value : '',
        runtimeState: socialMetricsRuntime?.state || '',
        runtimeAvailable: socialMetricsRuntime?.available === true,
      }),
      timeSignals: Object.freeze({
        enabled: timeSignalsConfigured,
        ratio: timeSignalsRatio,
        runtimeState: timeSignalsRuntime?.state || '',
        runtimeAvailable: timeSignalsRuntime?.available === true,
      }),
      shortformBlock: Object.freeze({
        enabled: shortformBlockConfigured,
        ratio: shortformBlockRatio,
        runtimeState: shortformBlockRuntime?.state || '',
        runtimeAvailable: shortformBlockRuntime?.available === true,
      }),
      socialSurface: Object.freeze({
        enabled: false,
        ratio: 0,
        level: 0,
        max: 1,
        ready: false,
        runtimeState: '',
        runtimeAvailable: false,
      }),
    }),
  };
}
