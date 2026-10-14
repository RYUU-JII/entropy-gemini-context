// Pure model. The Tracking-owned durable service is its only runtime writer;
// actuator policy remains separate from this descriptive observation model.
// Time constants describe product memory, not measured psychological recovery.
export const CONSUMPTION_MEMORY_PROFILE = Object.freeze({
  version: 'consumption_memory_v1',
  useTimeConstantMs: 30 * 60_000,
  outsideHalfLifeMs: 10 * 60_000,
  unknownHalfLifeMs: 90 * 60_000,
});

export const CONSUMPTION_MEMORY_KINDS = Object.freeze([
  'protected_use', 'protected_media', 'outside', 'unknown', 'intervention', 'disabled',
]);

function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`CONSUMPTION_MEMORY_INVALID:${code}`);
  }
}

function time(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`CONSUMPTION_MEMORY_INVALID:${code}`);
}

export function requireConsumptionMemoryInterval(value) {
  exact(value, ['epoch', 'sequence', 'startedAt', 'endedAt', 'kind'], 'interval');
  if (typeof value.epoch !== 'string' || !value.epoch || value.epoch.length > 160
    || value.epoch.trim() !== value.epoch) throw new Error('CONSUMPTION_MEMORY_INVALID:epoch');
  time(value.sequence, 'sequence');
  time(value.startedAt, 'startedAt');
  time(value.endedAt, 'endedAt');
  if (value.sequence < 1 || value.endedAt <= value.startedAt
    || !CONSUMPTION_MEMORY_KINDS.includes(value.kind)) throw new Error('CONSUMPTION_MEMORY_INVALID:interval_value');
  return value;
}

export function createConsumptionMemory({ epoch, startedAt }) {
  requireConsumptionMemoryInterval({ epoch, sequence: 1, startedAt, endedAt: startedAt + 1, kind: 'unknown' });
  return {
    contract: CONSUMPTION_MEMORY_PROFILE.version,
    epoch, startedAt, throughAt: startedAt, sequence: 0, memory: 0, lastInput: null,
    durations: Object.fromEntries(CONSUMPTION_MEMORY_KINDS.map((kind) => [kind, 0])),
  };
}

export function requireConsumptionMemory(value) {
  exact(value, ['contract', 'epoch', 'startedAt', 'throughAt', 'sequence', 'memory', 'lastInput', 'durations'], 'state');
  if (value.contract !== CONSUMPTION_MEMORY_PROFILE.version) throw new Error('CONSUMPTION_MEMORY_INVALID:version');
  time(value.startedAt, 'startedAt');
  time(value.throughAt, 'throughAt');
  time(value.sequence, 'sequence');
  if (typeof value.epoch !== 'string' || !value.epoch || value.epoch.length > 160
    || value.epoch.trim() !== value.epoch || value.throughAt < value.startedAt
    || typeof value.memory !== 'number' || !Number.isFinite(value.memory) || value.memory < 0 || value.memory > 1) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:state_value');
  }
  exact(value.durations, CONSUMPTION_MEMORY_KINDS, 'durations');
  let sum = 0;
  for (const kind of CONSUMPTION_MEMORY_KINDS) { time(value.durations[kind], kind); sum += value.durations[kind]; }
  if (sum !== value.throughAt - value.startedAt) throw new Error('CONSUMPTION_MEMORY_INVALID:accounting');
  if (value.lastInput === null) {
    if (value.sequence !== 0 || sum !== 0 || value.memory !== 0) throw new Error('CONSUMPTION_MEMORY_INVALID:initial');
  } else {
    requireConsumptionMemoryInterval(value.lastInput);
    if (value.lastInput.epoch !== value.epoch || value.lastInput.sequence !== value.sequence
      || value.lastInput.endedAt !== value.throughAt || value.lastInput.startedAt < value.startedAt
      || value.durations[value.lastInput.kind] < value.lastInput.endedAt - value.lastInput.startedAt) {
      throw new Error('CONSUMPTION_MEMORY_INVALID:cursor');
    }
  }
  return value;
}

function evolve(memory, kind, elapsedMs) {
  const profile = CONSUMPTION_MEMORY_PROFILE;
  if (kind === 'protected_use' || kind === 'protected_media') {
    // Analytic integration: splitting the same interval cannot change pressure.
    return memory + (1 - memory) * -Math.expm1(-elapsedMs / profile.useTimeConstantMs);
  }
  if (kind === 'intervention') return memory;
  const halfLife = kind === 'outside' ? profile.outsideHalfLifeMs : profile.unknownHalfLifeMs;
  return memory * Math.exp(-Math.LN2 * elapsedMs / halfLife);
}

