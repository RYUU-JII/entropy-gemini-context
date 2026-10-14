import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import {
  PROGRESSION_FIRST_VISION_STATES,
  resolveFirstVisionDreamDwellMs,
} from '../../../domains/progression/index.js';
import {
  THEME_IDS,
  normalizeThemeId,
} from '../../../themes/core/ids.js';
import { emitZenTrace } from '@zen-trace';
import {
  readFirstVisionProgressionSnapshot,
  recordFirstVisionPresented,
  recordFirstVisionSpent,
} from '../progression/firstVisionProgressionClient.js';
import {
  persistFirstVisionPresentedForProjection,
  persistFirstVisionSpentForProjection,
  resolveFirstVisionPresentationProjection,
} from '@first-vision-development-projection';
import {
  MAIN_PRESENTATION_PHASES,
  MAIN_PRESENTATION_SCENE_KINDS,
  buildMainPresentationDecision,
  createMainPresentationSession,
} from './mainPresentationDecision.js';
import {
  MAIN_PRESENTATION_SESSION_EVENTS,
  createMainPresentationSessionState,
  isMainPresentationFirstVisionSession,
  reduceMainPresentationSession,
  resolveMainPresentationCommittedFatalError,
  resolveMainPresentationRenderKind,
} from './mainPresentationSessionState.js';
import { createActivePresentationClock } from './activePresentationClock.js';
import { usePresentationSessionLifetime } from './usePresentationSessionLifetime.js';

const UNSTARTED_BOOT_ID = 'dashboard_boot:unstarted';

function resolveBootId(boot = null) {
  const startedAt = Number(boot?.startedAt);
  if (Number.isFinite(startedAt) && startedAt > 0) {
    return `dashboard_boot:${Math.floor(startedAt)}`;
  }
  return UNSTARTED_BOOT_ID;
}

function buildSceneSessionId({ bootId, startedAtEpochMs, generation }) {
  return `${bootId}:main_presentation:${startedAtEpochMs}:${generation}`;
}

function createOwnedSession(lifetime) {
  return { lifetime, state: createMainPresentationSessionState() };
}

function reduceOwnedSession(current, event) {
  if (event.type === MAIN_PRESENTATION_SESSION_EVENTS.RESET) return createOwnedSession(event.lifetime);
  if (current.lifetime !== event.lifetime) return current;
  return { lifetime: current.lifetime, state: reduceMainPresentationSession(current.state, event) };
}

function isBootDegraded(boot) {
  return boot?.degraded === true
    || boot?.forcedVisualRelease === true
    || boot?.themeShellDegraded === true
    || boot?.mainTabFirstFrameDegraded === true;
}

function isBootSceneRevealReady(boot) {
  return boot?.dismissible === true
    && boot?.mainTabFirstFrameReady === true
    && !isBootDegraded(boot);
}

function describeError(error) {
  return error instanceof Error ? error : new Error(String(error || 'UNKNOWN_ERROR'));
}

export const MAIN_PRESENTATION_SPENT_PERSIST_RETRY_DELAYS_MS = Object.freeze([
  250,
  750,
]);
export const MAIN_PRESENTATION_SPENT_PERSIST_MAX_ATTEMPTS = (
  MAIN_PRESENTATION_SPENT_PERSIST_RETRY_DELAYS_MS.length + 1
);

function requireProgressionCommandState(snapshot, expectedState, commandName) {
  const actualState = snapshot?.state;
  if (actualState === expectedState) return snapshot;

  const code = `FIRST_VISION_${commandName}_ACK_STATE_MISMATCH`;
  const error = new Error(`${code}:${String(actualState ?? 'missing')}`);
  error.code = code;
  error.expectedState = expectedState;
  error.actualState = actualState ?? null;
  throw error;
}

