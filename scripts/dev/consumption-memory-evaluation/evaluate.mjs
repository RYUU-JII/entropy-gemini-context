import { createConsumptionMemory, advanceConsumptionMemory, projectConsumptionMemory, createConsumptionPolicyEvidence, advanceConsumptionPolicyEvidence } from '../../../src/domains/behavior/consumption/consumptionMemoryModel.js';
import { projectShishiConsumptionLevel, SHISHI_CONSUMPTION_PROFILE } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';
import { toModelInterval, partitionPattern, generateConsumptionPattern, PATTERN_PROFILES } from './patternGenerator.mjs';
import { CONSUMPTION_SCENARIOS, scenarioPattern, checkScenarioRelationships } from './scenarios.mjs';

export function replayConsumptionPattern(pattern, { reads = false, restore = false, duplicate = false } = {}) {
  const first = pattern.intervals[0];
  let state = createConsumptionMemory({ epoch: first.epoch, startedAt: first.startedAt });
  let policyEvidence = createConsumptionPolicyEvidence(state.throughAt, { knownZero: true });
  const project = (at = state.throughAt) => ({ ...projectConsumptionMemory(state, at),
    policyEvidence: advanceConsumptionPolicyEvidence(policyEvidence, { startedAt: state.throughAt, endedAt: at, kind: 'unknown' }) });
  const entries = [];
  let previousKind = null, peak = 0, checks = 0;
  for (const raw of pattern.intervals) {
    const input = toModelInterval(raw);
    if (restore) state = JSON.parse(JSON.stringify(state));
    if (input.kind === 'protected_use' && previousKind !== 'protected_use') {
      const context = project(input.startedAt);
      entries.push({ at: input.startedAt, memory: context.memory, ...projectShishiConsumptionLevel({ enabled: true, consumption: context }) });
    }
    const before = state;
    policyEvidence = advanceConsumptionPolicyEvidence(policyEvidence, input);
    state = advanceConsumptionMemory(state, input);
    if (duplicate) state = advanceConsumptionMemory(state, input);
    if (reads) {
      const serialized = JSON.stringify(state);
      projectConsumptionMemory(state, state.throughAt + 60_000);
      project();
      if (serialized !== JSON.stringify(state)) throw new Error('READ_MUTATED_STATE');
    }
    const delta = state.memory - before.memory;
    const contiguous = input.startedAt === before.throughAt;
    if (contiguous && ((['protected_use', 'protected_media'].includes(input.kind) && delta < -1e-12)
      || (['outside', 'unknown', 'disabled'].includes(input.kind) && delta > 1e-12)
      || (input.kind === 'intervention' && Math.abs(delta) > 1e-12))) throw new Error(`DIRECTION_FAILED:${input.sequence}`);
    const context = project();
    const level = projectShishiConsumptionLevel({ enabled: true, consumption: context });
    if (level.waitExtensionMs < 0 || level.waitExtensionMs > SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs) throw new Error(`HOLD_BOUNDS_FAILED:${input.sequence}`);
    if (Object.values(state.durations).reduce((sum, duration) => sum + duration, 0) !== state.throughAt - state.startedAt) throw new Error('TIME_ACCOUNTING_FAILED');
    peak = Math.max(peak, state.memory);
    previousKind = input.kind;
    checks += 3;
  }
  const final = project();
  return { state, policyEvidence, final, level: projectShishiConsumptionLevel({ enabled: true, consumption: final }), entries, peak, checks };
}

