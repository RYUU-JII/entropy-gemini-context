const MINUTE_MS = 60_000;
const PRESSURE_BASIS = 'experiment-synthetic-weighted-active-time';

const SCENARIO_BLUEPRINTS = Object.freeze([
  Object.freeze({
    domain: 'neutral.pool.lab',
    label: 'Neutral',
    cohort: 'managed',
    policyStatus: 'allowed',
    weightedMinutes: 0,
    rawMinutes: 0,
    share: 0,
    rank: null,
    volatility: 0.04,
    trendRatio: 0.82,
    risk: 0.12,
    hasPressureInput: false,
  }),
  Object.freeze({
    domain: 'steady.pressure.lab',
    label: 'Steady pressure',
    cohort: 'managed',
    policyStatus: 'allowed',
    weightedMinutes: 165,
    rawMinutes: 210,
    share: 0.18,
    rank: 3,
    volatility: 0.18,
    trendRatio: 1.08,
    risk: 0.72,
  }),
  Object.freeze({
    domain: 'large.edge.lab',
    label: 'Large edge',
    cohort: 'blocked',
    policyStatus: 'blocked',
    weightedMinutes: 260,
    rawMinutes: 330,
    share: 0.26,
    rank: 2,
    volatility: 0.32,
    trendRatio: 1.24,
    risk: 1.02,
  }),
  Object.freeze({
    domain: 'dominant.pressure.lab',
    label: 'Dominant',
    cohort: 'blocked',
    policyStatus: 'blocked',
    weightedMinutes: 520,
    rawMinutes: 690,
    share: 0.38,
    rank: 1,
    volatility: 0.38,
    trendRatio: 1.34,
    risk: 1.18,
  }),
  Object.freeze({
    domain: 'share.trap.lab',
    label: 'High share low time',
    cohort: 'unmanaged',
    policyStatus: 'allowed',
    weightedMinutes: 48,
    rawMinutes: 56,
    share: 0.42,
    rank: 1,
    volatility: 0.24,
    trendRatio: 1.68,
    risk: 0.44,
  }),
  Object.freeze({
    domain: 'restless.pattern.lab',
    label: 'Restless pattern',
    cohort: 'managed',
    policyStatus: 'allowed',
    weightedMinutes: 112,
    rawMinutes: 150,
    share: 0.13,
    rank: 4,
    volatility: 0.82,
    trendRatio: 1.76,
    risk: 0.68,
  }),
]);

const toPositiveInteger = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
};

const createSeededRandom = (seed) => {
  let state = toPositiveInteger(seed, 1) >>> 0;
  return () => {
    state = (Math.imul(state ^ 0x6d2b79f5, 1664525) + 1013904223) >>> 0;
    state ^= state >>> 16;
    state = Math.imul(state, 2246822507) >>> 0;
    state ^= state >>> 13;
    state = Math.imul(state, 3266489909) >>> 0;
    state ^= state >>> 16;
    return (state >>> 0) / 0xffffffff;
  };
};

const jitter = (rng, amount = 0.08) => 1 + ((rng() - 0.5) * amount);

const clampNumber = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
};

const roundNumber = (value, digits = 3) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
};

const buildCandidate = (blueprint, index, rng) => {
  const hasPressureInput = blueprint.hasPressureInput !== false;
  const weightedMinutes = hasPressureInput
    ? Math.max(0, Math.round(blueprint.weightedMinutes * jitter(rng, 0.1)))
    : 0;
  const rawMinutes = hasPressureInput
    ? Math.max(weightedMinutes, Math.round(blueprint.rawMinutes * jitter(rng, 0.08)))
    : 0;
  const share = hasPressureInput
    ? roundNumber(clampNumber(blueprint.share * jitter(rng, 0.12), 0, 1), 4)
    : 0;
  const rank = hasPressureInput && Number.isFinite(Number(blueprint.rank))
    ? Math.max(1, Math.floor(Number(blueprint.rank)))
    : null;
  const todayMinutes = Math.max(6, Math.round((rawMinutes || blueprint.rawMinutes || 32) * (0.28 + (rng() * 0.22))));
  const recentAverageMinutes = Math.max(8, Math.round(todayMinutes / Math.max(0.55, blueprint.trendRatio || 1)));
  const windowActiveMs = Math.max(todayMinutes, Math.round((rawMinutes || todayMinutes) * 0.62)) * MINUTE_MS;
  const goalMinutes = blueprint.cohort === 'blocked'
    ? 45
    : (blueprint.cohort === 'unmanaged' ? 50 : 75);
  const selectionScore = hasPressureInput
    ? weightedMinutes
    : Math.max(1, todayMinutes * 0.2);

  return {
    domain: blueprint.domain,
    label: blueprint.label,
    cohort: blueprint.cohort,
    policyStatus: blueprint.policyStatus,
    blocked: blueprint.policyStatus === 'blocked' || blueprint.cohort === 'blocked',
    managed: blueprint.cohort !== 'unmanaged',
    todayActiveMs: todayMinutes * MINUTE_MS,
    windowActiveMs,
    recentAverageMs: recentAverageMinutes * MINUTE_MS,
    goalMinutes,
    risk: roundNumber(clampNumber(blueprint.risk * jitter(rng, 0.08), 0, 1.2), 3),
    trendRatio: roundNumber(clampNumber(blueprint.trendRatio * jitter(rng, 0.08), 0, 2.4), 3),
    volatility: roundNumber(clampNumber(blueprint.volatility * jitter(rng, 0.12), 0, 1.5), 3),
    activeDays: hasPressureInput ? 7 : 2,
    streakDays: hasPressureInput ? Math.max(1, 7 - index) : 1,
    overLimitDays: blueprint.risk >= 1 ? 3 : (blueprint.risk >= 0.7 ? 1 : 0),
    selectionScore: roundNumber(selectionScore, 4),
    visibleUsageMs: Math.max(weightedMinutes, todayMinutes) * MINUTE_MS,
    rawWindowMs: rawMinutes * MINUTE_MS,
    weightedPressureMs: weightedMinutes * MINUTE_MS,
    pressureShare: share,
    pressureRank: rank,
    pressureBasis: hasPressureInput ? PRESSURE_BASIS : null,
    pressureWindowDays: hasPressureInput ? 7 : 0,
    hasPressureInput,
    visibleRank: index + 1,
    activityProfile: {
      persisted: false,
      quantile: roundNumber(clampNumber(0.12 + (rng() * 0.76), 0.0005, 0.9995), 4),
      boundDayIndex: null,
      rebindCount: 0,
    },
  };
};

export const buildExperimentPondSyntheticDomainCandidates = ({
  seed = 1,
} = {}) => {
  const rng = createSeededRandom(seed);
  return SCENARIO_BLUEPRINTS.map((blueprint, index) => buildCandidate(blueprint, index, rng));
};

export const summarizeExperimentPondSyntheticFixture = (domainCandidates = []) => {
  const candidates = Array.isArray(domainCandidates) ? domainCandidates : [];
  const pressureCandidates = candidates.filter((candidate) => candidate?.hasPressureInput !== false);
  return {
    candidateCount: candidates.length,
    pressureCandidateCount: pressureCandidates.length,
    maxWeightedPressureMs: Math.max(0, ...pressureCandidates.map((candidate) => Number(candidate.weightedPressureMs) || 0)),
    maxPressureShare: Math.max(0, ...pressureCandidates.map((candidate) => Number(candidate.pressureShare) || 0)),
  };
};

export const EXPERIMENT_POND_SYNTHETIC_PRESSURE_BASIS = PRESSURE_BASIS;
