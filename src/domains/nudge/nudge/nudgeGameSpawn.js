import {
  clamp,
  createNudgeEntity,
  resolveNudgeTheme,
  resolveSpawnPointFromHint,
} from './index.js';
import { assertNudgeRuntimeThemeId } from '../runtime/nudgeRuntimeContext.js';
import { resolveNudgeLiveEntityLimit } from '../engine/nudgeEntityBudget.js';

export function buildSentinelSpawnedEntity({
  parent = null,
  spawnHint = null,
  activeTheme = null,
  activeThemeId = '',
  bounds,
  config,
  protocolScene = null,
  nextEntitySerial = 0,
} = {}) {
  const theme = activeTheme || resolveNudgeTheme(
    assertNudgeRuntimeThemeId(activeThemeId, 'sentinel spawn active theme'),
  );
  const spawnPoint = parent ? null : resolveSpawnPointFromHint(spawnHint, bounds);
  const entity = createNudgeEntity(bounds, config, theme, parent, spawnPoint, protocolScene);
  entity.entityId = nextEntitySerial;
  if (theme?.shape === 'koi_shadow') {
    return entity;
  }

  entity.splitGeneration = 0;
  if (!parent) return entity;

  const parentGeneration = Number(parent?.splitGeneration) || 0;
  const sizeRatio = clamp((Number(parent?.sizeRatio) || 1) * (0.82 - parentGeneration * 0.06), 0.42, 1.15);
  const speedRatio = clamp((Number(parent?.speedRatio) || 1) * 1.08, 0.5, 1.8);
  const heading = Math.atan2(Number(parent?.vy) || 0, Number(parent?.vx) || 1);
  const splitDirection = Math.random() < 0.5 ? -1 : 1;
  const offsetAngle = heading + splitDirection * (0.32 + Math.random() * 0.44);

  entity.splitGeneration = parentGeneration + 1;
  entity.sizeRatio = sizeRatio;
  entity.speedRatio = speedRatio;
  entity.size = config.spriteSizePx * sizeRatio;
  entity.baseSpeed = config.baseSpeedPxPerSec * speedRatio;
  entity.hitRadius = entity.size * 0.5;

  const margin = entity.size * 0.55;
  const minX = margin;
  const maxX = Math.max(minX, bounds.width - margin);
  const minY = margin;
  const maxY = Math.max(minY, bounds.height - margin);
  const spawnDistance = Math.max(8, (Number(parent?.size) || entity.size) * (0.28 + Math.random() * 0.2));
  entity.x = clamp((Number(parent?.x) || entity.x) + Math.cos(offsetAngle) * spawnDistance, minX, maxX);
  entity.y = clamp((Number(parent?.y) || entity.y) + Math.sin(offsetAngle) * spawnDistance, minY, maxY);

  const parentSpeed = Math.hypot(Number(parent?.vx) || 0, Number(parent?.vy) || 0);
  const launchSpeed = Math.max(entity.baseSpeed * 0.85, parentSpeed * 0.92);
  entity.vx = Math.cos(offsetAngle) * launchSpeed;
  entity.vy = Math.sin(offsetAngle) * launchSpeed;
  return entity;
}

export function canSpawnSentinelEntity({
  reason = 'spawn',
  parent = null,
  hasCanvasContext = false,
  entities = [],
  config,
  totalSpawned = 0,
  totalSplitSpawned = 0,
  resolveLiveEntityLimit,
} = {}) {
  return resolveSentinelSpawnBlockReason({
    reason,
    parent,
    hasCanvasContext,
    entities,
    config,
    totalSpawned,
    totalSplitSpawned,
    resolveLiveEntityLimit,
  }) === '';
}

