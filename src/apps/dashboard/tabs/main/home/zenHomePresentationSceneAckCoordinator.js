import {
  MAIN_PRESENTATION_PHASES,
} from '@/themes/core/presentation/mainSceneContract.js';

export const ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS = Object.freeze([
  'pond',
  'bonsai',
]);

export const ZEN_HOME_PRESENTATION_SCENE_ACK_DEADLINE_MS = 15_000;

export const ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_CODE = (
  'ZEN_HOME_PRESENTATION_SCENE_COMPOSITE_ACK_STALLED'
);

export const ZEN_HOME_PRESENTATION_SCENE_RENDERER_FAILURE_CODE = (
  'ZEN_HOME_PRESENTATION_SCENE_RENDERER_FAILED'
);

export const ZEN_HOME_PRESENTATION_SCENE_FATAL_PARTS = Object.freeze([
  ...ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS,
  'composite',
]);

const PART_SET = new Set(ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS);
const FATAL_PART_SET = new Set(ZEN_HOME_PRESENTATION_SCENE_FATAL_PARTS);
const FATAL_CODE_SET = new Set([
  ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_CODE,
  ZEN_HOME_PRESENTATION_SCENE_RENDERER_FAILURE_CODE,
]);
const STARTUP_DIAGNOSTIC_TOKEN_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;

const requirePart = (part) => {
  if (!PART_SET.has(part)) {
    throw new Error(`ZEN_HOME_PRESENTATION_SCENE_ACK_PART_INVALID:${String(part)}`);
  }
  return part;
};

const requireSceneCommitKey = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_GENERATION_REQUIRED');
  }
  return value;
};

const requireTimestamp = (value, code) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(code);
  }
  return numeric;
};

const requireDeadlineMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_DEADLINE_INVALID');
  }
  return numeric;
};

const normalizeReason = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_REJECTION_REASON_REQUIRED');
  }
  return value.trim();
};

const normalizeOptionalStartupDiagnosticToken = (value, code) => {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || !STARTUP_DIAGNOSTIC_TOKEN_PATTERN.test(value)
  ) {
    throw new Error(code);
  }
  return value;
};

const normalizeFatalDetails = (details = null) => {
  if (!details || typeof details !== 'object') return null;
  const startupStage = normalizeOptionalStartupDiagnosticToken(
    details.startupStage,
    'ZEN_HOME_PRESENTATION_SCENE_STARTUP_STAGE_INVALID',
  );
  const startupReadinessReason = normalizeOptionalStartupDiagnosticToken(
    details.startupReadinessReason,
    'ZEN_HOME_PRESENTATION_SCENE_STARTUP_READINESS_REASON_INVALID',
  );
  return Object.freeze({
    ...details,
    ...(startupStage === null ? {} : { startupStage }),
    ...(startupReadinessReason === null ? {} : { startupReadinessReason }),
  });
};

export function createZenHomePresentationSceneFatalError({
  code,
  sceneCommitKey,
  part,
  reason,
  details = null,
} = {}) {
  if (!FATAL_CODE_SET.has(code)) {
    throw new Error(`ZEN_HOME_PRESENTATION_SCENE_FATAL_CODE_INVALID:${String(code)}`);
  }
  const generation = requireSceneCommitKey(sceneCommitKey);
  if (!FATAL_PART_SET.has(part)) {
    throw new Error(`ZEN_HOME_PRESENTATION_SCENE_FATAL_PART_INVALID:${String(part)}`);
  }
  const normalizedReason = normalizeReason(reason);
  const normalizedDetails = normalizeFatalDetails(details);
  const startupDiagnosticSuffix = [
    normalizedDetails?.startupStage
      ? `startup_stage=${normalizedDetails.startupStage}`
      : null,
    normalizedDetails?.startupReadinessReason
      ? `startup_reason=${normalizedDetails.startupReadinessReason}`
      : null,
  ].filter(Boolean).join(':');
  const error = new Error(
    `${code}:part=${part}:reason=${normalizedReason}:scene=${generation}`
      + `${startupDiagnosticSuffix ? `:${startupDiagnosticSuffix}` : ''}`,
  );
  error.code = code;
  error.sceneCommitKey = generation;
  error.part = part;
  error.reason = normalizedReason;
  error.details = normalizedDetails;
  return error;
}

