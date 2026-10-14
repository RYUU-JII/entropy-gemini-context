import { drawZenSentinelPairedKoi } from '../rendering/ZenSentinelInvocation.js';
import {
  getThemeDefinition,
  assertThemeDefinitionId,
} from '../../../themes/core/catalog.js';
import { resolveNudgeThemeVariant } from '../../../themes/core/friction/runtime.js';
import {
  buildKoiBodyContour,
  resolveKoiBodyRadius,
  traceKoiBodyContourPath,
} from '../../../themes/plugins/zen/api/koi.js';
import { NudgeShadowKoiEntity } from '../koi/NudgeShadowKoiEntity.js';
import { drawZenFurinLotusBloom } from '../rendering/ZenFurinLotusBloomRenderer.js';
import { normalizeSentinelFlareProtocolScope } from '../runtime/sentinelFlareProtocolProfile.js';
import {
  NUDGE_TERMINAL_SEQUENCE_MODES,
  resolveNudgeTerminalSequenceProgress,
} from './nudgeGameTerminalSequence.js';
import {
  GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  GLOBAL_SENTINEL_TERMINAL_MA_MS,
  resolveGlobalSentinelEntryRuptureTimeline,
} from './nudgeGameGlobalSentinelProtocol.js';
import { normalizeNudgeScenePhase } from './nudgeGameScene.js';

const BASE_MOTION = {
  drift: 1,
  jitter: 0.12,
  orbit: 0.1,
  wobble: 0.6,
};

const SHADOW_KOI_PROFILE = Object.freeze({
  baseSizeScale: 0.18,
  segmentSpacingScale: 0.21,
});

// Koi lifecycle: site followers rise from depth as they join the return wake,
// then the school sinks together during descent. The shared sink path also
// serves global hit retirement. Timing uses Date.now(), the same clock both the
// main loop and worker pass to drawNudgeEntity.
const KOI_RISE_MS = 1300;
const KOI_SINK_MS = 1100;
const KOI_GLINT_MS = 420;
const KOI_RIPPLE_MS = 1100;
export const GLOBAL_SENTINEL_HIT_AFTERMATH_MS = 1600;
export const GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS = 2200;
export const GLOBAL_SENTINEL_INK_BURST_MS = GLOBAL_SENTINEL_HIT_AFTERMATH_MS;
export const GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES = Object.freeze({
  FRACTURE: 'fracture',
  REVERSE_RECALL: 'reverse-recall',
  REPAIR_SEAM_ANNULMENT: 'repair-seam-annulment',
  COMPLETE: 'complete',
});
export const GLOBAL_SENTINEL_VULNERABILITY_CUE_PHASES = Object.freeze({
  INACTIVE: '',
  APPROACH_REPAIR_CONTACT: 'approach-repair-contact',
  RING_CORE_CONTRACTION: 'ring-core-contraction',
  RUPTURE_WINDOW: 'rupture-window',
});
const GLOBAL_SENTINEL_STARTER_FEEDBACK_MS = 760;
const GLOBAL_SENTINEL_STARTER_EMERGENCE_MS = 900;

const NUDGE_PRESETS = {
  default: {
    label: 'Core',
    shape: 'prism',
    beam: true,
    trailAlpha: 0.18,
    motion: { ...BASE_MOTION, orbit: 0.12, jitter: 0.08 },
  },
  hazard: {
    label: 'Hazard',
    shape: 'hazard',
    beam: true,
    trailAlpha: 0.22,
    motion: { ...BASE_MOTION, orbit: 0.18, jitter: 0.14 },
  },
  glyph: {
    label: 'Glyph',
    shape: 'glyph',
    trailAlpha: 0.2,
    motion: { ...BASE_MOTION, drift: 0.9, jitter: 0.1 },
  },
  distortion: {
    label: 'Distortion',
    shape: 'distortion',
    trailAlpha: 0.23,
    flicker: 0.45,
    motion: { ...BASE_MOTION, orbit: 0.16, jitter: 0.18, drift: 1.05 },
  },
  halo: {
    label: 'Halo',
    shape: 'halo',
    beam: false,
    trailAlpha: 0.16,
    motion: { ...BASE_MOTION, orbit: 0.09, jitter: 0.04, drift: 0.88 },
  },
  organic: {
    label: 'Organic',
    shape: 'spore',
    trailAlpha: 0.24,
    motion: { ...BASE_MOTION, drift: 0.75, jitter: 0.05 },
  },
};
function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function seededUnit(index, seed = 0) {
  const normalizedSeed = Math.max(0, Math.round(Number(seed) || 0));
  const seededIndex = Number(index) + normalizedSeed * 0.000173;
  const value = Math.sin(seededIndex * 12.9898 + 78.233 + normalizedSeed * 0.01991) * 43758.5453;
  return value - Math.floor(value);
}

function resolveEntityRenderBudget(renderBudget) {
  if (!renderBudget?.entity || !renderBudget?.koi || typeof renderBudget.render?.policyId !== 'string') {
    throw new Error('NUDGE_ENTITY_RENDER_BUDGET_REQUIRED');
  }
  return renderBudget.entity;
}

function isShadowKoiActorEntity(entity) {
  return !!entity?.koiActor && entity.koiActor.kind === 'shadow_koi_actor';
}

function syncShadowKoiActorSnapshot(entity) {
  if (!isShadowKoiActorEntity(entity)) return;
  const snapshot = entity.koiActor.getSnapshot();
  entity.x = snapshot.x;
  entity.y = snapshot.y;
  entity.vx = snapshot.vx;
  entity.vy = snapshot.vy;
  entity.size = snapshot.size;
  entity.hitRadius = snapshot.hitRadius;
  entity.sizeRatio = snapshot.sizeRatio;
  entity.speedRatio = snapshot.speedRatio;
  entity.splitGeneration = snapshot.splitGeneration;
  entity.baseSpeed = Math.hypot(snapshot.vx, snapshot.vy);
}

function hexToRgb(hex) {
  const raw = (hex || '').replace('#', '').trim();
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length >= 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 255, g: 255, b: 255 };
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveScenePhase(value) {
  return normalizeNudgeScenePhase(value);
}

export function resolveGlobalSentinelEntityTerminalVisualProgress(sequence = null, timeMs = Date.now()) {
  const terminal = resolveNudgeTerminalSequenceProgress(sequence, { now: timeMs });
  if (!terminal.active || terminal.mode !== NUDGE_TERMINAL_SEQUENCE_MODES.BANISH) {
    return terminal;
  }
  const durationMs = Math.max(1, Number(terminal.durationMs) || 1);
  const maMs = Math.min(GLOBAL_SENTINEL_TERMINAL_MA_MS, Math.max(0, durationMs - 1));
  const rawElapsedMs = Math.max(0, Number(timeMs) - Number(terminal.startedAtMs));
  const progress = clamp((rawElapsedMs - maMs) / Math.max(1, durationMs - maMs), 0, 1);
  const eased = 1 - ((1 - progress) ** 3);
  return Object.freeze({
    ...terminal,
    alpha: clamp(1 - eased, 0, 1),
    driftPx: eased * 34,
    eased,
    elapsedMs: Math.max(0, rawElapsedMs - maMs),
    progress,
    scale: clamp(1 - eased * 0.46, 0.54, 1),
  });
}

