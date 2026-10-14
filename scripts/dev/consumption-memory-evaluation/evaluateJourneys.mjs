import { PATTERN_PROFILES, generateConsumptionPattern } from './patternGenerator.mjs';
import { REACTION_PROFILES, replayConsumptionJourney } from './replayJourney.mjs';
import { evaluateJourneyContracts, journeyPattern } from './journeyContracts.mjs';

export async function evaluateConsumptionJourneys({ seed = 20260909, perProfile = 30, onProgress = () => {} } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff
    || !Number.isSafeInteger(perProfile) || perProfile < 1 || perProfile > 400) throw new Error('JOURNEY_EVALUATION_CONFIG_INVALID');
  const contracts = await evaluateJourneyContracts();
  const groups = {}, rows = [], failures = [];
  let sourceIntervals = 0, pairedComparisons = 0, deterministicReplays = 0;
  for (const [profileIndex, profile] of Object.keys(PATTERN_PROFILES).entries()) {
    for (let index = 0; index < perProfile; index++) {
      const caseSeed = (seed + Math.imul(profileIndex + 1, 1000003) + index) >>> 0;
      const pattern = generateConsumptionPattern({ profile, seed: caseSeed });
      sourceIntervals += pattern.intervals.length;
      for (const collection of ['protected_sites', 'all_sites_minimal']) {
        for (const reaction of Object.keys(REACTION_PROFILES)) {
          const key = `${profile}/${collection}/${reaction}`;
          if (!groups[key]) groups[key] = { profile, collection, reaction, pairs: 0, fixedShown: 0, adaptiveShown: 0,
            fixedWaitMs: 0, adaptiveWaitMs: 0, adaptiveMoreGates: 0, adaptiveFewerGates: 0,
            maxExtraWaitMs: 0, fixedShortVisitWaitMs: 0, adaptiveShortVisitWaitMs: 0,
            fixedLongDepartureWaitMs: 0, adaptiveLongDepartureWaitMs: 0, denials: {}, unknownOutsideMs: 0 };
          try {
            const fixed = await replayConsumptionJourney(pattern, { collection, reaction, policy: 'fixed' });
            const adaptive = await replayConsumptionJourney(pattern, { collection, reaction, policy: 'adaptive' });
            for (const result of [fixed, adaptive]) {
              if (Object.values(result.durations).reduce((sum, value) => sum + value, 0) !== pattern.durationMs) throw new Error('JOURNEY_TIME_ACCOUNTING');
              if (result.durations.outside !== 0 || result.durations.protected_media !== 0) throw new Error('JOURNEY_FABRICATED_INTERVAL_COVERAGE');
              if (result.finalMemory < 0 || result.finalMemory > 1) throw new Error('JOURNEY_MEMORY_BOUNDS');
            }
            // Reproducibility checks sample each family/mode/reaction, not an
            // alleged independent user sample. Random response is keyed to the
            // source action, so control-flow differences cannot shift RNG draws.
            if (index === 0) {
              const replay = await replayConsumptionJourney(pattern, { collection, reaction, policy: 'adaptive' });
              if (JSON.stringify(replay) !== JSON.stringify(adaptive)) throw new Error('JOURNEY_NONDETERMINISTIC');
              deterministicReplays++;
            }
            const group = groups[key];
            group.pairs++; pairedComparisons++;
            group.fixedShown += fixed.shownGates; group.adaptiveShown += adaptive.shownGates;
            group.fixedWaitMs += fixed.waitMs; group.adaptiveWaitMs += adaptive.waitMs;
            group.adaptiveMoreGates += Number(adaptive.shownGates > fixed.shownGates);
            group.adaptiveFewerGates += Number(adaptive.shownGates < fixed.shownGates);
            group.maxExtraWaitMs = Math.max(group.maxExtraWaitMs, adaptive.waitMs - fixed.waitMs);
            group.fixedShortVisitWaitMs += fixed.shortVisitWaitMs; group.adaptiveShortVisitWaitMs += adaptive.shortVisitWaitMs;
            group.fixedLongDepartureWaitMs += fixed.longDepartureWaitMs; group.adaptiveLongDepartureWaitMs += adaptive.longDepartureWaitMs;
            group.unknownOutsideMs += adaptive.unknownOutsideMs;
            for (const [reason, count] of Object.entries(adaptive.denials)) group.denials[reason] = (group.denials[reason] ?? 0) + count;
            rows.push({ profile, seed: caseSeed, collection, reaction, fixed, adaptive });
          } catch (error) {
            failures.push({ profile, seed: caseSeed, collection, reaction, error: error.message,
              counterexample: pattern, minimized: false });
          }
        }
      }
    }
    onProgress({ profile, pairedComparisons, failures: failures.length });
  }
  const scenarios = [];
  for (const outsideMinutes of [5, 30, 60]) {
    const pattern = journeyPattern([['protected_use', 30 * 60_000], ['outside', outsideMinutes * 60_000], ['protected_use', 30 * 60_000, 1]]);
    scenarios.push({ name: `30_use_${outsideMinutes}_outside_30_use`,
      result: await replayConsumptionJourney(pattern, { policy: 'adaptive', competing: false, presentationFailureRate: 0, keepTrace: true }) });
  }
  // Preserve a reproducible product tradeoff even when every safety invariant
  // passes. Increased exposure is evidence to review, not a numeric test error.
  const increased = rows.find((row) => row.collection === 'protected_sites' && row.reaction === 'continue_only'
    && row.adaptive.shownGates > row.fixed.shownGates);
  const tradeoffExamples = [];
  if (increased) {
    const pattern = generateConsumptionPattern({ profile: increased.profile, seed: increased.seed });
    const options = { collection: increased.collection, reaction: increased.reaction, keepTrace: true };
    tradeoffExamples.push({ reason: 'adaptive_increases_gate_count', profile: increased.profile, seed: increased.seed,
      pattern, fixed: await replayConsumptionJourney(pattern, { ...options, policy: 'fixed' }),
      adaptive: await replayConsumptionJourney(pattern, { ...options, policy: 'adaptive' }) });
  }
  return { schemaVersion: 1, scope: 'offline_observed_journey_replay', seed, perProfile,
    status: failures.length === 0 && contracts.every((item) => item.passed) ? 'PASS' : 'FAIL',
    readiness: 'NOT_READY_FOR_PRODUCTION', sourcePatterns: perProfile * Object.keys(PATTERN_PROFILES).length,
    sourceIntervals, pairedComparisons, deterministicReplays, groups, rows, contracts, scenarios, tradeoffExamples, failures,
    interpretation: 'Contract PASS is not evidence that adaptive holds improve intentionality. Exposure counts and added waiting are measured under declared synthetic reactions.',
    limitations: [
      'No live observation join or model storage/policy cutover; actual Chrome and Gate UI are not run',
      'Simulated stats-ACK receipts pass existing consent and segment contracts; real stats commits and navigation detection are not executed',
      'Only the simulator certifies exposure interval completeness; current production media points cannot certify outside or media intervals',
      'Entry checkpoint only for policy comparison; return/spread gates, pass persistence and background Furin debt/episode generation are not simulated',
      'Furin/Enso fixtures supply candidate conditions; rejection does not test obligation retention or episode absorption',
      'Fixed and adaptive reactions share action-keyed random draws; reaction probabilities do not depend on hold length and are not human measurements',
      'A leave replaces remaining current intent until the next scripted action; a switch immediately tries another tab without a pass',
      'An incompatible scripted intent explicitly cancels the simulated Gate with cleanup; it does not auto-continue in a hidden tab. Real visibility/gesture timing is not simulated',
      'Gate session representation and browser receipts are I/O fixtures; no real screen/input/media cleanup, MV3 restart or browser durability proof',
      'Initial memory is an explicit zero evaluation baseline, not a production restart policy',
      'All source patterns and inspected seeds are development evidence; no empirical classification accuracy or unseen holdout claim',
    ] };
}
