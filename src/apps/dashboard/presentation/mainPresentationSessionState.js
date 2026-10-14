import {
  MAIN_PRESENTATION_PHASES,
  MAIN_PRESENTATION_SCENE_KINDS,
} from './mainPresentationDecision.js';

const freeze = (value) => Object.freeze(value);

export const MAIN_PRESENTATION_COMMITTED_FATAL_CODES = freeze({
  BOOT_DEGRADED: 'FIRST_VISION_BOOT_DEGRADED_AFTER_SCENE_COMMIT',
  PRESENTED_PERSIST_FAILED: 'FIRST_VISION_PRESENTED_PERSIST_FAILED_AFTER_SCENE_COMMIT',
});

const COMMITTED_FATAL_CODE_BY_DIAGNOSTIC = freeze({
  boot_degraded: MAIN_PRESENTATION_COMMITTED_FATAL_CODES.BOOT_DEGRADED,
  presentation_persist_failed: MAIN_PRESENTATION_COMMITTED_FATAL_CODES.PRESENTED_PERSIST_FAILED,
});

export const MAIN_PRESENTATION_SESSION_EVENTS = freeze({
  RESET: 'reset',
  USE_CURRENT: 'use_current',
  PROGRESSION_RESOLVED: 'progression_resolved',
  PROGRESSION_READ_FAILED: 'progression_read_failed',
  BOOT_DEGRADED: 'boot_degraded',
  FIRST_VISION_SCENE_COMMITTED: 'first_vision_scene_committed',
  PRESENTATION_PERSISTED: 'presentation_persisted',
  PRESENTATION_PERSIST_FAILED: 'presentation_persist_failed',
  FIRST_VISION_SPENT_ELSEWHERE: 'first_vision_spent_elsewhere',
  VISION_REVEALED: 'vision_revealed',
  DREAM_DWELL_ELAPSED: 'dream_dwell_elapsed',
  COVER_OPAQUE: 'cover_opaque',
  CURRENT_SCENE_COMMITTED: 'current_scene_committed',
  SPENT_PERSISTED: 'spent_persisted',
  SPENT_PERSIST_FAILED: 'spent_persist_failed',
  OVERLAY_COMPLETED: 'overlay_completed',
});

const EVENT_SET = new Set(Object.values(MAIN_PRESENTATION_SESSION_EVENTS));

function normalizeEpochMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
}

function requirePositiveSafeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(code);
  }
  return value;
}

function withDiagnostic(state, code, error = null, details = null) {
  return freeze({
    ...state,
    diagnostic: freeze({
      code,
      message: typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : null,
      ...(details && typeof details === 'object' ? details : {}),
    }),
  });
}

export function createMainPresentationSessionState() {
  return freeze({
    phase: MAIN_PRESENTATION_PHASES.RESOLVING,
    progressionState: null,
    resuming: false,
    visionRevealedAtMs: 0,
    spentPersisted: false,
    diagnostic: null,
  });
}

function assertPhase(state, allowedPhases, eventType) {
  if (!allowedPhases.includes(state.phase)) {
    throw new Error(
      `MAIN_PRESENTATION_TRANSITION_INVALID:event=${eventType}:phase=${String(state.phase)}`,
    );
  }
}

