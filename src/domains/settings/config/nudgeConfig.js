import {
  FRICTION_ASSET_PATHS,
  normalizeAssetPath,
} from '../../../lib/assets/index.js';
import { normalizeThemeId } from '../../../themes/core/ids.js';
import { normalizeSentinelFlareDeliveryForm } from '../../nudge/runtime/sentinelFlareDeliveryForm.js';
import {
  DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE,
  normalizeSentinelFlareProtocolProfile,
} from '../../nudge/runtime/sentinelFlareProtocolProfile.js';

export const DEFAULT_NUDGE_RUNTIME_TUNING = Object.freeze({
  spriteSizePx: 96,
  baseSpeedPxPerSec: 140,
  spawnIntervalMs: 4000,
  maxSprites: 6,
  maxTotalSpawned: 28,
  maxSplits: 18,
  maxSplitGeneration: 3,
  speedRamp: 1.15,
  visualThemeId: null,
  hudVisible: false,
  fullscreenRitualEnabled: true,
  protocolScope: DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolScope,
  protocolIntensity: DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolIntensity,
  protocolVariant: DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.protocolVariant,
  escalationReason: DEFAULT_SENTINEL_FLARE_PROTOCOL_PROFILE.escalationReason,
});

export const DEFAULT_NUDGE_PROTOCOL = Object.freeze({
  rampMs: 45000,
});

export const DEFAULT_NUDGE_PRESAGE_CONFIG = Object.freeze({
  // Presage is an internal, one-shot part of Sentinel Flare. It is not an
  // independently configurable artifact child.
  enabled: true,
  triggerRatio: 0.85,
  visibleMs: 6500,
  dismissOnActivity: true,
  chimeOnClick: true,
});

export const DEFAULT_NUDGE_EPISODE_CONFIG = Object.freeze({
  coalesceWindowMs: 5 * 60 * 1000,
});

export const DEFAULT_NUDGE_SETTINGS = Object.freeze({
  goalEnds: Object.freeze({ site: false, global: false }),
  presage: DEFAULT_NUDGE_PRESAGE_CONFIG,
  episode: DEFAULT_NUDGE_EPISODE_CONFIG,
});

export const DEFAULT_NUDGE_ASSET = Object.freeze({
  gifPath: FRICTION_ASSET_PATHS.nudge.gif,
  label: 'sentinel-flare',
});

export const DEFAULT_NUDGE_RUNTIME_ASSET = DEFAULT_NUDGE_ASSET;

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function omitRetiredRenderQualitySettings(source) {
  const canonical = { ...source };
  delete canonical.adaptiveQuality;
  delete canonical.qualityTier;
  delete canonical.siteFurin;
  return canonical;
}

function normalizeVisualThemeId(value) {
  if (typeof value !== 'string') return null;
  const normalized = normalizeThemeId(value.trim(), '');
  return normalized || null;
}

function normalizeProtocol(protocol, fallbackProtocol) {
  const source = protocol && typeof protocol === 'object' ? protocol : {};
  const fallback = fallbackProtocol && typeof fallbackProtocol === 'object'
    ? fallbackProtocol
    : DEFAULT_NUDGE_PROTOCOL;

  return {
    ...fallback,
    ...source,
    rampMs: Math.round(clamp(source.rampMs ?? fallback.rampMs, 10_000, 180_000)),
  };
}

function normalizeAsset(asset, fallbackAsset) {
  const source = asset && typeof asset === 'object' ? asset : {};
  const fallback = fallbackAsset && typeof fallbackAsset === 'object'
    ? fallbackAsset
    : DEFAULT_NUDGE_ASSET;
  if (Object.prototype.hasOwnProperty.call(source, 'audioPath')) {
    throw new Error('NUDGE_ASSET_CONTRACT_INVALID');
  }

  return {
    ...fallback,
    ...source,
    gifPath: normalizeAssetPath(source.gifPath ?? fallback.gifPath),
  };
}

export function normalizeNudgePresageConfig(raw, { defaults } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object'
    ? defaults
    : DEFAULT_NUDGE_PRESAGE_CONFIG;
  const triggerRatio = clamp(source.triggerRatio ?? fallback.triggerRatio, 0.5, 0.95);
  const visibleMs = Math.round(clamp(source.visibleMs ?? fallback.visibleMs, 1500, 30000));

  return {
    enabled: true,
    triggerRatio,
    visibleMs,
    dismissOnActivity: typeof source.dismissOnActivity === 'boolean'
      ? source.dismissOnActivity
      : fallback.dismissOnActivity !== false,
    chimeOnClick: typeof source.chimeOnClick === 'boolean'
      ? source.chimeOnClick
      : fallback.chimeOnClick !== false,
  };
}

export function normalizeNudgeEpisodeConfig(raw, { defaults } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object'
    ? defaults
    : DEFAULT_NUDGE_EPISODE_CONFIG;
  return {
    coalesceWindowMs: Math.round(clamp(
      source.coalesceWindowMs ?? fallback.coalesceWindowMs,
      0,
      30 * 60_000,
    )),
  };
}

