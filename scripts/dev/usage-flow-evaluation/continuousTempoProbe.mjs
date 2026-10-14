import { isDeepStrictEqual } from 'node:util';
import FeedTempoEpisodeAssembler from '../../../src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js';
import {
  applyEligibleEpisodeToFeedTempoCheckpoint,
  evaluateFeedTempoEpisodeAgainstProfile,
  restoreFeedTempoAdaptiveProfile,
} from '../../../src/domains/nudge/feed-flow/tempo/feedTempoAdaptiveProfileModel.js';
import {
  normalizeFeedTempoShadowEvaluation,
} from '../../../src/domains/nudge/feed-flow/tempo/feedTempoContracts.js';

const SURFACE = Object.freeze({
  profileId: 'synthetic_probe',
  semanticSurfaceId: 'synthetic_probe:continuous_feed',
  surfaceMode: 'continuous',
  contentClass: 'microblog',
});
const PROFILE_EPOCH = 'synthetic_continuous_tempo_probe';

function assembleSyntheticEpisode(screenfuls, durationMs) {
  let clock = 1_000;
  let timerSequence = 0;
  const timers = new Map();
  const assembler = new FeedTempoEpisodeAssembler({
    now: () => clock,
    setTimeoutFn: (callback, delayMs) => {
      const timerId = ++timerSequence;
      timers.set(timerId, { callback, deadline: clock + delayMs });
      return timerId;
    },
    clearTimeoutFn: (timerId) => timers.delete(timerId),
  });
  const advanceClock = (next) => {
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.deadline <= next)
        .sort((left, right) => left[1].deadline - right[1].deadline)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].deadline;
      due[1].callback();
    }
    clock = next;
  };
  assembler.start({ surface: SURFACE, now: clock });
  // Forward observations every second keep the production idle rule intact.
  // These are synthetic source facts, not detector labels or admission state.
  const count = durationMs / 1_000;
  for (let index = 0; index < count; index += 1) {
    advanceClock(1_000 + index * 1_000);
    assembler.recordAdvance({
      ts: clock,
      direction: 'forward',
      screenfulDelta: screenfuls / count,
      confidence: 0.9,
    });
  }
  advanceClock(1_000 + durationMs);
  const fact = assembler.stop({ now: clock });
  if (fact === null || timers.size !== 0) {
    throw new Error('SYNTHETIC_CONTINUOUS_PROBE_EPISODE_INVALID');
  }
  return fact;
}

function evaluate(fact, profile = null) {
  return normalizeFeedTempoShadowEvaluation(evaluateFeedTempoEpisodeAgainstProfile({
    fact,
    profile,
    now: fact.endedAt,
  }), fact.surface);
}

function publicAmountAndPace(evaluation) {
  return {
    currentScreenfuls: evaluation.currentScreenfuls,
    amountRatio: evaluation.amountRatio,
    amountComparison: evaluation.amountComparison,
    direction: evaluation.direction,
    paceRatio: evaluation.paceRatio,
    fastnessZ: evaluation.fastnessZ,
    referenceDwellMs: evaluation.referenceDwellMs,
    currentMedianDwellMs: evaluation.currentMedianDwellMs,
    paceUnmeasured: evaluation.reasons.includes('continuous_pace_unmeasured'),
  };
}

function expectedProjection(currentScreenfuls, amountRatio, amountComparison) {
  return {
    currentScreenfuls,
    amountRatio,
    amountComparison,
    direction: 'unknown',
    paceRatio: null,
    fastnessZ: null,
    referenceDwellMs: null,
    currentMedianDwellMs: null,
    paceUnmeasured: true,
  };
}

export function runContinuousTempoProbe() {
  const checks = [];
  const check = (id, expected, actual) => checks.push({
    id,
    passed: isDeepStrictEqual(actual, expected),
    expected,
    actual,
  });
  check(
    'continuous_same_amount_different_elapsed_has_no_speed_claim',
    [1_000, 20_000, 600_000].map(() => expectedProjection(4, 0.25, 'below_reference')),
    [1_000, 20_000, 600_000].map((durationMs) => publicAmountAndPace(
      evaluate(assembleSyntheticEpisode(4, durationMs)),
    )),
  );
  check(
    'continuous_different_amount_same_elapsed_changes_only_amount_axis',
    [
      expectedProjection(4, 0.25, 'below_reference'),
      expectedProjection(16, 1, 'at_reference'),
      expectedProjection(32, 2, 'above_reference'),
    ],
    [4, 16, 32].map((amount) => publicAmountAndPace(
      evaluate(assembleSyntheticEpisode(amount, 20_000)),
    )),
  );

  const baselineFact = assembleSyntheticEpisode(24, 20_000);
  const first = applyEligibleEpisodeToFeedTempoCheckpoint({
    checkpoint: null,
    profileEpoch: PROFILE_EPOCH,
    fact: baselineFact,
    now: baselineFact.endedAt,
  });
  const alteredEncoding = structuredClone(first.checkpoint);
  alteredEncoding.profiles[0].retainedSamples[0].dwellMs = 1_000;
  alteredEncoding.profiles[0].logDwellMean = 100;
  alteredEncoding.profiles[0].logDwellVariance = 100;
  const storedBefore = structuredClone(alteredEncoding);
  const restored = restoreFeedTempoAdaptiveProfile({
    checkpoint: alteredEncoding,
    profileEpoch: PROFILE_EPOCH,
    surface: SURFACE,
    now: baselineFact.endedAt,
  });
  check('continuous_v2_restore_does_not_reinterpret_stored_encoding', storedBefore, alteredEncoding);
  const update = (checkpoint) => applyEligibleEpisodeToFeedTempoCheckpoint({
    checkpoint,
    profileEpoch: PROFILE_EPOCH,
    fact: baselineFact,
    now: baselineFact.endedAt,
  });
  const ordinaryUpdate = update(first.checkpoint);
  const alteredUpdate = update(alteredEncoding);
  check('continuous_public_amount_ignores_v2_encoded_dwell_fields', {
    restoredProfile: first.profile,
    nextProfile: ordinaryUpdate.profile,
    evaluation: ordinaryUpdate.evaluation,
  }, {
    restoredProfile: restored.profile,
    nextProfile: alteredUpdate.profile,
    evaluation: alteredUpdate.evaluation,
  });
  return {
    checks,
    limitations: [
      'Synthetic forward observations and a synthetic checkpoint exercise unit semantics only; they do not establish behavioral accuracy or human intent.',
      'No admission state, safety readiness, browser adapter, intervention endpoint, or durable store is seeded or exercised.',
      'Continuous episode elapsed time is not an observed visible-coverage denominator, so the public comparison abstains from speed.',
      'Checkpoint v2 still stores scaled amount in required dwell/log fields. This probe verifies isolation, not a schema migration.',
    ],
  };
}
