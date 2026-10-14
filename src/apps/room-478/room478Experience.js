import {
  resolveGlobalSimulationBreakCrackSkeleton,
  resolveGlobalSentinelRiftAperturePlan,
} from '../../domains/nudge/rendering/NudgeProtocolSceneBackground.js';
import { resolveRoom478Surface } from './room478Template.js';
import { applyRoom478Arrival, releaseRoom478Arrival } from './room478Arrival.js';
import {
  applyRoom478GardenLayout,
  bindRoom478GardenAssetLifetime,
} from './room478Garden.js';

export const ROOM478_PHASES = Object.freeze({
  arrival: 'arrival',
  grounding: 'grounding',
  inhale: 'inhale',
  hold: 'hold',
  exhale: 'exhale',
  still: 'still',
});

export const ROOM478_ARRIVAL_MS = 4_800;
export const ROOM478_REDUCED_ARRIVAL_MS = 480;
export const ROOM478_GROUNDING_HOLD_DURATION_MS = 1_800;
export const ROOM478_GROUNDING_TIMEOUT_MS = 8_000;
export const ROOM478_GROUNDING_DECAY_DURATION_MS = 600;

export const ROOM478_BREATH_PHASES = Object.freeze([
  Object.freeze({ key: ROOM478_PHASES.inhale, durationMs: 4_000 }),
  Object.freeze({ key: ROOM478_PHASES.hold, durationMs: 7_000 }),
  Object.freeze({ key: ROOM478_PHASES.exhale, durationMs: 8_000 }),
]);
export const ROOM478_GUIDED_BREATH_MS = ROOM478_BREATH_PHASES
  .reduce((total, phase) => total + phase.durationMs, 0);
export const ROOM478_TARGET_CYCLES = 1;
export const ROOM478_TOTAL_GUIDED_MS = ROOM478_GUIDED_BREATH_MS * ROOM478_TARGET_CYCLES;

const ROOM478_SOURCE = 'global_sentinel_success';
const ROOM478_MAX_SEED = 0x7fffffff;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function smoothstep(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function progressBetween(value, start, end) {
  return clamp((value - start) / Math.max(0.0001, end - start));
}

function parseRequiredRatio(params, key) {
  const rawValue = params.get(key);
  if (rawValue === null || rawValue.trim() === '') {
    throw new Error(`room_478_handoff_${key}_missing`);
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`room_478_handoff_${key}_invalid`);
  }
  return value;
}

export function parseRoom478Handoff(search = '') {
  const params = new URLSearchParams(search);
  const source = String(params.get('source') || '').trim();
  const runId = String(params.get('runId') || '').trim();
  const rawSeed = String(params.get('seed') || '').trim();

  if (source !== ROOM478_SOURCE) {
    throw new Error('room_478_handoff_source_invalid');
  }
  if (!runId) {
    throw new Error('room_478_handoff_run_id_missing');
  }
  if (!/^\d+$/.test(rawSeed)) {
    throw new Error('room_478_handoff_seed_invalid');
  }
  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > ROOM478_MAX_SEED) {
    throw new Error('room_478_handoff_seed_invalid');
  }

  return Object.freeze({
    origin: Object.freeze({
      x: parseRequiredRatio(params, 'originX'),
      y: parseRequiredRatio(params, 'originY'),
    }),
    runId,
    seed,
    source,
  });
}

