import { useCallback, useEffect, useRef } from 'react';

import {
  emitZenMainBootTrace,
} from '@/themes/plugins/zen/runtime/zenMainBootReadinessTrace.js';
import {
  compactDashboardMainFirstFrameMetadata as compactFirstVisualMetadataForTrace,
  compactDashboardMainFirstFrameRuntimeDetails as compactRuntimeDetailsForTrace,
} from '@/apps/dashboard/bootstrap/mainFirstFrameDiagnostics.js';
import {
  ZEN_HOME_FIRST_VISUAL_PARTS,
  ZEN_HOME_FIRST_VISUAL_PHASES,
  ZEN_HOME_FIRST_VISUAL_SOURCES,
  normalizeZenHomeFirstVisualMilestone,
} from '@/themes/plugins/zen/runtime/zenHomeFirstVisualReadinessContract.js';
import {
  ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS,
  createZenHomeFirstVisualCoordinatorState,
  reduceZenHomeFirstVisualCoordinatorState,
} from './zenHomeFirstVisualCoordinatorState.js';

export const ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS = 3200;
export const ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS = 15000;

const nowMainTabMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const roundMainTabMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Number(parsed.toFixed(1)));
};

const areRequiredFirstVisualPartsReady = (parts = {}) => (
  parts[ZEN_HOME_FIRST_VISUAL_PARTS.POND] === true
  && parts[ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI] === true
  && parts.firstViewport === true
);

const resolvePartReadyPhaseReason = (part) => (
  part === ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT
    ? 'first_viewport_ready'
    : `${part}_first_frame_ready`
);

const resolvePartStateKey = (part) => (
  part === ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT ? 'firstViewport' : part
);