// An interval of possible states under this model's own laws, not a probability
// or a measure of human fatigue. Missing observations may be use OR outside.
export function requireConsumptionPolicyEvidence(value) {
  exact(value, ['contract', 'throughAt', 'lowerMemory', 'upperMemory'], 'policy_evidence');
  time(value.throughAt, 'evidence_throughAt');
  if (value.contract !== 'consumption_policy_evidence_v1'
    || !Number.isFinite(value.lowerMemory) || !Number.isFinite(value.upperMemory)
    || value.lowerMemory < 0 || value.upperMemory > 1 || value.lowerMemory > value.upperMemory) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:policy_evidence_bounds');
  }
  return value;
}

export function createConsumptionPolicyEvidence(throughAt, { knownZero = false } = {}) {
  return requireConsumptionPolicyEvidence({ contract: 'consumption_policy_evidence_v1', throughAt,
    lowerMemory: 0, upperMemory: knownZero ? 0 : 1 });
}

export function advanceConsumptionPolicyEvidence(previous, { startedAt, endedAt, kind }) {
  requireConsumptionPolicyEvidence(previous);
  time(startedAt, 'evidence_start'); time(endedAt, 'evidence_end');
  if (startedAt < previous.throughAt || endedAt < startedAt || !CONSUMPTION_MEMORY_KINDS.includes(kind)) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:policy_evidence_interval');
  }
  const gap = startedAt - previous.throughAt;
  const uncertain = kind === 'unknown' || kind === 'disabled';
  return requireConsumptionPolicyEvidence({ ...previous, throughAt: endedAt,
    lowerMemory: evolve(evolve(previous.lowerMemory, 'outside', gap), uncertain ? 'outside' : kind, endedAt - startedAt),
    upperMemory: evolve(evolve(previous.upperMemory, 'protected_use', gap), uncertain ? 'protected_use' : kind, endedAt - startedAt) });
}

export function requireConsumptionPolicyEvidenceFor(value, throughAt, memory) {
  requireConsumptionPolicyEvidence(value);
  if (value.throughAt !== throughAt || memory < value.lowerMemory - 1e-12 || memory > value.upperMemory + 1e-12) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:policy_evidence_cursor');
  }
  return value;
}

export function advanceConsumptionMemory(previous, input) {
  requireConsumptionMemory(previous);
  requireConsumptionMemoryInterval(input);
  if (input.epoch !== previous.epoch) throw new Error('CONSUMPTION_MEMORY_EPOCH_MISMATCH');
  if (input.sequence === previous.sequence && previous.lastInput !== null
    && Object.keys(input).every((key) => input[key] === previous.lastInput[key])) return previous;
  if (input.sequence !== previous.sequence + 1) throw new Error('CONSUMPTION_MEMORY_SEQUENCE_DISCONTINUITY');
  if (input.startedAt < previous.throughAt) throw new Error('CONSUMPTION_MEMORY_INTERVAL_OVERLAP');
  const state = structuredClone(previous);
  const gapMs = input.startedAt - previous.throughAt;
  state.memory = evolve(evolve(state.memory, 'unknown', gapMs), input.kind, input.endedAt - input.startedAt);
  state.durations.unknown += gapMs;
  state.durations[input.kind] += input.endedAt - input.startedAt;
  state.throughAt = input.endedAt;
  state.sequence = input.sequence;
  state.lastInput = { ...input };
  return requireConsumptionMemory(state);
}

function projectionCoverageStatus(latestKind, unobservedMs) {
  // Reading later cannot silently re-enable an explicitly disabled/suspended
  // policy. Only subsequent admitted evidence changes those modes.
  if (latestKind === null) return 'unobserved';
  if (latestKind === 'disabled' || latestKind === 'intervention') return latestKind;
  return unobservedMs > 0 || latestKind === 'unknown' ? 'unknown' : 'observed';
}

