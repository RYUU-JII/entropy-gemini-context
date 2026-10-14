export const INTERVENTION_ADMISSION_STATE_VERSION = 1;

export const INTERVENTION_ADMISSION_DECISIONS = Object.freeze({
  EMIT: 'emit',
  SWALLOW: 'swallow',
  DEFER: 'defer',
});

export const INTERVENTION_ADMISSION_EVENTS = Object.freeze({
  REQUESTED: 'requested',
  PRESENTED: 'presented',
  ABORTED: 'aborted',
  RELEASED: 'released',
  CONTEXT_CHANGED: 'context_changed',
});

export const INTERVENTION_ADMISSION_LEASE_PHASES = Object.freeze({
  RESERVED: 'reserved',
  PRESENTED: 'presented',
});

export const INTERVENTION_ADMISSION_CONTEXT_MODES = Object.freeze({
  OPEN: 'open',
  BLOCKED: 'blocked',
});

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeNonNegativeNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function requireText(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(label);
  return normalized;
}

function requirePositiveInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 1) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function freezeState(state) {
  return Object.freeze({
    ...state,
    context: Object.freeze({ ...state.context }),
    activeLease: state.activeLease
      ? Object.freeze({ ...state.activeLease })
      : null,
  });
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('INTERVENTION_ADMISSION_CANDIDATE_REQUIRED');
  }
  const requestedAt = normalizeNow(
    candidate.requestedAt,
    'INTERVENTION_ADMISSION_CANDIDATE_REQUESTED_AT_INVALID',
  );
  const validUntil = normalizeNow(
    candidate.validUntil,
    'INTERVENTION_ADMISSION_CANDIDATE_VALID_UNTIL_INVALID',
  );
  if (validUntil < requestedAt) {
    throw new Error('INTERVENTION_ADMISSION_CANDIDATE_WINDOW_INVALID');
  }
  const weight = normalizeNonNegativeNumber(
    candidate.weight,
    'INTERVENTION_ADMISSION_CANDIDATE_WEIGHT_INVALID',
  );
  if (weight > 1) {
    throw new Error('INTERVENTION_ADMISSION_CANDIDATE_WEIGHT_INVALID');
  }
  const exclusivity = requireText(
    candidate.exclusivity,
    'INTERVENTION_ADMISSION_CANDIDATE_EXCLUSIVITY_REQUIRED',
  );
  if (exclusivity !== 'exclusive') {
    throw new Error(
      `INTERVENTION_ADMISSION_CANDIDATE_EXCLUSIVITY_INVALID:${exclusivity}`,
    );
  }
  return Object.freeze({
    requestId: requireText(
      candidate.requestId,
      'INTERVENTION_ADMISSION_CANDIDATE_REQUEST_ID_REQUIRED',
    ),
    kind: requireText(
      candidate.kind,
      'INTERVENTION_ADMISSION_CANDIDATE_KIND_REQUIRED',
    ),
    requestedAt,
    validUntil,
    evidenceRevision: normalizeNow(
      candidate.evidenceRevision,
      'INTERVENTION_ADMISSION_CANDIDATE_EVIDENCE_REVISION_INVALID',
    ),
    priority: normalizeNonNegativeNumber(
      candidate.priority,
      'INTERVENTION_ADMISSION_CANDIDATE_PRIORITY_INVALID',
    ),
    weight,
    exclusivity,
  });
}

function normalizeContext(context = {}) {
  const mode = context.mode;
  if (!Object.values(INTERVENTION_ADMISSION_CONTEXT_MODES).includes(mode)) {
    throw new Error(`INTERVENTION_ADMISSION_CONTEXT_MODE_INVALID:${String(mode)}`);
  }
  return {
    mode,
    reason: mode === INTERVENTION_ADMISSION_CONTEXT_MODES.BLOCKED
      ? requireText(context.reason, 'INTERVENTION_ADMISSION_CONTEXT_REASON_REQUIRED')
      : '',
  };
}