export function reduceMainPresentationSession(state, event = {}) {
  const current = state || createMainPresentationSessionState();
  const type = typeof event.type === 'string' ? event.type.trim() : '';
  if (!EVENT_SET.has(type)) {
    throw new Error(`MAIN_PRESENTATION_EVENT_INVALID:${String(event.type)}`);
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.RESET) {
    return createMainPresentationSessionState();
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.USE_CURRENT) {
    if (current.phase === MAIN_PRESENTATION_PHASES.SETTLED
      && current.progressionState === 'not_applicable') return current;
    assertPhase(current, [MAIN_PRESENTATION_PHASES.RESOLVING], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.SETTLED,
      progressionState: 'not_applicable',
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.PROGRESSION_RESOLVED) {
    if (current.phase !== MAIN_PRESENTATION_PHASES.RESOLVING) return current;
    const progressionState = event.progressionState;
    if (progressionState === 'spent') {
      return freeze({
        ...current,
        phase: MAIN_PRESENTATION_PHASES.SETTLED,
        progressionState,
        spentPersisted: true,
      });
    }
    if (progressionState !== 'pending' && progressionState !== 'presented') {
      throw new Error(`MAIN_PRESENTATION_PROGRESSION_STATE_INVALID:${String(progressionState)}`);
    }
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
      progressionState,
      resuming: progressionState === 'presented',
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.PROGRESSION_READ_FAILED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.RESOLVING], type);
    return withDiagnostic({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.DEFERRED,
    }, 'progression_read_failed', event.error);
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.BOOT_DEGRADED) {
    if (
      current.phase === MAIN_PRESENTATION_PHASES.DEFERRED
      || current.phase === MAIN_PRESENTATION_PHASES.SETTLED
    ) {
      return current;
    }
    assertPhase(current, [
      MAIN_PRESENTATION_PHASES.RESOLVING,
      MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
      MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
    ], type);
    if (current.phase === MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED) {
      return withDiagnostic(current, 'boot_degraded', event.error);
    }
    return withDiagnostic({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.DEFERRED,
    }, 'boot_degraded', event.error);
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.FIRST_VISION_SCENE_COMMITTED) {
    if (current.phase === MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED) return current;
    assertPhase(current, [MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.PRESENTATION_PERSISTED) {
    if (current.phase === MAIN_PRESENTATION_PHASES.PRESENTING) return current;
    assertPhase(current, [MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED], type);
    if (current.diagnostic?.code === 'boot_degraded') return current;
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.PRESENTING,
      progressionState: 'presented',
      diagnostic: null,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.PRESENTATION_PERSIST_FAILED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED], type);
    return withDiagnostic(current, 'presentation_persist_failed', event.error);
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.FIRST_VISION_SPENT_ELSEWHERE) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED], type);
    if (current.diagnostic?.code === 'boot_degraded') return current;
    // Another tab's monotonic receipt is valid. Retire this exact ideal frame
    // through the same opaque boundary rather than replaying or exposing current.
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.COVERING,
      progressionState: 'spent',
      spentPersisted: true,
      diagnostic: null,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.VISION_REVEALED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.PRESENTING], type);
    const revealedAtMs = normalizeEpochMs(event.atMs);
    if (current.visionRevealedAtMs > 0 || revealedAtMs <= 0) return current;
    return freeze({
      ...current,
      visionRevealedAtMs: revealedAtMs,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.DREAM_DWELL_ELAPSED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.PRESENTING], type);
    if (current.visionRevealedAtMs <= 0) {
      throw new Error('MAIN_PRESENTATION_DWELL_BEFORE_REVEAL');
    }
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.COVERING,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.COVER_OPAQUE) {
    if (current.phase === MAIN_PRESENTATION_PHASES.PREPARING_CURRENT) return current;
    assertPhase(current, [MAIN_PRESENTATION_PHASES.COVERING], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.PREPARING_CURRENT,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.CURRENT_SCENE_COMMITTED) {
    if (current.phase === MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED) return current;
    assertPhase(current, [MAIN_PRESENTATION_PHASES.PREPARING_CURRENT], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.SPENT_PERSISTED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.UNCOVERING,
      progressionState: 'spent',
      spentPersisted: true,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.SPENT_PERSIST_FAILED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED], type);
    const attempts = requirePositiveSafeInteger(
      event.attempts,
      'MAIN_PRESENTATION_SPENT_PERSIST_ATTEMPTS_INVALID',
    );
    return withDiagnostic({
      ...current,
      spentPersisted: false,
    }, 'spent_persist_failed', event.error, {
      attempts,
    });
  }

  if (type === MAIN_PRESENTATION_SESSION_EVENTS.OVERLAY_COMPLETED) {
    assertPhase(current, [MAIN_PRESENTATION_PHASES.UNCOVERING], type);
    return freeze({
      ...current,
      phase: MAIN_PRESENTATION_PHASES.SETTLED,
    });
  }

  return current;
}

export function resolveMainPresentationRenderKind(phase) {
  if ([
    MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
    MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
    MAIN_PRESENTATION_PHASES.PRESENTING,
    MAIN_PRESENTATION_PHASES.COVERING,
  ].includes(phase)) {
    return MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION;
  }
  return MAIN_PRESENTATION_SCENE_KINDS.CURRENT;
}

export function resolveMainPresentationCommittedFatalError(state = null) {
  if (state?.phase !== MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED) return null;
  const diagnosticCode = state?.diagnostic?.code;
  const code = COMMITTED_FATAL_CODE_BY_DIAGNOSTIC[diagnosticCode] || null;
  if (code === null) return null;
  const diagnosticMessage = typeof state?.diagnostic?.message === 'string'
    && state.diagnostic.message.trim()
    ? state.diagnostic.message.trim()
    : diagnosticCode;
  const error = new Error(`${code}:${diagnosticMessage}`);
  error.code = code;
  error.diagnostic = state.diagnostic;
  return error;
}

export function isMainPresentationFirstVisionSession(phase) {
  return ![
    MAIN_PRESENTATION_PHASES.RESOLVING,
    MAIN_PRESENTATION_PHASES.SETTLED,
    MAIN_PRESENTATION_PHASES.DEFERRED,
  ].includes(phase);
}
