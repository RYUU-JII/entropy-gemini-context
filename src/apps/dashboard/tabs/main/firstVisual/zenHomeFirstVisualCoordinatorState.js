import {
  ZEN_HOME_FIRST_VISUAL_PARTS,
  ZEN_HOME_FIRST_VISUAL_PHASES,
  normalizeZenHomeFirstVisualMilestone,
  resolveZenHomeFirstVisualPhaseForMilestone,
  shouldAcceptZenHomeFirstVisualPhaseTransition,
} from '@/themes/plugins/zen/runtime/zenHomeFirstVisualReadinessContract.js';

export const ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS = Object.freeze({
  RESET: 'reset',
  WAIT_START: 'wait_start',
  MILESTONE: 'milestone',
  PART_READY: 'part_ready',
  READINESS_FAILED: 'readiness_failed',
});

const createInitialParts = (requiresCompositeFirstFrameReady = true) => ({
  [ZEN_HOME_FIRST_VISUAL_PARTS.POND]: false,
  [ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI]: !requiresCompositeFirstFrameReady,
  firstViewport: !requiresCompositeFirstFrameReady,
  pondMetadata: null,
  bonsaiMetadata: null,
  firstViewportMetadata: null,
});

const createInitialCorrelationToken = () => ({
  sceneCommitKey: null,
  inputSignature: null,
  bonsaiMaterializationKey: null,
});

const FIRST_VISUAL_PART_STATE_KEYS = Object.freeze({
  [ZEN_HOME_FIRST_VISUAL_PARTS.POND]: ZEN_HOME_FIRST_VISUAL_PARTS.POND,
  [ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI]: ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI,
  [ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT]: 'firstViewport',
});

const FIRST_VISUAL_PART_METADATA_KEYS = Object.freeze({
  [ZEN_HOME_FIRST_VISUAL_PARTS.POND]: 'pondMetadata',
  [ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI]: 'bonsaiMetadata',
  [ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT]: 'firstViewportMetadata',
});

const isZenHomeFirstVisualPart = (part) => (
  Object.prototype.hasOwnProperty.call(FIRST_VISUAL_PART_STATE_KEYS, part)
);

const normalizeCorrelationTokenPart = (value) => (
  typeof value === 'string' && value.trim() && value.trim() === value ? value : null
);

const resolvePartCorrelationToken = (part, metadata = null) => {
  const sceneCommitKey = normalizeCorrelationTokenPart(metadata?.sceneCommitKey);
  if (!sceneCommitKey) return null;
  if (part === ZEN_HOME_FIRST_VISUAL_PARTS.POND) {
    return {
      sceneCommitKey,
      inputSignature: null,
      bonsaiMaterializationKey: null,
    };
  }

  const inputSignature = normalizeCorrelationTokenPart(metadata?.inputSignature);
  const bonsaiMaterializationKey = normalizeCorrelationTokenPart(
    metadata?.bonsaiMaterializationKey,
  );
  if (!inputSignature || !bonsaiMaterializationKey) return null;
  return {
    sceneCommitKey,
    inputSignature,
    bonsaiMaterializationKey,
  };
};

const mergeCorrelationToken = (currentToken = null, candidateToken = null) => {
  if (!candidateToken) return null;
  const current = currentToken || createInitialCorrelationToken();
  if (current.sceneCommitKey && current.sceneCommitKey !== candidateToken.sceneCommitKey) {
    return null;
  }
  if (
    current.inputSignature
    && candidateToken.inputSignature
    && current.inputSignature !== candidateToken.inputSignature
  ) {
    return null;
  }
  if (
    current.bonsaiMaterializationKey
    && candidateToken.bonsaiMaterializationKey
    && current.bonsaiMaterializationKey !== candidateToken.bonsaiMaterializationKey
  ) {
    return null;
  }
  return {
    sceneCommitKey: current.sceneCommitKey || candidateToken.sceneCommitKey,
    inputSignature: current.inputSignature || candidateToken.inputSignature,
    bonsaiMaterializationKey:
      current.bonsaiMaterializationKey || candidateToken.bonsaiMaterializationKey,
  };
};

const resolveCorrelationTransition = (state, part, candidateToken) => {
  if (!candidateToken) return null;
  const currentToken = state.correlationToken || createInitialCorrelationToken();
  if (
    currentToken.sceneCommitKey
    && currentToken.sceneCommitKey !== candidateToken.sceneCommitKey
  ) {
    return null;
  }

  const materializationChanged = (
    part !== ZEN_HOME_FIRST_VISUAL_PARTS.POND
    && currentToken.inputSignature
    && currentToken.bonsaiMaterializationKey
    && (
      currentToken.inputSignature !== candidateToken.inputSignature
      || currentToken.bonsaiMaterializationKey !== candidateToken.bonsaiMaterializationKey
    )
  );
  if (!materializationChanged) {
    const correlationToken = mergeCorrelationToken(currentToken, candidateToken);
    return correlationToken ? { baseState: state, correlationToken } : null;
  }

  // HomeScanWorkspace admits only the currently prepared bonsai token. A same-scene
  // mismatch here therefore means a legitimate re-materialization, not a stale ACK.
  return {
    baseState: {
      ...state,
      parts: {
        ...state.parts,
        [ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI]: false,
        firstViewport: false,
        bonsaiMetadata: null,
        firstViewportMetadata: null,
      },
    },
    correlationToken: {
      sceneCommitKey: candidateToken.sceneCommitKey,
      inputSignature: candidateToken.inputSignature,
      bonsaiMaterializationKey: candidateToken.bonsaiMaterializationKey,
    },
  };
};

const areRequiredFirstVisualPartsReady = (parts = {}) => (
  parts[ZEN_HOME_FIRST_VISUAL_PARTS.POND] === true
  && parts[ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI] === true
  && parts.firstViewport === true
);

