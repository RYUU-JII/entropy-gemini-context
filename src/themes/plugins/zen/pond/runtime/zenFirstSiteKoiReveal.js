export const ZEN_FIRST_SITE_KOI_REVEAL_DURATION_MS = 4800;
export const ZEN_FIRST_SITE_KOI_MATERIAL_DURATION_MS = 1200;

export function resolveZenFirstSiteKoiMaterialPresence(startedAtMs, nowMs = performance.now()) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    throw new Error('ZEN_FIRST_SITE_KOI_REVEAL_CLOCK_INVALID');
  }
  const t = Math.max(0, Math.min(1, (nowMs - startedAtMs) / ZEN_FIRST_SITE_KOI_MATERIAL_DURATION_MS));
  return t * t * (3 - 2 * t);
}

// Worker-local presentation of a shadow's first site assignment.
// This receipt neither changes the roster nor records onboarding/business state.
export function beginZenFirstSiteKoiReveal(fish, nowMs = performance.now()) {
  if (!fish.domain || !Number.isFinite(nowMs)) throw new Error('ZEN_FIRST_SITE_KOI_REVEAL_INPUT_INVALID');
  fish.firstSiteReveal = { domain: fish.domain, startedAtMs: nowMs };
}

export function resolveZenFirstSiteKoiReveal(fish, nowMs = performance.now()) {
  const reveal = fish.firstSiteReveal;
  if (!reveal) return 0;
  if (!Number.isFinite(reveal.startedAtMs) || !Number.isFinite(nowMs)) {
    throw new Error('ZEN_FIRST_SITE_KOI_REVEAL_CLOCK_INVALID');
  }
  if (fish.domain !== reveal.domain) return 0;
  return Math.max(0, Math.min(1, 1 - (nowMs - reveal.startedAtMs) / ZEN_FIRST_SITE_KOI_REVEAL_DURATION_MS));
}
