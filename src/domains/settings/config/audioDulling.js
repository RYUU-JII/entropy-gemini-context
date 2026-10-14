export const AUDIO_DULLING_PRESETS = Object.freeze([
  'resolution',
]);

export const AUDIO_DULLING_CAPTURE_MODES = Object.freeze({
  MANUAL: 'manual',
});

export const DEFAULT_AUDIO_DULLING_VALUE = Object.freeze({
  preset: 'resolution',
  intensity: 0.58,
  wet: 1,
  rampMs: 12_000,
  captureMode: AUDIO_DULLING_CAPTURE_MODES.MANUAL,
});

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizePreset(value, fallback = DEFAULT_AUDIO_DULLING_VALUE.preset) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return AUDIO_DULLING_PRESETS.includes(normalized) ? normalized : fallback;
}

function normalizeCaptureMode(value, fallback = DEFAULT_AUDIO_DULLING_VALUE.captureMode) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized === AUDIO_DULLING_CAPTURE_MODES.MANUAL ? normalized : fallback;
}

export function normalizeAudioDullingValue(rawValue) {
  if (typeof rawValue === 'string') {
    return {
      ...DEFAULT_AUDIO_DULLING_VALUE,
      preset: normalizePreset(rawValue),
    };
  }

  if (typeof rawValue === 'number') {
    return {
      ...DEFAULT_AUDIO_DULLING_VALUE,
      intensity: clampNumber(rawValue, DEFAULT_AUDIO_DULLING_VALUE.intensity, 0, 1),
    };
  }

  const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
  return {
    preset: normalizePreset(source.preset),
    intensity: clampNumber(source.intensity, DEFAULT_AUDIO_DULLING_VALUE.intensity, 0, 1),
    wet: clampNumber(source.wet, DEFAULT_AUDIO_DULLING_VALUE.wet, 0, 1),
    rampMs: Math.round(clampNumber(source.rampMs, DEFAULT_AUDIO_DULLING_VALUE.rampMs, 0, 90_000)),
    captureMode: normalizeCaptureMode(source.captureMode),
  };
}
