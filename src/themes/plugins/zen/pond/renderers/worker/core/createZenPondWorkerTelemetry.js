import { normalizeZenPondFrameMetrics } from '../../../contracts/zenPondFrameMetrics.js';

import {
  ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED,
  buildZenPondRuntimeHealthSnapshot,
  recordZenPondRuntimeHealthEvent,
} from './zenPondWorkerRuntimeHealth.js';

import {
  snapshotZenSurfaceDisturbanceTelemetry,
} from '../../../runtime/surface/zenSurfaceDisturbance.js';
import {
  ZEN_POND_WORKER_STARTUP_READINESS_REASON,
} from './zenPondWorkerStartupContract.js';
import {
  createZenRendererWorkJournal,
  ZEN_RENDERER_WORK_JOURNAL_ENABLED,
  ZEN_POND_FRAME_SPIKE_THRESHOLD_MS,
} from '../../../../runtime/worker/zenRendererWorkJournal.js';

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const ZEN_POND_FIRST_FRAME_MIN_RUNTIME_LOOP_FRAMES = 2;

const round = (value, digits = 2, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(digits));
};

const toNonNegativeInt = (value, fallback = 0) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
};

const toPositiveMetric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0.001;
};

const hasEssentialWaterAtmosphere = (waterEffects = null) => (
  isObject(waterEffects)
  && (
    waterEffects.visible === true
    || waterEffects.topShadowVisible === true
    || waterEffects.cloudsVisible === true
    || waterEffects.cloudsOnscreenVisible === true
    || waterEffects.surfaceFieldReady === true
    || toPositiveMetric(waterEffects.surfaceOpticsGate)
    || toPositiveMetric(waterEffects.benthicGate)
    || toPositiveMetric(waterEffects.causticGate)
    || toPositiveMetric(waterEffects.atmosphereGate)
    || waterEffects.komorebiActive === true
    || toPositiveMetric(waterEffects.komorebiAlpha)
    || toPositiveMetric(waterEffects.refractedGuideAlpha)
    || toPositiveMetric(waterEffects.causticPrimaryAlpha)
    || toPositiveMetric(waterEffects.causticSecondaryAlpha)
    || toPositiveMetric(waterEffects.highlightPrimaryAlpha)
    || toPositiveMetric(waterEffects.highlightMicroAlpha)
    || toPositiveMetric(waterEffects.atmosphereAlpha)
    || toPositiveMetric(waterEffects.bottomVisibility)
    || toPositiveMetric(waterEffects.pebbleAlpha)
    || toPositiveMetric(waterEffects.pebbleDetailAlpha)
    || toPositiveMetric(waterEffects.waterBenthicContainerAlpha)
    || toPositiveMetric(waterEffects.frameBottomVisibility)
  )
);

const buildFirstFrameSurfaceReadiness = (frameMetrics = null) => {
  const waterEffects = isObject(frameMetrics?.waterEffects) ? frameMetrics.waterEffects : null;
  const surfaceEffectsRequested = waterEffects?.surfaceEffectsRequested === true;
  const surfaceEffectsEnabled = waterEffects?.surfaceEffectsEnabled === true;
  const surfaceEffectsDeferredForFirstFrame = waterEffects?.surfaceEffectsDeferredForFirstFrame === true;
  const waterLayerRequested = waterEffects?.waterLayerRequested === true;
  const waterLayerApplyReady = (
    waterLayerRequested !== true
    || waterEffects?.waterLayerApplyReady === true
  );
  const waterEffectsReason = typeof waterEffects?.reason === 'string' ? waterEffects.reason : '';
  const waterLayerProbeReady = (
    waterLayerApplyReady === true
    && waterEffects !== null
    && ![
      'water_layer_probe_unavailable',
      'water_layer_apply_pending',
      'water_layer_apply_failed',
      'water_layer_signature_mismatch',
      'water_layer_apply_state_missing',
    ].includes(waterEffectsReason)
  );
  const waterPresentationRequested = (
    surfaceEffectsRequested
    || waterLayerRequested
  );
  const essentialWaterAtmosphereReady = (
    waterPresentationRequested !== true
    || hasEssentialWaterAtmosphere(waterEffects)
  );
  return {
    surfaceEffectsRequested,
    surfaceEffectsEnabled,
    surfaceEffectsDeferredForFirstFrame,
    waterLayerRequested,
    waterLayerApplyReady,
    waterLayerProbeReady,
    essentialWaterAtmosphereReady,
    waterEffectsReason,
    ready: (
      waterPresentationRequested !== true
      || (
        (
          surfaceEffectsRequested !== true
          || surfaceEffectsEnabled === true
        )
        && surfaceEffectsDeferredForFirstFrame !== true
        && waterLayerApplyReady === true
        && waterLayerProbeReady === true
        && essentialWaterAtmosphereReady === true
      )
    ),
  };
};