export function resolveSentinelSpawnBlockReason({
  reason = 'spawn',
  parent = null,
  hasCanvasContext = false,
  entities = [],
  config,
  totalSpawned = 0,
  totalSplitSpawned = 0,
  resolveLiveEntityLimit,
} = {}) {
  if (!hasCanvasContext) return 'canvas_context_missing';
  const liveEntityLimit = typeof resolveLiveEntityLimit === 'function'
    ? resolveLiveEntityLimit(config, totalSpawned, entities.length)
    : resolveNudgeLiveEntityLimit(config, totalSpawned, entities.length);
  if (entities.length >= liveEntityLimit) return 'live_limit';
  if (totalSpawned >= config.maxTotalSpawned) return 'total_limit';

  if (reason === 'split') {
    if (config.maxSplits <= 0 || totalSplitSpawned >= config.maxSplits) return 'split_limit';
    if ((Number(parent?.splitGeneration) || 0) >= config.maxSplitGeneration) return 'split_generation_limit';
  }
  return '';
}

export function speedUpSentinelEntities({
  activeTheme = null,
  config,
  entities = [],
  speedScalar = 1,
} = {}) {
  const isShadowKoi = activeTheme?.shape === 'koi_shadow';
  const baseRamp = clamp(config.speedRamp, 1, 3);
  const ramp = isShadowKoi
    ? clamp(1 + ((baseRamp - 1) * 0.34), 1, 1.45)
    : baseRamp;
  const maxScalar = isShadowKoi ? 2.15 : 4;
  const nextSpeedScalar = clamp(speedScalar * ramp, 1, maxScalar);

  for (const entity of entities) {
    if (entity?.koiActor?.kind === 'shadow_koi_actor') continue;
    entity.vx *= ramp;
    entity.vy *= ramp;
  }

  return nextSpeedScalar;
}

export function trySplitSentinelEntity({
  config,
  totalSplitSpawned = 0,
  entities = [],
  spawnOne,
} = {}) {
  if (config.maxSplits <= 0 || totalSplitSpawned >= config.maxSplits) return false;
  if (entities.length <= 0) return false;
  const eligible = entities.filter((entity) => (Number(entity?.splitGeneration) || 0) < config.maxSplitGeneration);
  if (eligible.length === 0) return false;
  const parent = eligible[Math.floor(Math.random() * eligible.length)];
  return spawnOne({ reason: 'split', parent });
}

export function runSentinelSplitCycle({
  modalOpen = false,
  config,
  totalSplitSpawned = 0,
  entities = [],
  activeTheme = null,
  splitTimerMs = 0,
  dtMs = 0,
  syncLevel = 0,
  spawnOne,
  speedUpAll,
} = {}) {
  if (modalOpen) {
    return { splitTimerMs, didSpeedUp: false };
  }
  if (config.maxSplits <= 0 || totalSplitSpawned >= config.maxSplits || entities.length <= 0) {
    return { splitTimerMs, didSpeedUp: false };
  }

  const isShadowKoi = activeTheme?.shape === 'koi_shadow';
  const nextSplitTimerMs = splitTimerMs + Math.max(0, dtMs);
  const baseIntervalMs = clamp(config.spawnIntervalMs * 0.95, 350, 8000);
  const syncFactor = clamp(1 - (syncLevel * 0.82), 0.18, 1);
  const zenPacingFactor = isShadowKoi ? 1.38 : 1;
  const splitIntervalMs = Math.max(260, Math.round(baseIntervalMs * syncFactor * zenPacingFactor));
  if (nextSplitTimerMs < splitIntervalMs) {
    return { splitTimerMs: nextSplitTimerMs, didSpeedUp: false };
  }

  const attempts = isShadowKoi
    ? 1
    : (syncLevel > 0.72 ? 2 : 1);
  let spawned = 0;
  let nextTotalSplitSpawned = totalSplitSpawned;
  for (let i = 0; i < attempts; i += 1) {
    if (nextTotalSplitSpawned >= config.maxSplits) break;
    if (trySplitSentinelEntity({
      config,
      totalSplitSpawned: nextTotalSplitSpawned,
      entities,
      spawnOne,
    })) {
      spawned += 1;
      nextTotalSplitSpawned += 1;
    }
  }
  if (spawned > 0) {
    speedUpAll();
  }

  return {
    splitTimerMs: 0,
    didSpeedUp: spawned > 0,
  };
}

export function runSentinelSpawnerTick({
  modalOpen = false,
  spawnOne,
  speedUpAll,
} = {}) {
  if (modalOpen) return false;
  if (spawnOne({ reason: 'spawn' })) {
    speedUpAll();
    return true;
  }
  return false;
}