export function resolveZenHomePresentationSceneAckStallFatalFailure(diagnostic = null, {
  phase = null,
} = {}) {
  const reason = phase === MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION
    ? 'first_vision_scene_composite_ack_deadline_exceeded'
    : phase === MAIN_PRESENTATION_PHASES.PREPARING_CURRENT
      ? 'current_scene_composite_ack_deadline_exceeded'
      : null;
  if (reason === null) return null;
  if (diagnostic?.code !== ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_CODE) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_DIAGNOSTIC_INVALID');
  }
  return Object.freeze({
    code: ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_CODE,
    sceneCommitKey: requireSceneCommitKey(diagnostic.sceneCommitKey),
    part: 'composite',
    reason,
    details: diagnostic,
  });
}

const resolveMetadataSceneCommitKey = (metadata) => (
  typeof metadata?.sceneCommitKey === 'string' && metadata.sceneCommitKey.trim()
    ? metadata.sceneCommitKey.trim()
    : null
);

const buildRejectionObservation = (metadata = null) => Object.freeze({
  actualSceneCommitKey: resolveMetadataSceneCommitKey(metadata),
  inputSignatureLength: typeof metadata?.inputSignature === 'string'
    ? metadata.inputSignature.length
    : 0,
  bonsaiMaterializationKeyLength: typeof metadata?.bonsaiMaterializationKey === 'string'
    ? metadata.bonsaiMaterializationKey.length
    : 0,
  presentationRosterSignatureLength:
    typeof metadata?.presentationRosterSignature === 'string'
      ? metadata.presentationRosterSignature.length
      : 0,
  workerRosterSignatureLength: typeof metadata?.workerRosterSignature === 'string'
    ? metadata.workerRosterSignature.length
    : 0,
});

const createPartMap = (value) => Object.freeze({
  pond: value,
  bonsai: value,
});

export function createZenHomePresentationSceneAckGeneration({
  sceneCommitKey,
  startedAtMs,
  deadlineMs = ZEN_HOME_PRESENTATION_SCENE_ACK_DEADLINE_MS,
} = {}) {
  const generation = requireSceneCommitKey(sceneCommitKey);
  const startedAt = requireTimestamp(
    startedAtMs,
    'ZEN_HOME_PRESENTATION_SCENE_ACK_START_TIME_INVALID',
  );
  const duration = requireDeadlineMs(deadlineMs);
  return Object.freeze({
    sceneCommitKey: generation,
    startedAtMs: startedAt,
    deadlineAtMs: startedAt + duration,
    received: createPartMap(null),
    rejections: createPartMap(null),
    notified: false,
    stalledAtMs: null,
  });
}

export function recordZenHomePresentationSceneAckRejected(state, {
  part,
  reason,
  metadata = null,
  observedAtMs,
} = {}) {
  if (!state) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_GENERATION_STATE_REQUIRED');
  }
  const resolvedPart = requirePart(part);
  const resolvedReason = normalizeReason(reason);
  const observedAt = requireTimestamp(
    observedAtMs,
    'ZEN_HOME_PRESENTATION_SCENE_ACK_REJECTION_TIME_INVALID',
  );
  const previousPartRejections = state.rejections[resolvedPart] || Object.freeze({
    count: 0,
    reasons: Object.freeze({}),
    lastReason: null,
    lastObservedAtMs: null,
    lastObservation: null,
  });
  const previousReasonCount = Number(previousPartRejections.reasons[resolvedReason]) || 0;
  const nextPartRejections = Object.freeze({
    count: previousPartRejections.count + 1,
    reasons: Object.freeze({
      ...previousPartRejections.reasons,
      [resolvedReason]: previousReasonCount + 1,
    }),
    lastReason: resolvedReason,
    lastObservedAtMs: observedAt,
    lastObservation: buildRejectionObservation(metadata),
  });
  return Object.freeze({
    ...state,
    rejections: Object.freeze({
      ...state.rejections,
      [resolvedPart]: nextPartRejections,
    }),
  });
}

