import {
  buildZenWeatherAuthoritySnapshot,
  ZEN_WEATHER_AUTHORITY_MODES,
} from '@/themes/plugins/zen/api/environment.js';
import {
  buildExperimentPondSyntheticDomainCandidates,
} from '@/apps/dashboard/tabs/experiment/pondSyntheticDomainCandidates.js';
import {
  buildZenKoiRosterSnapshot,
} from '@/themes/plugins/zen/pond/roster/zenKoiRosterPolicy.js';
import {
  readZenMainCaptureInputFromSearch,
  ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_PARAM,
} from './zenMainCaptureProfileContract.js';
import {
  normalizeZenRendererDebugToggles,
  resolveZenRendererDebugTogglePreset,
} from '@/themes/plugins/zen/pond/contracts/zenRendererDebugToggles.js';
import {
  createInitialZenBonsaiProfileActiveIdentityInput,
} from '@/themes/plugins/zen/model/ZenBonsaiProfileGenerationGenesis.js';

export const ZEN_MAIN_CAPTURE_PROFILE_DEV_SIGNATURE = (
  'ENTROPY_ZEN_MAIN_CAPTURE_PROFILE_DEV'
);

const PROFILE_STYLE_ID = 'entropy-zen-main-capture-profile-style';
const FIXTURE_NOW_MS = Date.UTC(2026, 3, 12, 12, 0, 0, 0);
const FIXED_POND_SCENE_GENERATION_KEY = 'zen-main-qa-pond-scene-v1-731';
const FIXED_BONSAI_TREE_SEED = 31_451;
const MINUTE_MS = 60_000;
const PRESSURE_SITE_FIXTURES = Object.freeze([
  Object.freeze({
    domain: 'dominant.pressure.lab',
    rawWindowMs: 148 * MINUTE_MS,
    weightedPressureMs: 96 * MINUTE_MS,
    pressureShare: 0.36,
    visibleRank: 1,
    policyDisposition: 'protected',
  }),
  Object.freeze({
    domain: 'large.edge.lab',
    rawWindowMs: 102 * MINUTE_MS,
    weightedPressureMs: 68 * MINUTE_MS,
    pressureShare: 0.25,
    visibleRank: 2,
    policyDisposition: 'protected',
  }),
  Object.freeze({
    domain: 'steady.pressure.lab',
    rawWindowMs: 70 * MINUTE_MS,
    weightedPressureMs: 48 * MINUTE_MS,
    pressureShare: 0.18,
    visibleRank: 3,
    policyDisposition: 'managed_allowed',
  }),
  Object.freeze({
    domain: 'restless.pattern.lab',
    rawWindowMs: 44 * MINUTE_MS,
    weightedPressureMs: 30 * MINUTE_MS,
    pressureShare: 0.11,
    visibleRank: 4,
    policyDisposition: 'recommended',
  }),
]);
let cachedHref = null;
let cachedProfile = null;

const POND_EFFECT_PATCH_BY_PROFILE = Object.freeze({
  full: Object.freeze({}),
  'no-benthic': Object.freeze({ benthicEnabled: false }),
  'no-caustics': Object.freeze({ causticsEnabled: false }),
  'no-atmosphere': Object.freeze({ atmosphereEnabled: false }),
  'no-god-rays': Object.freeze({ godRaysEnabled: false }),
  'no-cloud-reflection': Object.freeze({ cloudReflectionEnabled: false }),
  'no-komorebi': Object.freeze({ komorebiEnabled: false }),
  'no-yoonseul': Object.freeze({ yoonseulEnabled: false }),
  'no-fish-shadows': Object.freeze({ fishShadowEnabled: false }),
  'no-layer-effects': Object.freeze({ waterLayerEffectsEnabled: false }),
  'no-surface-effects': Object.freeze({
    waterSurfaceEffectsEnabled: false,
    yoonseulEnabled: false,
  }),
  'minimal-water': Object.freeze({
    waterEffectsEnabled: false,
    waterSurfaceEffectsEnabled: false,
    waterLayerEffectsEnabled: false,
    yoonseulEnabled: false,
    fishShadowEnabled: false,
  }),
});

