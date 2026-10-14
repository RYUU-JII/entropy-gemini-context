import {
  assertRenderHealthSample,
} from '@/platform/rendering/renderHealthSample.js';

export const NUDGE_RENDER_PRESSURE_LEVELS = Object.freeze({
  NORMAL: 'normal',
  PRESSURE: 'pressure',
  SEVERE: 'severe',
});

const ORDERED_LEVELS = Object.freeze([
  NUDGE_RENDER_PRESSURE_LEVELS.NORMAL,
  NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE,
  NUDGE_RENDER_PRESSURE_LEVELS.SEVERE,
]);
const LEVEL_SET = new Set(ORDERED_LEVELS);
const SUSPENDED_FRAME_GAP_MS = 250;

export const NUDGE_RENDER_PRESSURE_POLICY = Object.freeze({
  [NUDGE_RENDER_PRESSURE_LEVELS.NORMAL]: Object.freeze({
    degradeWorkEmaMs: 13.5,
    degradeWorkSpikeMs: 22,
    degradeFrameIntervalEmaMs: 24,
    degradeDroppedFrameRatio: 0.18,
    degradeFrames: 12,
    recoverWorkEmaMs: 8.5,
    recoverFrameIntervalEmaMs: 19,
    recoverFrames: 260,
  }),
  [NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE]: Object.freeze({
    degradeWorkEmaMs: 15.5,
    degradeWorkSpikeMs: 25,
    degradeFrameIntervalEmaMs: 31,
    degradeDroppedFrameRatio: 0.25,
    degradeFrames: 9,
    recoverWorkEmaMs: 9,
    recoverFrameIntervalEmaMs: 19,
    recoverFrames: 260,
  }),
  [NUDGE_RENDER_PRESSURE_LEVELS.SEVERE]: Object.freeze({
    degradeWorkEmaMs: 15.5,
    degradeWorkSpikeMs: 25,
    degradeFrameIntervalEmaMs: 31,
    degradeDroppedFrameRatio: 0.25,
    degradeFrames: 9,
    recoverWorkEmaMs: 10.5,
    recoverFrameIntervalEmaMs: 22,
    recoverFrames: 170,
  }),
});

export function assertNudgeRenderPressureLevel(value) {
  if (!LEVEL_SET.has(value)) {
    throw new Error(`NUDGE_RENDER_PRESSURE_LEVEL_INVALID:${String(value || 'missing')}`);
  }
  return value;
}

export function createNudgeRenderPressureState({
  pressureLevel = NUDGE_RENDER_PRESSURE_LEVELS.NORMAL,
  frameIntervalEmaMs = 16.67,
  workTimeEmaMs = 0,
  pressureFrames = 0,
  recoveryFrames = 0,
} = {}) {
  const frameEma = Number(frameIntervalEmaMs);
  const workEma = Number(workTimeEmaMs);
  if (!Number.isFinite(frameEma) || frameEma <= 0) {
    throw new Error('NUDGE_RENDER_PRESSURE_FRAME_INTERVAL_EMA_INVALID');
  }
  if (!Number.isFinite(workEma) || workEma < 0) {
    throw new Error('NUDGE_RENDER_PRESSURE_WORK_TIME_EMA_INVALID');
  }
  return Object.freeze({
    pressureLevel: assertNudgeRenderPressureLevel(pressureLevel),
    frameIntervalEmaMs: frameEma,
    workTimeEmaMs: workEma,
    pressureFrames: Math.max(0, Math.floor(Number(pressureFrames) || 0)),
    recoveryFrames: Math.max(0, Math.floor(Number(recoveryFrames) || 0)),
  });
}

export function shouldObserveNudgeRenderHealth(sample) {
  assertRenderHealthSample(sample);
  return isObservableNudgeRenderHealth(sample);
}

function isObservableNudgeRenderHealth(sample) {
  return sample.visible === true && sample.frameIntervalMs <= SUSPENDED_FRAME_GAP_MS;
}