// Projection never moves the commit cursor or turns a read into observed time.
export function projectConsumptionMemory(state, evaluatedAt) {
  requireConsumptionMemory(state);
  time(evaluatedAt, 'evaluatedAt');
  if (evaluatedAt < state.throughAt) throw new Error('CONSUMPTION_MEMORY_CLOCK_REGRESSED');
  const unobservedMs = evaluatedAt - state.throughAt;
  const latestKind = state.lastInput === null ? null : state.lastInput.kind;
  const status = projectionCoverageStatus(latestKind, unobservedMs);
  return {
    contract: 'consumption_memory_projection_v1',
    modelVersion: state.contract,
    evaluatedAt, throughAt: state.throughAt,
    memory: evolve(state.memory, 'unknown', unobservedMs),
    coverage: {
      status, latestKind, unobservedMs,
      historicalUnknownMs: state.durations.unknown,
      historicalDisabledMs: state.durations.disabled,
      baseline: 'zero_since_explicit_start',
    },
    durations: { ...state.durations },
    recovery: {
      status: 'not_a_psychological_measure',
      observedOutsideMs: state.durations.outside,
      memoryAgingMs: state.durations.unknown + state.durations.disabled + unobservedMs,
    },
    switching: { status: 'not_evaluated' },
  };
}

export function requireConsumptionMemoryProjection(value) {
  const keys = ['contract', 'modelVersion', 'evaluatedAt', 'throughAt', 'memory', 'coverage', 'durations', 'recovery', 'switching'];
  if (value && Object.hasOwn(value, 'policyEvidence')) keys.push('policyEvidence');
  exact(value, keys, 'projection');
  if (Object.hasOwn(value, 'policyEvidence')) requireConsumptionPolicyEvidenceFor(value.policyEvidence, value.evaluatedAt, value.memory);
  if (value.contract !== 'consumption_memory_projection_v1' || value.modelVersion !== CONSUMPTION_MEMORY_PROFILE.version
    || typeof value.memory !== 'number' || !Number.isFinite(value.memory) || value.memory < 0 || value.memory > 1) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:projection_value');
  }
  time(value.evaluatedAt, 'evaluatedAt');
  time(value.throughAt, 'throughAt');
  exact(value.coverage, ['status', 'latestKind', 'unobservedMs', 'historicalUnknownMs', 'historicalDisabledMs', 'baseline'], 'coverage');
  const coverage = value.coverage;
  for (const key of ['unobservedMs', 'historicalUnknownMs', 'historicalDisabledMs']) time(coverage[key], key);
  if (coverage.baseline !== 'zero_since_explicit_start'
    || !['observed', 'unobserved', 'unknown', 'disabled', 'intervention'].includes(coverage.status)
    || (coverage.latestKind !== null && !CONSUMPTION_MEMORY_KINDS.includes(coverage.latestKind))
    || value.evaluatedAt - value.throughAt !== coverage.unobservedMs
    || coverage.status !== projectionCoverageStatus(coverage.latestKind, coverage.unobservedMs)
    || (coverage.status === 'observed' && (coverage.unobservedMs !== 0
      || !['protected_use', 'protected_media', 'outside'].includes(coverage.latestKind)))) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:coverage');
  }
  exact(value.durations, CONSUMPTION_MEMORY_KINDS, 'durations');
  for (const kind of CONSUMPTION_MEMORY_KINDS) time(value.durations[kind], kind);
  exact(value.recovery, ['status', 'observedOutsideMs', 'memoryAgingMs'], 'recovery');
  exact(value.switching, ['status'], 'switching');
  if (value.recovery.status !== 'not_a_psychological_measure' || value.switching.status !== 'not_evaluated'
    || value.recovery.observedOutsideMs !== value.durations.outside
    || coverage.historicalUnknownMs !== value.durations.unknown || coverage.historicalDisabledMs !== value.durations.disabled
    || value.recovery.memoryAgingMs !== value.durations.unknown + value.durations.disabled + coverage.unobservedMs) {
    throw new Error('CONSUMPTION_MEMORY_INVALID:projection_accounting');
  }
  return value;
}

export function requireConsumptionMemoryRead(value) {
  exact(value, ['status', 'projection', 'error'], 'read');
  if (!['not_ready', 'disabled', 'failed', 'ahead_of_query', 'ready'].includes(value.status)
    || (value.status === 'failed' ? typeof value.error !== 'string' || !value.error : value.error !== null)) throw new Error('CONSUMPTION_MEMORY_READ_INVALID');
  if (value.status === 'ready') requireConsumptionMemoryProjection(value.projection);
  else if (value.projection !== null) throw new Error('CONSUMPTION_MEMORY_READ_UNAVAILABLE_INVALID');
  return value;
}
