// Semi-Markov stories: state transitions plus independent dwell distributions.
// These are varied synthetic workloads, not estimates of a human population.
export const GENERATOR_VERSION = 'consumption_patterns_v1';
const P = 'protected_use', M = 'protected_media', O = 'outside', U = 'unknown', I = 'intervention';
export const PATTERN_PROFILES = Object.freeze({
  sustained: { first: P, weights: { [P]: 7, [M]: 1, [O]: 2 }, dwell: { [P]: [300, 2400], [M]: [120, 1200], [O]: [15, 300] } },
  frequent_returns: { first: P, weights: { [P]: 5, [O]: 5 }, dwell: { [P]: [15, 300], [O]: [5, 120] } },
  longer_departures: { first: O, weights: { [P]: 4, [O]: 6 }, dwell: { [P]: [180, 1800], [O]: [300, 5400] } },
  mixed_tabs: { first: P, weights: { [P]: 5, [M]: 2, [O]: 3, [I]: 0.2 }, dwell: { [P]: [5, 900], [M]: [30, 1800], [O]: [5, 1200], [I]: [2, 120] } },
  observation_gaps: { first: P, weights: { [P]: 4, [O]: 2, [U]: 3, disabled: 1 }, dwell: { [P]: [20, 1800], [O]: [20, 1800], [U]: [1, 3600], disabled: [60, 3600] } },
});

export function seededRandom(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('PATTERN_SEED_INVALID');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateConsumptionPattern({ profile, seed, durationMs = 8 * 60 * 60_000 }) {
  if (!Object.hasOwn(PATTERN_PROFILES, profile) || !Number.isSafeInteger(durationMs) || durationMs <= 0) throw new Error('PATTERN_CONFIG_INVALID');
  const config = PATTERN_PROFILES[profile];
  const random = seededRandom(seed);
  const epoch = `synthetic:${profile}:${seed}`;
  const intervals = [];
  let at = 0, kind = config.first;
  while (at < durationMs) {
    const [min, max] = config.dwell[kind];
    // Log-uniform dwell plus occasional long persistence and very brief visits.
    const draw = random();
    const seconds = draw < 0.06 ? 1 + random() * 4
      : Math.exp(Math.log(min) + random() * Math.log(max / min)) * (draw > 0.94 ? 3 : 1);
    const endedAt = Math.min(durationMs, at + Math.max(1, Math.round(seconds * 1000)));
    intervals.push({ epoch, sequence: intervals.length + 1, startedAt: at, endedAt, kind,
      // Context churn is metadata only. It must not become pressure mass.
      tab: Math.floor(random() * 8), domain: Math.floor(random() * 4) });
    at = endedAt;
    const choices = Object.entries(config.weights).map(([next, weight]) => [next, weight * (next === kind ? 0.35 : 1)]);
    let ticket = random() * choices.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [next, weight] of choices) { ticket -= weight; if (ticket < 0) { kind = next; break; } }
  }
  return { generatorVersion: GENERATOR_VERSION, profile, seed, durationMs, intervals };
}

export function toModelInterval({ epoch, sequence, startedAt, endedAt, kind }) {
  return { epoch, sequence, startedAt, endedAt, kind };
}

export function partitionPattern(pattern, maximumSliceMs) {
  if (!Number.isSafeInteger(maximumSliceMs) || maximumSliceMs < 1) throw new Error('PATTERN_SLICE_INVALID');
  const intervals = [];
  for (const input of pattern.intervals) {
    for (let startedAt = input.startedAt; startedAt < input.endedAt; startedAt += maximumSliceMs) {
      intervals.push({ ...input, sequence: intervals.length + 1, startedAt, endedAt: Math.min(input.endedAt, startedAt + maximumSliceMs) });
    }
  }
  return { ...pattern, intervals };
}
