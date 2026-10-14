import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { createZenBonsaiFirstBloomPlayback } from './zenBonsaiFirstBloomPlayback.js';
import { ZEN_RENDERER_WORK_JOURNAL_ENABLED } from './zenRendererWorkJournal.js';
import { ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED } from './zenBonsaiInitDiagnosticsCapability.js';
import {
    hydrateBonsaiCameraSnapshot,
} from '../../model/bonsai/rendering/resolveBonsaiCamera.js';
import {
    createBonsaiWorkerRendererBackend,
    resolveBonsaiWorkerRenderBackend,
} from './renderers/createBonsaiWorkerRendererBackend.js';
import {
    zenBonsaiG15PixiRendererModuleAdmission,
    zenBonsaiPlumePixiRendererModuleAdmission,
    zenBonsaiPixiRendererModuleAdmission,
} from './renderers/zenBonsaiPixiRendererModuleAdmission.js';
import {
    DEFAULT_ZEN_BONSAI_CADENCE_PROFILE,
    resolveZenBonsaiCadenceEnvironmentRefreshIntervalMs,
    resolveZenBonsaiCadenceProfile,
    resolveZenBonsaiCadenceWindSampleEveryFrames,
} from '../zenBonsaiCadenceProfile.js';
import {
    createZenBonsaiWindSampler,
} from './zenBonsaiWindSampler.js';
import {
    ensurePixiWorkerCanvasEventSurface,
    requirePixiWorkerRuntimeEnvironment,
} from './zenPixiWorkerEnvironment.js';
import {
    ZEN_BONSAI_WORKER_PROTOCOL_VERSION,
    ZEN_BONSAI_WORKER_MESSAGE_TYPE as MESSAGE_TYPE,
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
    ZEN_BONSAI_WORKER_RENDER_LOOP_MODES as RENDER_LOOP_MODES,
    requireZenBonsaiInputSignature,
    requireZenBonsaiMaterializationKey,
    requireZenBonsaiWorkerProtocolVersion,
} from './zenBonsaiWorkerProtocol.js';
import {
    shouldResumeZenBonsaiRendererOnActiveTransition,
} from './zenBonsaiWorkerActiveTransition.js';
import {
    isZenBonsaiIntrinsicCanvasRenderPlan,
    requireZenBonsaiRenderPlanV1,
    ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT,
} from '../../model/bonsai/rendering/zenBonsaiRenderPlan.js';
import {
    requireSakuraActualAlphaObservationRequestV1,
} from '../../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';
import {
    buildBonsaiWorkerEnvironmentDiagnostics,
    buildBonsaiWorkerEnvironmentRenderSignature,
    buildBonsaiWorkerStaticLayerEnvironmentSignature,
    normalizeBonsaiWorkerEnvAuthority,
    resolveBonsaiWorkerClockEnvironmentState,
    resolveBonsaiWorkerClockSyncIntervalMs,
    shouldBakeBonsaiWorkerEnvironmentIntoStaticLayers,
} from './zenBonsaiWorkerEnvironment.js';
import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
} from '../environment/zenWorldEnvironmentAuthority.js';

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clampPixelExtent = (value) => Math.max(1, Math.round(toNumber(value, 1)));
const clampPixelRatio = (value) => {
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 1;
    }
    return Math.min(3, ratio);
};
const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);
const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);
const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};
const buildRendererAdmissionTiming = ({
    initStartMs,
    renderBackend: activeRenderBackend,
} = {}) => {
    if (
        activeRenderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI
        && activeRenderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
        && activeRenderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME
    ) {
        return {
            rendererAdmissionState: 'not_required',
            rendererAdmissionStartedBeforeInit: false,
            rendererAdmissionCompletedBeforeInit: false,
            rendererAdmissionDurationMs: null,
            rendererAdmissionLeadToInitMs: null,
        };
    }
    const snapshot = activeRenderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME
        ? zenBonsaiPlumePixiRendererModuleAdmission.getSnapshot()
        : activeRenderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
        ? zenBonsaiG15PixiRendererModuleAdmission.getSnapshot()
        : zenBonsaiPixiRendererModuleAdmission.getSnapshot();
    const startedAtMs = Number(snapshot.startedAtMs);
    const settledAtMs = Number(snapshot.settledAtMs);
    const hasStart = snapshot.startedAtMs !== null && Number.isFinite(startedAtMs);
    const hasSettlement = snapshot.settledAtMs !== null && Number.isFinite(settledAtMs);
    return {
        rendererAdmissionState: snapshot.state,
        rendererAdmissionStartedBeforeInit: hasStart && startedAtMs <= initStartMs,
        rendererAdmissionCompletedBeforeInit: (
            snapshot.state === 'ready'
            && hasSettlement
            && settledAtMs <= initStartMs
        ),
        rendererAdmissionDurationMs: snapshot.durationMs,
        rendererAdmissionLeadToInitMs: hasStart && startedAtMs <= initStartMs
            ? roundMs(initStartMs - startedAtMs)
            : null,
    };
};

