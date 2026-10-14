import { KoiFish } from '../../../themes/plugins/zen/api/koiEntity.js';
import {
  resolveKoiTuningFor,
  resolveKoiRenderPolicyFor,
  resolveKoiSpeedMultiplierFor,
  resolveKoiTimeScaleFor,
} from './NudgeShadowKoiPolicy.js';
import { resolveNudgeRenderBudget } from '../rendering/nudgeRenderBudget.js';
import { buildKoiBodyContour } from '../../../themes/plugins/zen/api/koi.js';
import { resolveKoiExpressionVisualScale } from './render/KoiRenderGeometry.js';
import { resolveKoiTailFinGeometry } from './render/KoiRenderFins.js';
import { resolveZenSentinelDepartureDrive, resolveZenSentinelDepartureFault, resolveZenSentinelDepartureMotion } from './ZenSentinelDeparture.js';
import { GLOBAL_SENTINEL_ENTRY_STAGES } from '../nudge/nudgeGameGlobalSentinelProtocol.js';

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function smoothstep(value) {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function wrapAngle(value) {
  let angle = Number(value) || 0;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function transformPointAround(
  point,
  originX,
  originY,
  turnRadians,
  cosTurn,
  sinTurn,
  moveX,
  moveY,
) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return;
  const localX = Number(point.x) - originX;
  const localY = Number(point.y) - originY;
  point.x = originX + localX * cosTurn - localY * sinTurn + moveX;
  point.y = originY + localX * sinTurn + localY * cosTurn + moveY;
  if (Number.isFinite(Number(point.angle))) {
    point.angle = wrapAngle(Number(point.angle) + turnRadians);
  }
}

function resolveBounds(bounds) {
  const width = Math.max(1, Number(bounds?.width) || 1);
  const height = Math.max(1, Number(bounds?.height) || 1);
  return { width, height };
}

function resolveRandomRatio(min, max) {
  return min + Math.random() * (max - min);
}

function resolveBaseSizeFromConfig(config, sizeRatio, protocolScene = null) {
  const spriteSizePx = clamp(config?.spriteSizePx, 32, 260);
  const globalSentinel = isGlobalSentinelProtocol(config, protocolScene);
  const baseScale = globalSentinel ? 0.24 : 0.18;
  return Math.max(
    globalSentinel ? 8 : 6,
    spriteSizePx * clamp(sizeRatio, 0.42, 1.2) * baseScale,
  );
}

function resolveBaseSpeedMultiplierFromConfig(config, speedRatio, individualSpeedFactor) {
  const speedPxPerSec = clamp(config?.baseSpeedPxPerSec, 20, 1200);
  const baseSpeedScale = clamp(speedPxPerSec / 180, 0.35, 3);
  return clamp(
    baseSpeedScale
      * clamp(speedRatio, 0.5, 1.8)
      * clamp(individualSpeedFactor, 0.65, 1.45),
    0.3,
    4,
  );
}

function resolveRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function resolvePercent(value, fallback, min = 0, max = 100) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : fallback, min, max) / 100;
}

function resolveNumber(value, fallback, min, max) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : fallback, min, max);
}

function isGlobalSentinelProtocol(config = {}, protocolScene = null) {
  return protocolScene?.protocolSystem === 'global_sentinel_simulation'
    || protocolScene?.protocolVariant === 'global_sentinel'
    || (
      config?.protocolScope === 'global'
      && (config?.protocolVariant === 'global_sentinel' || config?.protocolSystem === 'global_sentinel_simulation')
    );
}

function resolveGlobalSentinelMotionPolicy(config = {}, protocolScene = null) {
  const scenePolicy = resolveRecord(protocolScene?.motionPolicy);
  const configPolicy = resolveRecord(resolveRecord(config?.globalSentinel).motionPolicy);
  const source = { ...configPolicy, ...scenePolicy };
  return {
    centerX: resolvePercent(source.centerXPercent, 50, 0, 100),
    centerY: resolvePercent(source.centerYPercent, 48, 0, 100),
    radiusX: resolvePercent(source.radiusXPercent, 38, 6, 58),
    radiusY: resolvePercent(source.radiusYPercent, 28, 4, 46),
    speedScale: resolveNumber(source.speedScale, 0.82, 0.2, 1.2),
    activityScale: resolveNumber(source.activityScale, 0.72, 0.35, 1.2),
    simStepRateScale: resolveNumber(source.simStepRateScale, 0.82, 0.45, 1.25),
    pressureSpeedBoost: resolveNumber(source.pressureSpeedBoost, 0.34, 0, 1.2),
    pressureActivityBoost: resolveNumber(source.pressureActivityBoost, 0.36, 0, 1.2),
    pressureRadiusTightening: resolveNumber(source.pressureRadiusTightening, 0.18, 0, 0.6),
    crossDriftScale: resolveNumber(source.crossDriftScale, 1, 0, 2),
  };
}

const FURIN_KOI_PALETTE_INDICES = Object.freeze([
  0, // Kohaku
  1, // Sanke
  9, // Asagi
  10, // Shusui
  13, // Tancho Kohaku
  17, // Yamabuki Ogon
  18, // Kujaku
  19, // Kikusui
  24, // Ginrin Kohaku
  25, // Doitsu Kohaku
]);

function resolveFurinAppearanceProfile() {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  const paletteIndex = FURIN_KOI_PALETTE_INDICES[
    Math.floor(Math.random() * FURIN_KOI_PALETTE_INDICES.length)
  ] || 0;
  return { seed, paletteIndex };
}