function buildPondRendererDebugToggles(pondEffectProfile) {
  const patch = POND_EFFECT_PATCH_BY_PROFILE[pondEffectProfile];
  if (!patch) {
    throw new Error(`ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_UNDECLARED:${pondEffectProfile}`);
  }
  return Object.freeze(normalizeZenRendererDebugToggles({
    ...resolveZenRendererDebugTogglePreset('on'),
    ...patch,
  }));
}

function buildBonsaiPresentationIdentity() {
  return Object.freeze({
    ...createInitialZenBonsaiProfileActiveIdentityInput({
      treeSeed: FIXED_BONSAI_TREE_SEED,
    }),
    identityRevision: 1,
  });
}

function buildPressureRailFrame(profile) {
  const showsPressure = profile.pressureContentState === 'pressure';
  const sites = showsPressure ? PRESSURE_SITE_FIXTURES : Object.freeze([]);
  const visibleMs = showsPressure
    ? sites.reduce((sum, site) => sum + site.weightedPressureMs, 0)
    : 0;
  const totalMs = showsPressure ? Math.round(visibleMs / 0.9) : 0;
  const protectedMs = showsPressure
    ? sites
        .filter((site) => site.policyDisposition === 'protected')
        .reduce((sum, site) => sum + site.weightedPressureMs, 0)
    : 0;
  const collecting = profile.pressureReadinessState === 'collecting';
  return Object.freeze({
    sites,
    summary: Object.freeze({
      mode: 'recent-pressure',
      basis: 'qa-capture-weighted-active-time',
      windowDays: 7,
      totalMs,
      protectedMs,
      activeDayCount: showsPressure ? 3 : 0,
      temporal: Object.freeze({
        basis: 'activity-day',
        resetHour: 4,
      }),
      readiness: Object.freeze({
        schemaVersion: 2,
        state: profile.pressureReadinessState,
        contentState: profile.pressureContentState,
        reason: collecting
          ? 'forming_evidence_incomplete'
          : (showsPressure ? 'forming_evidence_ready' : 'observed_without_pressure'),
        observedDayCount: profile.pressureObservedDayCount,
        positiveDayCount: showsPressure ? 3 : 0,
        targetDayCount: 3,
        stableDayCount: 7,
        candidateCount: sites.length,
      }),
    }),
  });
}

function buildKoiRosterFrame(koiCount) {
  const candidates = buildExperimentPondSyntheticDomainCandidates({ seed: 731 })
    .slice(0, koiCount);
  return buildZenKoiRosterSnapshot({
    domainCandidates: candidates,
    interactiveMax: koiCount,
    nowMs: FIXTURE_NOW_MS,
    rosterSource: 'experiment_synthetic_domain_candidates',
  });
}

function installCapturePresentation(profile, search) {
  if (typeof document === 'undefined') return;
  const developmentToolsParam = new URLSearchParams(search).get(ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_PARAM);
  if (developmentToolsParam !== null && developmentToolsParam !== 'true') {
    throw new Error('ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_INVALID');
  }
  const developmentToolsEnabled = developmentToolsParam === 'true';
  document.documentElement.dataset.entropyZenMainCapture = profile.profileId;
  let style = document.getElementById(PROFILE_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PROFILE_STYLE_ID;
    document.head.append(style);
  }
  style.textContent = `
      ${developmentToolsEnabled ? '' : '.dashboard-development-hud,'}
      .zen-bonsai-growth-reveal,
      [data-testid="zen-bonsai-debug-toggle"],
      [data-testid="zen-bonsai-debug-panel"] {
        display: none !important;
      }
    `;
  Object.defineProperty(globalThis, '__ENTROPY_ZEN_MAIN_CAPTURE_PROFILE__', {
    configurable: true,
    value: Object.freeze({
      signature: ZEN_MAIN_CAPTURE_PROFILE_DEV_SIGNATURE,
      profileId: profile.profileId,
      developmentToolsEnabled,
      koiState: profile.koiState,
      koiCount: profile.koiCount,
      bonsaiState: profile.bonsaiState,
      bonsaiDayCount: profile.bonsaiDayCount,
      appearanceTime: profile.appearanceTime,
      environmentClock: profile.environmentClock,
      weather: profile.weather,
      pressureState: profile.pressureState,
      pressureReadinessState: profile.pressureReadinessState,
      pressureContentState: profile.pressureContentState,
      pondEffectProfile: profile.pondEffectProfile,
      pondSceneGenerationKey: profile.pondSceneGenerationKey,
      bonsaiTreeSeed: profile.bonsaiPresentationIdentity.treeSeed,
    }),
  });
}