let initializedWorkerRuntime = null;

export const initializeZenBonsaiRendererWorker = ({
    postMessage,
    onInitDiagnostic = null,
} = {}) => {
    if (typeof postMessage !== 'function') {
        throw new Error('ZEN_BONSAI_RENDERER_WORKER_POST_MESSAGE_REQUIRED');
    }
    if (initializedWorkerRuntime) {
        if (initializedWorkerRuntime.postMessage !== postMessage) {
            throw new Error('ZEN_BONSAI_RENDERER_WORKER_ALREADY_INITIALIZED');
        }
        return initializedWorkerRuntime;
    }

const postChannelMessage = (type, payload = {}) => {
    postMessage({ type, payload });
};

const workerScriptStartedAtMs = nowPerfMs();

let canvas = null;
let renderer = null;
let stopLoop = null;
let renderInFlight = false;
let renderQueued = false;
let messageQueue = Promise.resolve();
let runtimeGeneration = 0;
let frameCount = 0;
let cadenceProfile = DEFAULT_ZEN_BONSAI_CADENCE_PROFILE;
let renderLoopMode = RENDER_LOOP_MODES.CONTINUOUS;
let renderBackend = ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D;
let active = false;
let disposed = false;
let scene = null;
let sceneReportPending = false;
let initTimingSnapshot = null;
let sceneTimingSnapshot = null;
let sceneReceivedAtMs = 0;
const windSampler = createZenBonsaiWindSampler();
let firstBloomPlayback = createZenBonsaiFirstBloomPlayback();
let completedBloomReceipt = null;
let lastBloomCompletionIdentity = null;
const applyFirstBloomPresentation = (presentation) => {
    firstBloomPlayback.setPresentation(presentation, scene.treeSeed);
    if (presentation === null) {
        completedBloomReceipt = null;
        lastBloomCompletionIdentity = null;
    }
};
const createInitialSizeState = () => ({
    cssWidth: 1,
    cssHeight: 1,
    pixelWidth: 1,
    pixelHeight: 1,
    pixelRatio: 1,
});
let sizeState = createInitialSizeState();
let sceneSurfacePending = false;
let sceneSurfaceSize = null;

requirePixiWorkerRuntimeEnvironment();

const resolveRenderLoopMode = (value) => {
    if (value === RENDER_LOOP_MODES.CONTINUOUS) {
        return RENDER_LOOP_MODES.CONTINUOUS;
    }
    if (value === RENDER_LOOP_MODES.DIRTY) {
        return RENDER_LOOP_MODES.DIRTY;
    }
    throw new Error(`ZEN_BONSAI_WORKER_RENDER_LOOP_MODE_INVALID:${value || 'missing'}`);
};

const resolveCadenceDebugSnapshot = () => ({
    qualityMode: cadenceProfile.qualityMode,
    cadenceTier: cadenceProfile.cadenceTier,
    targetFps: cadenceProfile.targetFps,
    simHz: cadenceProfile.simHz,
    windSampleEveryFrames: resolveZenBonsaiCadenceWindSampleEveryFrames(cadenceProfile),
});

const resetRuntimeForFreshInit = () => {
    stopRenderLoop();
    renderer?.dispose?.();
    canvas = null;
    renderer = null;
    renderInFlight = false;
    renderQueued = false;
    frameCount = 0;
    cadenceProfile = DEFAULT_ZEN_BONSAI_CADENCE_PROFILE;
    renderLoopMode = RENDER_LOOP_MODES.CONTINUOUS;
    renderBackend = ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D;
    active = false;
    disposed = false;
    scene = null;
    sceneReportPending = false;
    initTimingSnapshot = null;
    sceneTimingSnapshot = null;
    sceneReceivedAtMs = 0;
    sizeState = createInitialSizeState();
    sceneSurfacePending = false;
    sceneSurfaceSize = null;
    windSampler.reset();
    firstBloomPlayback = createZenBonsaiFirstBloomPlayback();
    completedBloomReceipt = null;
    lastBloomCompletionIdentity = null;
};

const stopRenderLoop = () => {
    if (stopLoop) {
        stopLoop();
        stopLoop = null;
    }
};

const applyCanvasSize = (payload = {}) => {
    const nextSize = {
        cssWidth: clampPixelExtent(payload?.cssWidth),
        cssHeight: clampPixelExtent(payload?.cssHeight),
        pixelWidth: clampPixelExtent(payload?.pixelWidth),
        pixelHeight: clampPixelExtent(payload?.pixelHeight),
        pixelRatio: clampPixelRatio(payload?.pixelRatio),
    };
    // RESIZE and the projected SCENE are separate ordered messages. Never draw
    // the previous scene's device geometry into the newly sized renderer.
    sceneSurfacePending = scene !== null
        && Object.keys(nextSize).some(key => nextSize[key] !== sceneSurfaceSize[key]);
    sizeState = nextSize;
    if (!canvas) {
        return;
    }
    renderer?.resize?.(sizeState);
};

const cloneStaticLayerSignatures = (signatures = null) => (
    isObject(signatures) ? { ...signatures } : {}
);

const appendEnvironmentSignatureToStaticLayers = (baseSignatures = null, environmentSignature = '') => {
    const base = cloneStaticLayerSignatures(baseSignatures);
    const signature = typeof environmentSignature === 'string' && environmentSignature
        ? environmentSignature
        : 'worker_env:none';
    const next = {};
    Object.keys(base).forEach((key) => {
        const value = base[key];
        if (typeof value === 'string' && value) {
            next[key] = `${value}|${signature}`;
        }
    });
    return next;
};

const resolveNextEnvironmentRefreshAtMs = ({
    envAuthority = null,
    timestampMs = 0,
} = {}) => {
    if (envAuthority?.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED) {
        return Number.POSITIVE_INFINITY;
    }
    const intervalMs = resolveBonsaiWorkerClockSyncIntervalMs({
        envAuthority,
        documentVisible: active === true,
    });
    const refreshIntervalMs = resolveZenBonsaiCadenceEnvironmentRefreshIntervalMs({
        cadenceProfile,
        baseIntervalMs: intervalMs,
        active: active === true,
    });
    return Math.max(0, Number(timestampMs) || 0) + refreshIntervalMs;
};

const refreshSceneWorkerEnvironment = ({ force = false } = {}) => {
    if (!scene || !isObject(scene.envAuthority)) {
        return false;
    }
    const runtime = scene.environmentRuntime || {
        lastSignature: '',
        nextRefreshAtMs: 0,
    };
    // Cadence measures elapsed time; the canonical sampler still owns wall time.
    const nowMs = nowPerfMs();
    if (
        !force
        && runtime.nextRefreshAtMs > 0
        && nowMs < runtime.nextRefreshAtMs
    ) {
        return false;
    }

    const resolved = resolveBonsaiWorkerClockEnvironmentState({
        envAuthority: scene.envAuthority,
        fallbackEnvironmentState: scene.environmentState,
    });
    const nextEnvAuthority = normalizeBonsaiWorkerEnvAuthority(resolved?.envAuthority);
    const nextEnvState = resolved?.envState || scene.environmentState || null;
    const nextSignature = buildBonsaiWorkerEnvironmentRenderSignature({
        envAuthority: nextEnvAuthority,
        envState: nextEnvState,
    });
    const nextStaticLayerEnvironmentSignature = (
        buildBonsaiWorkerStaticLayerEnvironmentSignature({
            envState: nextEnvState,
        })
    );
    const signatureChanged = nextSignature !== runtime.lastSignature;
    const baseStaticLayerSignatures = scene.baseStaticLayerSignatures
        || cloneStaticLayerSignatures(scene.staticLayerSignatures);

    scene.envAuthority = nextEnvAuthority;
    scene.environmentState = nextEnvState;
    scene.solarState = resolved?.solarState || null;
    scene.environmentDiagnostics = buildBonsaiWorkerEnvironmentDiagnostics({
        envAuthority: nextEnvAuthority,
        envState: nextEnvState,
        solarState: scene.solarState,
        environmentRuntimeConfigSignature: scene.renderOptions?.environmentRuntimeConfigSignature || '',
    });
    scene.renderOptions = {
        ...(scene.renderOptions || {}),
        environmentState: nextEnvState,
    };
    scene.baseStaticLayerSignatures = baseStaticLayerSignatures;
    scene.staticLayerSignatures = shouldBakeBonsaiWorkerEnvironmentIntoStaticLayers(nextEnvAuthority)
        ? appendEnvironmentSignatureToStaticLayers(
            baseStaticLayerSignatures,
            nextStaticLayerEnvironmentSignature,
        )
        : cloneStaticLayerSignatures(baseStaticLayerSignatures);
    scene.environmentRuntime = {
        lastSignature: nextSignature,
        nextRefreshAtMs: resolveNextEnvironmentRefreshAtMs({
            envAuthority: nextEnvAuthority,
            timestampMs: nowMs,
        }),
    };

    sceneReportPending = true;
    return signatureChanged;
};

const resolveSceneWindState = () => windSampler.resolve({
    environmentState: scene.environmentState,
    environmentSignature: scene.environmentRuntime?.lastSignature || scene.sceneSignature || '',
    frameCount,
    sampleFrameStep: resolveZenBonsaiCadenceWindSampleEveryFrames(cadenceProfile),
});

const flattenRendererTiming = (timing = null) => {
    if (!isObject(timing)) return {};
    const flattened = {};
    Object.entries(timing).forEach(([key, value]) => {
        flattened[`renderer${key.slice(0, 1).toUpperCase()}${key.slice(1)}`] = roundMs(value);
    });
    return flattened;
};

const reportError = (error) => {
    postChannelMessage(MESSAGE_TYPE.ERROR, {
        reason: String(error?.message || error || 'ZEN_BONSAI_WORKER_RENDER_ERROR'),
    });
};

const ensureRenderer = async () => {
    if (renderer) {
        return renderer;
    }
    if (!canvas) {
        throw new Error('ZEN_BONSAI_WORKER_RENDERER_CANVAS_MISSING');
    }
    renderer = await createBonsaiWorkerRendererBackend({
        renderBackend,
        canvas,
    });
    renderer.resize(sizeState);
    return renderer;
};

const renderFrame = () => {
    if (!canvas || !scene || sceneSurfacePending || disposed || active !== true) {
        return;
    }
    if (renderInFlight) {
        renderQueued = true;
        return;
    }
    const frameRequestedAtMs = nowPerfMs();
    const frameRuntimeGeneration = runtimeGeneration;
    const preflightEnvironmentStartMs = nowPerfMs();
    refreshSceneWorkerEnvironment();
    const preflightEnvironmentEndMs = nowPerfMs();
    renderInFlight = true;
    Promise.resolve().then(async () => {
        const frameAsyncStartMs = nowPerfMs();
        const windStartMs = nowPerfMs();
        const windState = resolveSceneWindState();
        const windEndMs = nowPerfMs();
        const ensureRendererStartMs = nowPerfMs();
        const activeRenderer = await ensureRenderer();
        const ensureRendererEndMs = nowPerfMs();
        if (
            frameRuntimeGeneration !== runtimeGeneration
            || !scene
            || sceneSurfacePending
            || disposed
            || active !== true
        ) {
            return;
        }
        const renderStartMs = nowPerfMs();
        const bloomPresentationProgress = firstBloomPlayback.sample(renderStartMs);
        const renderResult = activeRenderer.render({
            scene,
            sizeState,
            frameCount,
            windState,
            bloomPresentationProgress,
            bloomInvitation: firstBloomPlayback.getInvitation(),
            ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? { includeReportDiagnostics: sceneReportPending } : {}),
        });
        const bloomCompletion = firstBloomPlayback.takeCompletion();
        if (bloomCompletion !== null) completedBloomReceipt = bloomCompletion;
        if (completedBloomReceipt !== null && (lastBloomCompletionIdentity === null
            || lastBloomCompletionIdentity.sceneCommitKey !== scene.sceneCommitKey
            || lastBloomCompletionIdentity.bonsaiMaterializationKey !== scene.bonsaiMaterializationKey
            || lastBloomCompletionIdentity.inputSignature !== scene.inputSignature
            || lastBloomCompletionIdentity.eventId !== completedBloomReceipt.eventId)) {
            // Completion dedupe owns only the ACK identity, never the scene's
            // topology/plan after its logical channel has been released.
            lastBloomCompletionIdentity = {
                sceneCommitKey: scene.sceneCommitKey,
                bonsaiMaterializationKey: scene.bonsaiMaterializationKey,
                inputSignature: scene.inputSignature,
                eventId: completedBloomReceipt.eventId,
            };
            postChannelMessage(MESSAGE_TYPE.BLOOM_PRESENTATION_COMPLETE, {
                ...completedBloomReceipt,
                sceneCommitKey: scene.sceneCommitKey,
                bonsaiMaterializationKey: scene.bonsaiMaterializationKey,
                inputSignature: scene.inputSignature,
            });
        }
        let actualAlphaObservation = null;
        if (scene.alphaObservationRequest) {
            const alphaObservationRequest = scene.alphaObservationRequest;
            scene.alphaObservationRequest = null;
            try {
                if (typeof activeRenderer.observeActualAlpha !== 'function') {
                    throw new Error('ZEN_BONSAI_WORKER_ALPHA_OBSERVER_UNAVAILABLE');
                }
                actualAlphaObservation = await activeRenderer.observeActualAlpha({
                    request: alphaObservationRequest,
                    scene,
                    frameSequence: frameCount,
                    frameCount,
                    windState,
                });
            } catch (error) {
                sceneReportPending = false;
                throw error;
            }
        }
        const renderEndMs = nowPerfMs();
        if (sceneReportPending) {
            sceneReportPending = false;
            const workerTiming = {
                ...(initTimingSnapshot || {}),
                ...(sceneTimingSnapshot || {}),
                ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? { frameRequestedAtMs } : {}),
                frameQueueWaitMs: roundMs(frameAsyncStartMs - frameRequestedAtMs),
                framePreflightEnvRefreshMs: roundMs(preflightEnvironmentEndMs - preflightEnvironmentStartMs),
                frameWindMs: roundMs(windEndMs - windStartMs),
                frameEnsureRendererMs: roundMs(ensureRendererEndMs - ensureRendererStartMs),
                frameRenderMs: roundMs(renderEndMs - renderStartMs),
                frameWorkMs: roundMs(renderEndMs - frameAsyncStartMs),
                frameTotalMs: roundMs(renderEndMs - frameRequestedAtMs),
                sceneToFrameReportMs: sceneReceivedAtMs > 0
                    ? roundMs(renderEndMs - sceneReceivedAtMs)
                    : null,
                ...flattenRendererTiming(renderResult?.timing),
                ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? renderResult?.reportDiagnostics : {}),
            };
            postChannelMessage(MESSAGE_TYPE.FRAME_RENDERED, {
                ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? { renderedPresentation: {
                    activationRatio: scene.renderOptions.activationPresentation?.ratio ?? null,
                    expressedActivation: scene.topology.engine === 'plume'
                        ? renderResult.treeMetrics?.motion?.activation ?? null : null,
                    modelId: scene.topology.engine,
                    gardenBedSupport: scene.renderOptions.homeGardenBedProjection?.support || null,
                    presentationStyle: scene.renderOptions.presentationStyle,
                } } : {}),
                renderPlanModel: scene.topology?.engine || null,
                renderPlanContract: scene.renderPlan.contract,
                width: scene.width,
                height: scene.height,
                pixelWidth: sizeState.pixelWidth,
                pixelHeight: sizeState.pixelHeight,
                pixelRatio: sizeState.pixelRatio,
                treeSeed: scene.treeSeed,
                isAnimated: renderLoopMode === RENDER_LOOP_MODES.CONTINUOUS,
                renderer: renderResult?.renderer || activeRenderer.renderer || renderBackend,
                renderBackend,
                cacheInvalidated: scene.cacheInvalidated === true,
                frameCount,
                wind: windState.scalar,
                renderLoopMode,
                sceneSignature: scene.sceneSignature || '',
                sceneCommitKey: scene.sceneCommitKey || null,
                bonsaiMaterializationKey: scene.bonsaiMaterializationKey,
                inputSignature: scene.inputSignature,
                staticLayerSignatures: scene.staticLayerSignatures || {},
                branchRigSignature: scene.branchRigSignature || '',
                cadence: resolveCadenceDebugSnapshot(),
                environmentDiagnostics: scene.environmentDiagnostics || null,
                staticLayersRebaked: renderResult?.staticLayersRebaked === true,
                staticLayerRebakes: renderResult?.staticLayerRebakes || {},
                branchRigRebuilt: renderResult?.branchRig?.rebuilt === true,
                branchRigDeferred: renderResult?.branchRig?.deferred === true,
                branchRigReady: renderResult?.branchRig?.ready === true,
                branchRigRecords: Number.isFinite(Number(renderResult?.branchRig?.records))
                    ? Number(renderResult.branchRig.records)
                    : 0,
                branchRigDiagnostics: renderResult?.branchRig?.diagnostics || null,
                ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED && renderResult?.rainStreaks
                    ? { rainStreaks: renderResult.rainStreaks } : {}),
                actualAlphaObservation,
                workerTiming,
            });
        }
    }).catch((error) => {
        if (frameRuntimeGeneration === runtimeGeneration) {
            reportError(error);
        }
    }).finally(() => {
        if (frameRuntimeGeneration !== runtimeGeneration) {
            return;
        }
        renderInFlight = false;
        if (renderQueued) {
            renderQueued = false;
            renderFrame();
        }
    });
};