function compareCandidates(left, right) {
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.weight !== right.weight) return right.weight - left.weight;
  if (left.requestedAt !== right.requestedAt) return left.requestedAt - right.requestedAt;
  const kindOrder = left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0;
  if (kindOrder !== 0) return kindOrder;
  return left.requestId < right.requestId
    ? -1
    : left.requestId > right.requestId
      ? 1
      : 0;
}

function createDecision(candidate, decision, reason, {
  notBefore = 0,
  leaseId = null,
} = {}) {
  return Object.freeze({
    requestId: candidate.requestId,
    kind: candidate.kind,
    decision,
    reason,
    notBefore,
    leaseId,
  });
}

export function requireInterventionAdmissionState(state) {
  if (!state || state.version !== INTERVENTION_ADMISSION_STATE_VERSION) {
    throw new Error('INTERVENTION_ADMISSION_STATE_INVALID');
  }
  normalizeNow(
    state.globalMinimumGapMs,
    'INTERVENTION_ADMISSION_STATE_GLOBAL_GAP_INVALID',
  );
  normalizeNow(
    state.globalNotBefore,
    'INTERVENTION_ADMISSION_STATE_GLOBAL_NOT_BEFORE_INVALID',
  );
  normalizeNow(
    state.lastPresentedAt,
    'INTERVENTION_ADMISSION_STATE_LAST_PRESENTED_AT_INVALID',
  );
  requirePositiveInteger(
    state.nextLeaseSerial,
    'INTERVENTION_ADMISSION_STATE_NEXT_LEASE_SERIAL_INVALID',
  );
  normalizeContext(state.context);
  if (
    state.lastPresentedKind !== null
    && (typeof state.lastPresentedKind !== 'string' || !state.lastPresentedKind.trim())
  ) {
    throw new Error('INTERVENTION_ADMISSION_STATE_LAST_PRESENTED_KIND_INVALID');
  }
  if (state.activeLease !== null) {
    const lease = state.activeLease;
    if (!lease || typeof lease !== 'object' || Array.isArray(lease)) {
      throw new Error('INTERVENTION_ADMISSION_STATE_ACTIVE_LEASE_INVALID');
    }
    requireText(lease.leaseId, 'INTERVENTION_ADMISSION_STATE_LEASE_ID_REQUIRED');
    requireText(lease.requestId, 'INTERVENTION_ADMISSION_STATE_REQUEST_ID_REQUIRED');
    requireText(lease.kind, 'INTERVENTION_ADMISSION_STATE_KIND_REQUIRED');
    if (!Object.values(INTERVENTION_ADMISSION_LEASE_PHASES).includes(lease.phase)) {
      throw new Error(
        `INTERVENTION_ADMISSION_STATE_LEASE_PHASE_INVALID:${String(lease.phase)}`,
      );
    }
    const reservedAt = normalizeNow(
      lease.reservedAt,
      'INTERVENTION_ADMISSION_STATE_RESERVED_AT_INVALID',
    );
    const presentedAt = normalizeNow(
      lease.presentedAt,
      'INTERVENTION_ADMISSION_STATE_PRESENTED_AT_INVALID',
    );
    if (
      lease.phase === INTERVENTION_ADMISSION_LEASE_PHASES.RESERVED
      && presentedAt !== 0
    ) {
      throw new Error('INTERVENTION_ADMISSION_STATE_RESERVED_PRESENTED_AT_INVALID');
    }
    if (
      lease.phase === INTERVENTION_ADMISSION_LEASE_PHASES.PRESENTED
      && (presentedAt < reservedAt || presentedAt <= 0)
    ) {
      throw new Error('INTERVENTION_ADMISSION_STATE_PRESENTED_TIMELINE_INVALID');
    }
  }
  return state;
}

function requireMatchingLease(state, leaseId, expectedPhase) {
  const normalizedLeaseId = requireText(
    leaseId,
    'INTERVENTION_ADMISSION_LEASE_ID_REQUIRED',
  );
  const lease = state.activeLease;
  if (!lease || lease.leaseId !== normalizedLeaseId) {
    throw new Error('INTERVENTION_ADMISSION_LEASE_MISMATCH');
  }
  if (lease.phase !== expectedPhase) {
    throw new Error(
      `INTERVENTION_ADMISSION_LEASE_PHASE_INVALID:${lease.phase}:${expectedPhase}`,
    );
  }
  return lease;
}