export function useMainPresentationScene({
  themeId = '',
  boot = null,
  presentationActive,
} = {}) {
  if (typeof presentationActive !== 'boolean') throw new Error('MAIN_PRESENTATION_ADMISSION_REQUIRED');
  const bootId = resolveBootId(boot);
  const normalizedThemeId = normalizeThemeId(themeId);
  const { lifetime, isCurrent } = usePresentationSessionLifetime(`${bootId}:${normalizedThemeId}`);
  const sessionRef = useRef(null);
  if (!sessionRef.current || sessionRef.current.lifetime !== lifetime) {
    const startedAtEpochMs = Date.now();
    sessionRef.current = {
      lifetime,
      session: createMainPresentationSession({
        sceneSessionId: buildSceneSessionId({ bootId, startedAtEpochMs, generation: lifetime.generation }),
        startedAtEpochMs,
      }),
    };
  }

  const [ownedSession, dispatchOwned] = useReducer(reduceOwnedSession, lifetime, createOwnedSession);
  const initialState = useMemo(createMainPresentationSessionState, [lifetime]);
  const state = ownedSession.lifetime === lifetime ? ownedSession.state : initialState;
  const dispatch = useCallback((event) => {
    if (isCurrent(lifetime)) dispatchOwned({ ...event, lifetime });
  }, [isCurrent, lifetime]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const resolutionKeyRef = useRef('');
  const progressionPresentationProjectionRef = useRef(null);
  const presentationWriteStartedRef = useRef(false);
  const spentWriteStartedRef = useRef(false);
  const dwellClockRef = useRef(null);
  if (dwellClockRef.current?.lifetime !== lifetime) {
    dwellClockRef.current = { lifetime, clock: createActivePresentationClock(resolveFirstVisionDreamDwellMs()) };
  }
  const presentationActiveRef = useRef(presentationActive);
  presentationActiveRef.current = presentationActive;

  useEffect(() => {
    const resolutionKey = `${sessionRef.current.session.sceneSessionId}:${normalizedThemeId}`;
    if (resolutionKeyRef.current !== resolutionKey) {
      resolutionKeyRef.current = resolutionKey;
      progressionPresentationProjectionRef.current = null;
      presentationWriteStartedRef.current = false;
      spentWriteStartedRef.current = false;
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.RESET });
    }

    if (normalizedThemeId !== THEME_IDS.ZEN) {
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.USE_CURRENT });
      return undefined;
    }

    // The unstarted projection keeps presentation unresolved. Read only for the
    // actual boot session, without waiting for its later readiness gates.
    if (bootId === UNSTARTED_BOOT_ID) return undefined;

    let current = true;
    emitZenTrace('main_presentation:progression_read_start', { bootId });
    void readFirstVisionProgressionSnapshot().then((snapshot) => {
      if (!current || !isCurrent(lifetime)) return;
      const presentationProjection = resolveFirstVisionPresentationProjection(snapshot);
      progressionPresentationProjectionRef.current = presentationProjection;
      const progressionState = presentationProjection.effectiveState;
      emitZenTrace('main_presentation:progression_read_done', {
        bootId,
        progressionState,
        canonicalProgressionState: presentationProjection.canonicalSnapshot.state,
        previewActive: presentationProjection.previewActive,
      });
      dispatch({
        type: MAIN_PRESENTATION_SESSION_EVENTS.PROGRESSION_RESOLVED,
        progressionState,
      });
    }).catch((error) => {
      if (!current || !isCurrent(lifetime)) return;
      emitZenTrace('main_presentation:progression_read_failed', { error });
      dispatch({
        type: MAIN_PRESENTATION_SESSION_EVENTS.PROGRESSION_READ_FAILED,
        error: describeError(error),
      });
    });
    return () => {
      current = false;
    };
  }, [bootId, dispatch, isCurrent, lifetime, normalizedThemeId]);

  useEffect(() => {
    if (!isBootDegraded(boot)) return;
    if (![
      MAIN_PRESENTATION_PHASES.RESOLVING,
      MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
      MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
    ].includes(state.phase)) return;
    dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.BOOT_DEGRADED });
  }, [boot, state.phase]);

  useEffect(() => {
    if (state.phase !== MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED) return;
    if (!isBootSceneRevealReady(boot)) return;
    if (state.progressionState === PROGRESSION_FIRST_VISION_STATES.PRESENTED) {
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.PRESENTATION_PERSISTED });
      return;
    }
    if (presentationWriteStartedRef.current) return;
    presentationWriteStartedRef.current = true;
    emitZenTrace('main_presentation:presented_persist_start', { bootId });
    void persistFirstVisionPresentedForProjection({
      projection: progressionPresentationProjectionRef.current,
      recordCanonical: recordFirstVisionPresented,
    }).then((snapshot) => {
      if (!isCurrent(lifetime)) return;
      if (snapshot?.state === PROGRESSION_FIRST_VISION_STATES.SPENT) {
        emitZenTrace('main_presentation:spent_in_another_session', { bootId });
        dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.FIRST_VISION_SPENT_ELSEWHERE });
        return;
      }
      requireProgressionCommandState(
        snapshot,
        PROGRESSION_FIRST_VISION_STATES.PRESENTED,
        'PRESENTED',
      );
      emitZenTrace('main_presentation:presented_persist_done', { bootId });
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.PRESENTATION_PERSISTED });
    }).catch((error) => {
      if (!isCurrent(lifetime)) return;
      emitZenTrace('main_presentation:presented_persist_failed', { error });
      dispatch({
        type: MAIN_PRESENTATION_SESSION_EVENTS.PRESENTATION_PERSIST_FAILED,
        error: describeError(error),
      });
    });
  }, [boot, bootId, dispatch, isCurrent, lifetime, state.phase, state.progressionState]);

  useEffect(() => {
    if (state.phase !== MAIN_PRESENTATION_PHASES.PRESENTING) return;
    if (presentationActive !== true) return;
    if (boot?.shellDismissed !== true || state.visionRevealedAtMs > 0) return;
    dispatch({
      type: MAIN_PRESENTATION_SESSION_EVENTS.VISION_REVEALED,
      atMs: Date.now(),
    });
  }, [boot?.shellDismissed, dispatch, presentationActive, state.phase, state.visionRevealedAtMs]);

  useEffect(() => {
    if (
      state.phase !== MAIN_PRESENTATION_PHASES.PRESENTING
      || state.visionRevealedAtMs <= 0
      || presentationActive !== true
    ) {
      return undefined;
    }
    const clock = dwellClockRef.current.clock;
    clock.resume(performance.now());
    const remainingMs = clock.remaining(performance.now());
    const timerId = window.setTimeout(() => {
      if (!isCurrent(lifetime) || presentationActiveRef.current !== true) return;
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.DREAM_DWELL_ELAPSED });
    }, remainingMs);
    emitZenTrace('main_presentation:dream_dwell_scheduled', {
      dreamDwellMs: resolveFirstVisionDreamDwellMs(),
      remainingMs,
      resuming: state.resuming,
    });
    return () => {
      window.clearTimeout(timerId);
      clock.pause(performance.now());
    };
  }, [dispatch, isCurrent, lifetime, presentationActive, state.phase, state.resuming, state.visionRevealedAtMs]);

  useEffect(() => {
    if (state.phase !== MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED) return undefined;
    if (state.spentPersisted === true) {
      dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.SPENT_PERSISTED });
      return undefined;
    }
    if (spentWriteStartedRef.current) return undefined;
    spentWriteStartedRef.current = true;
    let active = true;
    let retryTimerId = null;

    const persistSpent = (attempt) => {
      if (!active || !isCurrent(lifetime)) return;
      emitZenTrace('main_presentation:spent_persist_start', {
        bootId,
        attempt,
        maxAttempts: MAIN_PRESENTATION_SPENT_PERSIST_MAX_ATTEMPTS,
      });
      void persistFirstVisionSpentForProjection({
        projection: progressionPresentationProjectionRef.current,
        recordCanonical: recordFirstVisionSpent,
      }).then((snapshot) => {
        requireProgressionCommandState(
          snapshot,
          PROGRESSION_FIRST_VISION_STATES.SPENT,
          'SPENT',
        );
        if (!active || !isCurrent(lifetime)) return;
        emitZenTrace('main_presentation:spent_persist_done', { bootId, attempt });
        dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.SPENT_PERSISTED });
      }).catch((error) => {
        if (!active || !isCurrent(lifetime)) return;
        const failure = describeError(error);
        if (attempt >= MAIN_PRESENTATION_SPENT_PERSIST_MAX_ATTEMPTS) {
          emitZenTrace('main_presentation:spent_persist_failed', {
            error: failure,
            attempt,
            maxAttempts: MAIN_PRESENTATION_SPENT_PERSIST_MAX_ATTEMPTS,
          });
          dispatch({
            type: MAIN_PRESENTATION_SESSION_EVENTS.SPENT_PERSIST_FAILED,
            error: failure,
            attempts: attempt,
          });
          return;
        }

        const retryDelayMs = MAIN_PRESENTATION_SPENT_PERSIST_RETRY_DELAYS_MS[attempt - 1];
        emitZenTrace('main_presentation:spent_persist_retry_scheduled', {
          error: failure,
          attempt,
          nextAttempt: attempt + 1,
          retryDelayMs,
        });
        retryTimerId = window.setTimeout(() => {
          retryTimerId = null;
          persistSpent(attempt + 1);
        }, retryDelayMs);
      });
    };

    persistSpent(1);
    return () => {
      active = false;
      spentWriteStartedRef.current = false;
      if (retryTimerId !== null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [bootId, dispatch, isCurrent, lifetime, state.phase, state.spentPersisted]);

  const kind = isMainPresentationFirstVisionSession(state.phase)
    ? MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION
    : MAIN_PRESENTATION_SCENE_KINDS.CURRENT;
  const renderKind = resolveMainPresentationRenderKind(state.phase);
  const decision = useMemo(() => buildMainPresentationDecision({
    sceneSession: sessionRef.current.session,
    kind,
    renderKind,
    phase: state.phase,
    themeId,
    bootId,
    reason: state.diagnostic?.code
      || (state.resuming ? 'resume_incomplete_first_vision' : 'main_presentation_session'),
    diagnostics: state.diagnostic
      ? { degraded: true, reason: state.diagnostic.code }
      : null,
  }), [bootId, kind, renderKind, state.diagnostic, state.phase, state.resuming, themeId]);
  const fatalError = useMemo(
    () => resolveMainPresentationCommittedFatalError(state),
    [state],
  );

  const reportSceneCommitted = useCallback((metadata = null) => {
    if (!isCurrent(lifetime)) return false;
    const expectedKey = decision.renderTarget.sceneCommitKey;
    const actualKey = typeof metadata?.sceneCommitKey === 'string'
      ? metadata.sceneCommitKey.trim()
      : '';
    if (actualKey !== expectedKey) {
      emitZenTrace('main_presentation:stale_scene_commit_ignored', {
        expectedKey,
        actualKey: actualKey || null,
        phase: stateRef.current.phase,
      });
      return false;
    }
    const phase = stateRef.current.phase;
    const eventType = decision.renderTarget.kind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION
      ? MAIN_PRESENTATION_SESSION_EVENTS.FIRST_VISION_SCENE_COMMITTED
      : MAIN_PRESENTATION_SESSION_EVENTS.CURRENT_SCENE_COMMITTED;
    if (
      (eventType === MAIN_PRESENTATION_SESSION_EVENTS.FIRST_VISION_SCENE_COMMITTED
        && ![
          MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
          MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
        ].includes(phase))
      || (eventType === MAIN_PRESENTATION_SESSION_EVENTS.CURRENT_SCENE_COMMITTED
        && ![
          MAIN_PRESENTATION_PHASES.PREPARING_CURRENT,
          MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED,
        ].includes(phase))
    ) {
      emitZenTrace('main_presentation:out_of_phase_scene_commit_ignored', {
        expectedKey,
        phase,
      });
      return false;
    }
    dispatch({ type: eventType });
    return true;
  }, [decision.renderTarget.kind, decision.renderTarget.sceneCommitKey, dispatch, isCurrent, lifetime]);

  const reportCoverOpaque = useCallback(() => {
    if (!isCurrent(lifetime)) return false;
    if (stateRef.current.phase !== MAIN_PRESENTATION_PHASES.COVERING) return false;
    dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.COVER_OPAQUE });
    return true;
  }, [dispatch, isCurrent, lifetime]);

  const handleOverlayComplete = useCallback(() => {
    if (!isCurrent(lifetime)) return false;
    if (stateRef.current.phase !== MAIN_PRESENTATION_PHASES.UNCOVERING) return false;
    dispatch({ type: MAIN_PRESENTATION_SESSION_EVENTS.OVERLAY_COMPLETED });
    return true;
  }, [dispatch, isCurrent, lifetime]);

  return useMemo(() => Object.freeze({
    decision,
    fatalError,
    sceneSession: sessionRef.current.session,
    resolved: state.phase !== MAIN_PRESENTATION_PHASES.RESOLVING,
    state,
    reportSceneCommitted,
    reportCoverOpaque,
    handleOverlayComplete,
  }), [
    decision,
    fatalError,
    handleOverlayComplete,
    reportCoverOpaque,
    reportSceneCommitted,
    state,
  ]);
}

export default useMainPresentationScene;