const restartLoop = () => {
    stopRenderLoop();
    if (disposed || active !== true || !scene || renderLoopMode !== RENDER_LOOP_MODES.CONTINUOUS) {
        return;
    }
    stopLoop = runRenderLoop({
        enabled: true,
        simHz: cadenceProfile.simHz,
        targetFps: cadenceProfile.targetFps,
        maxCatchUpSteps: cadenceProfile.maxCatchUpSteps,
        frameScheduler: 'auto',
        isPaused: () => active !== true || !scene,
        onSimStep: () => {
            frameCount += 1;
        },
        onRender: renderFrame,
    });
};

const handleInit = async (payload = {}) => {
    const initStartMs = nowPerfMs();
    if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && typeof onInitDiagnostic === 'function') {
        onInitDiagnostic('init_entered', initStartMs);
    }
    requireZenBonsaiWorkerProtocolVersion(payload.protocolVersion);
    if (!payload?.canvas) {
        throw new Error('ZEN_BONSAI_WORKER_INIT_CANVAS_MISSING');
    }
    const canvasStartMs = nowPerfMs();
    canvas = ensurePixiWorkerCanvasEventSurface(payload.canvas);
    const canvasEndMs = nowPerfMs();
    const backendStartMs = nowPerfMs();
    renderBackend = resolveBonsaiWorkerRenderBackend(payload?.renderBackend);
    const backendEndMs = nowPerfMs();
    const sizeStartMs = nowPerfMs();
    applyCanvasSize(payload);
    const sizeEndMs = nowPerfMs();
    const rendererStartMs = nowPerfMs();
    const activeRenderer = await ensureRenderer();
    const rendererEndMs = nowPerfMs();
    initTimingSnapshot = {
        scriptToInitMs: roundMs(initStartMs - workerScriptStartedAtMs),
        initCanvasSurfaceMs: roundMs(canvasEndMs - canvasStartMs),
        initBackendResolveMs: roundMs(backendEndMs - backendStartMs),
        initApplySizeMs: roundMs(sizeEndMs - sizeStartMs),
        initEnsureRendererMs: roundMs(rendererEndMs - rendererStartMs),
        initTotalMs: roundMs(rendererEndMs - initStartMs),
        ...buildRendererAdmissionTiming({
            initStartMs,
            renderBackend,
        }),
    };
    postChannelMessage(MESSAGE_TYPE.READY, {
        protocolVersion: ZEN_BONSAI_WORKER_PROTOCOL_VERSION,
        renderer: activeRenderer.renderer || renderBackend,
        renderBackend,
        workerTiming: initTimingSnapshot,
    });
};