function buildCaptureProfile(normalized) {
  const weatherAuthority = buildZenWeatherAuthoritySnapshot({
    mode: ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB,
    fixedCloudCover: normalized.weatherCause.cloudCover,
    fixedRainIntensity: normalized.weatherCause.rainIntensity,
  });
  return Object.freeze({
    ...normalized,
    koiRosterFrame: buildKoiRosterFrame(normalized.koiCount),
    pressureRailFrame: buildPressureRailFrame(normalized),
    weatherAuthority,
    pondRendererDebugToggles: buildPondRendererDebugToggles(
      normalized.pondEffectProfile,
    ),
    pondSceneGenerationKey: FIXED_POND_SCENE_GENERATION_KEY,
    bonsaiPresentationIdentity: buildBonsaiPresentationIdentity(),
  });
}

export function resolveZenMainCaptureProfile({ location = globalThis.location } = {}) {
  const href = typeof location?.href === 'string' ? location.href : '';
  if (href === cachedHref) return cachedProfile;
  const normalized = readZenMainCaptureInputFromSearch(location?.search || '');
  const profile = normalized ? buildCaptureProfile(normalized) : null;
  if (profile) installCapturePresentation(profile, location.search);
  cachedHref = href;
  cachedProfile = profile;
  return cachedProfile;
}

export function applyZenMainCaptureProjection(projection, profile) {
  if (!profile) return projection;
  if (!projection || typeof projection !== 'object') {
    throw new Error('ZEN_MAIN_CAPTURE_PROJECTION_REQUIRED');
  }
  return Object.freeze({
    ...projection,
    pond: Object.freeze({
      ...projection.pond,
      dataIsolationMode: true,
      weatherAuthority: profile.weatherAuthority,
    }),
    bonsai: Object.freeze({
      ...projection.bonsai,
      weatherAuthority: profile.weatherAuthority,
    }),
  });
}

export function applyZenMainCaptureScanSnapshot(snapshot, profile) {
  if (!profile) return snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('ZEN_MAIN_CAPTURE_SCAN_SNAPSHOT_REQUIRED');
  }
  if (!profile.pressureRailFrame || typeof profile.pressureRailFrame !== 'object') {
    throw new Error('ZEN_MAIN_CAPTURE_PRESSURE_RAIL_FRAME_REQUIRED');
  }
  return Object.freeze({
    ...snapshot,
    rhythmTopSites: profile.pressureRailFrame.sites,
    pressureSummary: profile.pressureRailFrame.summary,
  });
}

export function applyZenMainCapturePressureRailProps(props, profile, requestedLensDomain) {
  if (!profile) return props;
  if (!profile.pressureRailFrame || typeof profile.pressureRailFrame !== 'object') {
    throw new Error('ZEN_MAIN_CAPTURE_PRESSURE_RAIL_FRAME_REQUIRED');
  }
  if (requestedLensDomain !== null && typeof requestedLensDomain !== 'string') {
    throw new Error('ZEN_MAIN_CAPTURE_REQUESTED_LENS_DOMAIN_REQUIRED');
  }
  // The isolated rail and pond use fixture domains, while Home normally admits
  // only live protected-site candidates. Keep the same controller lock, admitting
  // it against the fixture rail instead of the unrelated live candidate list.
  const selectedLensDomain = profile.pressureRailFrame.sites.some(
    site => site.domain === requestedLensDomain,
  ) ? requestedLensDomain : null;
  return Object.freeze({ ...props, pressureSites: profile.pressureRailFrame.sites,
    pressureSummary: profile.pressureRailFrame.summary, selectedLensDomain });
}
