import { resolveConfiguredArtifactChildEnabled } from './shared.jsx';

function resolveFlareStatusPresentation(overallStatus, t) {
  switch (overallStatus) {
    case 'engaged':
      return { label: t('status.sentinel_flare_breach'), toneClass: 'text-danger' };
    case 'armed':
      return { label: t('status.sentinel_flare_armed'), toneClass: 'text-warning' };
    case 'monitoring':
    case 'idle':
      return { label: t('status.sentinel_flare_patrol'), toneClass: 'text-success' };
    case 'off':
    default:
      return { label: t('status.off'), toneClass: 'text-on-surface-muted' };
  }
}

export function extendLensDerivedState({ runtime }) {
  return {
    lensRuntimeChildren: runtime.artifactRuntimeChildren,
  };
}

export function extendVeilDerivedState({ runtime }) {
  return {
    veilRuntimeChildren: runtime.artifactRuntimeChildren,
  };
}

export function extendBrakeDerivedState({ runtime }) {
  return {
    brakeRuntimeChildren: runtime.artifactRuntimeChildren,
  };
}

export function extendBarrierDerivedState({ runtime }) {
  return {
    barrierRuntimeChildren: runtime.artifactRuntimeChildren,
  };
}

export function extendFlareDerivedState({ runtime, t }) {
  const flareRuntimeChildren = runtime.artifactRuntimeChildren;
  const flareSentinelRuntime = flareRuntimeChildren.sentinelFlare || null;
  const flareMetrics = flareSentinelRuntime?.metrics && typeof flareSentinelRuntime.metrics === 'object'
    ? flareSentinelRuntime.metrics
    : {};
  const flareTopTargets = Array.isArray(flareMetrics.topTargets) ? flareMetrics.topTargets : [];
  const flareTargets = Array.isArray(flareMetrics.targets) ? flareMetrics.targets : [];
  const flareDisplayTargets = flareTopTargets.length ? flareTopTargets : flareTargets;
  const flarePreviewTargets = flareDisplayTargets.slice(0, 2);
  const flareOverallStatus = typeof flareMetrics.overallStatus === 'string' ? flareMetrics.overallStatus : 'off';
  const flareStatusPresentation = resolveFlareStatusPresentation(flareOverallStatus, t);
  const flareBasis = typeof flareMetrics.basis === 'string' ? flareMetrics.basis : '';

  return {
    flareRuntimeChildren,
    flareBasisDetail: t('artifacts.sentinel_flare.reference_targets_note'),
    flareBasisLabel: flareBasis ? t(`artifacts.sentinel_flare.basis_${flareBasis}`) : '-',
    flareDisplayTargets,
    flarePreviewTargets,
    flareSentinelIntensityLevel: Math.max(0, Number(flareSentinelRuntime?.intensityLevel) || 0),
    flareSentinelIntensityMax: Math.max(0, Number(flareSentinelRuntime?.intensityMax) || 0),
    flareReferenceExceededCount: Math.max(
      0,
      Number(flareSentinelRuntime?.metrics?.referenceExceededCount) || Number(flareSentinelRuntime?.intensityLevel) || 0,
    ),
    flareSitesInScopeCount: Math.max(
      0,
      Number(flareSentinelRuntime?.metrics?.sitesInScopeCount) || Number(flareSentinelRuntime?.intensityMax) || 0,
    ),
    flareStatusLabel: flareStatusPresentation.label,
    flareStatusToneClass: flareStatusPresentation.toneClass,
  };
}

export function extendEchoDerivedState({ runtime, state }) {
  const echoRuntimeChildren = runtime.artifactRuntimeChildren;
  const historyCleanupRuntime = echoRuntimeChildren.historyCleanup || null;
  const bookmarkConcealRuntime = echoRuntimeChildren.bookmarkConceal || null;
  const echoFamilyChildren = state?.artifactFamilies?.echo?.children || {};
  const historyCleanupEnabled = resolveConfiguredArtifactChildEnabled(echoFamilyChildren.historyCleanup);
  const bookmarkConcealEnabled = resolveConfiguredArtifactChildEnabled(echoFamilyChildren.bookmarkConceal);
  const runtimeMetricsSource = historyCleanupRuntime || bookmarkConcealRuntime || null;

  return {
    echoRuntimeChildren: {
      historyCleanup: historyCleanupRuntime && typeof historyCleanupRuntime === 'object'
        ? {
          ...historyCleanupRuntime,
          childId: 'historyCleanup',
          isActive: historyCleanupEnabled && historyCleanupRuntime.isActive === true,
          intensityLevel: historyCleanupEnabled && historyCleanupRuntime.isActive === true ? 1 : 0,
          intensityMax: 1,
          metrics: historyCleanupRuntime.metrics && typeof historyCleanupRuntime.metrics === 'object'
            ? { ...historyCleanupRuntime.metrics }
            : {},
        }
        : null,
      bookmarkConceal: bookmarkConcealRuntime && typeof bookmarkConcealRuntime === 'object'
        ? {
          ...bookmarkConcealRuntime,
          childId: 'bookmarkConceal',
          isActive: bookmarkConcealEnabled && bookmarkConcealRuntime.isActive === true,
          intensityLevel: bookmarkConcealEnabled && bookmarkConcealRuntime.isActive === true ? 1 : 0,
          intensityMax: 1,
          metrics: bookmarkConcealRuntime.metrics && typeof bookmarkConcealRuntime.metrics === 'object'
            ? { ...bookmarkConcealRuntime.metrics }
            : {},
        }
        : null,
    },
    memoryPurgeSafeguardCount: Math.max(
      0,
      Number(runtimeMetricsSource?.metrics?.safeguardCount) || Number(runtimeMetricsSource?.intensityLevel) || 0,
    ),
  };
}

export function extendGateDerivedState({ runtime }) {
  return {
    gateRuntimeChildren: runtime.artifactRuntimeChildren,
  };
}