function resolveEntityTerminalTransform(entity, terminal) {
  if (!terminal?.active) {
    return {
      active: false,
      alpha: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }
  const seed = Number(entity?.entityId)
    || Number(entity?.shadowKoiSeed)
    || Number(entity?.phase)
    || 1;
  const angle = Math.sin(seed * 12.9898) * Math.PI * 2;
  const drift = Number(terminal.driftPx) || 0;
  const lift = terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC ? 0.42 : -0.24;
  return {
    active: true,
    alpha: terminal.alpha,
    scale: terminal.scale,
    offsetX: Math.cos(angle) * drift * 0.18,
    offsetY: Math.sin(angle) * drift * 0.12 + drift * lift,
  };
}

function drawTerminalResidue(ctx, entity, terminal, entityBudget, isGlobalProtocol) {
  if (!terminal?.active || !isGlobalProtocol || terminal.progress <= 0.03) return;
  const size = Math.max(16, Number(entity?.size) || 32);
  const eased = Number(terminal.eased) || 0;
  const alpha = terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    ? 0.16 * eased
    : 0.34 * Math.sin(Math.PI * Math.min(1, terminal.progress));
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    ? 'rgba(220, 226, 232, 0.34)'
    : 'rgba(174, 184, 178, 0.42)';
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * (0.36 + eased * 0.28), size * (0.12 + eased * 0.08), 0, 0, Math.PI * 2);
  ctx.stroke();

  if (entityBudget.terminalResidueEnabled && terminal.mode === NUDGE_TERMINAL_SEQUENCE_MODES.BANISH) {
    ctx.fillStyle = 'rgba(220, 224, 218, 0.72)';
    const count = entityBudget.terminalResidueCount;
    const seed = Number(entity?.entityId) || Number(entity?.shadowKoiSeed) || 1;
    for (let i = 0; i < count; i += 1) {
      const angle = seed * 0.73 + i * 1.91;
      const radius = size * (0.16 + eased * (0.18 + i * 0.015));
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.48 - eased * size * 0.08,
        Math.max(0.8, size * 0.01),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function resolvePalette(themeId) {
  const theme = getThemeDefinition(themeId);
  const colors = theme?.tokens?.colors || {};
  const primary = colors.accent || '#ff3b30';
  const secondary = colors.accentSecondary || '#34c759';
  const tertiary = colors.accentTertiary || '#22d3ee';
  const background = colors.background || '#0b0f14';
  const text = colors.text || '#f8fafc';
  const glow = colors.accentRing || 'rgba(255, 59, 48, 0.35)';
  return {
    primary,
    secondary,
    tertiary,
    background,
    text,
    glow,
  };
}

export function resolveNudgeTheme(themeId) {
  const resolvedId = assertThemeDefinitionId(themeId, 'nudge visual theme');
  const variant = resolveNudgeThemeVariant(resolvedId);
  const presetId = typeof variant?.presetId === 'string' && variant.presetId.trim()
    ? variant.presetId.trim()
    : 'default';
  const base = NUDGE_PRESETS[presetId] || NUDGE_PRESETS.default;
  const variantMotion = variant?.motion && typeof variant.motion === 'object'
    ? variant.motion
    : {};
  const palette = variant?.palette && typeof variant.palette === 'object'
    ? { ...resolvePalette(resolvedId), ...variant.palette }
    : resolvePalette(resolvedId);

  return {
    ...base,
    id: resolvedId,
    variantId: variant?.styleVariant || resolvedId,
    hudVariant: variant?.hudVariant || null,
    shape: variant?.shape || base.shape,
    beam: typeof variant?.beam === 'boolean' ? variant.beam : base.beam,
    trailAlpha: Number.isFinite(Number(variant?.trailAlpha))
      ? Number(variant.trailAlpha)
      : base.trailAlpha,
    motion: {
      ...BASE_MOTION,
      ...(base.motion || {}),
      ...variantMotion,
    },
    palette,
  };
}

export function createNudgeEntity(
  bounds,
  config,
  theme = null,
  parent = null,
  spawnPoint = null,
  protocolScene = null,
) {
  const hasManualSpawnPoint = !parent
    && spawnPoint
    && Number.isFinite(Number(spawnPoint.x))
    && Number.isFinite(Number(spawnPoint.y));
  const manualHeading = Number(spawnPoint?.heading);
  const hasManualHeading = Number.isFinite(manualHeading);
  if (theme?.shape === 'koi_shadow') {
    const actor = new NudgeShadowKoiEntity(bounds, config, parent, protocolScene);
    if (hasManualSpawnPoint && typeof actor.teleport === 'function') {
      actor.teleport(Number(spawnPoint.x), Number(spawnPoint.y), bounds, {
        heading: hasManualHeading ? manualHeading : undefined,
        allowOffscreen: spawnPoint.allowOffscreen === true,
      });
    }
    const baseEntity = {
      spin: 0,
      wobble: 0,
      phase: Math.random() * Math.PI * 2,
      swimPhase: Math.random() * Math.PI * 2,
      koiActor: actor,
      spawnAtMs: Date.now(),
    };
    syncShadowKoiActorSnapshot(baseEntity);
    return baseEntity;
  }

  const width = Math.max(1, bounds?.width || window.innerWidth || 1);
  const height = Math.max(1, bounds?.height || window.innerHeight || 1);
  const baseSize = clamp(config?.spriteSizePx, 32, 260);
  const sizeRatio = 0.65 + Math.random() * 0.55;
  const speedRatio = 0.6 + Math.random() * 0.6;
  const size = baseSize * sizeRatio;
  const baseSpeed = clamp(config?.baseSpeedPxPerSec, 20, 1200) * speedRatio;
  const angle = hasManualHeading ? manualHeading : Math.random() * Math.PI * 2;
  const margin = size * 0.6;
  const offscreenMargin = hasManualSpawnPoint && spawnPoint.allowOffscreen === true
    ? Math.max(width, height) * 0.14
    : 0;
  const x = hasManualSpawnPoint
    ? clamp(Number(spawnPoint.x), margin - offscreenMargin, Math.max(margin, width - margin) + offscreenMargin)
    : (Math.random() * Math.max(1, width - margin * 2) + margin);
  const y = hasManualSpawnPoint
    ? clamp(Number(spawnPoint.y), margin, Math.max(margin, height - margin))
    : (Math.random() * Math.max(1, height - margin * 2) + margin);
  return {
    x,
    y,
    vx: Math.cos(angle) * baseSpeed,
    vy: Math.sin(angle) * baseSpeed,
    size,
    baseSpeed,
    sizeRatio,
    speedRatio,
    spin: (Math.random() - 0.5) * 2,
    wobble: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    swimPhase: Math.random() * Math.PI * 2,
    shadowKoiSeed: Math.random() * Math.PI * 2,
    shadowKoiBeat: 0.82 + Math.random() * 0.36,
    shadowKoiDrift: 0.74 + Math.random() * 0.42,
    hitRadius: size * 0.5,
    spawnAtMs: Date.now(),
  };
}

export function updateNudgeEntity(entity, dt, bounds, theme, speedScalar = 1, runtimeOptions = null) {
  if (!entity || !bounds) return;
  if (isShadowKoiActorEntity(entity)) {
    entity.koiActor.update(dt, bounds, {
      speedScalar,
      renderBudget: runtimeOptions?.renderBudget,
      timeMs: Number(runtimeOptions?.timeMs) || 0,
      protocolProgress: Number(runtimeOptions?.protocolProgress) || 0,
      protocolSyncLevel: Number(runtimeOptions?.protocolSyncLevel) || 0,
      siteFurinFormationTarget: runtimeOptions?.siteFurinFormationTarget || null,
      globalSentinelRepairTarget: runtimeOptions?.globalSentinelRepairTarget || null,
    });
    syncShadowKoiActorSnapshot(entity);
    return;
  }

  const width = Math.max(1, bounds.width || 1);
  const height = Math.max(1, bounds.height || 1);
  const motion = theme?.motion || BASE_MOTION;
  const drift = Number(motion.drift) || 1;
  const jitter = Number(motion.jitter) || 0;
  const orbit = Number(motion.orbit) || 0;

  if (orbit > 0) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const dx = cx - entity.x;
    const dy = cy - entity.y;
    const dist = Math.max(120, Math.hypot(dx, dy));
    const accel = orbit * 28;
    entity.vx += (dx / dist) * accel * dt;
    entity.vy += (dy / dist) * accel * dt;
  }

  if (jitter > 0) {
    const jitterForce = jitter * 40;
    entity.vx += (Math.random() - 0.5) * jitterForce * dt * 60;
    entity.vy += (Math.random() - 0.5) * jitterForce * dt * 60;
  }

  const targetSpeed = Math.max(30, entity.baseSpeed * drift * speedScalar);
  const minSpeed = targetSpeed * 0.45;
  const maxSpeed = targetSpeed * 1.6;
  const speed = Math.hypot(entity.vx, entity.vy) || 1;

  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    entity.vx *= scale;
    entity.vy *= scale;
  } else if (speed < minSpeed) {
    const scale = minSpeed / speed;
    entity.vx *= scale;
    entity.vy *= scale;
  }

  if (theme?.shape === 'koi_shadow') {
    entity.swimPhase = (Number(entity.swimPhase) || 0) + dt * (2 + (Number(entity.speedRatio) || 1) * 0.7);
    const heading = Math.atan2(entity.vy, entity.vx || 1);
    const sway = Math.sin(entity.swimPhase + entity.phase) * 0.58;
    const nextHeading = heading + (sway * dt * 2.1);
    const swimSpeed = Math.hypot(entity.vx, entity.vy) || minSpeed;
    entity.vx = Math.cos(nextHeading) * swimSpeed;
    entity.vy = Math.sin(nextHeading) * swimSpeed;
  }

  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;

  const margin = entity.size * 0.55;
  if (entity.x < margin) {
    entity.x = margin;
    entity.vx = Math.abs(entity.vx);
  } else if (entity.x > width - margin) {
    entity.x = width - margin;
    entity.vx = -Math.abs(entity.vx);
  }

  if (entity.y < margin) {
    entity.y = margin;
    entity.vy = Math.abs(entity.vy);
  } else if (entity.y > height - margin) {
    entity.y = height - margin;
    entity.vy = -Math.abs(entity.vy);
  }
}

export function hitTestNudgeEntity(entity, x, y) {
  if (!entity) return false;
  if (entity.sinking) return false;
  if (isShadowKoiActorEntity(entity)) {
    return entity.koiActor.containsPoint(x, y);
  }
  const dx = x - entity.x;
  const dy = y - entity.y;
  const radius = entity.hitRadius || entity.size * 0.5;
  return (dx * dx + dy * dy) <= radius * radius;
}

function drawBeam(ctx, size, palette, pulse, intensity) {
  const beamLength = size * 2.8;
  const beamWidth = Math.max(2, size * 0.12);
  const grad = ctx.createLinearGradient(0, 0, 0, -beamLength);
  grad.addColorStop(0, withAlpha(palette.primary, 0.5 * pulse * intensity));
  grad.addColorStop(1, withAlpha(palette.primary, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(-beamWidth / 2, -beamLength, beamWidth, beamLength);
}

function drawPrism(ctx, size, palette, pulse, intensity, isLowQuality = false) {
  const half = size * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(half * 0.85, half);
  ctx.lineTo(-half * 0.85, half);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.primary, 0.2 + 0.35 * intensity);
  ctx.strokeStyle = withAlpha(palette.primary, 0.8);
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -half * 0.2, Math.max(2, half * 0.18), 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.secondary, 0.7);
  if (isLowQuality) {
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = palette.secondary;
    ctx.shadowBlur = 12 + 18 * pulse;
  }
  ctx.fill();
}

function drawHazard(ctx, size, palette, pulse, intensity) {
  const half = size * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(half, 0);
  ctx.lineTo(0, half);
  ctx.lineTo(-half, 0);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.primary, 0.15 + 0.35 * intensity);
  ctx.strokeStyle = withAlpha(palette.primary, 0.9);
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = withAlpha(palette.secondary, 0.6 + 0.3 * pulse);
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-half * 0.75, i * half * 0.2);
    ctx.lineTo(half * 0.75, i * half * 0.2 + half * 0.3);
    ctx.stroke();
  }
}