function captureFurinVisualState(fish) {
  return {
    variant: fish.variant,
    palette: fish.palette,
    dynamicFaviconColors: fish.dynamicFaviconColors,
    appearanceResolverMeta: fish.appearanceResolverMeta,
    scaleType: fish.scaleType,
    doitsuMode: fish.doitsuMode,
    isGinrin: fish.isGinrin,
    ginrinDensity: fish.ginrinDensity,
    colorBody: fish.colorBody,
    colorPattern: fish.colorPattern,
    colorSecondary: fish.colorSecondary,
    colorAccent: fish.colorAccent,
    colorFin: fish.colorFin,
    colorTail: fish.colorTail,
    eyeColor: fish.eyeColor,
    finStyle: fish.finStyle,
    patternStyle: fish.patternStyle,
    patternMarks: fish.patternMarks,
    patternSignature: fish.patternSignature,
    patternCandidateCount: fish.patternCandidateCount,
    patternBlueprintMeta: fish.patternBlueprintMeta,
  };
}

function applyFurinVisualState(fish, visualState) {
  if (!fish || !visualState) return;
  for (const [key, value] of Object.entries(visualState)) {
    fish[key] = value;
  }
}

const RETAINED_SHIKIGAMI_FORK = Symbol('retained_shikigami_fork');

class NudgeShadowKoiEntity {
  constructor(bounds, config = {}, parent = null, protocolScene = null, presentationFork = null) {
    if (presentationFork?.token === RETAINED_SHIKIGAMI_FORK) {
      const source = presentationFork.source;
      this.kind = 'shikigami_presentation_actor';
      for (const key of ['splitGeneration', 'sizeRatio', 'speedRatio', 'individualSpeedFactor', 'baseSize',
        'baseSpeedMultiplier', 'frameCount', 'timeMs', 'motionSeed', 'motionDirection',
        'protocolVisualProgress', 'protocolSyncLevel', 'x', 'y', 'vx', 'vy', 'size', 'hitRadius']) this[key] = source[key];
      this.runtimeConfig = source.runtimeConfig;
      this.protocolScene = source.protocolScene;
      this.renderBudget = source.renderBudget;
      this.furinVisualState = { ...source.furinVisualState };
      this._tuningKey = source._tuningKey;
      this._tuning = source._tuning;
      this._renderPolicyKey = '';
      this._renderPolicy = null;
      this._spriteRenderDiagnostics = { mode: 'vector', reason: '', cacheHit: false };
      this.fish = source.fish.forkSentinelPresentationRig();
      this.retainedShikigamiMotor = { accumulator: 0 };
      this.presentationGeometry = null;
      return;
    }
    if (presentationFork !== null) throw new Error('NUDGE_SHIKIGAMI_PRESENTATION_FORK_INVALID');
    const resolvedBounds = resolveBounds(bounds);
    const parentGeneration = Number(parent?.splitGeneration) || 0;
    const hasParent = !!parent;

    const nextSizeRatio = hasParent
      ? clamp((Number(parent?.sizeRatio) || 1) * (0.82 - parentGeneration * 0.06), 0.42, 1.15)
      : resolveRandomRatio(0.65, 1.2);
    const nextSpeedRatio = hasParent
      ? clamp((Number(parent?.speedRatio) || 1) * 1.08, 0.5, 1.8)
      : resolveRandomRatio(0.62, 1.25);

    const individualSpeed = resolveRandomRatio(0.82, 1.28);
    const baseSize = resolveBaseSizeFromConfig(config, nextSizeRatio, protocolScene);

    this.kind = 'shadow_koi_actor';
    this.splitGeneration = hasParent ? (parentGeneration + 1) : 0;
    this.sizeRatio = nextSizeRatio;
    this.speedRatio = nextSpeedRatio;
    this.individualSpeedFactor = individualSpeed;
    this.baseSize = baseSize;
    this.baseSpeedMultiplier = resolveBaseSpeedMultiplierFromConfig(
      config,
      nextSpeedRatio,
      individualSpeed,
    );
    this.frameCount = 0;
    this.renderBudget = resolveNudgeRenderBudget('normal');
    this.timeMs = 0;
    this.runtimeConfig = config && typeof config === 'object' ? config : {};
    this.protocolScene = protocolScene && typeof protocolScene === 'object' ? protocolScene : null;
    this.motionSeed = Math.random();
    this.motionDirection = Math.random() < 0.5 ? -1 : 1;
    this.protocolVisualProgress = 0;
    this.protocolSyncLevel = 0;

    // Per-frame derivations are memoized: tuning rebuilds only when render budget
    // or baseSize changes; render policy only when its inputs change. This kills
    // the per-koi, per-frame allocation churn that otherwise drives GC jank.
    this._tuningKey = '';
    this._tuning = null;
    this._renderPolicyKey = '';
    this._renderPolicy = null;
    this._spriteRenderDiagnostics = {
      mode: 'vector',
      reason: '',
      cacheHit: false,
    };

    const tuning = this.#resolveTuning();
    this.fish = new KoiFish(
      resolvedBounds.width,
      resolvedBounds.height,
      'nudge_shadow',
      0,
      'blocked',
      tuning,
    );
    this.fish.baseSpeed = (0.082 + this.fish.personality.energy * 0.09) * 20;
    this.fish.speed = this.fish.baseSpeed;
    this.fish.shadowRenderProfile = { enabled: false, cadence: 0, blur: 0, opacity: 0, scale: 1 };
    this.fish.shadowOutlineColor = '';
    this.fish.shadowOutlineWidthScale = 0;
    this.fish.setAppearanceProfile(resolveFurinAppearanceProfile());
    this.furinVisualState = captureFurinVisualState(this.fish);
    this.fish.colorBody = '#000000';
    this.fish.colorFin = '#000000';
    this.fish.colorTail = '#000000';
    this.fish.colorPattern = '#000000';
    this.fish.colorSecondary = '#000000';
    this.fish.colorAccent = '#000000';
    this.fish.eyeColor = '#000000';

    const initialPose = this.#resolveSpawnPose(resolvedBounds, parent);
    this.#applyPose(initialPose.x, initialPose.y, initialPose.heading);
    this.#syncSnapshot(1 / 60);
  }