const buildFirstFrameAckRuntimeHealth = (state) => {
  if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED !== true) return null;
  const snapshot = buildZenPondRuntimeHealthSnapshot(state);
  return {
    initOrder: snapshot.initOrder,
    milestones: snapshot.milestones,
    events: Array.isArray(snapshot.events) ? snapshot.events.slice(-24) : [],
  };
};

export const createZenPondWorkerTelemetry = ({
  messageType = {},
  rendererKind = 'pixi_offscreen',
  supportsWorkerRaf = false,
  postMessage,
} = {}) => {
  const spikeJournals = ZEN_RENDERER_WORK_JOURNAL_ENABLED ? new WeakMap() : null;
  const sceneTickFrameDurations = ZEN_RENDERER_WORK_JOURNAL_ENABLED ? new WeakMap() : null;
  const invitationMembershipSignatures = new WeakMap();
  const resolveSpikeJournal = (state) => {
    let journal = spikeJournals.get(state);
    if (!journal) {
      journal = createZenRendererWorkJournal();
      spikeJournals.set(state, journal);
    }
    return journal;
  };
  const post = (message) => {
    if (typeof postMessage !== 'function' || !isObject(message)) return;
    postMessage(message);
  };

  const deferFirstFrameAck = (
    state,
    timestampMs,
    eventName,
    details = null,
  ) => {
    const readinessReason = eventName === 'first_frame_ack_deferred_runtime_warmup'
      ? ZEN_POND_WORKER_STARTUP_READINESS_REASON.RUNTIME_WARMUP
      : eventName === 'first_frame_ack_deferred_surface_effects'
        ? ZEN_POND_WORKER_STARTUP_READINESS_REASON.SURFACE_EFFECTS
        : eventName === 'first_frame_ack_deferred_fish_roster'
          ? ZEN_POND_WORKER_STARTUP_READINESS_REASON.FISH_ROSTER
          : null;
    if (readinessReason === null) {
      throw new Error(`ZEN_POND_FIRST_FRAME_DEFER_REASON_INVALID:${eventName}`);
    }
    state.firstFrameAckDeferredReason = readinessReason;
    state.firstFrameAckDeferredCount = Math.max(
      0,
      Math.floor(Number(state.firstFrameAckDeferredCount) || 0),
    ) + 1;
    if (state.firstFrameAckDeferredCount <= 5 || state.firstFrameAckDeferredCount % 30 === 0) {
      recordZenPondRuntimeHealthEvent(state, eventName, {
        ...(isObject(details) ? details : {}),
        deferCount: state.firstFrameAckDeferredCount,
      }, {
        timestampMs,
      });
    }
    return false;
  };

  const markFirstFrame = (state, timestampMs, frameMetrics = null, options = null) => {
    if (!state || state.firstFrameAckEmitted) return false;
    const source = typeof options?.source === 'string'
      ? options.source
      : (typeof state.firstFrameLastRenderSource === 'string' ? state.firstFrameLastRenderSource : '');
    const runtimeLoopMounted = state.firstFrameRuntimeLoopMounted === true;
    const runtimeLoopFrameCount = toNonNegativeInt(state.firstFrameRuntimeLoopFrameCount, 0);
    const requiredRuntimeLoopFrameCount = Math.max(
      1,
      toNonNegativeInt(
        state.requiredFirstFrameRuntimeLoopFrameCount,
        ZEN_POND_FIRST_FRAME_MIN_RUNTIME_LOOP_FRAMES,
      ),
    );
    const surfaceReadiness = buildFirstFrameSurfaceReadiness(frameMetrics);
    const fishCount = Array.isArray(state.refs?.fishRef?.current) ? state.refs.fishRef.current.length : 0;
    const requiredFirstFrameFishCount = Math.max(
      0,
      Math.floor(Number(state.requiredFirstFrameFishCount) || 0),
    );
    const visibleFishCount = Math.max(
      0,
      Math.floor(Number(frameMetrics?.koiRender?.visibleFishCount) || 0),
    );
    const sinceInitMs = state.startedAtMs > 0
      ? Math.max(0, round(timestampMs - state.startedAtMs, 2, 0))
      : null;
    const requiredVisibleFishCount = requiredFirstFrameFishCount > 0 ? 1 : 0;
    if (
      runtimeLoopMounted !== true
      || runtimeLoopFrameCount < requiredRuntimeLoopFrameCount
    ) {
      return deferFirstFrameAck(
        state,
        timestampMs,
        'first_frame_ack_deferred_runtime_warmup',
        {
          sinceInitMs: sinceInitMs === null ? -1 : sinceInitMs,
          source,
          runtimeLoopMounted,
          runtimeLoopFrameCount,
          requiredRuntimeLoopFrameCount,
          frameMs: Number(frameMetrics?.frameMs) || 0,
        },
      );
    }
    if (surfaceReadiness.ready !== true) {
      return deferFirstFrameAck(
        state,
        timestampMs,
        'first_frame_ack_deferred_surface_effects',
        {
          sinceInitMs: sinceInitMs === null ? -1 : sinceInitMs,
          source,
          runtimeLoopFrameCount,
          requiredRuntimeLoopFrameCount,
          surfaceEffectsRequested: surfaceReadiness.surfaceEffectsRequested,
          surfaceEffectsEnabled: surfaceReadiness.surfaceEffectsEnabled,
          surfaceEffectsDeferredForFirstFrame: surfaceReadiness.surfaceEffectsDeferredForFirstFrame,
          waterLayerRequested: surfaceReadiness.waterLayerRequested,
          waterLayerApplyReady: surfaceReadiness.waterLayerApplyReady,
          waterLayerProbeReady: surfaceReadiness.waterLayerProbeReady,
          essentialWaterAtmosphereReady: surfaceReadiness.essentialWaterAtmosphereReady,
          waterEffectsReason: surfaceReadiness.waterEffectsReason,
          frameMs: Number(frameMetrics?.frameMs) || 0,
        },
      );
    }
    if (
      requiredFirstFrameFishCount > 0
      && (
        fishCount < requiredFirstFrameFishCount
        || visibleFishCount < requiredVisibleFishCount
      )
    ) {
      return deferFirstFrameAck(
        state,
        timestampMs,
        'first_frame_ack_deferred_fish_roster',
        {
          sinceInitMs: sinceInitMs === null ? -1 : sinceInitMs,
          source,
          runtimeLoopFrameCount,
          requiredRuntimeLoopFrameCount,
          fishCount,
          visibleFishCount,
          requiredFirstFrameFishCount,
          requiredVisibleFishCount,
          fishRosterPayloadCount: Array.isArray(state.fishRosterPayload) ? state.fishRosterPayload.length : 0,
          frameMs: Number(frameMetrics?.frameMs) || 0,
        },
      );
    }
    state.firstFrameAckEmitted = true;
    state.firstFrameAckDeferredReason = null;
    state.firstFrameAtMs = timestampMs;
    recordZenPondRuntimeHealthEvent(state, 'first_frame_ack', {
      sinceInitMs: sinceInitMs === null ? -1 : sinceInitMs,
      source,
      runtimeLoopFrameCount,
      requiredRuntimeLoopFrameCount,
      surfaceEffectsRequested: surfaceReadiness.surfaceEffectsRequested,
      surfaceEffectsEnabled: surfaceReadiness.surfaceEffectsEnabled,
      surfaceEffectsDeferredForFirstFrame: surfaceReadiness.surfaceEffectsDeferredForFirstFrame,
      waterLayerRequested: surfaceReadiness.waterLayerRequested,
      waterLayerApplyReady: surfaceReadiness.waterLayerApplyReady,
      waterLayerProbeReady: surfaceReadiness.waterLayerProbeReady,
      essentialWaterAtmosphereReady: surfaceReadiness.essentialWaterAtmosphereReady,
      waterEffectsReason: surfaceReadiness.waterEffectsReason,
      frameMs: Number(frameMetrics?.frameMs) || 0,
      fishCount,
      visibleFishCount,
      requiredFirstFrameFishCount,
      requiredVisibleFishCount,
    }, {
      timestampMs,
    });
    const runtimeHealth = buildFirstFrameAckRuntimeHealth(state);
    post({
      type: messageType.FIRST_FRAME_ACK,
      rendererKind,
      qualityMode: state.qualityMode,
      sinceInitMs,
      source,
      runtimeLoopMounted,
      runtimeLoopFrameCount,
      requiredRuntimeLoopFrameCount,
      surfaceEffectsRequested: surfaceReadiness.surfaceEffectsRequested,
      surfaceEffectsEnabled: surfaceReadiness.surfaceEffectsEnabled,
      surfaceEffectsDeferredForFirstFrame: surfaceReadiness.surfaceEffectsDeferredForFirstFrame,
      waterLayerRequested: surfaceReadiness.waterLayerRequested,
      waterLayerApplyReady: surfaceReadiness.waterLayerApplyReady,
      waterLayerProbeReady: surfaceReadiness.waterLayerProbeReady,
      essentialWaterAtmosphereReady: surfaceReadiness.essentialWaterAtmosphereReady,
      waterEffectsReason: surfaceReadiness.waterEffectsReason,
      fishCount,
      visibleFishCount,
      requiredFirstFrameFishCount,
      requiredVisibleFishCount,
      firstFrameAckDeferredCount: Math.max(0, Math.floor(Number(state.firstFrameAckDeferredCount) || 0)),
      frameMs: Number(frameMetrics?.frameMs) || null,
      ...(runtimeHealth ? {
        frameMetrics: normalizeZenPondFrameMetrics(frameMetrics),
        initOrder: runtimeHealth.initOrder,
        runtimeHealth,
      } : {}),
    });
    return true;
  };

  const markPresentationSceneFrame = (
    state,
    timestampMs,
    frameMetrics = null,
    options = null,
  ) => {
    const request = isObject(state?.presentationSceneCommitRequest)
      ? state.presentationSceneCommitRequest
      : null;
    if (!request || state.firstFrameAckEmitted !== true) return false;

    const frameCount = toNonNegativeInt(state.metrics?.sampleFrames, 0);
    const appliedAfterFrameCount = toNonNegativeInt(request.appliedAfterFrameCount, 0);
    const frameAtMs = Math.max(0, Number(timestampMs) || 0);
    const appliedAfterFrameAtMs = Math.max(0, Number(request.appliedAfterFrameAtMs) || 0);
    if (
      frameCount <= appliedAfterFrameCount
      || frameAtMs <= appliedAfterFrameAtMs
    ) {
      return false;
    }

    const fishCount = Array.isArray(state.refs?.fishRef?.current)
      ? state.refs.fishRef.current.length
      : 0;
    const expectedFishCount = toNonNegativeInt(request.expectedFishCount, 0);
    const physicalEntityIds = new Set(state.refs.fishRef.current.map(fish => fish.entityId));
    const missingEntries = state.fishRosterPayload.filter(entry => !physicalEntityIds.has(entry.entityId));
    const pendingInvitationCount = missingEntries.filter(entry => entry.entityKind === 'invitation'
      && entry.invitationArrivalMode === 'bank').length;
    const renderedFishCount = Number.isInteger(Number(frameMetrics?.koiRender?.fishCount))
      ? Math.max(0, Number(frameMetrics.koiRender.fishCount))
      : null;
    const visibleFishCount = toNonNegativeInt(
      frameMetrics?.koiRender?.visibleFishCount,
      0,
    );
    const requiredVisibleFishCount = toNonNegativeInt(
      request.requiredVisibleFishCount,
      0,
    );
    if (
      missingEntries.length !== pendingInvitationCount
      || pendingInvitationCount > request.deferredInvitationCount
      || fishCount + pendingInvitationCount !== expectedFishCount
      || (fishCount > 0 && renderedFishCount !== fishCount)
      || visibleFishCount < requiredVisibleFishCount
    ) {
      return false;
    }

    let actualWorkerRosterSignature = '';
    try {
      actualWorkerRosterSignature = JSON.stringify(state.fishRosterPayload) || '';
    } catch (_) {
      return false;
    }
    if (actualWorkerRosterSignature !== request.workerRosterSignature) return false;

    const source = typeof options?.source === 'string' ? options.source : '';
    const ack = Object.freeze({
      presentationSceneCommitKey: request.presentationSceneCommitKey,
      presentationRosterSignature: request.presentationRosterSignature,
      workerRosterSignature: request.workerRosterSignature,
      appliedAfterFrameAtMs,
      appliedAfterFrameCount,
      frameAtMs,
      frameCount,
      fishCount,
      pendingInvitationCount,
      visibleFishCount,
      requiredVisibleFishCount,
      source,
    });
    state.lastPresentationSceneCommitAck = ack;
    state.presentationSceneCommitRequest = null;
    recordZenPondRuntimeHealthEvent(state, 'presentation_scene_frame_ack', {
      presentationSceneCommitKey: ack.presentationSceneCommitKey,
      appliedAfterFrameCount,
      frameCount,
      fishCount,
      visibleFishCount,
      requiredVisibleFishCount,
      source,
    }, {
      timestampMs: frameAtMs,
    });
    post({
      type: messageType.PRESENTATION_SCENE_FRAME_ACK,
      ...ack,
    });
    return true;
  };

  const recordFrameMetrics = (state, frameMetrics, timestampMs) => {
    const entityIds = state.refs.fishRef.current
      .filter(fish => fish.entityKind === 'invitation' && fish.presenceState !== 'retiring')
      .map(fish => fish.entityId).sort();
    const membershipSignature = JSON.stringify(entityIds);
    if (invitationMembershipSignatures.get(state) !== membershipSignature) {
      invitationMembershipSignatures.set(state, membershipSignature);
      post({ type: messageType.RENDERER_EVENT, event: 'invitation_membership_changed', details: { entityIds } });
    }
    // Engine timestamps precede environment preflight and scene.tick. Copy the
    // previous tick's duration before the caller can mutate its metrics object.
    const previousFrameStartedAtMs = ZEN_RENDERER_WORK_JOURNAL_ENABLED
      && Number.isFinite(state.lastFrameAtMs) && state.lastFrameAtMs > 0
      && state.lastFrameAtMs <= timestampMs ? state.lastFrameAtMs : null;
    const previousSceneTickDuration = ZEN_RENDERER_WORK_JOURNAL_ENABLED
      && previousFrameStartedAtMs !== null ? sceneTickFrameDurations.get(state) : null;
    const previousSceneTickFrameMs = ZEN_RENDERER_WORK_JOURNAL_ENABLED && Number.isFinite(previousSceneTickDuration)
      ? previousSceneTickDuration : null;
    const frameIntervalMs = state.lastFrameAtMs > 0
      ? Math.max(0.001, timestampMs - state.lastFrameAtMs)
      : 16.667;
    state.lastFrameAtMs = timestampMs;
    state.lastSceneFrameMetrics = isObject(frameMetrics) ? frameMetrics : null;
    if (ZEN_RENDERER_WORK_JOURNAL_ENABLED) {
      sceneTickFrameDurations.set(state, Number.isFinite(frameMetrics?.frameMs)
        && frameMetrics.frameMs >= 0 ? frameMetrics.frameMs : null);
    }

    state.metrics.sampleFrames += 1;
    state.metrics.totalDtMs += frameIntervalMs;
    state.metrics.maxDtMs = Math.max(state.metrics.maxDtMs, frameIntervalMs);
    if (frameIntervalMs >= 24) state.metrics.over24 += 1;
    if (frameIntervalMs >= 32) state.metrics.over32 += 1;
    if (frameIntervalMs >= 50) state.metrics.over50 += 1;
    if (frameIntervalMs >= 100) state.metrics.over100 += 1;
    if (frameIntervalMs >= 24 || Number(frameMetrics?.frameMs) >= 18) {
      state.lastSceneFrameSpike = {
        atMs: Math.max(0, Math.floor(Number(timestampMs) || 0)),
        frameIntervalMs: round(frameIntervalMs, 4, 0),
        ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? {
          previousFrameStartedAtMs,
          previousSceneTickFrameMs,
        } : {}),
        runtimeParamSyncCount: Math.max(0, Math.floor(Number(state.metrics.runtimeParamSyncCount) || 0)),
        fishRosterSyncCount: Math.max(0, Math.floor(Number(state.metrics.fishRosterSyncCount) || 0)),
        sceneSessionSyncCount: Math.max(0, Math.floor(Number(state.metrics.sceneSessionSyncCount) || 0)),
        mainMetrics: normalizeZenPondFrameMetrics(frameMetrics),
      };
    }
    if (ZEN_RENDERER_WORK_JOURNAL_ENABLED && frameIntervalMs >= ZEN_POND_FRAME_SPIKE_THRESHOLD_MS) {
      resolveSpikeJournal(state).append({
        ...state.lastSceneFrameSpike,
        atMs: timestampMs,
        frameCount: state.metrics.sampleFrames,
        frameMs: round(Number(frameMetrics?.frameMs), 4, 0),
      });
    }
  };

  const buildMetrics = (state) => {
    const count = Math.max(1, state.metrics.sampleFrames);
    return {
      path: 'worker_pixi_scene',
      viewport: {
        width: state.viewportWidth, height: state.viewportHeight, dpr: state.dpr,
        pixelWidth: state.canvas?.width, pixelHeight: state.canvas?.height,
      },
      viewportReflowCount: state.metrics.viewportReflowCount,
      sceneLayout: state.sceneLayout,
      rendererKind,
      qualityMode: state.qualityMode,
      supportsWorkerRaf,
      sampleFrames: state.metrics.sampleFrames,
      totalDtMs: Number(state.metrics.totalDtMs.toFixed(2)),
      avgDtMs: Number((state.metrics.totalDtMs / count).toFixed(2)),
      maxDtMs: Number(state.metrics.maxDtMs.toFixed(2)),
      over24: state.metrics.over24,
      over32: state.metrics.over32,
      over50: state.metrics.over50,
      over100: state.metrics.over100,
      sceneSessionSyncCount: Math.max(0, Math.floor(Number(state.metrics.sceneSessionSyncCount) || 0)),
      runtimeParamSyncCount: state.metrics.runtimeParamSyncCount,
      fishRosterSyncCount: state.metrics.fishRosterSyncCount,
      ambientPopulationSyncCount: Math.max(0, Math.floor(Number(state.metrics.ambientPopulationSyncCount) || 0)),
      staticSceneSyncCount: Math.max(0, Math.floor(Number(state.metrics.staticSceneSyncCount) || 0)),
      fishRenderCount: Array.isArray(state.refs?.fishRef?.current) ? state.refs.fishRef.current.length : 0,
      surfaceDisturbanceTelemetry:
        snapshotZenSurfaceDisturbanceTelemetry({
          telemetryRef:
            state.refs?.surfaceDisturbanceTelemetryRef,
          disturbances:
            state.refs?.surfaceDisturbancesRef?.current,
          rendererDebugToggles:
            state.refs?.rendererDebugTogglesRef?.current,
        }),
      mainMetrics: normalizeZenPondFrameMetrics(state.lastSceneFrameMetrics),
      lastSpike: isObject(state.lastSceneFrameSpike) ? state.lastSceneFrameSpike : null,
      ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? {
        spikeJournal: resolveSpikeJournal(state).snapshot(),
      } : {}),
      workerMetrics: state.performanceSample,
      runtimeHealth: buildZenPondRuntimeHealthSnapshot(state),
    };
  };

  const resetFirstFrameState = (state) => {
    if (!state) return;
    state.firstFrameAckEmitted = false;
    state.firstFrameAtMs = 0;
    state.firstFrameAckDeferredCount = 0;
    state.firstFrameAckDeferredReason = null;
    state.firstRenderTickRecorded = false;
    state.firstFrameRuntimeLoopMounted = false;
    state.firstFrameRuntimeLoopFrameCount = 0;
    state.firstFrameLastRenderSource = '';
  };

  return Object.freeze({
    recordFrameMetrics,
    buildMetrics,
    markFirstFrame,
    markPresentationSceneFrame,
    resetFirstFrameState,
  });
};