const resolvePartReadyProgressLabel = (part) => (
  part === ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT
    ? 'first_viewport_ready'
    : `${part}_first_frame_ready`
);

const createInitialProgress = (label = 'not_started') => ({
  startedAtMs: 0,
  lastProgressAtMs: 0,
  lastProgressLabel: label,
});

export const createZenHomeFirstVisualCoordinatorState = ({
  requiresCompositeFirstFrameReady = true,
  progressLabel = 'not_started',
} = {}) => ({
  phase: ZEN_HOME_FIRST_VISUAL_PHASES.IDLE,
  readyNotified: false,
  failureNotified: false,
  parts: createInitialParts(requiresCompositeFirstFrameReady),
  correlationToken: createInitialCorrelationToken(),
  progress: createInitialProgress(progressLabel),
});

const withProgress = (state, label, nowMs) => {
  const resolvedNowMs = Number(nowMs);
  const currentProgress = state.progress || {};
  return {
    ...state,
    progress: {
      startedAtMs: Number(currentProgress.startedAtMs) || resolvedNowMs,
      lastProgressAtMs: resolvedNowMs,
      lastProgressLabel: label,
    },
  };
};

const withPhase = (state, nextPhase) => {
  if (!shouldAcceptZenHomeFirstVisualPhaseTransition(state.phase, nextPhase)) {
    return state;
  }
  return {
    ...state,
    phase: nextPhase,
  };
};

const reduceReset = (event) => createZenHomeFirstVisualCoordinatorState({
  requiresCompositeFirstFrameReady: event.requiresCompositeFirstFrameReady === true,
  progressLabel: event.progressLabel || 'gate_reset',
});

const reduceWaitStart = (state, event) => {
  if (state.readyNotified || state.failureNotified) return state;
  const withStartedProgress = {
    ...state,
    progress: {
      startedAtMs: Number(event.nowMs) || 0,
      lastProgressAtMs: Number(event.nowMs) || 0,
      lastProgressLabel: event.label || 'main_tab_readiness_ready',
    },
  };
  return withPhase(withStartedProgress, ZEN_HOME_FIRST_VISUAL_PHASES.WAITING_VISUAL_PARTS);
};

const reduceMilestone = (state, event) => {
  if (state.readyNotified || state.failureNotified) return state;
  const milestone = normalizeZenHomeFirstVisualMilestone(event.milestoneEvent || event.milestone);
  if (!milestone) return state;
  const withMilestoneProgress = withProgress(state, milestone, event.nowMs);
  const nextPhase = resolveZenHomeFirstVisualPhaseForMilestone(milestone, withMilestoneProgress.phase);
  const withResolvedPhase = withPhase(withMilestoneProgress, nextPhase);
  if (nextPhase !== ZEN_HOME_FIRST_VISUAL_PHASES.FAILED) {
    return withResolvedPhase;
  }
  return {
    ...withResolvedPhase,
    failureNotified: true,
  };
};

const reducePartReady = (state, event) => {
  if (state.readyNotified || state.failureNotified) return state;
  const part = event.part;
  if (!isZenHomeFirstVisualPart(part)) {
    return state;
  }
  if (event.requiresCompositeFirstFrameReady !== true) {
    return {
      ...withProgress(state, resolvePartReadyProgressLabel(part), event.nowMs),
      readyNotified: true,
    };
  }

  const candidateCorrelationToken = resolvePartCorrelationToken(part, event.metadata);
  const correlationTransition = resolveCorrelationTransition(
    state,
    part,
    candidateCorrelationToken,
  );
  if (!correlationTransition) return state;
  const { baseState, correlationToken: nextCorrelationToken } = correlationTransition;

  const withPartProgress = withProgress(
    baseState,
    resolvePartReadyProgressLabel(part),
    event.nowMs,
  );
  const partStateKey = FIRST_VISUAL_PART_STATE_KEYS[part];
  const metadataKey = FIRST_VISUAL_PART_METADATA_KEYS[part];
  const nextParts = {
    ...withPartProgress.parts,
    [partStateKey]: true,
    [metadataKey]: event.metadata || null,
  };
  const allRequiredPartsReady = areRequiredFirstVisualPartsReady(nextParts);
  const withParts = {
    ...withPartProgress,
    parts: nextParts,
    correlationToken: nextCorrelationToken,
  };
  if (!allRequiredPartsReady) {
    return withPhase(withParts, ZEN_HOME_FIRST_VISUAL_PHASES.PARTIAL_READY);
  }
  return {
    ...withPhase(withParts, ZEN_HOME_FIRST_VISUAL_PHASES.COMPOSITE_COMMITTED),
    readyNotified: true,
  };
};

const reduceReadinessFailed = (state, event) => {
  if (state.readyNotified || state.failureNotified) return state;
  const failedState = withPhase(
    withProgress(state, event.label || 'main_tab_readiness_failed', event.nowMs),
    ZEN_HOME_FIRST_VISUAL_PHASES.FAILED,
  );
  return {
    ...failedState,
    failureNotified: true,
  };
};

export const reduceZenHomeFirstVisualCoordinatorState = (state, event = {}) => {
  const currentState = state || createZenHomeFirstVisualCoordinatorState();
  switch (event.type) {
    case ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.RESET:
      return reduceReset(event);
    case ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.WAIT_START:
      return reduceWaitStart(currentState, event);
    case ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.MILESTONE:
      return reduceMilestone(currentState, event);
    case ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.PART_READY:
      return reducePartReady(currentState, event);
    case ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.READINESS_FAILED:
      return reduceReadinessFailed(currentState, event);
    default:
      return currentState;
  }
};
