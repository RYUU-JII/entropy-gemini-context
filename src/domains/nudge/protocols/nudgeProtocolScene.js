import {
  SENTINEL_FLARE_PROTOCOL_SCOPES,
  SENTINEL_FLARE_PROTOCOL_VARIANTS,
  normalizeSentinelFlareProtocolProfile,
} from '../runtime/sentinelFlareProtocolProfile.js';
import {
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
  resolveGlobalSentinelSimulationPolicy,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { SITE_FURIN_PROTOCOL_SYSTEM, resolveSiteFurinPolicy } from '../nudge/nudgeGameSiteFurinProtocol.js';

export const NUDGE_PROTOCOL_SCENE_IDS = Object.freeze({
  SITE_FURIN_CHIME: 'site_furin_chime_scene',
  GLOBAL_SENTINEL_SIMULATION: 'global_sentinel_simulation_scene',
});

export const NUDGE_PROTOCOL_BACKGROUND_OWNER = 'worker_canvas';

export const NUDGE_PROTOCOL_RENDERERS = Object.freeze({
  KOI_SCHOOL: 'koi_school',
  FURIN_SVG: 'furin_svg',
});

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizePositiveInt(value, fallback, min, max) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeNumber(value, fallback, min, max) {
  const numeric = Number(value);
  const source = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(min, Math.min(max, source));
}

function resolveRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function seededUnit(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function resolveGlobalSentinelActiveRailCount(syncLevel = 0, maxRailCount = 6) {
  const sync = clamp(syncLevel, 0, 1);
  const maxCount = normalizePositiveInt(maxRailCount, 6, 1, 8);
  return Math.min(maxCount, 1 + Math.floor(sync * (maxCount - 0.6)));
}

export function resolveGlobalSentinelRailPercent(index = 0, {
  yMinPercent = 8,
  yMaxPercent = 92,
} = {}) {
  const min = normalizeNumber(yMinPercent, 8, 0, 100);
  const max = normalizeNumber(yMaxPercent, 92, 0, 100);
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const cursor = Math.max(0, Math.round(Number(index) || 0));
  return low + seededUnit(cursor) * (high - low);
}

function resolveGlobalSentinelSpawnPolicy(config = {}) {
  const globalSentinel = resolveRecord(config.globalSentinel);
  const spawnPolicy = resolveRecord(globalSentinel.spawnPolicy);
  const maxSprites = normalizePositiveInt(config.maxSprites, 6, 1, 40);
  const policy = resolveGlobalSentinelSimulationPolicy(config);

  return {
    owner: 'global_sentinel',
    mode: 'sentinel_field',
    origin: 'central_field',
    movement: 'sync_pressure',
    initialSchoolCount: normalizePositiveInt(
      spawnPolicy.initialSentinelCount,
      1,
      1,
      Math.min(maxSprites, policy.targetDormantCount),
    ),
    cadenceMs: normalizePositiveInt(
      spawnPolicy.cadenceMs ?? config.spawnIntervalMs,
      normalizePositiveInt(config.spawnIntervalMs, 2200, 200, 30000),
      200,
      30000,
    ),
    firstCadenceMs: normalizePositiveInt(spawnPolicy.firstCadenceMs, 4600, 200, 30000),
    cadenceMinMs: normalizePositiveInt(spawnPolicy.cadenceMinMs, 5200, 200, 30000),
    cadenceMaxMs: normalizePositiveInt(spawnPolicy.cadenceMaxMs, 7600, 200, 30000),
    lateCadenceMinMs: normalizePositiveInt(spawnPolicy.lateCadenceMinMs, 3600, 200, 30000),
    lateCadenceMaxMs: normalizePositiveInt(spawnPolicy.lateCadenceMaxMs, 5200, 200, 30000),
    lateCadenceAfterCount: normalizePositiveInt(
      spawnPolicy.lateCadenceAfterCount,
      Math.max(3, policy.targetDormantCount - 1),
      1,
      80,
    ),
    pressureCadenceBoost: normalizeNumber(spawnPolicy.pressureCadenceBoost, 0.28, 0, 0.75),
    xBandMinPercent: normalizeNumber(spawnPolicy.xBandMinPercent, 8, 0, 100),
    xBandMaxPercent: normalizeNumber(spawnPolicy.xBandMaxPercent, 96, 0, 100),
    yBandMinPercent: normalizeNumber(spawnPolicy.yBandMinPercent, 8, 0, 100),
    yBandMaxPercent: normalizeNumber(spawnPolicy.yBandMaxPercent, 96, 0, 100),
    staggerPercent: normalizeNumber(spawnPolicy.staggerPercent, 10, 0, 30),
  };
}

function resolveGlobalSentinelMotionPolicy(config = {}) {
  const globalSentinel = resolveRecord(config.globalSentinel);
  const motionPolicy = resolveRecord(globalSentinel.motionPolicy);
  return {
    owner: 'global_sentinel',
    mode: 'sentinel_field',
    centerXPercent: normalizeNumber(motionPolicy.centerXPercent, 50, 0, 100),
    centerYPercent: normalizeNumber(motionPolicy.centerYPercent, 48, 0, 100),
    radiusXPercent: normalizeNumber(motionPolicy.radiusXPercent, 38, 6, 58),
    radiusYPercent: normalizeNumber(motionPolicy.radiusYPercent, 28, 4, 46),
    speedScale: normalizeNumber(motionPolicy.speedScale, 0.82, 0.2, 1.2),
    activityScale: normalizeNumber(motionPolicy.activityScale, 0.72, 0.35, 1.2),
    simStepRateScale: normalizeNumber(motionPolicy.simStepRateScale, 0.82, 0.45, 1.25),
    pressureSpeedBoost: normalizeNumber(motionPolicy.pressureSpeedBoost, 0.34, 0, 1.2),
    pressureActivityBoost: normalizeNumber(motionPolicy.pressureActivityBoost, 0.36, 0, 1.2),
    pressureRadiusTightening: normalizeNumber(motionPolicy.pressureRadiusTightening, 0.18, 0, 0.6),
    crossDriftScale: normalizeNumber(motionPolicy.crossDriftScale, 1, 0, 2),
  };
}

function resolveSiteFurinScene(config, profile) {
  return { sceneId: NUDGE_PROTOCOL_SCENE_IDS.SITE_FURIN_CHIME,
    protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.SITE,
    protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN,
    protocolSystem: SITE_FURIN_PROTOCOL_SYSTEM,
    protocolIntensity: profile.protocolIntensity, escalationReason: profile.escalationReason,
    renderer: { kind: NUDGE_PROTOCOL_RENDERERS.FURIN_SVG, actorStyle: 'artifact_furin' },
    background: { owner: 'host_dom', mode: 'furin_chime' },
    interaction: { hitMode: 'none', completionMode: 'visible_interval' },
    statePolicy: resolveSiteFurinPolicy(config),
    diagnostics: { budgetLabel: 'furin_chime', targetCountField: 'durationMs', currentCountField: 'visibleElapsedMs' },
  };
}

function resolveGlobalSentinelScene(config, profile) {
  const simulationPolicy = resolveGlobalSentinelSimulationPolicy(config);
  return {
    sceneId: NUDGE_PROTOCOL_SCENE_IDS.GLOBAL_SENTINEL_SIMULATION,
    protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL,
    protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL,
    protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
    protocolIntensity: profile.protocolIntensity,
    escalationReason: profile.escalationReason,
    // The escalated scene renders the slim ink shadow-koi school (the shared
    // swarm path, drawNudgeEntity with protocolScope 'global'), not the mature
    // pond koi engine — the pond koi read as oversized ink blobs at page scale.
    renderer: {
      kind: NUDGE_PROTOCOL_RENDERERS.KOI_SCHOOL,
      actorStyle: 'shadow_koi',
    },
    background: {
      owner: NUDGE_PROTOCOL_BACKGROUND_OWNER,
      mode: 'global_sentinel_field',
    },
    spawnPolicy: resolveGlobalSentinelSpawnPolicy(config),
    motionPolicy: resolveGlobalSentinelMotionPolicy(config),
    interaction: {
      hitMode: 'remove_and_dormant',
      completionMode: 'simulation_collapse',
    },
    statePolicy: {
      targetCount: simulationPolicy.targetDormantCount,
      syncDurationMs: simulationPolicy.syncDurationMs,
      collapseHoldMs: simulationPolicy.collapseHoldMs,
    },
    diagnostics: {
      budgetLabel: 'sentinel',
      targetCountField: 'targetDormantCount',
      currentCountField: 'dormantCount',
    },
  };
}

export function resolveNudgeProtocolScene(config = {}) {
  const profile = normalizeSentinelFlareProtocolProfile(config);
  if (profile.protocolScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL) {
    return resolveGlobalSentinelScene(config, profile);
  }
  return resolveSiteFurinScene(config, profile);
}

export function resolveNudgeProtocolSystem(config = {}) {
  return resolveNudgeProtocolScene(config).protocolSystem;
}

export function isGlobalNudgeProtocolScene(scene = null) {
  return scene?.protocolScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    || scene?.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM;
}

export function sampleNudgeProtocolSceneSpawnHint(scene = null, {
  spawnIndex = 0,
  liveCount = 0,
  protocolPhase = '',
  random = Math.random,
} = {}) {
  const runtimeRandom = typeof random === 'function' ? random : Math.random;
  if (!isGlobalNudgeProtocolScene(scene)) throw new Error('site_furin_has_no_swarm');
  const policy = resolveRecord(scene?.spawnPolicy);
  const xMin = normalizeNumber(policy.xBandMinPercent, 0, -20, 120);
  const xMax = normalizeNumber(policy.xBandMaxPercent, 100, -20, 120);
  const yMin = normalizeNumber(policy.yBandMinPercent, 0, 0, 100);
  const yMax = normalizeNumber(policy.yBandMaxPercent, 100, 0, 100);
  const minX = Math.min(xMin, xMax);
  const maxX = Math.max(xMin, xMax);
  const minY = Math.min(yMin, yMax);
  const maxY = Math.max(yMin, yMax);
  const stagger = normalizeNumber(policy.staggerPercent, 0, 0, 30);
  const cursor = Math.max(0, Math.round(Number(spawnIndex) || 0));
  const live = Math.max(0, Math.round(Number(liveCount) || 0));

  const bandWidth = Math.max(1, maxX - minX);
  const baseX = minX + ((cursor * Math.max(3, stagger || 7)) % bandWidth);
  const jitterX = (runtimeRandom() - 0.5) * Math.max(2, stagger || 5);
  const yBias = policy.origin === 'pond_surface_band' ? 0.48 : 0.5;
  const randomY = minY + (maxY - minY) * ((runtimeRandom() * 0.54) + (yBias - 0.27));
  const direction = cursor % 2 === 0 ? 1 : -1;
  const headingBase = direction === 1 ? 0 : Math.PI;
  const headingArc = Math.sin(cursor * 0.71 + live * 0.29) * 0.16;
  return {
    mode: 'manual',
    xPercent: clamp(baseX + jitterX + live * 0.8, minX, maxX),
    yPercent: clamp(randomY, minY, maxY),
    heading: headingBase + headingArc,
  };
}