export function createInterventionAdmissionState({
  globalMinimumGapMs = 0,
  context = {
    mode: INTERVENTION_ADMISSION_CONTEXT_MODES.OPEN,
    reason: '',
  },
} = {}) {
  return freezeState({
    version: INTERVENTION_ADMISSION_STATE_VERSION,
    globalMinimumGapMs: normalizeNow(
      globalMinimumGapMs,
      'INTERVENTION_ADMISSION_GLOBAL_GAP_INVALID',
    ),
    globalNotBefore: 0,
    lastPresentedAt: 0,
    lastPresentedKind: null,
    nextLeaseSerial: 1,
    activeLease: null,
    context: normalizeContext(context),
  });
}

function evaluateRequested(state, event) {
  const now = normalizeNow(event.now, 'INTERVENTION_ADMISSION_REQUEST_NOW_INVALID');
  if (!Array.isArray(event.candidates)) {
    throw new Error('INTERVENTION_ADMISSION_CANDIDATES_REQUIRED');
  }
  const candidates = event.candidates.map(normalizeCandidate);
  const requestIds = new Set(candidates.map((candidate) => candidate.requestId));
  if (requestIds.size !== candidates.length) {
    throw new Error('INTERVENTION_ADMISSION_DUPLICATE_REQUEST_ID');
  }
  if (candidates.length === 0) {
    return Object.freeze({
      state,
      decisions: Object.freeze([]),
      winner: null,
    });
  }
  if (candidates.some((candidate) => candidate.requestedAt > now)) {
    throw new Error('INTERVENTION_ADMISSION_CANDIDATE_FROM_FUTURE');
  }
  const orderedCandidates = [...candidates].sort(compareCandidates);
  const stale = orderedCandidates.filter((candidate) => candidate.validUntil <= now);
  const current = orderedCandidates.filter((candidate) => candidate.validUntil > now);
  const decisions = stale.map((candidate) => createDecision(
    candidate,
    INTERVENTION_ADMISSION_DECISIONS.SWALLOW,
    'candidate_stale',
  ));

  if (state.context.mode === INTERVENTION_ADMISSION_CONTEXT_MODES.BLOCKED) {
    current.forEach((candidate) => {
      decisions.push(createDecision(
        candidate,
        INTERVENTION_ADMISSION_DECISIONS.SWALLOW,
        `context_blocked:${state.context.reason}`,
      ));
    });
    return Object.freeze({
      state,
      decisions: Object.freeze(decisions),
      winner: null,
    });
  }

  if (state.activeLease) {
    current.forEach((candidate) => {
      decisions.push(createDecision(
        candidate,
        INTERVENTION_ADMISSION_DECISIONS.DEFER,
        'active_intervention',
      ));
    });
    return Object.freeze({
      state,
      decisions: Object.freeze(decisions),
      winner: null,
    });
  }

  if (state.globalNotBefore > now) {
    current.forEach((candidate) => {
      const expiresBeforeGap = candidate.validUntil <= state.globalNotBefore;
      decisions.push(createDecision(
        candidate,
        expiresBeforeGap
          ? INTERVENTION_ADMISSION_DECISIONS.SWALLOW
          : INTERVENTION_ADMISSION_DECISIONS.DEFER,
        expiresBeforeGap
          ? 'candidate_expires_before_global_gap'
          : 'global_gap',
        { notBefore: expiresBeforeGap ? 0 : state.globalNotBefore },
      ));
    });
    return Object.freeze({
      state,
      decisions: Object.freeze(decisions),
      winner: null,
    });
  }

  const [winner, ...losers] = current;
  if (!winner) {
    return Object.freeze({
      state,
      decisions: Object.freeze(decisions),
      winner: null,
    });
  }
  const leaseId = `intervention:${state.nextLeaseSerial}:${winner.kind}`;
  decisions.push(createDecision(
    winner,
    INTERVENTION_ADMISSION_DECISIONS.EMIT,
    'selected',
    { leaseId },
  ));
  losers.forEach((candidate) => {
    decisions.push(createDecision(
      candidate,
      INTERVENTION_ADMISSION_DECISIONS.SWALLOW,
      'selected_other_candidate',
    ));
  });
  const nextState = freezeState({
    ...state,
    nextLeaseSerial: state.nextLeaseSerial + 1,
    activeLease: {
      leaseId,
      requestId: winner.requestId,
      kind: winner.kind,
      phase: INTERVENTION_ADMISSION_LEASE_PHASES.RESERVED,
      reservedAt: now,
      presentedAt: 0,
    },
  });
  return Object.freeze({
    state: nextState,
    decisions: Object.freeze(decisions),
    winner: Object.freeze({
      candidate: winner,
      leaseId,
    }),
  });
}