export function resolveRoom478Frame(elapsedMs, {
  reducedMotion = false,
  isGrounded = true,
  groundingProgress = 0,
  groundedAtMs = null,
  targetCycles = ROOM478_TARGET_CYCLES,
} = {}) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const arrivalDurationMs = reducedMotion
    ? ROOM478_REDUCED_ARRIVAL_MS
    : ROOM478_ARRIVAL_MS;
  const safeTargetCycles = Math.max(1, Math.floor(Number(targetCycles) || ROOM478_TARGET_CYCLES));

  if (elapsed < arrivalDurationMs) {
    const phaseProgress = clamp(elapsed / arrivalDurationMs);
    return Object.freeze({
      arrivalProgress: smoothstep(phaseProgress),
      breathLevel: 0,
      currentCycle: 0,
      cycleProgress: 0,
      elapsedMs: elapsed,
      groundingProgress: 0,
      isGrounded: false,
      phase: ROOM478_PHASES.arrival,
      phaseProgress,
      releaseProgress: 0,
      stage: 'arrival',
      stillness: 0,
      totalCycleProgress: 0,
      totalCycles: safeTargetCycles,
    });
  }

  if (!isGrounded && !reducedMotion) {
    const safeGrounding = clamp(groundingProgress);
    return Object.freeze({
      arrivalProgress: 1,
      breathLevel: 0,
      currentCycle: 0,
      cycleProgress: 0,
      elapsedMs: elapsed,
      groundingProgress: safeGrounding,
      isGrounded: false,
      phase: ROOM478_PHASES.grounding,
      phaseProgress: safeGrounding,
      releaseProgress: 0,
      stage: 'grounding',
      stillness: 0,
      totalCycleProgress: 0,
      totalCycles: safeTargetCycles,
    });
  }

  const breathBaseTime = (groundedAtMs !== null && Number.isFinite(groundedAtMs))
    ? groundedAtMs
    : arrivalDurationMs;
  const breathElapsed = Math.max(0, elapsed - breathBaseTime);
  const totalGuidedMs = ROOM478_GUIDED_BREATH_MS * safeTargetCycles;

  if (breathElapsed < totalGuidedMs) {
    const currentCycle = Math.min(safeTargetCycles, Math.floor(breathElapsed / ROOM478_GUIDED_BREATH_MS) + 1);
    const cycleElapsed = breathElapsed % ROOM478_GUIDED_BREATH_MS;
    const cycleProgress = clamp(cycleElapsed / ROOM478_GUIDED_BREATH_MS);
    const totalCycleProgress = clamp(breathElapsed / totalGuidedMs);

    let cursor = 0;
    for (const phase of ROOM478_BREATH_PHASES) {
      const phaseEnd = cursor + phase.durationMs;
      if (cycleElapsed < phaseEnd) {
        const phaseProgress = clamp((cycleElapsed - cursor) / phase.durationMs);
        const breathLevel = phase.key === ROOM478_PHASES.inhale
          ? phaseProgress
          : (phase.key === ROOM478_PHASES.hold ? 1 : 1 - phaseProgress);
        return Object.freeze({
          arrivalProgress: 1,
          breathLevel,
          currentCycle,
          cycleProgress,
          elapsedMs: elapsed,
          groundingProgress: 1,
          isGrounded: true,
          phase: phase.key,
          phaseProgress,
          releaseProgress: phase.key === ROOM478_PHASES.exhale ? phaseProgress : 0,
          stage: 'guided',
          stillness: 0,
          totalCycleProgress,
          totalCycles: safeTargetCycles,
        });
      }
      cursor = phaseEnd;
    }
  }

  return Object.freeze({
    arrivalProgress: 1,
    breathLevel: 0,
    currentCycle: safeTargetCycles,
    cycleProgress: 1,
    elapsedMs: elapsed,
    groundingProgress: 1,
    isGrounded: true,
    phase: ROOM478_PHASES.still,
    phaseProgress: 1,
    releaseProgress: 1,
    stage: 'still',
    stillness: 1,
    totalCycleProgress: 1,
    totalCycles: safeTargetCycles,
  });
}

function assertRoom478Bounds(width, height) {
  const resolvedWidth = Math.round(Number(width));
  const resolvedHeight = Math.round(Number(height));
  if (resolvedWidth < 1 || resolvedHeight < 1) {
    throw new Error('room_478_scene_bounds_invalid');
  }
  return { width: resolvedWidth, height: resolvedHeight };
}

export function resolveRoom478ScenePlan({
  handoff,
  width,
  height,
} = {}) {
  if (!handoff || !Number.isSafeInteger(handoff.seed) || !handoff.origin) {
    throw new Error('room_478_scene_handoff_invalid');
  }
  const bounds = assertRoom478Bounds(width, height);
  const skeleton = resolveGlobalSimulationBreakCrackSkeleton({
    impactPoint: handoff.origin,
    seed: handoff.seed,
  });
  const rift = resolveGlobalSentinelRiftAperturePlan({
    progress: 1,
    seed: handoff.seed,
    skeleton,
    width: bounds.width,
    height: bounds.height,
  });
  if (!rift.active || rift.selectedNodes.length < 3) {
    throw new Error('room_478_scene_rift_plan_invalid');
  }

  const focusX = clamp(rift.origin[0], 0.34, 0.72);
  const furinX = focusX > 0.53 ? 0.22 : 0.78;
  return Object.freeze({
    ...bounds,
    focusX,
    furinX,
    handoff,
    rift,
    seedShift: ((handoff.seed % 997) / 996) - 0.5,
    skeleton,
  });
}