  #resolveSpawnPose(bounds, parent = null) {
    const footprint = this.baseSize * 3.4;
    const margin = Math.max(12, footprint * 0.55);
    const minX = margin;
    const maxX = Math.max(minX, bounds.width - margin);
    const minY = margin;
    const maxY = Math.max(minY, bounds.height - margin);

    if (!parent) {

      if (isGlobalSentinelProtocol(this.runtimeConfig, this.protocolScene)) {
        return {
          x: Math.random() * Math.max(1, maxX - minX) + minX,
          y: Math.random() * Math.max(1, maxY - minY) + minY,
          heading: Math.random() * Math.PI * 2,
        };
      }
      return {
        x: Math.random() * Math.max(1, maxX - minX) + minX,
        y: Math.random() * Math.max(1, maxY - minY) + minY,
        heading: Math.random() * Math.PI * 2,
      };
    }

    const px = Number(parent?.x);
    const py = Number(parent?.y);
    const pVx = Number(parent?.vx);
    const pVy = Number(parent?.vy);
    const fallbackHeading = Math.random() * Math.PI * 2;
    const heading = Number.isFinite(pVx) || Number.isFinite(pVy)
      ? Math.atan2(Number.isFinite(pVy) ? pVy : 0, Number.isFinite(pVx) && Math.abs(pVx) > 1e-6 ? pVx : 1)
      : fallbackHeading;
    const splitDirection = Math.random() < 0.5 ? -1 : 1;
    const offsetAngle = heading + splitDirection * (0.32 + Math.random() * 0.44);
    const spawnDistance = Math.max(8, (Number(parent?.size) || footprint) * (0.28 + Math.random() * 0.2));
    const x = clamp((Number.isFinite(px) ? px : bounds.width * 0.5) + Math.cos(offsetAngle) * spawnDistance, minX, maxX);
    const y = clamp((Number.isFinite(py) ? py : bounds.height * 0.5) + Math.sin(offsetAngle) * spawnDistance, minY, maxY);
    return { x, y, heading: offsetAngle };
  }

  #applyPose(x, y, heading) {
    const fish = this.fish;
    fish.x = x;
    fish.y = y;
    fish.angle = heading;
    fish.bodyHeading = heading;
    fish.propulsionDir = heading;
    fish.targetAngle = heading;
    fish.steerTargetAngle = heading;
    fish.aiHeadingFiltered = heading;
    fish.turnRate = 0;
    fish.velocity = { x: Math.cos(heading) * 0.01, y: Math.sin(heading) * 0.01 };

    fish.updateDimensions(fish.tuning);
    const spacing = Math.max(0.5, Number(fish.segmentSpacing) || (fish.baseSize * 0.21));
    fish.history = Array.from({ length: fish.historyLength }, (_, i) => ({
      x: x - Math.cos(heading) * i * spacing,
      y: y - Math.sin(heading) * i * spacing,
      angle: heading,
    }));
    fish.tailWaveMemory = Array.from({ length: fish.historyLength }, () => 0);
    fish.segmentWave = Array.from({ length: fish.historyLength }, () => 0);
    fish.tailPos = fish.history[Math.max(0, fish.history.length - 1)] || { x, y, angle: heading };
  }

  #syncSnapshot(dt, { velocityFromFish = false } = {}) {
    this.presentationGeometry = null;
    const safeDt = Math.max(1 / 240, Number(dt) || (1 / 60));
    const nextX = Number(this.fish?.x) || 0;
    const nextY = Number(this.fish?.y) || 0;
    const prevX = Number(this.x);
    const prevY = Number(this.y);
    this.vx = velocityFromFish || !Number.isFinite(prevX)
      ? (Number(this.fish?.velocity?.x) || 0)
      : (nextX - prevX) / safeDt;
    this.vy = velocityFromFish || !Number.isFinite(prevY)
      ? (Number(this.fish?.velocity?.y) || 0)
      : (nextY - prevY) / safeDt;
    this.x = nextX;
    this.y = nextY;
    this.size = Math.max(8, (Number(this.fish?.baseSize) || this.baseSize) * 3.4);
    this.hitRadius = this.size * 0.48;
  }

  #resolveGlobalSentinelMotionContext(bounds) {
    const policy = resolveGlobalSentinelMotionPolicy(this.runtimeConfig, this.protocolScene);
    const width = bounds.width;
    const height = bounds.height;
    const minSide = Math.min(width, height);
    const pad = Math.max(18, this.size * 0.36, minSide * 0.035);
    const t = (Number(this.timeMs) || 0) % 120000;
    const sync = clamp(Number(this.protocolSyncLevel) || 0, 0, 1);

    const orbit = this.motionSeed * Math.PI * 2
      + t * 0.000046 * this.motionDirection * (0.78 + sync * 0.28);
    const cross = this.motionSeed * Math.PI * 2.7
      + t * 0.000031 * (this.motionDirection > 0 ? -1 : 1);
    const radiusTightening = 1 - sync * policy.pressureRadiusTightening;
    const radiusX = Math.max(70, width * policy.radiusX * radiusTightening * clamp(this.sizeRatio, 0.78, 1.08));
    const radiusY = Math.max(42, height * policy.radiusY * radiusTightening * clamp(1.12 - this.sizeRatio * 0.14, 0.84, 1.08));
    const center = {
      x: width * policy.centerX + Math.sin(t * 0.000039 + this.motionSeed * 8.1) * width * 0.026,
      y: height * policy.centerY + Math.cos(t * 0.000033 + this.motionSeed * 5.4) * height * 0.022,
    };
    const targetX = center.x
      + Math.cos(orbit) * radiusX
      + Math.sin(cross) * width * 0.055 * policy.crossDriftScale * (0.6 + sync * 0.4);
    const targetY = center.y
      + Math.sin(orbit + this.motionSeed * 0.6) * radiusY
      + Math.cos(cross) * height * 0.046 * policy.crossDriftScale * (0.62 + sync * 0.35);
    const tangentX = -Math.sin(orbit) * this.motionDirection;
    const tangentY = Math.cos(orbit) * this.motionDirection * (radiusY / Math.max(1, radiusX));

    return {
      speedScale: policy.speedScale * (0.88 + sync * policy.pressureSpeedBoost),
      activityScale: policy.activityScale * (0.92 + sync * policy.pressureActivityBoost),
      simStepRateScale: policy.simStepRateScale,
      center,
      bounds: {
        width,
        height,
        padding: pad,
      },
      formationTarget: {
        x: clamp(targetX, pad, Math.max(pad, width - pad)),
        y: clamp(targetY, pad, Math.max(pad, height - pad)),
        tangentX,
        tangentY,
        radiusReference: Math.max(radiusX, radiusY),
      },
    };
  }

  #resolveTuning() {
    const key = `${this.renderBudget?.render?.policyId || 'missing'}|${this.baseSize}`;
    if (key !== this._tuningKey) {
      this._tuning = resolveKoiTuningFor(this.renderBudget, this.baseSize);
      this._tuningKey = key;
    }
    return this._tuning;
  }

  #applyFormationArrival(dt, arrivalTarget) {
    const fish = this.fish;
    const originX = Number(fish?.x);
    const originY = Number(fish?.y);
    const targetX = Number(arrivalTarget?.x);
    const targetY = Number(arrivalTarget?.y);
    if (![originX, originY, targetX, targetY].every(Number.isFinite)) return;

    const dx = targetX - originX;
    const dy = targetY - originY;
    const distance = Math.hypot(dx, dy);
    const stopRadiusPx = Math.max(3, this.baseSize * 0.32);
    const pinnedPose = arrivalTarget.pinnedPose === true;
    const arrivalPullRatePerSec = Number(arrivalTarget.arrivalPullRatePerSec);
    const arrivalMaxSpeedPxPerSec = Number(arrivalTarget.arrivalMaxSpeedPxPerSec);
    // Zero explicitly disables the extra arrival transform (prelude, emergence
    // and descent). It must not turn into a second swimmer with default force.
    if (!pinnedPose) {
      if (![arrivalPullRatePerSec, arrivalMaxSpeedPxPerSec].every(Number.isFinite)) {
        throw new Error('NUDGE_KOI_ARRIVAL_POLICY_INVALID');
      }
      if (arrivalPullRatePerSec <= 0 || arrivalMaxSpeedPxPerSec <= 0) return;
    }
    if (!pinnedPose && distance <= stopRadiusPx) return;

    const targetHeading = pinnedPose ? Math.atan2(arrivalTarget.tangentY, arrivalTarget.tangentX) : Math.atan2(dy, dx);
    const currentHeading = Number.isFinite(Number(fish.angle))
      ? Number(fish.angle)
      : targetHeading;
    const headingDelta = wrapAngle(targetHeading - currentHeading);
    const stepSeconds = Math.max(0, Number(dt) || 0);
    const maxTurnRad = 2.8 * stepSeconds;
    const turnStep = clamp(headingDelta, -maxTurnRad, maxTurnRad);
    const nextHeading = wrapAngle(currentHeading + turnStep);

    const pullRate = pinnedPose ? 0 : arrivalPullRatePerSec;
    const maxSpeed = pinnedPose ? 0 : arrivalMaxSpeedPxPerSec;
    const remainingDistance = Math.max(0, distance - stopRadiusPx);
    const pullStepPx = remainingDistance * (1 - Math.exp(-pullRate * stepSeconds));
    const forwardStepPx = Math.min(
      remainingDistance,
      pullStepPx,
      maxSpeed * stepSeconds,
    );
    const facingTarget = Math.cos(wrapAngle(targetHeading - nextHeading));
    const forwardReadiness = smoothstep(clamp((facingTarget - 0.05) / 0.95, 0, 1));
    const moveDistance = forwardStepPx * forwardReadiness;
    const moveX = pinnedPose ? dx : Math.cos(nextHeading) * moveDistance;
    const moveY = pinnedPose ? dy : Math.sin(nextHeading) * moveDistance;
    const cosTurn = Math.cos(turnStep);
    const sinTurn = Math.sin(turnStep);

    const history = Array.isArray(fish.history) ? fish.history : [];
    const transformedPoints = new Set();
    for (const point of history) {
      if (transformedPoints.has(point)) continue;
      transformPointAround(
        point,
        originX,
        originY,
        turnStep,
        cosTurn,
        sinTurn,
        moveX,
        moveY,
      );
      transformedPoints.add(point);
    }
    // The shared event swimmer follows an unposed path. Arrival is a rigid
    // transform of the entire actor, including that simulation-owned path.
    if (fish.eventBodyFrame) {
      for (const point of fish.eventBodyFrame.centerline) {
        if (transformedPoints.has(point)) continue;
        transformPointAround(point, originX, originY, turnStep, cosTurn, sinTurn, moveX, moveY);
        transformedPoints.add(point);
      }
    }
    if (fish.tailPos && !transformedPoints.has(fish.tailPos)) {
      transformPointAround(
        fish.tailPos,
        originX,
        originY,
        turnStep,
        cosTurn,
        sinTurn,
        moveX,
        moveY,
      );
    }

    for (const key of [
      'angle',
      'bodyHeading',
      'targetAngle',
      'steerTargetAngle',
      'aiHeadingFiltered',
      'propulsionDir',
    ]) {
      if (Number.isFinite(Number(fish[key]))) {
        fish[key] = wrapAngle(Number(fish[key]) + turnStep);
      }
    }
    if (
      fish.velocity
      && Number.isFinite(Number(fish.velocity.x))
      && Number.isFinite(Number(fish.velocity.y))
    ) {
      const velocityX = Number(fish.velocity.x);
      const velocityY = Number(fish.velocity.y);
      fish.velocity.x = velocityX * cosTurn - velocityY * sinTurn;
      fish.velocity.y = velocityX * sinTurn + velocityY * cosTurn;
    }
    fish.x = originX + moveX;
    fish.y = originY + moveY;
  }

  #resolveRenderPolicy(renderBudget, intensity, protocolScope, scenePhase, appearance) {
    const intensityBucket = Math.round(clamp(intensity, 0.1, 1.2) * 10);
    const key = `${renderBudget?.render?.policyId || 'missing'}|${protocolScope}|${scenePhase}|${appearance}|${intensityBucket}`;
    if (key !== this._renderPolicyKey) {
      this._renderPolicy = resolveKoiRenderPolicyFor({
        renderBudget,
        intensity,
        protocolScope,
        scenePhase,
        appearance,
      });
      this._renderPolicyKey = key;
    }
    return this._renderPolicy;
  }

  update(dt, bounds, {
    speedScalar = 1,
    renderBudget,
    timeMs = 0,
    protocolProgress = 0,
    protocolSyncLevel = 0,
    globalSentinelRepairTarget = null,
    globalSentinelDeparture = null,
  } = {}) {
    const resolvedBounds = resolveBounds(bounds);
    this.renderBudget = renderBudget;
    this.timeMs = Number.isFinite(Number(timeMs)) ? Number(timeMs) : this.timeMs;
    this.protocolVisualProgress = clamp(Number(protocolProgress) || 0, 0, 1);
    this.protocolSyncLevel = clamp(Number(protocolSyncLevel) || 0, 0, 1);

    const tuning = this.#resolveTuning();
    this.fish.tuning = tuning;
    this.fish.updateDimensions(tuning);
    this.fish.width = resolvedBounds.width;
    this.fish.height = resolvedBounds.height;
    const globalMotion = isGlobalSentinelProtocol(this.runtimeConfig, this.protocolScene)
      ? this.#resolveGlobalSentinelMotionContext(resolvedBounds)
      : null;
    if (globalMotion && globalSentinelRepairTarget) {
      globalMotion.formationTarget = globalSentinelRepairTarget;
      globalMotion.speedScale = 0.18;
      globalMotion.activityScale = 0.5;
    }
    if (globalMotion && globalSentinelDeparture) {
      globalMotion.bounds = globalSentinelDeparture.bounds;
      globalMotion.formationTarget = null;
      globalMotion.speedScale = 1;
      globalMotion.activityScale = 0.92;
      globalMotion.simStepRateScale = 1;
    }
    const protocolMotion = globalMotion;
    const formationTarget = protocolMotion?.formationTarget;
    let formationCatchupScale = 1;
    if (formationTarget && Number.isFinite(formationTarget.x) && Number.isFinite(formationTarget.y)) {
      const dist = Math.hypot(formationTarget.x - Number(this.fish.x), formationTarget.y - Number(this.fish.y));
      if (dist > 25) {
        formationCatchupScale = 1 + clamp((dist - 25) / 45, 0, 3.5);
      } else if (dist < 12 && formationTarget.translationSpeedScale < 0.5) {
        formationCatchupScale = 0.55;
      }
    }

    this.fish.speedMultiplier = resolveKoiSpeedMultiplierFor(
      this.baseSpeedMultiplier,
      speedScalar,
    ) * (protocolMotion?.speedScale || 1) * formationCatchupScale;

    {
      this.frameCount += 1;
      this.fish.update(
        resolvedBounds.width,
        resolvedBounds.height,
        this.frameCount,
        false,
        0,
        {
          tuning,
          timeScale: resolveKoiTimeScaleFor(dt),
          bounds: protocolMotion?.bounds || {
            width: resolvedBounds.width,
            height: resolvedBounds.height,
            padding: Math.max(22, this.size * 0.32),
          },
          center: protocolMotion?.center || {
            x: resolvedBounds.width * 0.5,
            y: resolvedBounds.height * 0.5,
          },
          formationTarget: protocolMotion?.formationTarget || null,
          rosterTransit: globalSentinelDeparture ? {
            heading: globalSentinelDeparture.heading,
          } : null,
          control: globalSentinelDeparture?.control,
          behaviorIntent: globalSentinelDeparture ? { enabled: true, steeringAuthority: 0.92 } : undefined,
          activityScale: protocolMotion?.activityScale || 1,
          globalActivityScale: protocolMotion?.activityScale || 1,
          simStepRateScale: protocolMotion?.simStepRateScale || 1,
          sessionSalt: this.motionSeed * 997,
          neighbors: [],
          mousePos: null,
        },
      );

      if (globalSentinelRepairTarget) this.#applyFormationArrival(dt, globalSentinelRepairTarget);
    }

    this.#syncSnapshot(dt);
  }

  applyRuntimeConfig(config = {}, protocolScene = null) {
    this.runtimeConfig = config && typeof config === 'object' ? config : {};
    if (protocolScene && typeof protocolScene === 'object') this.protocolScene = protocolScene;
    this.baseSize = resolveBaseSizeFromConfig(config, this.sizeRatio, this.protocolScene);
    this.baseSpeedMultiplier = resolveBaseSpeedMultiplierFromConfig(
      config,
      this.speedRatio,
      this.individualSpeedFactor,
    );
    const tuning = this.#resolveTuning();
    this.fish.tuning = tuning;
    this.fish.updateDimensions(tuning);
    this.fish.speedMultiplier = resolveKoiSpeedMultiplierFor(this.baseSpeedMultiplier, 1);
    this.#syncSnapshot(1 / 60);
  }

  teleport(x, y, bounds = null, options = {}) {
    const resolvedBounds = resolveBounds(bounds);
    const footprint = this.baseSize * 3.4;
    const margin = Math.max(12, footprint * 0.55);
    const allowViewportEdge = options.allowViewportEdge === true;
    const offscreenMargin = options.allowOffscreen === true
      ? Math.max(resolvedBounds.width, resolvedBounds.height) * 0.14
      : 0;
    const targetX = clamp(
      Number(x),
      allowViewportEdge ? 0 : margin - offscreenMargin,
      allowViewportEdge
        ? resolvedBounds.width
        : Math.max(margin, resolvedBounds.width - margin) + offscreenMargin,
    );
    const targetY = clamp(
      Number(y),
      allowViewportEdge ? 0 : margin,
      allowViewportEdge ? resolvedBounds.height : Math.max(margin, resolvedBounds.height - margin),
    );
    const manualHeading = Number(options?.heading);
    const currentHeading = Number(this.fish?.angle);
    const currentVx = Number(this.fish?.velocity?.x);
    const currentVy = Number(this.fish?.velocity?.y);
    const fallbackHeading = Number.isFinite(currentHeading) ? currentHeading : 0;
    const heading = Number.isFinite(manualHeading)
      ? manualHeading
      : ((Number.isFinite(currentVx) || Number.isFinite(currentVy))
      ? Math.atan2(Number.isFinite(currentVy) ? currentVy : 0, Number.isFinite(currentVx) ? currentVx : 1)
        : fallbackHeading);
    if (Number.isFinite(manualHeading)) {
      this.motionDirection = Math.cos(manualHeading) < 0 ? -1 : 1;
    }
    this.fish.width = resolvedBounds.width;
    this.fish.height = resolvedBounds.height;
    this.#applyPose(targetX, targetY, heading);
    this.#syncSnapshot(1 / 60, { velocityFromFish: true });
  }

  reanchorGlobalStarterPose(x, y, bounds) {
    if (this.kind !== 'shadow_koi_actor' || !isGlobalSentinelProtocol(this.runtimeConfig, this.protocolScene)
        || ![x, y, bounds?.width, bounds?.height, this.fish?.angle].every(Number.isFinite)
        || bounds.width <= 0 || bounds.height <= 0 || x < 0 || x > bounds.width || y < 0 || y > bounds.height) {
      throw new Error('NUDGE_GLOBAL_STARTER_POSE_INVALID');
    }
    // A settled viewport remaps the same live rig. Do not reset its history,
    // event body frame, fins, wave memory, velocity or native actor identity.
    const heading = this.fish.angle;
    this.fish.width = bounds.width;
    this.fish.height = bounds.height;
    this.#applyFormationArrival(0, { x, y, tangentX: Math.cos(heading), tangentY: Math.sin(heading), pinnedPose: true });
    this.#syncSnapshot(1 / 60, { velocityFromFish: true });
  }

  #applyRenderPolicy(renderPolicy) {
    const shadowProfile = renderPolicy?.shadowRenderProfile;
    this.fish.shadowRenderProfile = shadowProfile && typeof shadowProfile === 'object'
      ? shadowProfile
      : { enabled: false, cadence: 0, blur: 0, opacity: 0, scale: 1 };

    const shadowBodyAlpha = Number(renderPolicy.shadowBodyAlpha);
    const shadowTailAlpha = Number(renderPolicy.shadowTailAlpha);
    const shadowFinAlpha = Number(renderPolicy.shadowFinAlpha);
    if (Number.isFinite(shadowBodyAlpha)) this.fish.shadowBodyAlpha = shadowBodyAlpha;
    if (Number.isFinite(shadowTailAlpha)) this.fish.shadowTailAlpha = shadowTailAlpha;
    if (Number.isFinite(shadowFinAlpha)) this.fish.shadowFinAlpha = shadowFinAlpha;
    this.fish.shadowOutlineColor = typeof renderPolicy.shadowOutlineColor === 'string'
      ? renderPolicy.shadowOutlineColor
      : '';
    this.fish.shadowOutlineWidthScale = Number.isFinite(Number(renderPolicy.shadowOutlineWidthScale))
      ? Number(renderPolicy.shadowOutlineWidthScale)
      : 0;
    if (renderPolicy.mode !== 'shadow') {
      applyFurinVisualState(this.fish, this.furinVisualState);
      return;
    }
    this.fish.colorBody = '#000000';
    this.fish.colorFin = '#000000';
    this.fish.colorTail = '#000000';
    this.fish.colorPattern = '#000000';
    this.fish.colorSecondary = '#000000';
    this.fish.colorAccent = '#000000';
    this.fish.eyeColor = '#000000';
  }

  #drawVectorWithPolicy(ctx, renderPolicy, { frameCount = this.frameCount } = {}) {
    this.#applyRenderPolicy(renderPolicy);
    this.fish.draw(ctx, frameCount, false, false, 0, 0, { renderPolicy });
  }

  #drawWithPolicy(ctx, renderPolicy, {
    protocolScope = 'site',
  } = {}) {
    if (protocolScope === 'global') {
      this.#drawVectorWithPolicy(ctx, renderPolicy);
      this._spriteRenderDiagnostics = {
        mode: renderPolicy.mode === 'natural' ? 'vector_shikigami' : 'vector_shadow',
        reason: '',
        cacheHit: false,
      };
      return;
    }
    this.#drawVectorWithPolicy(ctx, renderPolicy);
    this._spriteRenderDiagnostics = {
      mode: renderPolicy?.mode === 'natural' ? 'vector_animated' : 'vector',
      reason: '',
      cacheHit: false,
    };
  }

  #drawGlitchGhost(ctx, renderPolicy, { alpha, offsetX, offsetY, outlineColor, widthScale = 1 }) {
    ctx.save();
    const currentAlpha = Number(ctx.globalAlpha);
    ctx.globalAlpha = (Number.isFinite(currentAlpha) ? currentAlpha : 1) * alpha;
    ctx.translate(offsetX, offsetY);
    this.#drawWithPolicy(ctx, {
      ...renderPolicy,
      shadowBodyAlpha: renderPolicy.shadowBodyAlpha * 0.46,
      shadowTailAlpha: renderPolicy.shadowTailAlpha * 0.42,
      shadowFinAlpha: renderPolicy.shadowFinAlpha * 0.38,
      shadowOutlineColor: outlineColor,
      shadowOutlineWidthScale: renderPolicy.shadowOutlineWidthScale * widthScale,
    });
    ctx.restore();
  }

  draw(ctx, {
    intensity = 1,
    renderBudget,
    protocolScope = 'site',
    scenePhase = 'ritual',
    timeMs = 0,
    appearance = 'sentinel',
  } = {}) {
    const renderPolicy = this.#resolveRenderPolicy(renderBudget, intensity, protocolScope, scenePhase, appearance);
    if (renderPolicy.glitch?.enabled) {
      const t = Number.isFinite(Number(timeMs)) ? Number(timeMs) : this.timeMs;
      const wave = Math.sin(t * 0.041 + this.frameCount * 0.37);
      const slicePulse = Math.sin(t * 0.017 + this.frameCount * 0.11) > 0.78 ? 1.45 : 1;
      const offset = renderPolicy.glitch.offsetPx * (0.58 + Math.abs(wave) * 0.42) * slicePulse;
      this.#drawGlitchGhost(ctx, renderPolicy, {
        alpha: renderPolicy.glitch.redGhostAlpha,
        offsetX: offset,
        offsetY: -offset * 0.34,
        outlineColor: 'rgba(255, 24, 24, 0.92)',
        widthScale: 1.18,
      });
      this.#drawGlitchGhost(ctx, renderPolicy, {
        alpha: renderPolicy.glitch.paleGhostAlpha,
        offsetX: -offset * 0.72,
        offsetY: offset * 0.24,
        outlineColor: 'rgba(255, 246, 238, 0.5)',
        widthScale: 0.82,
      });
    }
    this.#drawWithPolicy(ctx, renderPolicy, { protocolScope, scenePhase });
  }

  getRenderDiagnostics() {
    return { ...this._spriteRenderDiagnostics };
  }

  forkRetainedShikigamiPresentation() {
    if (this.kind !== 'shadow_koi_actor' || !isGlobalSentinelProtocol(this.runtimeConfig, this.protocolScene)) {
      throw new Error('NUDGE_SHIKIGAMI_PRESENTATION_SOURCE_INVALID');
    }
    return new NudgeShadowKoiEntity(null, null, null, null, { token: RETAINED_SHIKIGAMI_FORK, source: this });
  }

  advanceRetainedShikigamiPresentation(dt, bounds, { renderBudget, timeMs, reducedMotion = false } = {}) {
    if (this.kind !== 'shikigami_presentation_actor') throw new Error('NUDGE_SHIKIGAMI_PRESENTATION_ACTOR_REQUIRED');
    const step = clamp(dt, 0, 0.1);
    const motor = this.retainedShikigamiMotor;
    motor.accumulator += step;
    while (motor.accumulator >= 1 / 60 - 1e-8) {
      motor.accumulator -= 1 / 60;
      this.update(1 / 60, bounds, {
        renderBudget, timeMs,
        globalSentinelDeparture: {
          heading: this.fish.angle,
          bounds: { x: -bounds.width, y: -bounds.height, width: bounds.width * 3, height: bounds.height * 3, padding: 0 },
          // Existing native analog motor authority keeps the colored ally calm
          // while the independent sentinel holds/recoils. It makes no AI event
          // random choices and never participates in the user's input route.
          control: { active: true, forward: reducedMotion ? 0 : 0.28, turnIntent: reducedMotion ? 0 : this.motionDirection * 0.12, brake: reducedMotion, cTurn: false },
        },
      });
    }
  }

  advanceRetainedPresentation(dt, bounds, { renderBudget, timeMs, departure = null, elapsedMs = 0, reducedMotion = false } = {}) {
    const step = clamp(dt, 0, 0.1);
    if (step <= 0) return;
    if (departure && elapsedMs < GLOBAL_SENTINEL_ENTRY_STAGES.SHADOW_EXIT) {
      if (!this.retainedDepartureMotor) {
        this.retainedDepartureMotor = { accumulator: 0, baseSpeed: this.fish.baseSpeed, acceleration: this.fish.acceleration };
      }
      const motor = this.retainedDepartureMotor;
      motor.accumulator += step;
      while (motor.accumulator >= 1 / 60 - 1e-8) {
        motor.accumulator -= 1 / 60;
        const motorElapsedMs = elapsedMs - motor.accumulator * 1000;
        if (resolveZenSentinelDepartureFault(motorElapsedMs, reducedMotion, departure).held) continue;
        const drive = resolveZenSentinelDepartureDrive(motorElapsedMs, departure);
        const cruiseBaseSpeed = departure.cruisePxPerSecond / 72;
        const calmBaseSpeed = Math.min(motor.baseSpeed, cruiseBaseSpeed * 0.035);
        this.fish.baseSpeed = calmBaseSpeed + (cruiseBaseSpeed - calmBaseSpeed) * drive;
        this.fish.acceleration = motor.acceleration * Math.max(0.2, this.fish.baseSpeed / motor.baseSpeed);
        this.update(1 / 60, bounds, { renderBudget, timeMs, globalSentinelDeparture: resolveZenSentinelDepartureMotion(departure, motorElapsedMs, reducedMotion, this.fish) });
      }
      return;
    }
    if (this.retainedDepartureMotor) {
      this.fish.baseSpeed = this.retainedDepartureMotor.baseSpeed;
      this.fish.acceleration = this.retainedDepartureMotor.acceleration;
      this.retainedDepartureMotor = null;
    }
    const heading = this.fish.angle;
    // The witness has left the hit roster, but it is still this same swimmer.
    // Advance its canonical fins/body rig at low activity, pinning the complete
    // pose afterwards instead of replacing history with a straight sprite.
    this.update(step * 0.3, bounds, {
      renderBudget,
      timeMs,
      speedScalar: 0.4,
      protocolProgress: this.protocolVisualProgress,
      protocolSyncLevel: this.protocolSyncLevel,
      globalSentinelRepairTarget: {
        x: this.x, y: this.y,
        tangentX: Math.cos(heading), tangentY: Math.sin(heading),
        pinnedPose: true, translationSpeedScale: 0,
      },
    });
  }

  containsPoint(x, y) {
    if (this.kind === 'shikigami_presentation_actor') return false;
    if (!this.fish || typeof this.fish.containsPoint !== 'function') return false;
    return this.fish.containsPoint(x, y);
  }

  #getPresentationGeometry() {
    if (this.presentationGeometry) return this.presentationGeometry;
    const heading = this.fish.angle;
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    // `size` is the interaction footprint (baseSize × 3.4), not render size.
    // Measure the same body contour and tail Béziers that the vector renderer
    // consumes, in that footprint's units, before projecting a giant actor.
    const renderSize = this.fish.baseSize * this.fish.hoverScale * resolveKoiExpressionVisualScale(this.fish);
    const contour = buildKoiBodyContour({ history: this.fish.history, size: renderSize,
      tuning: this.fish.tuning, segmentWave: this.fish.segmentWave });
    const tail = resolveKoiTailFinGeometry(this.fish, this.fish.tailPos, renderSize, true);
    let rearExtent = 0;
    let forwardExtent = 0;
    const measure = point => {
      rearExtent = Math.max(rearExtent, -((point.x - this.x) * cos + (point.y - this.y) * sin));
      forwardExtent = Math.max(forwardExtent, (point.x - this.x) * cos + (point.y - this.y) * sin);
    };
    let halfWidth = 0;
    let bodyCenter = this.fish.history[0];
    for (let i = 0; i < contour.leftPoints.length; i += 1) {
      const left = contour.leftPoints[i];
      const right = contour.rightPoints[i];
      measure(left); measure(right);
      const radius = Math.hypot(left.x - right.x, left.y - right.y) / 2;
      if (radius > halfWidth) {
        halfWidth = radius;
        bodyCenter = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
      }
    }
    measure({ x: contour.noseTipX, y: contour.noseTipY });
    // A Bézier stays inside its control hull, including fin rounding. This
    // bound therefore cannot fade the tail while any painted lobe remains.
    for (const lobe of tail.lobes) {
      measure(lobe.start);
      for (const curve of lobe.curves) for (let i = 0; i < curve.length; i += 2) measure({ x: curve[i], y: curve[i + 1] });
    }
    this.presentationGeometry = {
      bodyRearReachRatio: rearExtent / this.size,
      noseForwardReachRatio: forwardExtent / this.size,
      bodyCenterRearRatio: -((bodyCenter.x - this.x) * cos + (bodyCenter.y - this.y) * sin) / this.size,
      bodyCenterLateralRatio: (-(bodyCenter.x - this.x) * sin + (bodyCenter.y - this.y) * cos) / this.size,
      bodyHalfWidthRatio: halfWidth / this.size,
    };
    return this.presentationGeometry;
  }

  getSnapshot() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      size: this.size,
      heading: this.fish.angle,
      ...(isGlobalSentinelProtocol(this.runtimeConfig, this.protocolScene) ? this.#getPresentationGeometry() : {}),
      hitRadius: this.hitRadius,
      sizeRatio: this.sizeRatio,
      speedRatio: this.speedRatio,
      splitGeneration: this.splitGeneration,
    };
  }
}

export { NudgeShadowKoiEntity };