export function computeNudgeRenderPressureState({
  enabled = true,
  sample,
  state,
} = {}) {
  const current = createNudgeRenderPressureState(state);
  if (enabled !== true) return current;
  assertRenderHealthSample(sample);
  if (!isObservableNudgeRenderHealth(sample)) return current;

  const stage = NUDGE_RENDER_PRESSURE_POLICY[current.pressureLevel];
  const effectiveWorkMs = Math.max(sample.totalWorkMs, Number(sample.gpuWorkMs) || 0);
  const nextFrameIntervalEmaMs = (current.frameIntervalEmaMs * 0.9)
    + (sample.frameIntervalMs * 0.1);
  const nextWorkTimeEmaMs = (current.workTimeEmaMs * 0.85) + (effectiveWorkMs * 0.15);
  const workOverloaded = nextWorkTimeEmaMs > stage.degradeWorkEmaMs
    || effectiveWorkMs > stage.degradeWorkSpikeMs;
  // OffscreenCanvas commands can return before the GPU has completed their
  // work. Treat sustained visible scheduling pressure as its own signal so a
  // GPU-bound surface can still degrade even when measured JS work stays low.
  // The stage counters below keep isolated stalls from changing the budget,
  // while isObservableNudgeRenderHealth excludes hidden and suspended frames.
  const schedulingOverloaded = nextFrameIntervalEmaMs > stage.degradeFrameIntervalEmaMs;
  const framesDropped = sample.droppedFrameRatio >= stage.degradeDroppedFrameRatio;
  const overloaded = workOverloaded || schedulingOverloaded || framesDropped;
  const recovering = nextWorkTimeEmaMs < stage.recoverWorkEmaMs
    && nextFrameIntervalEmaMs < stage.recoverFrameIntervalEmaMs
    && sample.droppedFrameRatio < 0.05;

  let pressureFrames = current.pressureFrames;
  let recoveryFrames = current.recoveryFrames;
  if (overloaded) {
    pressureFrames += 1;
    recoveryFrames = Math.max(0, recoveryFrames - 2);
  } else if (recovering) {
    recoveryFrames += 1;
    pressureFrames = Math.max(0, pressureFrames - 1);
  } else {
    pressureFrames = Math.max(0, pressureFrames - 1);
    recoveryFrames = Math.max(0, recoveryFrames - 1);
  }

  const currentIndex = ORDERED_LEVELS.indexOf(current.pressureLevel);
  if (pressureFrames >= stage.degradeFrames && currentIndex < ORDERED_LEVELS.length - 1) {
    return createNudgeRenderPressureState({
      pressureLevel: ORDERED_LEVELS[currentIndex + 1],
      frameIntervalEmaMs: nextFrameIntervalEmaMs,
      workTimeEmaMs: nextWorkTimeEmaMs,
    });
  }
  if (recoveryFrames >= stage.recoverFrames && currentIndex > 0) {
    return createNudgeRenderPressureState({
      pressureLevel: ORDERED_LEVELS[currentIndex - 1],
      frameIntervalEmaMs: nextFrameIntervalEmaMs,
      workTimeEmaMs: nextWorkTimeEmaMs,
    });
  }
  return createNudgeRenderPressureState({
    pressureLevel: current.pressureLevel,
    frameIntervalEmaMs: nextFrameIntervalEmaMs,
    workTimeEmaMs: nextWorkTimeEmaMs,
    pressureFrames,
    recoveryFrames,
  });
}

export function resolveInitialNudgePressureLevel(runtimeNavigator = globalThis?.navigator) {
  const cores = Number(runtimeNavigator?.hardwareConcurrency) || 0;
  const deviceMemory = Number(runtimeNavigator?.deviceMemory) || 0;
  if ((cores > 0 && cores <= 2) || (deviceMemory > 0 && deviceMemory <= 2)) {
    return NUDGE_RENDER_PRESSURE_LEVELS.SEVERE;
  }
  if ((cores > 0 && cores <= 4) || (deviceMemory > 0 && deviceMemory <= 4)) {
    return NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE;
  }
  return NUDGE_RENDER_PRESSURE_LEVELS.NORMAL;
}