function assertRoom478Copy(copy) {
  const phaseCopy = copy?.phases;
  const statusCopy = copy?.statuses;
  Object.values(ROOM478_PHASES).forEach((phase) => {
    if (typeof phaseCopy?.[phase] !== 'string' || typeof statusCopy?.[phase] !== 'string') {
      throw new Error(`room_478_copy_phase_missing:${phase}`);
    }
  });
}

export function applyRoom478Frame(surfaceOrRoot, frame, plan, copy) {
  const surface = surfaceOrRoot?.root
    ? surfaceOrRoot
    : resolveRoom478Surface(surfaceOrRoot);
  if (!frame || !Object.values(ROOM478_PHASES).includes(frame.phase)) {
    throw new Error('room_478_frame_invalid');
  }
  assertRoom478Copy(copy);

  const previousPhase = surface.root.dataset.phase || '';
  if (previousPhase !== frame.phase) surface.root.dataset.phase = frame.phase;
  if (surface.root.dataset.stage !== frame.stage) surface.root.dataset.stage = frame.stage;
  surface.root.style.setProperty('--room478-arrival', frame.arrivalProgress.toFixed(5));
  surface.root.style.setProperty('--room478-world-reveal',
    smoothstep(progressBetween(frame.arrivalProgress, 0.18, 0.9)).toFixed(5));
  surface.root.style.setProperty('--room478-breath', frame.breathLevel.toFixed(5));
  surface.root.style.setProperty('--room478-release', frame.releaseProgress.toFixed(5));
  surface.root.style.setProperty('--room478-stillness', frame.stillness.toFixed(5));

  surface.root.style.setProperty('--room478-cycle', String(frame.currentCycle || 1));
  surface.root.style.setProperty('--room478-total-cycles', String(frame.totalCycles || 1));
  surface.root.style.setProperty('--room478-cycle-progress', (frame.cycleProgress || 0).toFixed(5));
  surface.root.style.setProperty('--room478-total-progress', (frame.totalCycleProgress || 0).toFixed(5));

  if (surface.orbitDotElements?.length) {
    surface.orbitDotElements.forEach((dotEl, index) => {
      const dotCycle = index + 1;
      dotEl.hidden = frame.totalCycles <= 1 || dotCycle > frame.totalCycles;
      let state = 'dormant';
      if (frame.stage === 'still' || (frame.currentCycle && dotCycle < frame.currentCycle)) {
        state = 'completed';
      } else if (frame.stage === 'guided' && dotCycle === frame.currentCycle) {
        state = 'active';
      }
      if (dotEl.dataset.dotState !== state) {
        dotEl.dataset.dotState = state;
      }
    });
  }

  const isGrounding = frame.phase === ROOM478_PHASES.grounding;
  surface.ensoStage.setAttribute('aria-hidden', isGrounding ? 'false' : 'true');
  if (isGrounding) {
    surface.ensoStage.setAttribute('role', 'button');
    surface.ensoStage.setAttribute('aria-label', copy.groundingHint);
    surface.ensoStage.tabIndex = 0;
  } else {
    surface.ensoStage.removeAttribute('role');
    surface.ensoStage.removeAttribute('tabindex');
  }
  const groundingLevel = frame.groundingProgress ?? (frame.isGrounded ? 1 : 0);
  surface.root.style.setProperty('--room478-grounding', groundingLevel.toFixed(5));

  if (surface.groundingHint) {
    surface.groundingHint.hidden = !isGrounding;
    if (isGrounding) {
      surface.groundingHint.style.setProperty(
        '--room478-hint-opacity',
        (1 - groundingLevel * 0.7).toFixed(3),
      );
    }
  }

  if (surface.ensoStroke) {
    const strokeDash = 478;
    const strokeOffset = (144 * (1 - groundingLevel)).toFixed(2);
    surface.ensoStroke.style.strokeDasharray = `${strokeDash}`;
    surface.ensoStroke.style.strokeDashoffset = `${strokeOffset}`;
  }

  const sceneKey = [
    plan.handoff.seed,
    plan.handoff.origin.x,
    plan.handoff.origin.y,
    `${plan.width}x${plan.height}`,
  ].join(':');
  if (surface.root.dataset.room478Scene !== sceneKey) {
    applyRoom478GardenLayout(surface, plan.width, plan.height);
    surface.root.dataset.room478Scene = sceneKey;
    surface.root.style.setProperty('--room478-focus-x', `${(plan.focusX * 100).toFixed(3)}%`);
    surface.root.style.setProperty('--room478-furin-x', `${(plan.furinX * 100).toFixed(3)}%`);
    surface.root.style.setProperty('--room478-seed-shift', plan.seedShift.toFixed(5));
    surface.root.dataset.room478RiftSettled = 'false';
  }
  surface.root.style.setProperty(
    '--room478-rift-opacity',
    (1 - smoothstep(progressBetween(frame.arrivalProgress, 0.7, 1))).toFixed(5),
  );

  const cycleSuffix = frame.stage === 'guided' && frame.totalCycles > 1
    ? ` (${frame.currentCycle}/${frame.totalCycles})`
    : '';
  const currentPhaseText = copy.phases[frame.phase];
  const currentStatusText = `${copy.statuses[frame.phase]}${cycleSuffix}`;

  if (surface.phaseWhisper.textContent !== currentPhaseText) {
    surface.phaseWhisper.textContent = currentPhaseText;
  }
  if (surface.status.textContent !== currentStatusText) {
    surface.status.textContent = currentStatusText;
  }

  const isStill = frame.phase === ROOM478_PHASES.still;
  surface.repeatButton.hidden = !isStill;
  surface.repeatButton.disabled = !isStill;
  surface.repeatButton.tabIndex = isStill ? 0 : -1;
  applyRoom478Arrival(surface.root, frame, plan, {
    reducedMotion: surface.root.dataset.room478ReducedMotion === 'true',
    arrivalDurationMs: surface.root.dataset.room478ReducedMotion === 'true'
      ? ROOM478_REDUCED_ARRIVAL_MS : ROOM478_ARRIVAL_MS,
  });
  return surface;
}