export function reduceInterventionAdmission(state, event = {}) {
  const current = requireInterventionAdmissionState(state);
  switch (event.type) {
    case INTERVENTION_ADMISSION_EVENTS.REQUESTED:
      return evaluateRequested(current, event);
    case INTERVENTION_ADMISSION_EVENTS.PRESENTED: {
      const now = normalizeNow(
        event.now,
        'INTERVENTION_ADMISSION_PRESENTED_NOW_INVALID',
      );
      const lease = requireMatchingLease(
        current,
        event.leaseId,
        INTERVENTION_ADMISSION_LEASE_PHASES.RESERVED,
      );
      if (now < lease.reservedAt) {
        throw new Error('INTERVENTION_ADMISSION_PRESENTED_BEFORE_RESERVATION');
      }
      return Object.freeze({
        state: freezeState({
          ...current,
          lastPresentedAt: now,
          lastPresentedKind: lease.kind,
          activeLease: {
            ...lease,
            phase: INTERVENTION_ADMISSION_LEASE_PHASES.PRESENTED,
            presentedAt: now,
          },
        }),
        decisions: Object.freeze([]),
        winner: null,
      });
    }
    case INTERVENTION_ADMISSION_EVENTS.ABORTED: {
      const now = normalizeNow(
        event.now,
        'INTERVENTION_ADMISSION_ABORTED_NOW_INVALID',
      );
      const lease = requireMatchingLease(
        current,
        event.leaseId,
        INTERVENTION_ADMISSION_LEASE_PHASES.RESERVED,
      );
      if (now < lease.reservedAt) {
        throw new Error('INTERVENTION_ADMISSION_ABORTED_BEFORE_RESERVATION');
      }
      return Object.freeze({
        state: freezeState({
          ...current,
          activeLease: null,
        }),
        decisions: Object.freeze([]),
        winner: null,
      });
    }
    case INTERVENTION_ADMISSION_EVENTS.RELEASED: {
      const now = normalizeNow(
        event.now,
        'INTERVENTION_ADMISSION_RELEASED_NOW_INVALID',
      );
      const lease = requireMatchingLease(
        current,
        event.leaseId,
        INTERVENTION_ADMISSION_LEASE_PHASES.PRESENTED,
      );
      if (now < lease.presentedAt) {
        throw new Error('INTERVENTION_ADMISSION_RELEASED_BEFORE_PRESENTATION');
      }
      return Object.freeze({
        state: freezeState({
          ...current,
          globalNotBefore: now + current.globalMinimumGapMs,
          activeLease: null,
        }),
        decisions: Object.freeze([]),
        winner: null,
      });
    }
    case INTERVENTION_ADMISSION_EVENTS.CONTEXT_CHANGED:
      return Object.freeze({
        state: freezeState({
          ...current,
          context: normalizeContext(event.context),
        }),
        decisions: Object.freeze([]),
        winner: null,
      });
    default:
      throw new Error(`INTERVENTION_ADMISSION_EVENT_INVALID:${String(event.type)}`);
  }
}

export default reduceInterventionAdmission;
