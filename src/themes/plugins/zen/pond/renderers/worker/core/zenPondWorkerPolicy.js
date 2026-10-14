import {
  resolveZenRendererDebugTogglePreset,
} from '../../../contracts/zenRendererDebugToggles.js';

export const WORKER_RENDERER_POLICY = Object.freeze({
  strictWorkerOnly: true,
});

export const ZEN_QUALITY_MODE_LOW = 'low';
export const ZEN_QUALITY_MODE_BALANCED = 'balanced';
export const ZEN_QUALITY_MODE_FULL = 'full';
export const MAX_SYNC_FISH_COUNT = 96;
export const MIN_TEXTURE_UNITS_FALLBACK = 1;

export const DEFAULT_ENV = Object.freeze({
  daylight: 0.5,
  moonlight: 0,
  cloudCover: 0.5,
  overcastWeight: 0,
  rainIntensity: 0,
  weatherRegime: 'fixed_lab',
  weatherEventScheduled: false,
  weatherEventActive: false,
  weatherEventId: '',
  weatherEventKind: 'none',
  weatherEventPhase: 'ambient',
  weatherEventProgress: 0,
  weatherEventPhaseProgress: 0,
  weatherFrontWeight: 0,
  postRainWeight: 0,
  guaranteedRainDay: false,
  seasonalWetness: 0,
  cloudOcclusion: 0.82,
  sunAngle: Math.PI * 0.35,
  windIntensity: 0.4,
  windDirection: Math.PI * 0.08,
  gustEnvelope: 0.46,
  lightColor: null,
  petals: 0.55,
  fireflies: 0.25,
  koiActivity: 1,
});

export const DEFAULT_WATER_PALETTE = Object.freeze({
  gradientStops: ['#3D737D', '#2E5968', '#24495A'],
  depthStrengthBias: 0,
  contourDensityBias: 0,
  sedimentAmountBias: 0,
  mineralStrength: 0.16,
});

export const DEFAULT_RUNTIME_TOGGLES = Object.freeze(
  resolveZenRendererDebugTogglePreset(ZEN_QUALITY_MODE_FULL),
);