const handleScene = (payload = {}) => {
    const nextSceneReceivedAtMs = nowPerfMs();
    sceneReceivedAtMs = nextSceneReceivedAtMs;
    const modeStartMs = nowPerfMs();
    renderLoopMode = resolveRenderLoopMode(payload?.renderLoopMode);
    const nextRenderBackend = resolveBonsaiWorkerRenderBackend(payload?.renderBackend);
    if (nextRenderBackend !== renderBackend) {
        throw new Error('ZEN_BONSAI_WORKER_RENDER_BACKEND_CHANGED_AFTER_INIT');
    }
    const renderOptions = payload?.renderOptions || {};
    cadenceProfile = resolveZenBonsaiCadenceProfile({
        cadenceContext: payload?.cadenceContext,
        qualityMode: renderOptions?.qualityMode,
        targetFps: payload?.targetFps,
    });
    const modeEndMs = nowPerfMs();
    const sceneBuildStartMs = nowPerfMs();
    const renderPlan = requireZenBonsaiRenderPlanV1(payload?.renderPlan, {
        topology: payload?.topology,
    });
    const plumePlan = renderPlan.contract === ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT;
    if ((plumePlan && renderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME && renderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D)
        || (!plumePlan && renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME)) {
        throw new Error('ZEN_BONSAI_PLUME_RENDER_BACKEND_MISMATCH');
    }
    if (
        isZenBonsaiIntrinsicCanvasRenderPlan(renderPlan)
        && !plumePlan
        && renderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D
        && renderBackend !== ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
    ) {
        throw new Error('ZEN_BONSAI_G15_RENDER_BACKEND_CANVAS2D_REQUIRED');
    }
    if (
        !isZenBonsaiIntrinsicCanvasRenderPlan(renderPlan)
        && renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
    ) {
        throw new Error('ZEN_SAKURA_RENDER_BACKEND_PIXI_G15_UNSUPPORTED');
    }
    if (
        typeof payload?.topologySignature === 'string'
        && payload.topologySignature
        && renderPlan.source.topologySignature !== payload.topologySignature
    ) {
        throw new Error('ZEN_BONSAI_WORKER_RENDER_PLAN_TOPOLOGY_MISMATCH');
    }
    const alphaObservationRequest = payload?.alphaObservationRequest === null
        || payload?.alphaObservationRequest === undefined
        ? null
        : requireSakuraActualAlphaObservationRequestV1(payload.alphaObservationRequest);
    if (alphaObservationRequest && (
        alphaObservationRequest.identity.sceneSignature !== payload?.sceneSignature
        || alphaObservationRequest.identity.sceneCommitKey !== (
            typeof payload?.sceneCommitKey === 'string' && payload.sceneCommitKey
                ? payload.sceneCommitKey
                : `worker-scene:${payload?.sceneSignature}`
        )
        || alphaObservationRequest.identity.renderPlanSignature !== renderPlan.signature
        || alphaObservationRequest.identity.bonsaiMaterializationKey
            !== payload?.bonsaiMaterializationKey
        || alphaObservationRequest.identity.inputSignature !== payload?.inputSignature
        || alphaObservationRequest.identity.surface.renderBackend !== renderBackend
        || alphaObservationRequest.identity.surface.width !== renderPlan.surface?.pixelWidth
        || alphaObservationRequest.identity.surface.height !== renderPlan.surface?.pixelHeight
        || alphaObservationRequest.identity.surface.pixelRatio !== sizeState.pixelRatio
    )) {
        throw new Error('ZEN_BONSAI_WORKER_ALPHA_OBSERVATION_IDENTITY_MISMATCH');
    }
    scene = {
        treeType: typeof payload?.treeType === 'string' ? payload.treeType : 'sakura',
        treeSeed: payload?.treeSeed,
        topology: payload?.topology || null,
        renderPlan,
        alphaObservationRequest,
        currentStage: payload?.currentStage || null,
        envAuthority: normalizeBonsaiWorkerEnvAuthority(payload?.envAuthority),
        environmentState: payload?.environmentState || null,
        solarState: null,
        environmentDiagnostics: null,
        camera: hydrateBonsaiCameraSnapshot(payload?.camera || null),
        renderOptions,
        width: Math.max(1, Math.round(Number(payload?.width) || sizeState.cssWidth)),
        height: Math.max(1, Math.round(Number(payload?.height) || sizeState.cssHeight)),
        sceneSignature: typeof payload?.sceneSignature === 'string' ? payload.sceneSignature : '',
        sceneCommitKey: typeof payload?.sceneCommitKey === 'string'
            && payload.sceneCommitKey.length > 0
            ? payload.sceneCommitKey
            : null,
        bonsaiMaterializationKey: requireZenBonsaiMaterializationKey(
            payload?.bonsaiMaterializationKey,
        ),
        inputSignature: requireZenBonsaiInputSignature(payload?.inputSignature),
        topologySignature: typeof payload?.topologySignature === 'string' ? payload.topologySignature : '',
        staticLayerSignatures: cloneStaticLayerSignatures(payload?.staticLayerSignatures),
        baseStaticLayerSignatures: cloneStaticLayerSignatures(payload?.staticLayerSignatures),
        branchRigSignature: typeof payload?.branchRigSignature === 'string' ? payload.branchRigSignature : '',
        cacheInvalidated: payload?.cacheInvalidated === true,
        environmentRuntime: {
            lastSignature: '',
            nextRefreshAtMs: 0,
        },
    };
    const sceneBuildEndMs = nowPerfMs();
    sceneSurfaceSize = { ...sizeState };
    sceneSurfacePending = false;
    applyFirstBloomPresentation(payload.bloomPresentation === undefined ? null : payload.bloomPresentation);
    const resetStartMs = nowPerfMs();
    windSampler.reset();
    const resetEndMs = nowPerfMs();
    const environmentStartMs = nowPerfMs();
    refreshSceneWorkerEnvironment({ force: true });
    const environmentEndMs = nowPerfMs();
    sceneReportPending = true;
    const restartStartMs = nowPerfMs();
    restartLoop();
    const restartEndMs = nowPerfMs();
    sceneTimingSnapshot = {
        ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? {
            sceneSequence: (sceneTimingSnapshot?.sceneSequence || 0) + 1,
            sceneReceivedAtMs: nextSceneReceivedAtMs,
        } : {}),
        sceneModeResolveMs: roundMs(modeEndMs - modeStartMs),
        sceneBuildMs: roundMs(sceneBuildEndMs - sceneBuildStartMs),
        sceneResetMs: roundMs(resetEndMs - resetStartMs),
        sceneEnvRefreshMs: roundMs(environmentEndMs - environmentStartMs),
        sceneRestartLoopMs: roundMs(restartEndMs - restartStartMs),
        scenePreRenderRequestMs: roundMs(restartEndMs - nextSceneReceivedAtMs),
    };
    renderFrame();
};

