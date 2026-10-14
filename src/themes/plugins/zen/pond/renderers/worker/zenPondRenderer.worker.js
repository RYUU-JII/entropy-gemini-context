import { mountZenSignalScannerRuntimeLoop } from '../../runtime/zenSignalScannerLoop.js';
import { syncAmbientEntities } from '../../runtime/zenAmbientEntitySync.js';
import { syncFishRoster } from '../../runtime/zenFishRosterEntitySync.js';
import {
  QUALITY_PROFILES,
  DEFAULT_QUALITY_PROFILE,
  resolveQualityMode,
  scaleCount,
  buildClusteredPondLayout,
} from '../../runtime/zenSignalScannerConfig.js';
import { createPondDepthTexture, buildPondDepthTextureKey } from '../pixi/pondDepthTexture.js';
import { requireZenPondBathymetryField } from '../../world/fields/zenPondBathymetryField.js';
import { DEFAULT_KOI_TUNING } from '../../model/koi/constants.js';
import {
  ZEN_POND_WORKER_MESSAGE_TYPE,
  buildZenPondWorkerReadyPayload,
} from './core/zenPondWorkerProtocol.js';
import { createZenPondWorkerCommandRouter } from './core/createZenPondWorkerCommandRouter.js';
import { createZenPondWorkerSessionGate } from './core/createZenPondWorkerSessionGate.js';
import {
  applyZenPondWorkerCanvasInit,
  applyZenPondWorkerCanvasResize,
} from './core/zenPondWorkerCanvasLifecycle.js';
import { createZenPondWorkerTelemetry } from './core/createZenPondWorkerTelemetry.js';
import { createZenPondWorkerControlHandlers } from './core/createZenPondWorkerControlHandlers.js';
import {
  DEFAULT_WATER_PALETTE,
  MAX_SYNC_FISH_COUNT,
  ZEN_QUALITY_MODE_FULL,
} from './core/zenPondWorkerPolicy.js';
import {
  createWorldSyncCache,
  createRuntimeState,
} from './core/zenPondWorkerEngine.js';
import {
  requireRuntimeEnvironment as assertWorkerRuntimeEnvironment,
  ensureCanvasEventSurface as applyWorkerCanvasEventSurface,
  resolveWorkerRendererDiagnostics as collectWorkerRendererDiagnostics,
  resolveCanvasWebGLTextureCaps as collectCanvasWebGLTextureCaps,
} from './core/zenPondWorkerRuntimeEnvironment.js';
import {
  syncAmbientEntitiesForWorkerState,
  syncFishRosterForWorkerState,
} from './core/zenPondWorkerWorldSync.js';
import {
  applyEnvironmentAuthorityForWorkerState,
  applyRuntimeParamsForWorkerState,
  updateRuntimeEnvironmentForWorkerState,
} from './core/zenPondWorkerRuntimeParams.js';
import { createZenPondWorkerEngineLifecycle } from './core/zenPondWorkerEngineLifecycle.js';
import { createZenPondWorkerTransport } from './core/zenPondWorkerTransport.js';
import {
  recordZenPondBootTimelineEvent,
  recordZenPondRuntimeHealthEvent,
} from './core/zenPondWorkerRuntimeHealth.js';
import {
  applyZenPondPresentationSceneCommitRequest,
} from './core/zenPondPresentationSceneCommit.js';
import {
  zenPondRendererModuleAdmission,
} from './core/zenPondRendererModuleAdmission.js';

const SUPPORTS_WORKER_RAF = typeof globalThis.requestAnimationFrame === 'function'
  && typeof globalThis.cancelAnimationFrame === 'function';

const RENDERER_KIND = Object.freeze({
  PIXI_OFFSCREEN: 'pixi_offscreen',
});

const MESSAGE_TYPE = ZEN_POND_WORKER_MESSAGE_TYPE;
const ZEN_POND_WORKER_RUNTIME_DEBUG = false;

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const clamp = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

const resolveSessionMeta = (payload) => (
  isObject(payload?.__session) ? payload.__session : null
);