function measureRoom478Root(root) {
  const bounds = root.getBoundingClientRect();
  return assertRoom478Bounds(
    bounds.width || root.clientWidth,
    bounds.height || root.clientHeight,
  );
}

export function createRoom478Experience({
  copy,
  handoff,
  matchMediaFn = globalThis.matchMedia?.bind(globalThis),
  now = () => performance.now(),
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
  root,
  windowRef = globalThis,
  documentRef = document,
  onPhaseChange = null,
  autoGround = true,
  audioController = null,
  targetCycles = ROOM478_TARGET_CYCLES,
} = {}) {
  const surface = resolveRoom478Surface(root);
  assertRoom478Copy(copy);
  const reducedMotion = typeof matchMediaFn === 'function'
    ? matchMediaFn('(prefers-reduced-motion: reduce)').matches === true
    : false;
  let animationFrameId = 0;
  let startedAt = null;
  let pausedAt = null;
  let pausedDuration = 0;
  let destroyed = false;
  let gardenFailed = false;
  let scenePlan = null;
  let lastElapsed = 0;

  let isGrounded = reducedMotion || autoGround;
  let groundingProgress = isGrounded ? 1 : 0;
  let isHolding = false;
  let holdStartedAt = null;
  let holdStartProgress = 0;
  let decayStartedAt = null;
  let decayStartProgress = 0;
  let groundedAtMs = null;
  let previousPhase = null;
  let previousCycle = 0;

  surface.root.dataset.room478ReducedMotion = String(reducedMotion);
  const gardenLifetime = bindRoom478GardenAssetLifetime(surface, error => {
    gardenFailed = true;
    pause();
    releaseRoom478Arrival(surface.root);
    surface.root.dataset.room478GardenError = error.message;
    surface.gardenError.textContent = `ROOM 478 / ${error.message}`;
    surface.gardenError.hidden = false;
    console.error('[Room 478] canonical garden asset failed.', error);
  });

  function resolveScenePlan() {
    const bounds = measureRoom478Root(root);
    if (!scenePlan || scenePlan.width !== bounds.width || scenePlan.height !== bounds.height) {
      scenePlan = resolveRoom478ScenePlan({ handoff, ...bounds });
    }
    return scenePlan;
  }

  function cancelScheduledFrame() {
    if (!animationFrameId) return;
    cancelFrame(animationFrameId);
    animationFrameId = 0;
  }

  function render(timestamp = now()) {
    if (destroyed || gardenFailed || pausedAt !== null || startedAt === null) return null;
    const elapsed = Math.max(0, timestamp - startedAt - pausedDuration);
    lastElapsed = elapsed;

    const arrivalDurationMs = reducedMotion ? ROOM478_REDUCED_ARRIVAL_MS : ROOM478_ARRIVAL_MS;
    if (!isGrounded && elapsed >= arrivalDurationMs) {
      if (isHolding) {
        const holdElapsed = Math.max(0, timestamp - holdStartedAt);
        groundingProgress = clamp(holdStartProgress + holdElapsed / ROOM478_GROUNDING_HOLD_DURATION_MS);
        if (groundingProgress >= 1) {
          isGrounded = true;
          groundedAtMs = elapsed;
        }
      } else if (groundingProgress > 0) {
        const decayElapsed = Math.max(0, timestamp - decayStartedAt);
        groundingProgress = clamp(decayStartProgress - decayElapsed / ROOM478_GROUNDING_DECAY_DURATION_MS);
      }

      if (!isGrounded && elapsed >= arrivalDurationMs + ROOM478_GROUNDING_TIMEOUT_MS) {
        isGrounded = true;
        groundedAtMs = elapsed;
        groundingProgress = 1;
      }
    }

    const frame = resolveRoom478Frame(elapsed, {
      groundedAtMs,
      groundingProgress,
      isGrounded,
      reducedMotion,
      targetCycles,
    });
    applyRoom478Frame(surface, frame, resolveScenePlan(), copy);

    if (previousPhase !== frame.phase || previousCycle !== frame.currentCycle) {
      const prevPhase = previousPhase;
      const prevCycle = previousCycle;
      previousPhase = frame.phase;
      previousCycle = frame.currentCycle;

      if (audioController) {
        if (frame.phase === ROOM478_PHASES.inhale) {
          if (frame.currentCycle === 1 && prevPhase !== ROOM478_PHASES.inhale) {
            audioController.playOpeningGong();
          }
          audioController.playInhaleSwell();
        } else if (frame.phase === ROOM478_PHASES.hold) {
          audioController.playHoldDrone();
        } else if (frame.phase === ROOM478_PHASES.exhale) {
          audioController.playExhaleRelease();
        } else if (frame.phase === ROOM478_PHASES.still) {
          audioController.playClosingGong();
        }
      }

      if (prevPhase !== frame.phase || prevCycle !== frame.currentCycle) {
        onPhaseChange?.(frame.phase, {
          currentCycle: frame.currentCycle,
          elapsedMs: elapsed,
          previousCycle: prevCycle,
          previousPhase: prevPhase,
        });
      }
    }

    return frame;
  }

  function tick(timestamp) {
    animationFrameId = 0;
    const frame = render(timestamp);
    if (frame && frame.phase !== ROOM478_PHASES.still) {
      animationFrameId = requestFrame(tick);
    }
  }

  function scheduleFrame() {
    if (destroyed || pausedAt !== null || animationFrameId) return;
    animationFrameId = requestFrame(tick);
  }

  function getEffectiveElapsed() {
    if (startedAt === null) return 0;
    const base = pausedAt !== null ? pausedAt : now();
    return Math.max(0, base - startedAt - pausedDuration);
  }

  function startHold() {
    if (isGrounded || isHolding) return;
    const arrivalDurationMs = reducedMotion ? ROOM478_REDUCED_ARRIVAL_MS : ROOM478_ARRIVAL_MS;
    if (getEffectiveElapsed() < arrivalDurationMs) return;
    isHolding = true;
    holdStartedAt = now();
    holdStartProgress = groundingProgress;
    audioController?.startGroundingCharge();
    scheduleFrame();
  }

  function stopHold() {
    if (!isHolding) return;
    isHolding = false;
    decayStartedAt = now();
    decayStartProgress = groundingProgress;
    audioController?.stopGroundingCharge();
    scheduleFrame();
  }

  function handleKeyDown(event) {
    if (event.code === 'Space' && !event.repeat) {
      if (documentRef.activeElement?.tagName === 'BUTTON' || isGrounded) {
        return;
      }
      event.preventDefault();
      startHold();
    }
  }

  function handleKeyUp(event) {
    if (event.code === 'Space') {
      stopHold();
    }
  }

  function handlePointerDown(event) {
    if (event.target?.closest('button')) return;
    startHold();
  }

  function handlePointerUp() {
    stopHold();
  }

  function start() {
    if (destroyed) throw new Error('room_478_experience_destroyed');
    if (gardenFailed) throw new Error('room_478_garden_failed');
    if (startedAt === null) startedAt = now();
    surface.root.dataset.room478GardenPaused = 'false';
    render(startedAt + pausedDuration + lastElapsed);
    if (documentRef.visibilityState === 'hidden') pause();
    else scheduleFrame();
  }

  function pause() {
    if (destroyed || pausedAt !== null || startedAt === null) return;
    pausedAt = now();
    surface.root.dataset.room478GardenPaused = 'true';
    cancelScheduledFrame();
    stopHold();
    audioController?.stopAll();
  }

  function resume() {
    if (destroyed || gardenFailed || pausedAt === null || documentRef.visibilityState === 'hidden') return;
    pausedDuration += Math.max(0, now() - pausedAt);
    pausedAt = null;
    surface.root.dataset.room478GardenPaused = 'false';
    render(now());
    const currentFrame = resolveRoom478Frame(lastElapsed, {
      groundedAtMs,
      groundingProgress,
      isGrounded,
      reducedMotion,
      targetCycles,
    });
    if (currentFrame.phase !== ROOM478_PHASES.still) {
      scheduleFrame();
    }
  }

  function handleVisibilityChange() {
    if (documentRef.visibilityState === 'hidden') pause();
    else resume();
  }

  function repeatBreath() {
    if (destroyed || pausedAt !== null || previousPhase !== ROOM478_PHASES.still) return false;
    groundedAtMs = getEffectiveElapsed();
    render(now());
    scheduleFrame();
    // The pressed button becomes hidden during the next breath.
    surface.exitButton.focus({ preventScroll: true });
    return true;
  }

  function handleResize() {
    scenePlan = null;
    if (startedAt !== null && pausedAt === null) render(now());
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    surface.root.dataset.room478GardenPaused = 'true';
    gardenLifetime.destroy();
    releaseRoom478Arrival(surface.root);
    cancelScheduledFrame();
    audioController?.stopAll();
    documentRef.removeEventListener('visibilitychange', handleVisibilityChange);
    windowRef.removeEventListener('resize', handleResize);
    windowRef.removeEventListener('keydown', handleKeyDown);
    windowRef.removeEventListener('keyup', handleKeyUp);
    surface.root.removeEventListener('pointerdown', handlePointerDown);
    windowRef.removeEventListener('pointerup', handlePointerUp);
    windowRef.removeEventListener('pointercancel', handlePointerUp);
  }

  documentRef.addEventListener('visibilitychange', handleVisibilityChange);
  windowRef.addEventListener('resize', handleResize, { passive: true });
  windowRef.addEventListener('keydown', handleKeyDown);
  windowRef.addEventListener('keyup', handleKeyUp);
  surface.root.addEventListener('pointerdown', handlePointerDown);
  windowRef.addEventListener('pointerup', handlePointerUp);
  windowRef.addEventListener('pointercancel', handlePointerUp);

  return Object.freeze({
    destroy,
    getElapsedMs: () => lastElapsed,
    isGrounded: () => isGrounded,
    isReducedMotion: () => reducedMotion,
    pause,
    resume,
    repeatBreath,
    start,
  });
}