export function recordZenHomePresentationSceneAckAccepted(state, {
  part,
  metadata = null,
  observedAtMs,
} = {}) {
  if (!state) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_GENERATION_STATE_REQUIRED');
  }
  const resolvedPart = requirePart(part);
  const observedAt = requireTimestamp(
    observedAtMs,
    'ZEN_HOME_PRESENTATION_SCENE_ACK_RECEIVED_TIME_INVALID',
  );
  const actualSceneCommitKey = resolveMetadataSceneCommitKey(metadata);
  if (actualSceneCommitKey !== state.sceneCommitKey) {
    return Object.freeze({
      state: recordZenHomePresentationSceneAckRejected(state, {
        part: resolvedPart,
        reason: actualSceneCommitKey === null
          ? 'scene_commit_key_missing'
          : 'scene_commit_key_mismatch',
        metadata,
        observedAtMs: observedAt,
      }),
      shouldCommit: false,
      commitMetadata: null,
    });
  }
  if (state.notified || state.received[resolvedPart]) {
    return Object.freeze({
      state,
      shouldCommit: false,
      commitMetadata: null,
    });
  }

  const received = Object.freeze({
    ...state.received,
    [resolvedPart]: Object.freeze({
      metadata,
      observedAtMs: observedAt,
    }),
  });
  const complete = ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS.every(
    (candidate) => Boolean(received[candidate]),
  );
  const nextState = Object.freeze({
    ...state,
    received,
    notified: complete,
  });
  return Object.freeze({
    state: nextState,
    shouldCommit: complete,
    commitMetadata: complete
      ? Object.freeze({
          sceneCommitKey: state.sceneCommitKey,
          pond: received.pond.metadata,
          bonsai: received.bonsai.metadata,
        })
      : null,
  });
}

const listReceivedParts = (state) => ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS.filter(
  (part) => Boolean(state.received[part]),
);

const listPendingParts = (state) => ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS.filter(
  (part) => !state.received[part],
);

const listRejectedReasons = (state) => ZEN_HOME_PRESENTATION_SCENE_ACK_PARTS.flatMap(
  (part) => {
    const rejection = state.rejections[part];
    if (!rejection) return [];
    return Object.entries(rejection.reasons).map(([reason, count]) => Object.freeze({
      part,
      reason,
      count,
      lastReason: rejection.lastReason,
      lastObservedAtMs: rejection.lastObservedAtMs,
      lastObservation: rejection.lastObservation,
    }));
  },
);

export function markZenHomePresentationSceneAckStalled(state, {
  observedAtMs,
} = {}) {
  if (!state) {
    throw new Error('ZEN_HOME_PRESENTATION_SCENE_ACK_GENERATION_STATE_REQUIRED');
  }
  const observedAt = requireTimestamp(
    observedAtMs,
    'ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_TIME_INVALID',
  );
  if (state.notified || state.stalledAtMs !== null || observedAt < state.deadlineAtMs) {
    return Object.freeze({ state, shouldEmit: false, diagnostic: null });
  }
  const nextState = Object.freeze({
    ...state,
    stalledAtMs: observedAt,
  });
  return Object.freeze({
    state: nextState,
    shouldEmit: true,
    diagnostic: Object.freeze({
      code: ZEN_HOME_PRESENTATION_SCENE_ACK_STALL_CODE,
      sceneCommitKey: state.sceneCommitKey,
      startedAtMs: state.startedAtMs,
      deadlineAtMs: state.deadlineAtMs,
      observedAtMs: observedAt,
      elapsedMs: Math.max(0, observedAt - state.startedAtMs),
      deadlineExceededByMs: Math.max(0, observedAt - state.deadlineAtMs),
      receivedParts: Object.freeze(listReceivedParts(state)),
      pendingParts: Object.freeze(listPendingParts(state)),
      rejectedReasons: Object.freeze(listRejectedReasons(state)),
    }),
  });
}