function drawDistortion(ctx, size, palette, pulse, intensity, flicker = 0.3, isLowQuality = false) {
  const half = size * 0.5;
  const offset = Math.sin(pulse * Math.PI * 2) * half * 0.1 * flicker;
  ctx.fillStyle = withAlpha(palette.primary, 0.2 + 0.25 * intensity);
  ctx.fillRect(-half + offset, -half, size, size);
  ctx.strokeStyle = withAlpha(palette.secondary, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeRect(-half, -half, size, size);

  if (!isLowQuality) {
    ctx.fillStyle = withAlpha(palette.tertiary, 0.6);
    ctx.fillRect(-half * 0.6, half * 0.2, size * 0.3, size * 0.15);
    ctx.fillRect(half * 0.1, -half * 0.4, size * 0.35, size * 0.12);
  }
}

function drawGlyph(ctx, size, palette, pulse) {
  const half = size * 0.5;
  ctx.strokeStyle = withAlpha(palette.primary, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeRect(-half, -half, size, size);
  ctx.fillStyle = withAlpha(palette.primary, 0.7 + 0.2 * pulse);
  ctx.font = `${Math.max(10, Math.round(size * 0.35))}px "JetBrains Mono", "Noto Sans KR", ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('01', 0, 0);
}

function drawNeon(ctx, size, palette, pulse, isLowQuality = false) {
  const half = size * 0.52;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(half, 0);
  ctx.lineTo(0, half);
  ctx.lineTo(-half, 0);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(palette.primary, 0.9);
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  if (isLowQuality) {
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 18 + 18 * pulse;
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, half * 0.2), 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.secondary, 0.8);
  ctx.fill();
}

function drawSpore(ctx, size, palette, pulse) {
  const rx = size * 0.5;
  const ry = size * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.secondary, 0.25 + 0.35 * pulse);
  ctx.strokeStyle = withAlpha(palette.primary, 0.6);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-rx * 0.3, ry * 0.4);
  ctx.lineTo(rx * 0.5, ry * 0.9);
  ctx.strokeStyle = withAlpha(palette.primary, 0.4);
  ctx.stroke();
}

function drawHalo(ctx, size, palette, pulse, isLowQuality = false) {
  const radius = size * (0.35 + 0.1 * pulse);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(palette.primary, 0.7);
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  if (isLowQuality) {
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 12 + 14 * pulse;
  }
  ctx.stroke();
}

function resolveShadowKoiHistoryLength(renderBudget) {
  resolveEntityRenderBudget(renderBudget);
  return renderBudget.koi.historyLength;
}

function ensureShadowKoiState(entity, pointCount) {
  const state = entity.shadowKoiState && typeof entity.shadowKoiState === 'object'
    ? entity.shadowKoiState
    : {
      history: [],
      segmentWave: [],
      leftPoints: [],
      rightPoints: [],
    };
  entity.shadowKoiState = state;

  while (state.history.length < pointCount) state.history.push({ x: 0, y: 0, angle: 0 });
  state.history.length = pointCount;
  while (state.segmentWave.length < pointCount) state.segmentWave.push(0);
  state.segmentWave.length = pointCount;
  while (state.leftPoints.length < pointCount) state.leftPoints.push({ x: 0, y: 0 });
  state.leftPoints.length = pointCount;
  while (state.rightPoints.length < pointCount) state.rightPoints.push({ x: 0, y: 0 });
  state.rightPoints.length = pointCount;
  return state;
}

function buildShadowKoiContour(entity, size, renderBudget, timeMs) {
  const pointCount = resolveShadowKoiHistoryLength(renderBudget);
  const state = ensureShadowKoiState(entity, pointCount);
  const history = state.history;
  const segmentWave = state.segmentWave;
  const seed = Number(entity.shadowKoiSeed) || 0;
  const beat = clamp(entity.shadowKoiBeat, 0.64, 1.48);
  const drift = clamp(entity.shadowKoiDrift, 0.65, 1.55);
  const swimPhase = (Number(entity.swimPhase) || 0) + (timeMs * 0.0011);
  const baseSize = Math.max(5.5, size * SHADOW_KOI_PROFILE.baseSizeScale);
  const spacing = Math.max(1, baseSize * SHADOW_KOI_PROFILE.segmentSpacingScale);

  for (let i = 0; i < pointCount; i += 1) {
    const t = pointCount > 1 ? (i / (pointCount - 1)) : 0;
    const tailEnvelope = Math.pow(t, 1.45);
    const primaryWave = Math.sin(swimPhase * (1.68 + beat * 0.24) - t * (4.8 + beat * 1.24) + seed);
    const secondaryWave = Math.sin(swimPhase * 2.24 - t * 7.08 + seed * 0.74);
    const lateralOffset = (primaryWave * 0.72 + secondaryWave * 0.28) * tailEnvelope * baseSize * 0.44 * drift;
    const rotationalWave = Math.sin(swimPhase * 2.06 - t * 6.28 + seed * 0.36);

    history[i].x = -i * spacing;
    history[i].y = lateralOffset;
    history[i].angle = 0;
    segmentWave[i] = (0.018 + tailEnvelope * 0.21) * rotationalWave;
  }

  return {
    contour: buildKoiBodyContour({
      history,
      size: baseSize,
      segmentWave,
      leftPoints: state.leftPoints,
      rightPoints: state.rightPoints,
    }),
    baseSize,
  };
}

function drawShadowKoi(ctx, entity, size, pulse, renderBudget, timeMs = 0) {
  const { contour, baseSize } = buildShadowKoiContour(entity, size, renderBudget, timeMs);
  const history = contour.history;
  if (!Array.isArray(history) || history.length < 2) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
  ctx.beginPath();
  traceKoiBodyContourPath(ctx, contour);
  ctx.fill();

  const tipIndex = history.length - 1;
  const peduncleIndex = Math.max(0, tipIndex - 1);
  const tip = history[tipIndex];
  const peduncle = history[peduncleIndex];
  const rootLeft = contour.leftPoints[tipIndex];
  const rootRight = contour.rightPoints[tipIndex];
  if (tip && peduncle && rootLeft && rootRight) {
    const tailVecX = tip.x - peduncle.x;
    const tailVecY = tip.y - peduncle.y;
    const tailMag = Math.max(1e-6, Math.hypot(tailVecX, tailVecY));
    const tailDirX = tailVecX / tailMag;
    const tailDirY = tailVecY / tailMag;
    const sideX = -tailDirY;
    const sideY = tailDirX;
    const beatPhase = (Number(entity.swimPhase) || 0) * 2.08 + pulse * Math.PI * 2;
    const tailLength = baseSize * (2.2 + 0.36 * Math.sin(beatPhase));
    const tailSpread = resolveKoiBodyRadius(0.98, baseSize) * (2.08 + 0.12 * Math.sin(beatPhase + 0.7));
    const tailTipX = tip.x + tailDirX * tailLength;
    const tailTipY = tip.y + tailDirY * tailLength;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.96)';
    ctx.beginPath();
    ctx.moveTo(rootLeft.x, rootLeft.y);
    ctx.quadraticCurveTo(
      tip.x + sideX * tailSpread * 0.55,
      tip.y + sideY * tailSpread * 0.55,
      tailTipX + sideX * tailSpread,
      tailTipY + sideY * tailSpread,
    );
    ctx.lineTo(tailTipX - sideX * tailSpread, tailTipY - sideY * tailSpread);
    ctx.quadraticCurveTo(
      tip.x - sideX * tailSpread * 0.55,
      tip.y - sideY * tailSpread * 0.55,
      rootRight.x,
      rootRight.y,
    );
    ctx.closePath();
    ctx.fill();
  }

  if (!renderBudget.koi.includePectoral) return;
  const shoulderIndex = Math.max(2, Math.floor(history.length * 0.28));
  const shoulder = history[shoulderIndex];
  if (!shoulder) return;
  const prev = history[Math.max(0, shoulderIndex - 1)] || shoulder;
  const next = history[Math.min(history.length - 1, shoulderIndex + 1)] || shoulder;
  const headXRaw = prev.x - next.x;
  const headYRaw = prev.y - next.y;
  const headMag = Math.max(1e-6, Math.hypot(headXRaw, headYRaw));
  const headX = headXRaw / headMag;
  const headY = headYRaw / headMag;
  const sideX = -headY;
  const sideY = headX;
  const shoulderRadius = resolveKoiBodyRadius(
    shoulderIndex / Math.max(1, history.length - 1),
    baseSize,
  );
  const finPhase = (Number(entity.swimPhase) || 0) * 2.22 + (Number(entity.shadowKoiSeed) || 0);
  const finForward = shoulderRadius * (0.72 + 0.12 * Math.sin(finPhase));
  const finSpread = shoulderRadius * (0.95 + 0.22 * Math.sin(finPhase + 0.6));

  ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
  for (const side of [-1, 1]) {
    const baseX = shoulder.x + sideX * shoulderRadius * side * 0.62;
    const baseY = shoulder.y + sideY * shoulderRadius * side * 0.62;
    const tipX = baseX + sideX * side * finSpread + headX * finForward;
    const tipY = baseY + sideY * side * finSpread + headY * finForward;
    const trailX = baseX - headX * shoulderRadius * 0.5 + sideX * side * shoulderRadius * 0.16;
    const trailY = baseY - headY * shoulderRadius * 0.5 + sideY * side * shoulderRadius * 0.16;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(
      baseX + sideX * side * shoulderRadius * 0.42 + headX * shoulderRadius * 0.22,
      baseY + sideY * side * shoulderRadius * 0.42 + headY * shoulderRadius * 0.22,
      tipX,
      tipY,
    );
    ctx.quadraticCurveTo(
      baseX + headX * shoulderRadius * 0.36,
      baseY + headY * shoulderRadius * 0.36,
      trailX,
      trailY,
    );
    ctx.closePath();
    ctx.fill();
  }
}

function resolveNudgeEntitySinkDurationMs(entity) {
  const explicit = Number(entity?.sinkDurationMs);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : KOI_SINK_MS;
}

export function markNudgeEntitySinking(entity, now = Date.now(), { durationMs = null } = {}) {
  if (!entity || entity.sinking) return false;
  entity.sinking = true;
  entity.sinkStartMs = now;
  const explicitDurationMs = Number(durationMs);
  entity.sinkDurationMs = Number.isFinite(explicitDurationMs) && explicitDurationMs > 0
    ? explicitDurationMs
    : KOI_SINK_MS;
  return true;
}

export function isNudgeEntitySinkComplete(entity, now = Date.now()) {
  if (!entity?.sinking) return false;
  const sinkAt = Number(entity.sinkStartMs);
  return Number.isFinite(sinkAt) && (now - sinkAt) >= resolveNudgeEntitySinkDurationMs(entity);
}

// Resolve the rise/sink visual state for one koi at `timeMs`. Returns the
// transform (scale/alpha/blur/vertical drift), whether it should glint full
// colour, and the active ripple progress (emergence or descent), if any.
function resolveKoiLifecycle(entity, timeMs) {
  const now = Number(timeMs) || 0;
  const spawnAt = Number(entity.spawnAtMs);
  const riseAge = Number.isFinite(spawnAt) ? Math.max(0, now - spawnAt) : KOI_RISE_MS;
  const riseP = clamp(riseAge / KOI_RISE_MS, 0, 1);
  const eRise = 1 - (1 - riseP) ** 3;

  let scale = 0.32 + 0.68 * eRise;
  let alpha = riseP;
  let blur = 6 * (1 - eRise);
  let yOffset = (1 - eRise) * 22;
  let glint = false;
  let ripple = riseAge < KOI_RIPPLE_MS ? clamp(riseAge / KOI_RIPPLE_MS, 0, 1) : -1;

  if (entity.sinking) {
    const sinkAt = Number(entity.sinkStartMs);
    const sinkAge = Number.isFinite(sinkAt) ? Math.max(0, now - sinkAt) : 0;
    const sinkDurationMs = resolveNudgeEntitySinkDurationMs(entity);
    const visualDelayMs = 0;
    const visualSinkAge = Math.max(0, sinkAge - visualDelayMs);
    const visualSinkDurationMs = Math.max(1, sinkDurationMs - visualDelayMs);
    const sinkP = clamp(visualSinkAge / visualSinkDurationMs, 0, 1);
    const eSink = sinkP ** 3;
    scale = (0.32 + 0.68 * eRise) * (1 - 0.66 * eSink);
    alpha = (1 - eSink);
    blur = Math.max(blur, 4 * eSink);
    yOffset = yOffset + eSink * 28;
    glint = sinkAge < KOI_GLINT_MS;
    ripple = sinkAge < KOI_RIPPLE_MS
      ? clamp(sinkAge / KOI_RIPPLE_MS, 0, 1)
      : -1;
  }
  return { scale, alpha, blur, yOffset, glint, ripple };
}

function drawKoiRipple(ctx, x, y, size, progress) {
  if (!(progress > 0 && progress < 1)) return;
  const eased = 1 - (1 - progress) ** 3;
  const radius = Math.max(6, Number(size) || 6) * (0.34 + eased * 1.5);
  ctx.save();
  ctx.filter = 'none';
  ctx.globalAlpha = (1 - progress) * 0.4;
  ctx.lineWidth = Math.max(1, (Number(size) || 6) * 0.02);
  ctx.strokeStyle = 'rgba(210, 226, 220, 0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const SITE_FURIN_WAKE_IDLE_RESET_MS = 420;

function resolveSiteFurinWakeState(entity, timeMs, size, historyLimit, lifetimeMs) {
  const now = Number(timeMs) || 0;
  const x = Number(entity?.x) || 0;
  const y = Number(entity?.y) || 0;
  const heading = Math.atan2(Number(entity?.vy) || -1, Number(entity?.vx) || 0);
  const tailX = x - Math.cos(heading) * size * 0.24;
  const tailY = y - Math.sin(heading) * size * 0.24;
  let state = entity.siteFurinWakeState;
  const frameGapMs = state ? now - Number(state.lastFrameAtMs) : 0;
  if (!state || frameGapMs < 0 || frameGapMs > SITE_FURIN_WAKE_IDLE_RESET_MS) {
    state = { lastFrameAtMs: now, lastSampleAtMs: now, points: [] };
    entity.siteFurinWakeState = state;
  }

  const latest = state.points[state.points.length - 1];
  const distance = latest ? Math.hypot(tailX - latest.x, tailY - latest.y) : 0;
  const teleported = latest && distance > Math.max(140, size * 3.2);
  if (teleported) state.points.length = 0;

  const sampleAgeMs = now - Number(state.lastSampleAtMs);
  const shouldSample = state.points.length === 0
    || distance >= size * 0.1
    || (distance >= 0.8 && sampleAgeMs >= 58);
  if (shouldSample) {
    state.points.push({ bornAtMs: now, heading, x: tailX, y: tailY });
    state.lastSampleAtMs = now;
  }

  const oldestAllowedAtMs = now - lifetimeMs;
  while (state.points.length > 0 && state.points[0].bornAtMs < oldestAllowedAtMs) {
    state.points.shift();
  }
  if (state.points.length > historyLimit) {
    state.points.splice(0, state.points.length - historyLimit);
  }
  state.lastFrameAtMs = now;
  return state;
}

function resolveSiteFurinWakeRailPoint(point, side, ageProgress, size) {
  const spread = size * (0.07 + ageProgress * 0.62);
  const normalX = -Math.sin(point.heading);
  const normalY = Math.cos(point.heading);
  return {
    x: point.x + normalX * spread * side,
    y: point.y + normalY * spread * side,
  };
}

function isPointInsideCanvas(ctx, x, y) {
  const canvasWidth = Number(ctx?.canvas?.width);
  const canvasHeight = Number(ctx?.canvas?.height);
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) return true;
  const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const scaleX = Math.abs(Number(transform?.a)) || 1;
  const scaleY = Math.abs(Number(transform?.d)) || 1;
  return x >= 0 && x <= canvasWidth / scaleX && y >= 0 && y <= canvasHeight / scaleY;
}

export function resolveGlobalSentinelVulnerabilityCueTimeline(entity = null) {
  const telegraph = clamp(
    Number(entity?.globalSentinelVulnerabilityTelegraphProgress) || 0,
    0,
    1,
  );
  const vulnerable = entity?.globalSentinelVulnerable === true;
  const progress = clamp(Number(entity?.globalSentinelVulnerabilityProgress) || 0, 0, 1);
  if (!vulnerable && telegraph <= 0.02) {
    return Object.freeze({
      active: false,
      approach: 0,
      contraction: 0,
      phase: GLOBAL_SENTINEL_VULNERABILITY_CUE_PHASES.INACTIVE,
      progress: 0,
      repairContact: 0,
      ruptureWindow: 0,
      telegraph,
      vulnerable: false,
    });
  }
  if (vulnerable) {
    return Object.freeze({
      active: true,
      approach: 1,
      contraction: 1,
      phase: GLOBAL_SENTINEL_VULNERABILITY_CUE_PHASES.RUPTURE_WINDOW,
      progress,
      repairContact: 1,
      ruptureWindow: 0.72 + Math.sin(Math.PI * progress) * 0.28,
      telegraph: 1,
      vulnerable: true,
    });
  }
  const approach = resolveSmoothstepUnit(telegraph / 0.58);
  const repairContact = resolveSmoothstepUnit((telegraph - 0.2) / 0.44);
  const contraction = resolveSmoothstepUnit((telegraph - 0.56) / 0.44);
  return Object.freeze({
    active: true,
    approach,
    contraction,
    phase: telegraph < 0.58
      ? GLOBAL_SENTINEL_VULNERABILITY_CUE_PHASES.APPROACH_REPAIR_CONTACT
      : GLOBAL_SENTINEL_VULNERABILITY_CUE_PHASES.RING_CORE_CONTRACTION,
    progress: 0,
    repairContact,
    ruptureWindow: 0,
    telegraph,
    vulnerable: false,
  });
}

export function resolveGlobalSentinelEmergenceTimeline(entity = null, timeMs = 0) {
  const spawnedAtMs = Number(entity?.globalSentinelSpawnedAtMs);
  const now = Number(timeMs);
  if (
    entity?.globalSentinelStartGate !== true
    || !Number.isFinite(spawnedAtMs)
    || !Number.isFinite(now)
  ) {
    return Object.freeze({
      active: false,
      bodyAlpha: 1,
      material: 1,
      progress: 1,
      subsurface: 0,
    });
  }
  const progress = clamp(
    (now - spawnedAtMs) / GLOBAL_SENTINEL_STARTER_EMERGENCE_MS,
    0,
    1,
  );
  const material = resolveSmoothstepUnit((progress - 0.12) / 0.72);
  const subsurfaceArrival = (1 - resolveSmoothstepUnit((progress - 0.54) / 0.46))
    * (0.42 + Math.sin(progress * Math.PI) * 0.58);
  return Object.freeze({
    active: progress < 1,
    bodyAlpha: 0.08 + material * 0.92,
    material,
    progress,
    subsurface: 0.1 + subsurfaceArrival * 0.9,
  });
}

function drawGlobalSentinelSubsurfaceArrival(ctx, entity, timeMs, entityBudget) {
  const emergence = resolveGlobalSentinelEmergenceTimeline(entity, timeMs);
  if (!(emergence.subsurface > 0.001)) return emergence;
  const size = Math.max(14, Number(entity?.size) || 28);
  const heading = Math.atan2(Number(entity?.vy) || 0, Number(entity?.vx) || 1);
  const drift = size * (0.22 - emergence.progress * 0.12);
  const wave = Math.sin(Number(timeMs) * 0.0042 + (Number(entity?.entityId) || 0));

  ctx.save();
  ctx.translate(Number(entity?.x) || 0, Number(entity?.y) || 0);
  ctx.rotate(heading);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = emergence.subsurface * 0.22;
  const stain = ctx.createRadialGradient(
    -drift,
    wave * size * 0.025,
    size * 0.04,
    -drift,
    wave * size * 0.025,
    size * 0.92,
  );
  stain.addColorStop(0, 'rgba(3, 8, 12, 0.76)');
  stain.addColorStop(0.42, 'rgba(12, 21, 27, 0.3)');
  stain.addColorStop(1, 'rgba(12, 21, 27, 0)');
  ctx.fillStyle = stain;
  ctx.beginPath();
  ctx.ellipse(-drift, 0, size * 0.92, size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'screen';
  ctx.shadowColor = 'rgba(143, 222, 222, 0.3)';
  ctx.shadowBlur = entityBudget.vulnerabilityBlurEnabled ? Math.max(3, size * 0.05) : 0;
  ctx.lineCap = 'round';
  for (const strand of [
    { color: 'rgba(75, 211, 225, 0.42)', side: -1 },
    { color: 'rgba(237, 111, 145, 0.3)', side: 1 },
  ]) {
    ctx.globalAlpha = emergence.subsurface * (strand.side < 0 ? 0.32 : 0.22);
    ctx.strokeStyle = strand.color;
    ctx.lineWidth = Math.max(0.7, size * 0.008);
    ctx.beginPath();
    ctx.moveTo(-size * 0.86, strand.side * size * 0.1);
    ctx.quadraticCurveTo(
      -size * 0.14,
      strand.side * size * (0.16 + wave * 0.025),
      size * 0.58,
      strand.side * size * 0.065,
    );
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(0.8, size * 0.011);
  for (const refraction of [
    {
      alpha: 0.24,
      color: 'rgba(107, 219, 226, 0.54)',
      end: -Math.PI * 0.12,
      start: -Math.PI * 0.78,
    },
    {
      alpha: 0.16,
      color: 'rgba(238, 128, 157, 0.46)',
      end: Math.PI * 0.86,
      start: Math.PI * 0.2,
    },
  ]) {
    ctx.globalAlpha = emergence.subsurface * refraction.alpha;
    ctx.strokeStyle = refraction.color;
    ctx.beginPath();
    ctx.ellipse(
      -drift,
      wave * size * 0.02,
      size * 0.74,
      size * 0.2,
      0,
      refraction.start,
      refraction.end,
    );
    ctx.stroke();
  }
  ctx.restore();
  return emergence;
}

function drawGlobalSentinelPolarizedMaterial(ctx, entity, emergence, timeMs) {
  const presence = clamp(Number(emergence?.material) || 0, 0, 1);
  if (presence <= 0.001) return;
  const size = Math.max(14, Number(entity?.size) || 28);
  const heading = Math.atan2(Number(entity?.vy) || 0, Number(entity?.vx) || 1);
  const breathing = 0.86 + Math.sin(Number(timeMs) * 0.0034 + (Number(entity?.entityId) || 0)) * 0.14;
  ctx.save();
  ctx.translate(Number(entity?.x) || 0, Number(entity?.y) || 0);
  ctx.rotate(heading);
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.globalAlpha = presence * 0.22 * breathing;
  ctx.strokeStyle = 'rgba(187, 224, 216, 0.62)';
  ctx.lineWidth = Math.max(0.7, size * 0.008);
  ctx.beginPath();
  ctx.moveTo(-size * 0.48, 0);
  ctx.quadraticCurveTo(-size * 0.06, -size * 0.035, size * 0.43, 0);
  ctx.stroke();
  for (const edge of [
    { color: 'rgba(47, 205, 224, 0.7)', side: -1 },
    { color: 'rgba(236, 90, 129, 0.56)', side: 1 },
  ]) {
    ctx.globalAlpha = presence * (edge.side < 0 ? 0.16 : 0.11) * breathing;
    ctx.strokeStyle = edge.color;
    ctx.lineWidth = Math.max(0.55, size * 0.0065);
    ctx.beginPath();
    ctx.moveTo(-size * 0.34, edge.side * size * 0.105);
    ctx.quadraticCurveTo(
      size * 0.06,
      edge.side * size * 0.15,
      size * 0.42,
      edge.side * size * 0.055,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlobalSentinelVulnerabilityCue(
  ctx,
  entity,
  timeMs,
  entityBudget,
) {
  const TAU = Math.PI * 2;
  const size = Math.max(14, Number(entity?.size) || 28);
  const cue = resolveGlobalSentinelVulnerabilityCueTimeline(entity);
  if (!cue.active) return;
  const { vulnerable, progress } = cue;
  const heading = Math.atan2(Number(entity?.vy) || 0, Number(entity?.vx) || 1);
  const coreX = -size * 0.08;
  const feedbackAtMs = Number(entity?.globalSentinelStarterFeedbackAtMs) || 0;
  const feedbackAgeMs = feedbackAtMs > 0 ? Math.max(0, Number(timeMs) - feedbackAtMs) : Number.POSITIVE_INFINITY;
  const feedbackProgress = feedbackAgeMs < GLOBAL_SENTINEL_STARTER_FEEDBACK_MS
    ? clamp(feedbackAgeMs / GLOBAL_SENTINEL_STARTER_FEEDBACK_MS, 0, 1)
    : 1;
  const feedbackPulse = feedbackProgress < 1 ? 1 - feedbackProgress : 0;
  const feedbackEased = 1 - ((1 - feedbackPulse) ** 3);

  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.rotate(heading);
  ctx.lineCap = 'round';

  if (!vulnerable) {
    const eased = cue.approach;
    const gateRadius = size * (0.76 - cue.contraction * 0.42);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = entityBudget.vulnerabilityTelegraphAlpha
      * (0.12 + cue.repairContact * 0.2)
      * eased;
    ctx.fillStyle = 'rgba(3, 8, 12, 0.62)';
    ctx.beginPath();
    ctx.arc(coreX, 0, gateRadius * 0.88, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = 'rgba(164, 236, 224, 0.5)';
    ctx.shadowBlur = entityBudget.vulnerabilityBlurEnabled ? Math.max(4, size * 0.065) : 0;
    ctx.lineWidth = Math.max(1.15, size * 0.014);
    ctx.globalAlpha = entityBudget.vulnerabilityTelegraphAlpha * 0.24 * eased;
    ctx.strokeStyle = 'rgba(218, 247, 236, 0.9)';
    ctx.beginPath();
    ctx.arc(coreX, 0, gateRadius, -0.24, 0.28);
    ctx.moveTo(coreX - gateRadius * 0.96, gateRadius * 0.28);
    ctx.arc(coreX, 0, gateRadius, Math.PI - 0.28, Math.PI + 0.18);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.4, size * 0.018);
    ctx.globalAlpha = entityBudget.vulnerabilityTelegraphAlpha * 0.2 * eased;
    ctx.strokeStyle = 'rgba(71, 218, 232, 0.9)';
    ctx.beginPath();
    ctx.arc(coreX, 0, gateRadius, -Math.PI / 2, -Math.PI / 2 + 0.42 * cue.telegraph);
    ctx.stroke();
    if (cue.contraction > 0) {
      // A matte, unbroken seal is a preview, never an invitation. Only the
      // engine's vulnerable bit may expose the contrasting glass lips below.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = entityBudget.vulnerabilityTelegraphAlpha * cue.contraction * 0.28;
      ctx.fillStyle = 'rgba(108, 133, 138, 0.9)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.rect(coreX - size * 0.016, -size * 0.1, size * 0.032, size * 0.2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const pulse = Math.sin(Math.PI * progress);
  // The entire canonical window is actionable. Mid-window quality may breathe
  // in the ring, but its two open lips must be legible at both boundaries too.
  const alpha = entityBudget.vulnerabilityActiveAlpha * (0.9 + pulse * 0.1);
  const timingWeight = 1 - Math.abs(progress - 0.5) * 2;
  const core = Math.max(3.5, size * (0.065 + pulse * 0.024));
  const ringRadius = Math.max(core * 3.4, size * (0.48 + pulse * 0.024));

  if (feedbackPulse > 0) {
    const rippleRadius = size * (0.34 + feedbackProgress * 0.52);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(
      (1 - feedbackProgress) * entityBudget.vulnerabilityFeedbackAlpha * 0.68,
      0,
      0.34,
    );
    ctx.shadowColor = 'rgba(185, 238, 225, 0.64)';
    ctx.shadowBlur = entityBudget.vulnerabilityBlurEnabled
      ? Math.max(8, size * (0.12 + feedbackPulse * 0.08))
      : 0;
    ctx.lineWidth = Math.max(0.9, size * (0.009 + feedbackPulse * 0.008));
    ctx.strokeStyle = 'rgba(186, 236, 224, 0.72)';
    ctx.beginPath();
    ctx.arc(coreX, 0, rippleRadius, 0, TAU);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = clamp(alpha * 0.56 + feedbackEased * 0.06, 0, 0.62);
  ctx.fillStyle = 'rgba(2, 7, 10, 0.82)';
  ctx.shadowColor = 'rgba(5, 12, 16, 0.52)';
  ctx.shadowBlur = entityBudget.vulnerabilityBlurEnabled
    ? Math.max(4, size * (0.055 + feedbackEased * 0.04))
    : 0;
  ctx.beginPath();
  ctx.arc(coreX, 0, core * (1.06 + feedbackEased * 0.12), 0, TAU);
  ctx.fill();

  // The sealed core visibly opens into two glass lips for the full accepted
  // window. Shape and contrast carry the cue even without sound or color.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = clamp(alpha * 0.96, 0, 0.88);
  ctx.strokeStyle = 'rgba(224, 250, 240, 0.96)';
  ctx.lineWidth = Math.max(1.4, size * 0.028);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(coreX + side * core * 0.7, -core * 1.5);
    ctx.lineTo(coreX + side * core * 1.4, 0);
    ctx.lineTo(coreX + side * core * 0.7, core * 1.5);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = clamp(alpha * 0.58 + feedbackEased * 0.12, 0, 0.68);
  ctx.fillStyle = 'rgba(209, 241, 228, 0.9)';
  ctx.beginPath();
  ctx.arc(coreX + core * 0.08, 0, core * 0.22, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, size * 0.015);
  ctx.globalAlpha = clamp(alpha * (0.48 + Math.max(0, timingWeight) * 0.08), 0, 0.5);
  ctx.strokeStyle = 'rgba(200, 247, 235, 0.94)';
  ctx.beginPath();
  ctx.arc(coreX, 0, ringRadius, -Math.PI / 2 + 0.2, Math.PI / 2 - 0.2);
  ctx.moveTo(coreX + Math.cos(Math.PI / 2 + 0.2) * ringRadius, Math.sin(Math.PI / 2 + 0.2) * ringRadius);
  ctx.arc(coreX, 0, ringRadius, Math.PI / 2 + 0.2, Math.PI * 1.5 - 0.2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.45, size * 0.019);
  ctx.globalAlpha = clamp(alpha * 0.2, 0, 0.2);
  ctx.strokeStyle = 'rgba(64, 218, 234, 0.94)';
  ctx.beginPath();
  ctx.arc(coreX, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + 0.3 + progress * 0.25);
  ctx.stroke();
  ctx.globalAlpha = clamp(alpha * 0.12, 0, 0.12);
  ctx.strokeStyle = 'rgba(244, 103, 140, 0.88)';
  ctx.beginPath();
  ctx.arc(coreX, 0, ringRadius * 0.82, -Math.PI * 0.56, -Math.PI * 0.44);
  ctx.stroke();
  ctx.restore();
}

function resolveSmoothstepUnit(value) {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function assertGlobalSentinelHitAftermathBurst(burst) {
  if (burst?.hitAftermath !== true) {
    throw new Error('global_sentinel_hit_aftermath_contract_missing');
  }
  const requiredFields = [
    'startedAtMs',
    'sourceX',
    'sourceY',
    'sourceSize',
    'sourceHeading',
    'impactX',
    'impactY',
    'recallX',
    'recallY',
    'impactSerial',
    'durationMs',
  ];
  for (const field of requiredFields) {
    if (!Number.isFinite(Number(burst[field]))) {
      throw new Error(`global_sentinel_hit_aftermath_field_invalid:${field}`);
    }
  }
  if (Number(burst.sourceSize) <= 0) {
    throw new Error('global_sentinel_hit_aftermath_field_invalid:sourceSize');
  }
  if (Math.round(Number(burst.impactSerial)) <= 0) {
    throw new Error('global_sentinel_hit_aftermath_field_invalid:impactSerial');
  }
  const durationMs = Math.floor(Number(burst.durationMs));
  const maximumDurationMs = burst.terminalHit === true
    ? GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS
    : GLOBAL_SENTINEL_HIT_AFTERMATH_MS;
  if (durationMs <= 0 || durationMs > maximumDurationMs) {
    throw new Error('global_sentinel_hit_aftermath_field_invalid:durationMs');
  }
  if (typeof burst.terminalHit !== 'boolean') {
    throw new Error('global_sentinel_hit_aftermath_field_invalid:terminalHit');
  }
  if (typeof burst.koiActor?.draw !== 'function') {
    throw new Error('global_sentinel_hit_aftermath_actor_invalid');
  }
}

export function resolveGlobalSentinelHitAftermathTimeline(burst, timeMs) {
  assertGlobalSentinelHitAftermathBurst(burst);
  const now = Number(timeMs);
  if (!Number.isFinite(now)) {
    throw new Error('global_sentinel_hit_aftermath_clock_invalid');
  }
  const ageMs = now - Number(burst.startedAtMs);
  if (ageMs < 0) {
    throw new Error('global_sentinel_hit_aftermath_clock_precedes_hit');
  }
  const terminal = burst.terminalHit === true;
  const durationMs = Math.floor(Number(burst.durationMs));
  const progress = clamp(ageMs / durationMs, 0, 1);
  if (progress >= 1) {
    return Object.freeze({
      active: false,
      ageMs,
      durationMs,
      actorDissolve: 0,
      capillaryFeed: 0,
      completionFade: 0,
      fracture: 0,
      impactSerial: Math.round(Number(burst.impactSerial)),
      inkMass: 0,
      inkTransfer: 1,
      phase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.COMPLETE,
      particleContrast: 0,
      progress: 1,
      repairRailPrimary: 0,
      repairRailSecondary: 0,
      repairSeamAnnulment: 1,
      reverseCurrent: 0,
      reverseRecall: 1,
      terminal,
      weight: terminal ? 1.36 : 1,
    });
  }

  const fracture = 1 - resolveSmoothstepUnit(progress / 0.3);
  const actorDissolve = 1 - resolveSmoothstepUnit((progress - 0.015) / 0.24);
  const inkTransfer = resolveSmoothstepUnit((progress - 0.08) / 0.54);
  const inkMass = resolveSmoothstepUnit((progress - 0.025) / 0.2)
    * (1 - resolveSmoothstepUnit((progress - 0.66) / 0.28));
  const capillaryFeed = resolveSmoothstepUnit((progress - 0.12) / 0.42)
    * (1 - resolveSmoothstepUnit((progress - 0.72) / 0.22));
  const reverseRecall = resolveSmoothstepUnit((progress - 0.18) / 0.48);
  const repairSeamAnnulment = resolveSmoothstepUnit((progress - 0.64) / 0.28);
  const completionFade = 1 - resolveSmoothstepUnit((progress - 0.82) / 0.18);
  const reverseCurrent = reverseRecall * (1 - repairSeamAnnulment) * completionFade;
  const repairRailPrimary = reverseRecall
    * (1 - resolveSmoothstepUnit(repairSeamAnnulment / 0.7))
    * completionFade;
  const repairRailSecondary = reverseRecall
    * (1 - resolveSmoothstepUnit((repairSeamAnnulment - 0.3) / 0.7))
    * completionFade;
  const particleContrast = (1 - repairSeamAnnulment * 0.74) * completionFade * 0.32;
  const phase = progress < 0.3
    ? GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.FRACTURE
    : (progress < 0.7
      ? GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.REVERSE_RECALL
      : GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.REPAIR_SEAM_ANNULMENT);
  return Object.freeze({
    active: true,
    ageMs,
    actorDissolve,
    capillaryFeed,
    durationMs,
    completionFade,
    fracture,
    impactSerial: Math.round(Number(burst.impactSerial)),
    inkMass,
    inkTransfer,
    particleContrast,
    phase,
    progress,
    repairRailPrimary,
    repairRailSecondary,
    repairSeamAnnulment,
    reverseCurrent,
    reverseRecall,
    terminal,
    weight: terminal ? 1.36 : 1,
  });
}

export function resolveGlobalSentinelInkBurstLifetimeMs(burst = null) {
  if (burst?.starterActivation === true) {
    return GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS;
  }
  assertGlobalSentinelHitAftermathBurst(burst);
  return Math.floor(Number(burst.durationMs));
}

export function resolveGlobalSentinelStarterActivationTransient(burst, timeMs) {
  if (burst?.starterActivation !== true) return null;
  const ageMs = timeMs - burst.startedAtMs;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS) return null;
  const progress = ageMs / GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS;
  const timeline = resolveGlobalSentinelEntryRuptureTimeline(progress);
  return { ageMs, progress, timeline, actorAlpha: 1 - timeline.shikigamiRelease,
    sourceX: burst.sourceX, sourceY: burst.sourceY, sourceSize: burst.sourceSize,
    sourceHeading: burst.sourceHeading, impactX: burst.impactX, impactY: burst.impactY };
}

function drawGlobalSentinelHitAftermath(ctx, burst, timeMs, renderBudget) {
  const timeline = resolveGlobalSentinelHitAftermathTimeline(burst, timeMs);
  if (!timeline.active) return false;
  const p = timeline.progress;
  const alpha = 1 - resolveSmoothstepUnit((p - 0.08) / 0.34);
  // Keep the struck koi recognizable at its repair site. It loses coherence
  // into short local scan strips, instead of stretching into a central missile.
  if (alpha > 0) {
    const radius = burst.sourceSize * 1.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    const strips = 16;
    for (let i = 0; i < strips; i += 1) {
      if (p > 0.1 && (i * 7 % strips) / strips < resolveSmoothstepUnit((p - 0.1) / 0.32)) continue;
      ctx.rect(burst.sourceX - radius, burst.sourceY - radius + i * radius * 2 / strips, radius * 2, radius * 2 / strips + 0.5);
    }
    ctx.clip();
    burst.koiActor.draw(ctx, { intensity: 1, renderBudget, protocolScope: 'global', scenePhase: 'ritual', timeMs });
    ctx.restore();
  }
  return true;
}
export function drawGlobalSentinelInkBurst(ctx, burst, timeMs, renderBudget) {
  if (!ctx || !burst) return false;
  if (burst.hitAftermath === true) {
    return drawGlobalSentinelHitAftermath(ctx, burst, timeMs, renderBudget);
  }
  const entityBudget = resolveEntityRenderBudget(renderBudget);
  const startedAtMs = Number(burst.startedAtMs);
  const now = Number(timeMs);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(now)) return false;
  const ageMs = now - startedAtMs;
  const lifetimeMs = resolveGlobalSentinelInkBurstLifetimeMs(burst);
  if (ageMs < 0 || ageMs >= lifetimeMs) return false;
  if (burst.starterActivation === true) {
    // The scene foreground owns paired release, LCD occlusion and giant return.
    return resolveGlobalSentinelStarterActivationTransient(burst, now) !== null;
  }

  const progress = clamp(ageMs / lifetimeMs, 0, 1);
  const eased = 1 - (1 - progress) ** 3;
  const fade = (1 - progress) ** 1.45;
  const size = Math.max(18, Number(burst.size) || 32);
  const x = Number.isFinite(Number(burst.x)) ? Number(burst.x) : 0;
  const y = Number.isFinite(Number(burst.y)) ? Number(burst.y) : 0;
  const heading = Number.isFinite(Number(burst.heading)) ? Number(burst.heading) : 0;
  const seed = Math.max(1, Math.round(Number(burst.seed) || 1));
  const particleCount = entityBudget.inkParticleCount;
  const TAU = Math.PI * 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.globalCompositeOperation = 'source-over';

  if (entityBudget.inkHaloEnabled) {
    const haloRadius = size * (0.48 + eased * 0.9);
    const halo = ctx.createRadialGradient(0, 0, size * 0.04, 0, 0, haloRadius);
    halo.addColorStop(0, `rgba(0, 0, 0, ${0.3 * fade})`);
    halo.addColorStop(0.42, `rgba(0, 0, 0, ${0.12 * fade})`);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(0, 0, haloRadius * 0.62, haloRadius * 0.34, 0, 0, TAU);
    ctx.fill();
  }

  for (let i = 0; i < particleCount; i += 1) {
    const spread = seededUnit(i * 31 + 5, seed);
    const bias = seededUnit(i * 37 + 11, seed);
    const angle = (i % 4 === 0)
      ? (spread * TAU)
      : (Math.PI + (spread - 0.5) * 2.45);
    const distance = size * (0.16 + seededUnit(i * 41 + 17, seed) * 0.7) * (0.35 + eased * 1.18);
    const lateral = (seededUnit(i * 43 + 19, seed) - 0.5) * size * 0.14 * eased;
    const px = Math.cos(angle) * distance + lateral;
    const py = Math.sin(angle) * distance * (0.58 + bias * 0.34);
    const blob = size * (0.026 + seededUnit(i * 47 + 23, seed) * 0.038) * (1 - progress * 0.42);
    const stretch = 1.2 + seededUnit(i * 53 + 29, seed) * 1.35;
    const alpha = clamp(fade * (0.28 + seededUnit(i * 59 + 31, seed) * 0.34), 0, 0.68);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(px, py, Math.max(1.1, blob * stretch), Math.max(0.7, blob * 0.58), angle, 0, TAU);
    ctx.fill();
  }

  if (entityBudget.inkHaloEnabled) {
    ctx.globalAlpha = clamp(0.28 * fade, 0, 0.28);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.lineWidth = Math.max(0.9, size * 0.014);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      const yOffset = (seededUnit(i * 67 + 13, seed) - 0.5) * size * 0.18;
      const reach = size * (0.36 + eased * (0.54 + seededUnit(i * 71 + 17, seed) * 0.26));
      ctx.beginPath();
      ctx.moveTo(-size * 0.04, yOffset * 0.4);
      ctx.quadraticCurveTo(
        -reach * 0.45,
        yOffset - size * 0.08 * Math.sin(seed + i),
        -reach,
        yOffset * (0.72 + eased * 0.36),
      );
      ctx.stroke();
    }
  }

  ctx.restore();
  return true;
}

export function drawNudgeEntity(ctx, entity, theme, timeMs, intensity = 1, renderOptions = null) {
  if (!ctx || !entity || !theme) return;
  const renderBudget = renderOptions?.renderBudget;
  const entityBudget = resolveEntityRenderBudget(renderBudget);
  const protocolScope = normalizeSentinelFlareProtocolScope(renderOptions?.protocolScope);
  const scenePhase = resolveScenePhase(renderOptions?.scenePhase);
  const isGlobalProtocol = protocolScope === 'global';
  const compactStyle = !renderBudget.allowExpensivePasses;
  const terminal = isGlobalProtocol
    ? resolveGlobalSentinelEntityTerminalVisualProgress(
      renderOptions?.terminalSequence,
      timeMs,
    )
    : resolveNudgeTerminalSequenceProgress(renderOptions?.terminalSequence, {
      now: timeMs,
    });
  const terminalTransform = resolveEntityTerminalTransform(entity, terminal);

  if (isShadowKoiActorEntity(entity)) {
    // Generic non-global actor lifecycle; Site Furin no longer renders actors.
    const useLifecycle = !isGlobalProtocol && !terminalTransform.active;
    const life = useLifecycle ? resolveKoiLifecycle(entity, timeMs) : null;
    if (life && life.ripple >= 0) {
      drawKoiRipple(ctx, entity.x, entity.y, entity.size, life.ripple);
    }
    const globalEmergence = isGlobalProtocol && !terminalTransform.active
      ? drawGlobalSentinelSubsurfaceArrival(ctx, entity, timeMs, entityBudget)
      : null;
    ctx.save();
    if (terminalTransform.active) {
      ctx.translate(entity.x + terminalTransform.offsetX, entity.y + terminalTransform.offsetY);
      ctx.scale(terminalTransform.scale, terminalTransform.scale);
      ctx.translate(-entity.x, -entity.y);
    } else if (life) {
      ctx.translate(entity.x, entity.y + life.yOffset);
      ctx.scale(life.scale, life.scale);
      ctx.translate(-entity.x, -entity.y);
    }
    ctx.globalAlpha = (isGlobalProtocol
      ? clamp(0.82 + intensity * 0.18, 0.52, 1)
      : clamp(0.74 + intensity * 0.2, 0.48, 0.94))
      * terminalTransform.alpha
      * (isGlobalProtocol && !terminalTransform.active ? (entity.globalSentinelRepairOpacity ?? 1) : 1)
      * (life ? life.alpha : 1)
      * (globalEmergence?.bodyAlpha ?? 1);
    if (isGlobalProtocol) {
      ctx.shadowColor = 'rgba(24, 49, 53, 0.34)';
      ctx.shadowBlur = scenePhase === 'escape'
        ? entityBudget.globalEscapeKoiShadowBlur
        : entityBudget.globalKoiShadowBlur;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      // Emergence depth comes from scale/alpha/ripple. Dynamic Canvas2D blur on
      // every newly revealed koi caused the exact burst-time hitch this ritual
      // is meant to avoid.
      ctx.filter = 'none';
    }
    if (isGlobalProtocol && entity.globalSentinelStartGate === true && !terminalTransform.active) {
      drawZenSentinelPairedKoi(ctx, entity, renderBudget, timeMs);
    } else entity.koiActor.draw(ctx, {
      intensity,
      renderBudget,
      timeMs,
      protocolScope,
      scenePhase,
    });
    if (isGlobalProtocol && entity.globalSentinelStartGate !== true && !terminalTransform.active) {
      drawGlobalSentinelPolarizedMaterial(ctx, entity, globalEmergence, timeMs);
    }
    if (isGlobalProtocol && entity.globalSentinelStartGate !== true && !terminalTransform.active) {
      drawGlobalSentinelVulnerabilityCue(
        ctx,
        entity,
        timeMs,
        entityBudget,
      );
    }
    if (terminalTransform.active) {
      ctx.translate(entity.x, entity.y);
      drawTerminalResidue(ctx, entity, terminal, entityBudget, isGlobalProtocol);
    }
    ctx.restore();
    return;
  }

  const palette = theme.palette || resolvePalette(DEFAULT_THEME_ID);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.004 + entity.phase);
  const isShadowKoi = theme.shape === 'koi_shadow';

  ctx.save();
  ctx.translate(entity.x + terminalTransform.offsetX, entity.y + terminalTransform.offsetY);
  if (terminalTransform.active) {
    ctx.scale(terminalTransform.scale, terminalTransform.scale);
  }
  if (isShadowKoi) {
    const heading = Math.atan2(entity.vy || 0, entity.vx || 1);
    const sway = Math.sin((Number(entity.swimPhase) || 0) * 2.2 + timeMs * 0.008) * 0.08;
    ctx.rotate(heading + sway);
    ctx.globalAlpha = (0.78 + 0.22 * intensity) * terminalTransform.alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = entityBudget.shadowKoiBlur;
  } else {
    ctx.rotate(entity.spin * timeMs * 0.001 + entity.wobble);
    ctx.globalAlpha = (0.6 + 0.4 * intensity) * terminalTransform.alpha;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = entityBudget.genericShadowBase
      + entityBudget.genericShadowPulse * pulse * intensity;
  }

  if (theme.beam && entityBudget.beamEnabled) {
    drawBeam(ctx, entity.size, palette, pulse, intensity);
  }

  switch (theme.shape) {
    case 'koi_shadow':
      drawShadowKoi(ctx, entity, entity.size, pulse, renderBudget, timeMs);
      break;
    case 'hazard':
      drawHazard(ctx, entity.size, palette, pulse, intensity);
      break;
    case 'distortion':
      drawDistortion(ctx, entity.size, palette, pulse, intensity, theme.flicker || 0.3, compactStyle);
      break;
    case 'glyph':
      drawGlyph(ctx, entity.size, palette, pulse);
      break;
    case 'neon':
      drawNeon(ctx, entity.size, palette, pulse, compactStyle);
      break;
    case 'spore':
      drawSpore(ctx, entity.size, palette, pulse);
      break;
    case 'halo':
      drawHalo(ctx, entity.size, palette, pulse, compactStyle);
      break;
    case 'prism':
    default:
      drawPrism(ctx, entity.size, palette, pulse, intensity, compactStyle);
      break;
  }

  drawTerminalResidue(ctx, entity, terminal, entityBudget, isGlobalProtocol);
  ctx.restore();
}
