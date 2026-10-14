import {
  normalizeAudioDullingValue,
} from '../../settings/config/audioDulling.js';

const MIN_LINEAR_GAIN = 0.0001;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(start, end, amount) {
  return start + ((end - start) * amount);
}

function lerpExponential(start, end, amount) {
  return start * Math.pow(end / start, amount);
}

function decibelsToLinear(decibels) {
  return Math.max(MIN_LINEAR_GAIN, Math.pow(10, decibels / 20));
}

export function createAudioDullingResolutionPlan(rawConfig = null) {
  const config = normalizeAudioDullingValue(rawConfig?.value ?? rawConfig);
  const amount = clamp01(config.intensity) * clamp01(config.wet);
  const shapedAmount = Math.pow(amount, 0.82);
  const stereoWidth = lerp(1, 0.12, shapedAmount);
  const directChannelGain = (1 + stereoWidth) / 2;
  const crossChannelGain = (1 - stereoWidth) / 2;
  const masterGainDb = lerp(0, 0.3, shapedAmount);

  return Object.freeze({
    schemaVersion: 1,
    preset: 'resolution',
    amount,
    rampMs: config.rampMs,
    spatial: Object.freeze({
      width: stereoWidth,
      directChannelGain,
      crossChannelGain,
    }),
    spectral: Object.freeze({
      highpassHz: lerpExponential(12, 110, shapedAmount),
      lowpassHz: lerpExponential(22_000, 3_500, shapedAmount),
      highShelfFrequencyHz: 2_400,
      highShelfGainDb: lerp(0, -13, shapedAmount),
    }),
    dynamics: Object.freeze({
      thresholdDb: lerp(-3, -24, shapedAmount),
      kneeDb: lerp(3, 21, shapedAmount),
      ratio: lerp(1, 4.4, shapedAmount),
      attackSeconds: lerp(0.003, 0.035, shapedAmount),
      releaseSeconds: lerp(0.08, 0.38, shapedAmount),
    }),
    output: Object.freeze({
      masterGainDb,
      masterGain: decibelsToLinear(masterGainDb),
    }),
  });
}

export const AUDIO_DULLING_DRY_RESOLUTION_PLAN = (
  createAudioDullingResolutionPlan({
    preset: 'resolution',
    intensity: 0,
    wet: 1,
    rampMs: 0,
  })
);