const resolveSessionSeq = (payload) => {
  const sessionMeta = resolveSessionMeta(payload);
  const parsed = Number(sessionMeta?.seq);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const buildControlAck = ({
  payload = null,
  channel = 'unknown',
  applied = true,
  stale = false,
  reason = null,
} = {}) => {
  const sessionMeta = resolveSessionMeta(payload);
  return {
    channel: typeof channel === 'string' && channel ? channel : 'unknown',
    applied: applied === true,
    stale: stale === true,
    reason: typeof reason === 'string' && reason ? reason : null,
    seq: resolveSessionSeq(payload),
    sessionId: typeof sessionMeta?.id === 'string' && sessionMeta.id.trim()
      ? sessionMeta.id.trim()
      : null,
  };
};

let initializedWorkerRuntime = null;

export const initializeZenPondRendererWorker = ({
  postMessage,
} = {}) => {
  if (typeof postMessage !== 'function') {
    throw new Error('ZEN_POND_RENDERER_WORKER_POST_MESSAGE_REQUIRED');
  }
  if (initializedWorkerRuntime) {
    if (initializedWorkerRuntime.postMessage !== postMessage) {
      throw new Error('ZEN_POND_RENDERER_WORKER_ALREADY_INITIALIZED');
    }
    return initializedWorkerRuntime;
  }

let runtimeState = createRuntimeState();
let rendererModuleAdmissionTimelinePromise = null;
const recordRendererModuleAdmissionStart = (snapshot) => {
  if (
    snapshot?.startedAtMs === null
    || !Number.isFinite(Number(snapshot?.startedAtMs))
  ) return false;
  if (runtimeState.runtimeHealth?.milestones?.renderer_module_admission_start) return false;
  recordZenPondBootTimelineEvent(runtimeState, 'renderer_module_admission_start', {
    sceneRendererRequested: snapshot?.sceneRendererRequested === true,
    waterEffectsRequested: snapshot?.waterEffectsRequested === true,
    staticBenthicAssetsRequested: snapshot?.staticBenthicAssetsRequested === true,
  }, {
    timestampMs: Number(snapshot.startedAtMs),
  });
  return true;
};
const recordRendererModuleAdmissionEnd = (snapshot) => {
  if (
    snapshot?.settledAtMs === null
    || !Number.isFinite(Number(snapshot?.settledAtMs))
  ) return false;
  if (runtimeState.runtimeHealth?.milestones?.renderer_module_admission_end) return false;
  recordZenPondBootTimelineEvent(runtimeState, 'renderer_module_admission_end', {
    state: snapshot?.state || 'unknown',
    durationMs: snapshot?.durationMs ?? null,
    sceneModuleDurationMs: snapshot?.sceneModuleDurationMs ?? null,
    waterModuleDurationMs: snapshot?.waterModuleDurationMs ?? null,
    waterFactoryAdmissionDurationMs: snapshot?.waterFactoryAdmissionDurationMs ?? null,
    staticBenthicAssetState: snapshot?.staticBenthicAssets?.state || 'unknown',
    staticBenthicAssetDurationMs: snapshot?.staticBenthicAssets?.durationMs ?? null,
    staticBenthicAssetBytes: snapshot?.staticBenthicAssets?.totalRuntimeBytes ?? null,
  }, {
    timestampMs: Number(snapshot.settledAtMs),
  });
  return true;
};
const restoreRendererModuleAdmissionTimeline = () => {
  const snapshot = zenPondRendererModuleAdmission.getSnapshot();
  recordRendererModuleAdmissionStart(snapshot);
  recordRendererModuleAdmissionEnd(snapshot);
  return snapshot;
};
const prepareZenPondRendererModules = () => {
  const preparation = zenPondRendererModuleAdmission.prepare();
  if (!rendererModuleAdmissionTimelinePromise) {
    const started = zenPondRendererModuleAdmission.getSnapshot();
    recordRendererModuleAdmissionStart(started);
    rendererModuleAdmissionTimelinePromise = preparation.then(
      () => {
        const snapshot = zenPondRendererModuleAdmission.getSnapshot();
        recordRendererModuleAdmissionStart(snapshot);
        recordRendererModuleAdmissionEnd(snapshot);
        return true;
      },
      () => {
        const snapshot = zenPondRendererModuleAdmission.getSnapshot();
        recordRendererModuleAdmissionStart(snapshot);
        recordRendererModuleAdmissionEnd(snapshot);
        return false;
      },
    );
  }
  return preparation;
};
const RUNTIME_MODULES = Object.freeze({
  mountZenSignalScannerRuntimeLoop,
  loadZenPixiSceneRenderer: () => zenPondRendererModuleAdmission.loadSceneRenderer(),
  getZenPondRendererModuleAdmissionSnapshot: () => (
    zenPondRendererModuleAdmission.getSnapshot()
  ),
  syncAmbientEntities,
  syncFishRoster,
  QUALITY_PROFILES,
  DEFAULT_QUALITY_PROFILE,
  resolveQualityMode,
  scaleCount,
  buildClusteredPondLayout,
  createPondDepthTexture,
  buildPondDepthTextureKey,
  DEFAULT_KOI_TUNING,
});
const sessionGate = createZenPondWorkerSessionGate({
  pingType: MESSAGE_TYPE.PING,
});
const telemetry = createZenPondWorkerTelemetry({
  messageType: MESSAGE_TYPE,
  rendererKind: RENDERER_KIND.PIXI_OFFSCREEN,
  supportsWorkerRaf: SUPPORTS_WORKER_RAF,
  postMessage,
});

const transport = createZenPondWorkerTransport({
  messageType: MESSAGE_TYPE,
  nowMs,
  postMessage,
  runtimeDebugEnabled: ZEN_POND_WORKER_RUNTIME_DEBUG,
});

const resolveDepthTexture = (modules, state, paletteInput = null, depthConfig = null) => {
  const tuning = state.refs.tuningRef.current || {};
  const palette = isObject(paletteInput)
    ? paletteInput
    : (state.refs.waterPaletteRef.current || DEFAULT_WATER_PALETTE);
  const safeDepthConfig = isObject(depthConfig) ? depthConfig : {};
  const depthStrength = clamp(
    Number(safeDepthConfig.depthStrength ?? tuning?.pondDepthStrength ?? 1),
    0,
    2,
  );
  const contourDensity = clamp(
    Number(safeDepthConfig.contourDensity ?? tuning?.pondContourDensity ?? 1),
    0,
    2,
  );
  const sedimentAmount = clamp(
    Number(safeDepthConfig.sedimentAmount ?? tuning?.pondSedimentAmount ?? 1),
    0,
    2,
  );
  // The depth wash is projected from the canonical basin, so this ref is a
  // hard precondition rather than an optional input. Assert it here, at the
  // owner of the ref, so a world-sync ordering break names itself instead of
  // surfacing as an opaque failure inside the texture builder.
  const bathymetryField = requireZenPondBathymetryField(
    state.refs.bathymetryFieldRef.current,
  );
  const key = modules.buildPondDepthTextureKey({
    width: state.width,
    height: state.height,
    palette,
    bathymetryField,
    depthStrength,
    contourDensity,
    sedimentAmount,
    seedSalt: state.refs.sessionSaltRef.current,
  });

  if (state.depthTextureCache.key === key && state.depthTextureCache.canvas) {
    return state.depthTextureCache.canvas;
  }

  const canvas = modules.createPondDepthTexture({
    width: state.width,
    height: state.height,
    palette,
    bathymetryField,
    depthStrength,
    contourDensity,
    sedimentAmount,
    seedSalt: state.refs.sessionSaltRef.current,
  });
  state.depthTextureCache = {
    key,
    canvas,
  };
  return canvas;
};

const syncAmbientEntitiesForState = (modules, state) => {
  const shouldRecordAttempt = state.firstFrameAckEmitted !== true;
  const hasFrameState = Boolean(state.refs?.frameStateRef?.current);
  if (shouldRecordAttempt || !hasFrameState) {
    recordZenPondRuntimeHealthEvent(state, 'ambient_sync_attempt', {
      hasFrameState,
      hasQualityProfile: Boolean(state.qualityProfile),
      width: Number(state.width) || 0,
      height: Number(state.height) || 0,
    }, {
      captureStack: !hasFrameState,
      stackKey: 'ambient_sync_missing_frame_state',
    });
  }
  const result = syncAmbientEntitiesForWorkerState({
    modules,
    state,
  });
  if (result?.staticSceneChanged === true) {
    state.metrics.staticSceneSyncCount = Math.max(
      0,
      Math.floor(Number(state.metrics.staticSceneSyncCount) || 0),
    ) + 1;
  }
  if (result?.ambientPopulationChanged === true) {
    state.metrics.ambientPopulationSyncCount = Math.max(
      0,
      Math.floor(Number(state.metrics.ambientPopulationSyncCount) || 0),
    ) + 1;
  }
  if (
    shouldRecordAttempt
    || result?.staticSceneChanged === true
    || result?.ambientPopulationChanged === true
  ) {
    recordZenPondRuntimeHealthEvent(state, 'ambient_sync_complete', {
      staticSceneChanged: result?.staticSceneChanged === true,
      ambientPopulationChanged: result?.ambientPopulationChanged === true,
      staticSceneCount: state.metrics.staticSceneSyncCount || 0,
      ambientPopulationCount: state.metrics.ambientPopulationSyncCount || 0,
    });
  }
  return result;
};

const syncFishRosterForState = (modules, state, { replacePopulation = false } = {}) => {
  syncFishRosterForWorkerState({
    modules,
    state,
    maxSyncFishCount: MAX_SYNC_FISH_COUNT,
    replacePopulation,
  });
};

const recordFrameMetrics = (state, frameMetrics, timestampMs) => (
  telemetry.recordFrameMetrics(state, frameMetrics, timestampMs)
);

const updateRuntimeEnvironmentForState = (modules, state, timestampMs) => (
  updateRuntimeEnvironmentForWorkerState({
    modules,
    state,
    timestampMs,
    syncAmbientEntitiesForState,
  })
);

const buildMetrics = (state) => telemetry.buildMetrics(state);

const resolveRendererLabel = () => 'zen_pond_worker_pixi_offscreen';

const buildReadyPayload = ({ qualityMode = null } = {}) => {
  const payload = buildZenPondWorkerReadyPayload({
    renderer: resolveRendererLabel(),
    rendererKind: RENDERER_KIND.PIXI_OFFSCREEN,
    supportsWorkerRaf: SUPPORTS_WORKER_RAF,
    supportsPixiOffscreen: true,
  });
  if (typeof qualityMode === 'string' && qualityMode.trim()) {
    payload.qualityMode = qualityMode;
  }
  return payload;
};

const lifecycle = createZenPondWorkerEngineLifecycle({
  modules: RUNTIME_MODULES,
  state: runtimeState,
  messageType: MESSAGE_TYPE,
  rendererKind: RENDERER_KIND.PIXI_OFFSCREEN,
  nowMs,
  telemetry,
  applyWorkerCanvasEventSurface,
  collectWorkerRendererDiagnostics,
  collectCanvasWebGLTextureCaps,
  resolveDepthTexture: (palette, depthConfig) => (
    resolveDepthTexture(RUNTIME_MODULES, runtimeState, palette, depthConfig)
  ),
  syncAmbientEntitiesForState,
  syncFishRosterForState,
  updateRuntimeEnvironmentForState,
  recordFrameMetrics,
  emitRendererEvent: transport.emitRendererEvent,
  emitWorkerRuntimeDebug: transport.emitWorkerRuntimeDebug,
  emitWorkerRuntimeWarn: transport.emitWorkerRuntimeWarn,
  emitWorkerStartupProgress: transport.emitWorkerStartupProgress,
});

const stopEngine = (state, options = {}) => {
  lifecycle.stopEngine(options);
};

const remountEngine = () => {
  return lifecycle.remountEngine();
};

const resetRuntimeState = () => {
  lifecycle.resetRuntimeState();
  restoreRendererModuleAdmissionTimeline();
};

const startEngineAsync = () => {
  return lifecycle.startEngineAsync();
};

const applyRuntimeParams = (modules, state, runtimeParamsInput = null) => {
  return applyRuntimeParamsForWorkerState({
    modules,
    state,
    runtimeParamsInput,
    remountEngine: () => remountEngine(),
    syncAmbientEntitiesForState,
  });
};

const applyEnvironmentAuthority = (modules, state, envAuthorityInput = null) => {
  return applyEnvironmentAuthorityForWorkerState({
    modules,
    state,
    envAuthorityInput,
    syncAmbientEntitiesForState,
  });
};

const applyFishRoster = (
  modules,
  state,
  fishRoster = [],
  presentationSceneCommitPayload = null,
) => {
  state.fishRosterPayload = Array.isArray(fishRoster) ? fishRoster : [];
  state.metrics.fishRosterSyncCount += 1;
  const previousSceneCommit = state.presentationSceneCommitRequest
    ?? state.lastPresentationSceneCommitAck;
  const presentationSceneCommitRequest = applyZenPondPresentationSceneCommitRequest({
    state,
    payload: presentationSceneCommitPayload,
    fishRoster: state.fishRosterPayload,
  });
  // Scene commits cross the conductor's opaque cover. Bank crossings belong
  // only to live membership changes inside the same presentation scene.
  syncFishRosterForState(modules, state, {
    replacePopulation: Boolean(previousSceneCommit && presentationSceneCommitRequest
      && previousSceneCommit.presentationSceneCommitKey
        !== presentationSceneCommitRequest.presentationSceneCommitKey),
  });
  recordZenPondBootTimelineEvent(state, 'fish_roster_applied', {
    fishCount: Array.isArray(state.refs?.fishRef?.current)
      ? state.refs.fishRef.current.length
      : 0,
    payloadCount: state.fishRosterPayload.length,
    count: state.metrics.fishRosterSyncCount || 0,
    presentationSceneCommitKey:
      presentationSceneCommitRequest?.presentationSceneCommitKey || null,
    requiredVisibleFishCount:
      presentationSceneCommitRequest?.requiredVisibleFishCount ?? 0,
  });
  return presentationSceneCommitRequest;
};

const applySceneSession = (modules, state, sceneSessionInput = null) => {
  const incoming = isObject(sceneSessionInput) ? sceneSessionInput : {};
  const currentSceneGenerationKey = (
    typeof state.sceneGenerationKey === 'string' && state.sceneGenerationKey.trim()
      ? state.sceneGenerationKey.trim()
      : 'worker_scene'
  );
  const currentSeed = Math.max(0, Math.floor(Number(state.refs?.sessionSaltRef?.current) || 0)) >>> 0;
  const nextSceneGenerationKey = (
    typeof incoming.sceneGenerationKey === 'string' && incoming.sceneGenerationKey.trim()
      ? incoming.sceneGenerationKey.trim()
      : currentSceneGenerationKey
  );
  const nextSeedRaw = Number(incoming.seed);
  const nextSeed = Number.isFinite(nextSeedRaw)
    ? (Math.max(0, Math.floor(nextSeedRaw)) >>> 0)
    : currentSeed;
  const changed = (
    nextSceneGenerationKey !== currentSceneGenerationKey
    || nextSeed !== currentSeed
  );

  if (!changed) {
    return {
      changed: false,
      remounted: false,
      sceneGenerationKey: currentSceneGenerationKey,
      seed: currentSeed,
    };
  }

  state.sceneGenerationKey = nextSceneGenerationKey;
  state.refs.sessionSaltRef.current = nextSeed;
  state.depthTextureCache = { key: '', canvas: null };
  state.worldSyncCache = createWorldSyncCache();
  state.metrics.sceneSessionSyncCount = Math.max(
    0,
    Math.floor(Number(state.metrics.sceneSessionSyncCount) || 0),
  ) + 1;

  if (state.started && state.canvas) {
    remountEngine();
    return {
      changed: true,
      remounted: true,
      sceneGenerationKey: nextSceneGenerationKey,
      seed: nextSeed,
    };
  }

  syncAmbientEntitiesForState(modules, state);
  return {
    changed: true,
    remounted: false,
    sceneGenerationKey: nextSceneGenerationKey,
    seed: nextSeed,
  };
};

const controlHandlers = createZenPondWorkerControlHandlers({
  MESSAGE_TYPE,
  ZEN_QUALITY_MODE_FULL,
  runtimeState,
  RUNTIME_MODULES,
  applyZenPondWorkerCanvasInit,
  applyZenPondWorkerCanvasResize,
  ensureCanvasEventSurface: applyWorkerCanvasEventSurface,
  applySceneSession,
  applyEnvironmentAuthority,
  applyRuntimeParams,
  applyFishRoster,
  buildReadyPayload,
  buildControlAck,
  buildMetrics,
  remountEngine,
  stopEngine,
  resetRuntimeState,
  sessionGate,
  startEngineAsync,
  postMessage,
  respondResult: transport.respondResult,
  respondError: transport.respondError,
});

const commandRouter = createZenPondWorkerCommandRouter({
  handlers: {
    [MESSAGE_TYPE.PING]: async ({ id }) => {
      const readyPayload = buildReadyPayload();
      transport.respondResult(id, readyPayload);
      postMessage({
        type: MESSAGE_TYPE.READY,
        ...readyPayload,
      });
    },
    ...controlHandlers,
  },
});

const handleMessage = transport.createMessageHandler({
  sessionGate,
  commandRouter,
  buildControlAck,
});
const disposeRuntime = () => {
  stopEngine(runtimeState, { keepData: false });
  resetRuntimeState(runtimeState);
  sessionGate.reset();
  return true;
};

assertWorkerRuntimeEnvironment();
transport.emitWorkerRuntimeDebug('worker_boot_ready', {
  dpr: runtimeState.dpr,
  renderer: resolveRendererLabel(),
});

postMessage({
  type: MESSAGE_TYPE.READY,
  ...buildReadyPayload(),
});

initializedWorkerRuntime = Object.freeze({
  postMessage,
  prepare: prepareZenPondRendererModules,
  handleMessage,
  dispose: disposeRuntime,
});
return initializedWorkerRuntime;
};