export function evaluateConsumptionMemory({ seed = 20260909, perProfile = 100 } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('EVALUATION_SEED_INVALID');
  if (!Number.isSafeInteger(perProfile) || perProfile < 1 || perProfile > 2000) throw new Error('EVALUATION_COUNT_INVALID');
  const scenarios = CONSUMPTION_SCENARIOS.map((scenario) => ({ id: scenario.id, ...replayConsumptionPattern(scenarioPattern(scenario)) }));
  const relationships = checkScenarioRelationships(scenarios);
  const rows = [], failures = [], profiles = {};
  let intervalCount = 0, invariantChecks = 0, maxPartitionError = 0, maxRestoreError = 0;
  let maxSerializedStateBytes = 0;
  let maxOneSecondPerturbation = 0;
  let maxObservedHoldDeltaMs = 0, maxCoverageHoldDeltaMs = 0, maxExplicitModeHoldDeltaMs = 0;
  let coverageTransitionExample = null;
  for (const [profileIndex, profile] of Object.keys(PATTERN_PROFILES).entries()) {
    const summary = { runs: 0, entries: 0, bands: { light: 0, medium: 0, high: 0, baseline: 0, remembered: 0 }, meanFinalMemory: 0 };
    profiles[profile] = summary;
    for (let index = 0; index < perProfile; index++) {
      const caseSeed = (seed + Math.imul(profileIndex + 1, 1000003) + index) >>> 0;
      const pattern = generateConsumptionPattern({ profile, seed: caseSeed });
      try {
        const original = replayConsumptionPattern(pattern);
        maxSerializedStateBytes = Math.max(maxSerializedStateBytes, Buffer.byteLength(JSON.stringify(original.state), 'utf8'));
        const partitioned = replayConsumptionPattern(partitionPattern(pattern, 37_000));
        const restored = replayConsumptionPattern(pattern, { reads: true, restore: true, duplicate: true });
        const partitionError = Math.abs(original.final.memory - partitioned.final.memory);
        const restoreError = Math.abs(original.final.memory - restored.final.memory);
        if (partitionError > 1e-10 || restoreError > 1e-10) throw new Error('REPRESENTATION_INVARIANCE_FAILED');
        if (original.level.waitExtensionMs !== partitioned.level.waitExtensionMs
          || original.level.waitExtensionMs !== restored.level.waitExtensionMs) throw new Error('HOLD_REPRESENTATION_INVARIANCE_FAILED');
        // A one-second change cannot cause a large numerical policy jump.
        const next = advanceConsumptionMemory(original.state, { epoch: original.state.epoch, sequence: original.state.sequence + 1,
          startedAt: original.state.throughAt, endedAt: original.state.throughAt + 1000, kind: 'protected_use' });
        const perturbation = next.memory - original.state.memory;
        if (perturbation < 0 || perturbation > 0.001) throw new Error('SMALL_INPUT_BOUND_FAILED');
        const nextLevel = projectShishiConsumptionLevel({ enabled: true, consumption: { ...projectConsumptionMemory(next, next.throughAt), policyEvidence: advanceConsumptionPolicyEvidence(original.policyEvidence, next.lastInput) } });
        const holdDeltaMs = nextLevel.waitExtensionMs - original.level.waitExtensionMs;
        if (['adapted', 'remembered'].includes(original.level.status) && ['adapted', 'remembered'].includes(nextLevel.status)) {
          maxObservedHoldDeltaMs = Math.max(maxObservedHoldDeltaMs, holdDeltaMs);
          if (Math.abs(holdDeltaMs) > 50) throw new Error('SMALL_INPUT_HOLD_BOUND_FAILED');
        } else if (original.final.coverage.status === 'unknown' && holdDeltaMs > maxCoverageHoldDeltaMs) {
          maxCoverageHoldDeltaMs = holdDeltaMs;
          coverageTransitionExample = { profile, seed: caseSeed, beforeCoverage: original.final.coverage.status,
            beforeMemory: original.final.memory, beforeHoldMs: original.level.waitExtensionMs, afterHoldMs: nextLevel.waitExtensionMs };
        } else if (['disabled', 'intervention'].includes(original.final.coverage.status)) {
          maxExplicitModeHoldDeltaMs = Math.max(maxExplicitModeHoldDeltaMs, holdDeltaMs);
        }
        if (original.final.coverage.status === 'unknown' && Math.abs(holdDeltaMs) > 50) throw new Error('COVERAGE_RESUME_HOLD_JUMP');
        maxOneSecondPerturbation = Math.max(maxOneSecondPerturbation, perturbation);
        maxPartitionError = Math.max(maxPartitionError, partitionError);
        maxRestoreError = Math.max(maxRestoreError, restoreError);
        intervalCount += pattern.intervals.length;
        invariantChecks += original.checks + partitioned.checks + restored.checks + 4
          + (original.final.coverage.status === 'observed' ? 1 : 0);
        summary.runs++;
        summary.meanFinalMemory += original.final.memory / perProfile;
        for (const entry of original.entries) {
          summary.entries++;
          summary.bands[entry.status === 'adapted' ? entry.band : entry.status === 'remembered' ? 'remembered' : 'baseline']++;
        }
        rows.push({ profile, seed: caseSeed, intervals: pattern.intervals.length, finalMemory: original.final.memory,
          peak: original.peak, finalCoverage: original.final.coverage.status, entryCount: original.entries.length });
      } catch (error) {
        // Retain an independently reproducible seed and the first failing prefix.
        let prefix = pattern.intervals;
        let prefixMinimized = false;
        for (let length = 1; length <= pattern.intervals.length; length++) {
          try { replayConsumptionPattern({ ...pattern, intervals: pattern.intervals.slice(0, length) }); }
          catch { prefix = pattern.intervals.slice(0, length); prefixMinimized = true; break; }
        }
        failures.push({ profile, seed: caseSeed, error: error.message, prefixMinimized, counterexampleIntervals: prefix });
      }
    }
  }
  return {
    schemaVersion: 1, scope: 'synthetic_candidate_only', seed, perProfile,
    status: failures.length === 0 && relationships.every((check) => check.passed) ? 'PASS' : 'FAIL',
    generatedRuns: rows.length + failures.length, intervalCount, invariantChecks, maxSerializedStateBytes,
    maxPartitionError, maxRestoreError, maxOneSecondPerturbation, maxObservedHoldDeltaMs,
    readiness: 'NOT_READY_FOR_PRODUCTION',
    coverageTransitionAudit: { maxHoldDeltaMs: maxCoverageHoldDeltaMs, maxExplicitModeHoldDeltaMs, example: coverageTransitionExample,
      status: maxCoverageHoldDeltaMs > 50 ? 'WATCH' : 'PASS',
      interpretation: 'Unknown-to-observed continuity is audited separately from explicit collection-mode changes or intervention exclusivity. An active hold is never reselected.' },
    relationships, profiles, scenarios, rows, failures,
    limitations: ['No human labels or accuracy estimate', 'No live producer or storage integration',
      'Epoch restore checks serialization, not MV3 or browser-restart persistence',
      'Outside intervals require certified absence of protected media; existing point observations cannot supply them',
      'Profile distributions are generator assumptions, not real-user prevalence',
      'All inspected seeds and scenarios are development evidence, not an unseen holdout'],
  };
}