export function normalizeStoredNudgeConfig(raw, { defaults } = {}) {
  if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) throw new Error('NUDGE_CONFIG_INVALID');
  const source = raw === undefined ? (defaults === undefined ? DEFAULT_NUDGE_SETTINGS : defaults) : raw;
  const canonicalSource = { ...source };
  if (Object.hasOwn(canonicalSource, 'enabled')) throw new Error('NUDGE_CONFIG_RETIRED_FIELD:enabled');
  if (Object.hasOwn(canonicalSource, 'thresholdMs')) throw new Error('NUDGE_CONFIG_RETIRED_FIELD:thresholdMs');
  const fallback = defaults && typeof defaults === 'object'
    ? defaults
    : DEFAULT_NUDGE_SETTINGS;

  return {
    ...canonicalSource,
    goalEnds: { ...requireNudgeGoalEnds(canonicalSource.goalEnds) },
    presage: normalizeNudgePresageConfig(canonicalSource.presage, {
      defaults: fallback.presage || DEFAULT_NUDGE_PRESAGE_CONFIG,
    }),
    episode: normalizeNudgeEpisodeConfig(canonicalSource.episode, {
      defaults: fallback.episode || DEFAULT_NUDGE_EPISODE_CONFIG,
    }),
  };
}

export function requireNudgeGoalEnds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== 'global|site'
    || typeof value.site !== 'boolean' || typeof value.global !== 'boolean') throw new Error('NUDGE_GOAL_ENDS_INVALID');
  return value;
}

export function hasEnabledGoalEnd(config) {
  const goalEnds = requireNudgeGoalEnds(config?.goalEnds);
  return goalEnds.site || goalEnds.global;
}

export function isGoalEndEnabled(config, scope) {
  if (!['site', 'global'].includes(scope)) throw new Error('NUDGE_GOAL_END_SCOPE_INVALID');
  return requireNudgeGoalEnds(config?.goalEnds)[scope];
}

export function applyNudgeConfigCommand(value, current) {
  if (value === undefined) throw new Error('NUDGE_CONFIG_INVALID');
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'operation')) return normalizeStoredNudgeConfig(value);
  if (Object.keys(value).sort().join('|') !== 'enabled|operation|scope' || value.operation !== 'set_goal_end_enabled'
    || !['site', 'global'].includes(value.scope) || typeof value.enabled !== 'boolean') throw new Error('NUDGE_GOAL_END_COMMAND_INVALID');
  requireNudgeGoalEnds(current?.goalEnds);
  const canonical = normalizeStoredNudgeConfig(current);
  return { ...canonical, goalEnds: { ...canonical.goalEnds, [value.scope]: value.enabled } };
}

export function normalizeNudgeRuntimeConfig(raw, { defaults } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallback = defaults && typeof defaults === 'object'
    ? defaults
    : DEFAULT_NUDGE_RUNTIME_TUNING;

  const protocolProfile = normalizeSentinelFlareProtocolProfile(source, fallback);
  const deliveryForm = normalizeSentinelFlareDeliveryForm(source.deliveryForm);
  if (protocolProfile.protocolScope === 'global' && deliveryForm !== 'full') {
    throw new Error('sentinel_flare_global_brief_forbidden');
  }
  const merged = {
    ...fallback,
    ...source,
  };

  const maxSprites = Math.round(clamp(merged.maxSprites, 1, 40));

  const normalized = {
    ...omitRetiredRenderQualitySettings(merged),
    spriteSizePx: Math.round(clamp(merged.spriteSizePx, 32, 260)),
    baseSpeedPxPerSec: Math.round(clamp(merged.baseSpeedPxPerSec, 20, 1200)),
    spawnIntervalMs: Math.round(clamp(merged.spawnIntervalMs, 200, 30_000)),
    maxSprites,
    maxTotalSpawned: Math.round(clamp(merged.maxTotalSpawned, maxSprites, 160)),
    maxSplits: Math.round(clamp(merged.maxSplits, 0, 120)),
    maxSplitGeneration: Math.round(clamp(merged.maxSplitGeneration, 0, 8)),
    speedRamp: clamp(merged.speedRamp, 1, 3),
    visualThemeId: normalizeVisualThemeId(merged.visualThemeId),
    hudVisible: merged.hudVisible === true,
    fullscreenRitualEnabled: source.fullscreenRitualEnabled !== false && merged.fullscreenRitualEnabled !== false,
    protocolScope: protocolProfile.protocolScope,
    protocolIntensity: protocolProfile.protocolIntensity,
    protocolVariant: protocolProfile.protocolVariant,
    escalationReason: protocolProfile.escalationReason,
    deliveryForm,
    presage: normalizeNudgePresageConfig(source.presage ?? merged.presage, {
      defaults: fallback.presage || DEFAULT_NUDGE_PRESAGE_CONFIG,
    }),
    episode: normalizeNudgeEpisodeConfig(source.episode ?? merged.episode, {
      defaults: fallback.episode || DEFAULT_NUDGE_EPISODE_CONFIG,
    }),
  };

  const protocolFallback = fallback.protocol && typeof fallback.protocol === 'object'
    ? fallback.protocol
    : DEFAULT_NUDGE_PROTOCOL;
  const messageFallback = fallback.message && typeof fallback.message === 'object'
    ? fallback.message
    : null;
  const assetFallback = fallback.asset && typeof fallback.asset === 'object'
    ? fallback.asset
    : DEFAULT_NUDGE_ASSET;

  normalized.protocol = normalizeProtocol(source.protocol ?? merged.protocol, protocolFallback);
  normalized.asset = normalizeAsset(source.asset ?? merged.asset, assetFallback);

  if (messageFallback || (source.message && typeof source.message === 'object')) {
    normalized.message = {
      ...(messageFallback || {}),
      ...(source.message && typeof source.message === 'object' ? source.message : {}),
    };
  }

  return normalized;
}
