import { createRenderBudget, resolveRenderResolution } from '@/platform/rendering/renderBudgetContract.js';

export const CEREMONY_IDS = Object.freeze({
  FIRST_VISION_DESCENT: 'first_vision_descent',
  MEMORY_PURGE_TIDE: 'memory_purge_tide',
  BOOKMARK_NEUTRALIZED: 'bookmark_neutralized',
});

export const CEREMONY_COMPLETION_POLICIES = Object.freeze({
  PLAYBACK: 'playback',
  RELEASE_GATED: 'release_gated',
});

export const CEREMONY_DURATIONS_MS = Object.freeze({
  [CEREMONY_IDS.FIRST_VISION_DESCENT]: 8200,
  [CEREMONY_IDS.MEMORY_PURGE_TIDE]: 3200,
  [CEREMONY_IDS.BOOKMARK_NEUTRALIZED]: 2100,
});

export const FIRST_VISION_DESCENT_TIMELINE = Object.freeze({
  coverRiseStartMs: 3000,
  coverOpaqueAtMs: 5000,
  coverHoldAtMs: 6200,
  releaseFadeStartMs: 6500,
  fadeOutStartMs: 7000,
});

export const FIRST_VISION_DESCENT_RENDER_PROFILE = Object.freeze({
  ...createRenderBudget({
    policyId: 'first-vision-descent-fixed',
    targetFps: 30,
    pixelRatioCap: 1.25,
    maxRenderPixels: 3_779_136,
  }),
});

const CEREMONY_ID_SET = new Set(Object.values(CEREMONY_IDS));

export function normalizeCeremonyId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return CEREMONY_ID_SET.has(normalized) ? normalized : null;
}

export function getCeremonyDurationMs(ceremonyId) {
  const normalized = normalizeCeremonyId(ceremonyId);
  if (!normalized) return 0;
  return CEREMONY_DURATIONS_MS[normalized];
}

export function isContentCeremonyId(ceremonyId) {
  const normalized = normalizeCeremonyId(ceremonyId);
  return normalized === CEREMONY_IDS.BOOKMARK_NEUTRALIZED;
}

const CEREMONY_RENDER_BUDGET = createRenderBudget({
  policyId: 'ceremony-fixed', targetFps: 60, pixelRatioCap: 2, maxRenderPixels: 8_294_400,
});

export function resolveCeremonyResolution({ ceremonyId, width, height, devicePixelRatio }) {
  if (!CEREMONY_ID_SET.has(ceremonyId)) throw new Error('CEREMONY_RESOLUTION_ID_INVALID');
  return resolveRenderResolution({ cssWidth: width, cssHeight: height, devicePixelRatio,
    renderBudget: ceremonyId === CEREMONY_IDS.FIRST_VISION_DESCENT
      ? FIRST_VISION_DESCENT_RENDER_PROFILE : CEREMONY_RENDER_BUDGET });
}