export function useZenHomeFirstVisualCoordinator({
  isActive,
  mainWidgetThemeId,
  requiresCompositeFirstFrameReady,
  readiness,
  traceContext,
  onMainTabFirstFrameReady = null,
  onMainTabFirstFrameFailed = null,
} = {}) {
  const stateRef = useRef(createZenHomeFirstVisualCoordinatorState({
    requiresCompositeFirstFrameReady,
  }));

  const emitPhaseTransition = useCallback((previousPhase, nextPhase, reason, metadata = null) => {
    if (previousPhase === nextPhase) return;
    emitZenMainBootTrace('main_tab:first_visual_phase', traceContext, {
      from: previousPhase,
      to: nextPhase,
      reason,
      metadata: compactFirstVisualMetadataForTrace(metadata),
    });
  }, [traceContext]);

  const emitProgress = useCallback((label, phase, metadata = null) => {
    emitZenMainBootTrace('main_tab:first_frame_progress', traceContext, {
      label,
      phase,
      metadata: compactFirstVisualMetadataForTrace(metadata),
    });
  }, [traceContext]);

  const reduceCoordinatorState = useCallback((event, {
    phaseReason = null,
    phaseMetadata = null,
    progressMetadata = null,
    emitProgressEvent = false,
  } = {}) => {
    const previous = stateRef.current || createZenHomeFirstVisualCoordinatorState({
      requiresCompositeFirstFrameReady,
    });
    const next = reduceZenHomeFirstVisualCoordinatorState(previous, event);
    stateRef.current = next;
    if (
      emitProgressEvent
      && (
        previous.progress?.lastProgressAtMs !== next.progress?.lastProgressAtMs
        || previous.progress?.lastProgressLabel !== next.progress?.lastProgressLabel
      )
    ) {
      emitProgress(
        next.progress?.lastProgressLabel || 'unknown',
        next.phase || ZEN_HOME_FIRST_VISUAL_PHASES.IDLE,
        progressMetadata,
      );
    }
    emitPhaseTransition(
      previous.phase || ZEN_HOME_FIRST_VISUAL_PHASES.IDLE,
      next.phase || ZEN_HOME_FIRST_VISUAL_PHASES.IDLE,
      phaseReason || event?.type || 'state_transition',
      phaseMetadata,
    );
    return { previous, next };
  }, [
    emitPhaseTransition,
    emitProgress,
    requiresCompositeFirstFrameReady,
  ]);

  useEffect(() => {
    stateRef.current = reduceZenHomeFirstVisualCoordinatorState(stateRef.current, {
      type: ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.RESET,
      requiresCompositeFirstFrameReady,
      progressLabel: 'gate_reset',
    });
    emitZenMainBootTrace('main_tab:first_frame_gate_reset', traceContext, {
      mainWidgetThemeId,
      requiresCompositeFirstFrameReady,
    });
  }, [mainWidgetThemeId, requiresCompositeFirstFrameReady, traceContext]);

  useEffect(() => {
    emitZenMainBootTrace('main_tab:active_state', traceContext, {
      isActive,
      mainWidgetThemeId,
      requiresCompositeFirstFrameReady,
    });
  }, [isActive, mainWidgetThemeId, requiresCompositeFirstFrameReady, traceContext]);

  const notifyMainReady = useCallback((metadata = null) => {
    if (!isActive) return;
    if (typeof onMainTabFirstFrameReady !== 'function') return;
    emitZenMainBootTrace('main_tab:ready_notify', traceContext, {
      metadata: compactFirstVisualMetadataForTrace(metadata),
    });
    onMainTabFirstFrameReady(metadata || { source: ZEN_HOME_FIRST_VISUAL_SOURCES.HOME_READY });
  }, [isActive, onMainTabFirstFrameReady, traceContext]);

  const notifyMainFailed = useCallback((metadata = null) => {
    if (!isActive) return;
    emitZenMainBootTrace('main_tab:first_visual_failed', traceContext, {
      metadata: compactFirstVisualMetadataForTrace(metadata),
    });
    if (typeof onMainTabFirstFrameFailed !== 'function') return;
    onMainTabFirstFrameFailed(metadata || {
      source: ZEN_HOME_FIRST_VISUAL_SOURCES.FIRST_VISUAL_FAILED,
    });
  }, [isActive, onMainTabFirstFrameFailed, traceContext]);

  const handleFirstVisualMilestone = useCallback((milestoneEvent = null, metadata = null) => {
    const milestone = normalizeZenHomeFirstVisualMilestone(milestoneEvent);
    if (!milestone) return;
    const milestoneMetadata = milestoneEvent && typeof milestoneEvent === 'object'
      ? {
        ...milestoneEvent,
        ...(metadata && typeof metadata === 'object' ? metadata : {}),
      }
      : metadata;
    const { previous, next } = reduceCoordinatorState({
      type: ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.MILESTONE,
      milestoneEvent,
      milestone,
      nowMs: nowMainTabMs(),
    }, {
      phaseReason: milestone,
      phaseMetadata: milestoneMetadata,
      progressMetadata: milestoneMetadata,
      emitProgressEvent: true,
    });
    if (previous === next) return;
    emitZenMainBootTrace('main_tab:first_visual_milestone', traceContext, {
      milestone,
      phase: next.phase || ZEN_HOME_FIRST_VISUAL_PHASES.IDLE,
      metadata: compactFirstVisualMetadataForTrace(milestoneMetadata),
    });
    if (next.failureNotified === true && previous.failureNotified !== true) {
      notifyMainFailed({
        source: ZEN_HOME_FIRST_VISUAL_SOURCES.FIRST_VISUAL_FAILED,
        themeId: mainWidgetThemeId,
        milestone,
        failureScope: 'zen_home_first_visual',
        bootImpact: 'degraded',
        metadata: milestoneMetadata,
      });
    }
  }, [
    mainWidgetThemeId,
    notifyMainFailed,
    reduceCoordinatorState,
    traceContext,
  ]);

  const markFirstFramePartReady = useCallback((part, metadata = null) => {
    const current = stateRef.current || createZenHomeFirstVisualCoordinatorState({
      requiresCompositeFirstFrameReady,
    });
    const { previous, next } = reduceCoordinatorState({
      type: ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.PART_READY,
      part,
      metadata,
      requiresCompositeFirstFrameReady,
      nowMs: nowMainTabMs(),
    }, {
      phaseReason: resolvePartReadyPhaseReason(part),
      phaseMetadata: metadata,
      progressMetadata: metadata,
      emitProgressEvent: true,
    });
    if (previous === next) return;
    emitZenMainBootTrace('main_tab:first_frame_part_ready', traceContext, {
      part,
      alreadyReady: {
        pond: current.parts?.pond === true,
        bonsai: current.parts?.bonsai === true,
        firstViewport: current.parts?.firstViewport === true,
      },
      duplicatePartReady: current.parts?.[resolvePartStateKey(part)] === true,
      metadata: part === ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT
        ? compactFirstVisualMetadataForTrace(metadata)
        : compactRuntimeDetailsForTrace(metadata),
    });
    if (next.readyNotified !== true || previous.readyNotified === true) {
      return;
    }

    if (!requiresCompositeFirstFrameReady) {
      notifyMainReady({ source: ZEN_HOME_FIRST_VISUAL_SOURCES.HOME_READY, ...metadata });
      return;
    }
    notifyMainReady({
      source: ZEN_HOME_FIRST_VISUAL_SOURCES.COMPOSITE_FIRST_FRAME,
      themeId: mainWidgetThemeId,
      pondRuntimeReady: true,
      bonsaiRuntimeReady: true,
      firstViewportReady: true,
      sceneCommitKey: next.correlationToken?.sceneCommitKey || null,
      inputSignature: next.correlationToken?.inputSignature || null,
      bonsaiMaterializationKey: next.correlationToken?.bonsaiMaterializationKey || null,
      pondRuntimeDetails: next.parts?.pondMetadata || null,
      bonsaiRuntimeDetails: next.parts?.bonsaiMetadata || null,
      firstViewportDetails: next.parts?.firstViewportMetadata || null,
    });
  }, [
    mainWidgetThemeId,
    notifyMainReady,
    reduceCoordinatorState,
    requiresCompositeFirstFrameReady,
    traceContext,
  ]);

  const handlePondFirstFrameReady = useCallback((metadata = null) => {
    markFirstFramePartReady(ZEN_HOME_FIRST_VISUAL_PARTS.POND, metadata);
  }, [markFirstFramePartReady]);

  const handleBonsaiFirstFrameReady = useCallback((metadata = null) => {
    markFirstFramePartReady(ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI, metadata);
  }, [markFirstFramePartReady]);

  const handleFirstViewportReady = useCallback((metadata = null) => {
    markFirstFramePartReady(ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT, metadata);
  }, [markFirstFramePartReady]);

  useEffect(() => {
    if (!isActive) return;
    if (readiness?.phase !== 'error') return;
    if (stateRef.current?.readyNotified === true) return;
    if (stateRef.current?.failureNotified === true) return;
    const error = readiness?.error;
    const { previous, next } = reduceCoordinatorState({
      type: ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.READINESS_FAILED,
      nowMs: nowMainTabMs(),
      label: 'main_tab_readiness_failed',
    }, {
      phaseReason: 'main_tab_readiness_failed',
      phaseMetadata: {
        code: error?.code || null,
        message: error?.message || null,
      },
      progressMetadata: error,
      emitProgressEvent: true,
    });
    if (next.failureNotified !== true || previous.failureNotified === true) return;
    notifyMainFailed({
      source: ZEN_HOME_FIRST_VISUAL_SOURCES.HOME_READINESS_FAILED,
      themeId: mainWidgetThemeId,
      failureScope: 'main_tab_readiness',
      bootImpact: 'degraded',
      readinessKey: readiness?.readyKey || null,
      error: {
        code: error?.code || null,
        message: error?.message || 'Main tab readiness failed.',
      },
    });
  }, [
    isActive,
    mainWidgetThemeId,
    notifyMainFailed,
    readiness?.error,
    readiness?.phase,
    readiness?.readyKey,
    reduceCoordinatorState,
  ]);

  useEffect(() => {
    if (!isActive) return undefined;
    if (requiresCompositeFirstFrameReady) return undefined;
    if (readiness?.phase !== 'ready' || !readiness?.ready) return undefined;
    if (stateRef.current?.readyNotified === true) return undefined;
    if (stateRef.current?.failureNotified === true) return undefined;
    if (typeof onMainTabFirstFrameReady !== 'function') return undefined;

    let canceled = false;
    let firstFrameId = 0;
    let commitFrameId = 0;
    let timerId = 0;
    const commitReady = () => {
      if (canceled) return;
      if (stateRef.current?.readyNotified === true) return;
      if (stateRef.current?.failureNotified === true) return;
      markFirstFramePartReady(ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT, {
        firstViewportReady: true,
        readinessKey: readiness?.readyKey || null,
        renderCommit: 'post_paint',
      });
    };

    if (typeof window.requestAnimationFrame === 'function') {
      firstFrameId = window.requestAnimationFrame(() => {
        firstFrameId = 0;
        commitFrameId = window.requestAnimationFrame(() => {
          commitFrameId = 0;
          commitReady();
        });
      });
    } else {
      timerId = window.setTimeout(commitReady, 32);
    }

    return () => {
      canceled = true;
      if (firstFrameId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(firstFrameId);
      }
      if (commitFrameId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(commitFrameId);
      }
      if (timerId) window.clearTimeout(timerId);
    };
  }, [
    isActive,
    markFirstFramePartReady,
    onMainTabFirstFrameReady,
    readiness?.phase,
    readiness?.ready,
    readiness?.readyKey,
    requiresCompositeFirstFrameReady,
  ]);

  useEffect(() => {
    if (!isActive) return undefined;
    if (!requiresCompositeFirstFrameReady) return undefined;
    if (readiness?.phase !== 'ready' || !readiness?.ready) return undefined;
    if (stateRef.current?.readyNotified === true) return undefined;
    if (stateRef.current?.failureNotified === true) return undefined;
    if (typeof onMainTabFirstFrameReady !== 'function') return undefined;

    const startedAtMs = nowMainTabMs();
    emitZenMainBootTrace('main_tab:first_frame_wait_start', traceContext, {
      mainWidgetThemeId,
      softBudgetMs: ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS,
      progressWatchdogMs: ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS,
    });
    reduceCoordinatorState({
      type: ZEN_HOME_FIRST_VISUAL_COORDINATOR_EVENTS.WAIT_START,
      nowMs: startedAtMs,
      label: 'main_tab_readiness_ready',
    }, {
      phaseReason: 'main_tab_readiness_ready',
      phaseMetadata: {
        mainWidgetThemeId,
      },
    });

    const buildWaitDetails = () => {
      const currentState = stateRef.current || createZenHomeFirstVisualCoordinatorState({
        requiresCompositeFirstFrameReady,
      });
      const currentParts = currentState.parts || {};
      const progress = currentState.progress || {};
      const nowMs = nowMainTabMs();
      return {
        mainWidgetThemeId,
        pondRuntimeReady: currentParts.pond === true,
        bonsaiRuntimeReady: currentParts.bonsai === true,
        firstViewportReady: currentParts.firstViewport === true,
        sceneCommitKey: currentState.correlationToken?.sceneCommitKey || null,
        inputSignature: currentState.correlationToken?.inputSignature || null,
        bonsaiMaterializationKey:
          currentState.correlationToken?.bonsaiMaterializationKey || null,
        pondRuntimeDetails: compactRuntimeDetailsForTrace(currentParts.pondMetadata),
        bonsaiRuntimeDetails: compactRuntimeDetailsForTrace(currentParts.bonsaiMetadata),
        firstViewportDetails: compactFirstVisualMetadataForTrace(currentParts.firstViewportMetadata),
        elapsedMs: roundMainTabMs(nowMs - startedAtMs),
        sinceLastProgressMs: roundMainTabMs(nowMs - (Number(progress.lastProgressAtMs) || startedAtMs)),
        lastProgressLabel: progress.lastProgressLabel || 'unknown',
      };
    };

    const softBudgetId = window.setTimeout(() => {
      const currentState = stateRef.current || {};
      if (currentState.readyNotified === true) return;
      if (currentState.failureNotified === true) return;
      const currentParts = currentState.parts || {};
      if (areRequiredFirstVisualPartsReady(currentParts)) return;

      emitZenMainBootTrace('main_tab:first_frame_soft_budget_exceeded', traceContext, {
        ...buildWaitDetails(),
        softBudgetMs: ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS,
      });
    }, ZEN_MAIN_FIRST_FRAME_SOFT_BUDGET_MS);

    let progressWatchdogId = window.setInterval(() => {
      const currentState = stateRef.current || {};
      if (currentState.readyNotified === true) {
        window.clearInterval(progressWatchdogId);
        progressWatchdogId = 0;
        return;
      }
      if (currentState.failureNotified === true) {
        window.clearInterval(progressWatchdogId);
        progressWatchdogId = 0;
        return;
      }
      const currentParts = currentState.parts || {};
      if (areRequiredFirstVisualPartsReady(currentParts)) {
        window.clearInterval(progressWatchdogId);
        progressWatchdogId = 0;
        return;
      }

      emitZenMainBootTrace('main_tab:first_frame_progress_watchdog', traceContext, {
        ...buildWaitDetails(),
        progressWatchdogMs: ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS,
      });
    }, ZEN_MAIN_FIRST_FRAME_PROGRESS_WATCHDOG_MS);

    return () => {
      window.clearTimeout(softBudgetId);
      if (progressWatchdogId) {
        window.clearInterval(progressWatchdogId);
      }
    };
  }, [
    isActive,
    mainWidgetThemeId,
    onMainTabFirstFrameReady,
    readiness?.phase,
    readiness?.ready,
    reduceCoordinatorState,
    requiresCompositeFirstFrameReady,
    traceContext,
  ]);

  return {
    shouldAcceptPondFirstFrame: (
      stateRef.current?.readyNotified !== true
      && stateRef.current?.failureNotified !== true
      && isActive
    ),
    shouldAcceptBonsaiFirstFrame: (
      stateRef.current?.readyNotified !== true
      && stateRef.current?.failureNotified !== true
      && isActive
      && requiresCompositeFirstFrameReady
    ),
    shouldAcceptFirstViewportReady: (
      stateRef.current?.readyNotified !== true
      && stateRef.current?.failureNotified !== true
      && isActive
      && requiresCompositeFirstFrameReady
    ),
    onFirstVisualMilestone: handleFirstVisualMilestone,
    onPondFirstFrameReady: handlePondFirstFrameReady,
    onBonsaiFirstFrameReady: handleBonsaiFirstFrameReady,
    onFirstViewportReady: handleFirstViewportReady,
  };
}

export default useZenHomeFirstVisualCoordinator;
