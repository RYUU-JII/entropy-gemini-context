// One curated inscription set, with distinct selection policies per surface.
// Gallery rotates by activity day; Site draws once for its presentation lifetime.
export const ZEN_FURIN_INSCRIPTIONS = Object.freeze([
  ['clear_wind', '清風明月'],
  ['still_water', '明鏡止水'],
  ['one_encounter', '一期一会'],
  ['harmony', '和敬清寂'],
  ['one_act', '一行三昧'],
  ['flowing_clouds', '行雲流水'],
].map(([id, text]) => Object.freeze({ id, characters: Object.freeze([...text]) })));

// Gallery keeps its activity-day rotation over the same curated set as Site.
const FURIN_MANTRA_POOL = Object.freeze(ZEN_FURIN_INSCRIPTIONS.map(entry => entry.characters));

export function selectZenFurinInscription(sample = Math.random()) {
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('zen_furin_inscription_sample_invalid');
  }
  return ZEN_FURIN_INSCRIPTIONS[Math.floor(sample * ZEN_FURIN_INSCRIPTIONS.length)];
}

export function resolveDailyFurinMantra({ cycleState = null, now = new Date() } = {}) {
  const fromPolicy = Number(cycleState?.resetPolicy?.effectiveResetHour);
  const effectiveResetHour = Number.isFinite(fromPolicy)
    ? Math.min(23, Math.max(0, Math.floor(fromPolicy)))
    : 4;
  const boundary = new Date(now);
  boundary.setHours(effectiveResetHour, 0, 0, 0);
  if (now < boundary) boundary.setDate(boundary.getDate() - 1);
  const localBoundaryDay = new Date(boundary.getFullYear(), boundary.getMonth(), boundary.getDate());
  const daySerial = Math.floor(localBoundaryDay.getTime() / 86400000);
  const idx = ((daySerial % FURIN_MANTRA_POOL.length) + FURIN_MANTRA_POOL.length) % FURIN_MANTRA_POOL.length;
  return FURIN_MANTRA_POOL[idx];
}