const disposeRuntime = () => {
    if (disposed) return false;
    runtimeGeneration += 1;
    disposed = true;
    active = false;
    stopRenderLoop();
    firstBloomPlayback = createZenBonsaiFirstBloomPlayback();
    completedBloomReceipt = null;
    lastBloomCompletionIdentity = null;
    renderer?.dispose?.();
    renderer = null;
    canvas = null;
    scene = null;
    renderInFlight = false;
    renderQueued = false;
    return true;
};

const handleMessageAsync = async (event) => {
    const message = event?.data || {};
    const type = message?.type;
    const payload = message?.payload || {};
    if (disposed && type !== MESSAGE_TYPE.INIT) {
        return;
    }
    if (type === MESSAGE_TYPE.INIT) {
        if (disposed) {
            resetRuntimeForFreshInit();
        }
        await handleInit(payload);
        return;
    }
    if (type === MESSAGE_TYPE.RESIZE) {
        applyCanvasSize(payload);
        sceneReportPending = true;
        renderFrame();
        return;
    }
    if (type === MESSAGE_TYPE.SCENE) {
        handleScene(payload);
        return;
    }
    if (type === MESSAGE_TYPE.BLOOM_PRESENTATION) {
        // Late controls from a prior materialization cannot affect the painted tree.
        if (scene === null || payload.sceneCommitKey !== scene.sceneCommitKey
            || payload.bonsaiMaterializationKey !== scene.bonsaiMaterializationKey
            || payload.inputSignature !== scene.inputSignature) return;
        applyFirstBloomPresentation(payload.presentation);
        renderFrame();
        return;
    }
    if (type === MESSAGE_TYPE.ACTIVE) {
        const wasActive = active === true;
        active = payload?.active === true;
        firstBloomPlayback.setWorkerActive(active);
        if (active) {
            if (shouldResumeZenBonsaiRendererOnActiveTransition({
                wasActive,
                nextActive: active,
                renderer,
            })) {
                renderer.resume({
                    reason: payload?.reason || 'worker_renderer_reactivated',
                });
            }
            // Resume from the current weather once, without replaying parked time.
            if (!wasActive) {
                if (scene?.envAuthority.clockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME) {
                    refreshSceneWorkerEnvironment({ force: true });
                }
                restartLoop();
            }
            renderFrame();
        } else {
            stopRenderLoop();
            // Completion of an earlier async render cannot request another inactive frame.
            renderQueued = false;
        }
        return;
    }
    if (type === MESSAGE_TYPE.DISPOSE) {
        disposeRuntime();
    }
};

const handleMessage = (event) => {
    const isInit = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && event?.data?.type === MESSAGE_TYPE.INIT;
    if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && isInit && typeof onInitDiagnostic === 'function') {
        onInitDiagnostic('logical_enqueued');
    }
    messageQueue = messageQueue
        .then(() => {
            if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && isInit && typeof onInitDiagnostic === 'function') {
                onInitDiagnostic('logical_handler_started');
            }
            return handleMessageAsync(event);
        })
        .catch(reportError);
    return messageQueue;
};

initializedWorkerRuntime = Object.freeze({
    postMessage,
    handleMessage,
    dispose: disposeRuntime,
});
return initializedWorkerRuntime;
};
