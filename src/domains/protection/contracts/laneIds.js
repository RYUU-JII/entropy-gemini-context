export const PROTECTION_LANE_IDS = Object.freeze({
  REWARD: 'reward',
  PACE: 'pace',
  FRICTION: 'friction',
  ADVANCED: 'advanced',
});

export const LANE_IDS = Object.freeze(Object.values(PROTECTION_LANE_IDS));
export const LANE_ID_SET = new Set(LANE_IDS);

export function isLaneId(value) {
  return typeof value === 'string' && LANE_ID_SET.has(value);
}

export function normalizeLaneId(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isLaneId(normalized) ? normalized : fallback;
}
