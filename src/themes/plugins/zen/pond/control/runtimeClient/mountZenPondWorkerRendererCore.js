import { registerZenPetalReceiver } from '../../../runtime/petals/zenPetalFieldBridge.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import { ZEN_POND_RESIZE_SETTLE_MS } from '../../runtime/zenPondViewportPolicy.js';
import { normalizeZenPondRegistrationEntityId } from '../../contracts/zenPondRegistrationPresentation.js';
import { createZenPondRendererHandoff } from './zenPondRendererHandoff.js';
import {
    DEFAULT_WORKER_CANVAS_HOST_STYLE,
    createThemeWorkerCanvasHostController,
    createWorkerCanvasElement,
} from '@/themes/core/rendering/workerCanvasRuntime.js';
import {
    ZEN_POND_LOCK_RENDER_SIZE,
    assertWorkerMountContract,
    buildEnvironmentAuthorityInputProbe,
    buildEnvironmentAuthoritySyncPayload,
    buildSceneSessionInputProbe,
    buildSceneSessionSyncPayload,
    buildFishRosterInputProbe,
    buildFishRosterSyncPayload,
    buildRuntimeParamsInputProbe,
    buildInitialRuntimeParamsSyncPayload,
    buildRuntimeParamsSyncPayload,
    createZenPondWorkerRuntimeClient,
    debugLog,
    recordControlPayloadTelemetry,
    recordHardWorkerFailure,
    resolveTopShadowDebugBlackoutFlag,
    shouldRebuildSceneSessionPayload,
    shouldRebuildEnvironmentAuthorityPayload,
    shouldRebuildFishRosterPayload,
    shouldRebuildRuntimeParamsPayload,
    withTopShadowDebugRuntimeParams,
} from './createZenPondWorkerRuntimeClientCore.js';
import {
    isObject,
    nowPerfMs,
    roundNumber,
    toOptionalFiniteNumber,
    toOptionalUid,
} from './sharedUtils.js';
import { normalizeTopShadowProbe } from './metrics.js';
import {
    bindZenPondWaterEffectsDebugControls,
    unbindZenPondWaterEffectsDebugControls,
} from './waterEffectsDebugControls.js';
import {
    ZEN_POND_READINESS_PHASE,
    createZenPondReadinessSnapshot,
} from '../zenPondReadiness.js';
import {
    emitZenMainBootTrace,
} from '../../../runtime/zenMainBootReadinessTrace.js';
import {
    buildZenPondExpectedPresentationSceneCommit,
    resolveZenPondPresentationSceneFrameAck,
    resolveZenPondRetainedPresentationSceneAckReplay,
} from './presentationSceneFrameAck.js';
import {
    requireZenPondWorkerStartupProgress,
} from '../../renderers/worker/core/zenPondWorkerStartupContract.js';
import {
    createZenPondViewportMetrics,
} from './zenPondViewportMetrics.js';

const ZEN_POND_PENDING_CANVAS_STYLE = Object.freeze({
    ...DEFAULT_WORKER_CANVAS_HOST_STYLE,
    opacity: '0',
    transition: 'none',
    willChange: 'auto',
});
// All dashboard mounts share one logical pond channel. A replacement must wait
// for its predecessor's DISPOSE acknowledgement and channel release.
const rendererHandoff = createZenPondRendererHandoff();
const ZEN_POND_CONTROLLER_TRACE_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);

export const buildWorkerInputStateControlSnapshot = (options = {}) => {
    const pointerRef = options?.mousePos;
    const pointer = isObject(pointerRef?.current) ? pointerRef.current : null;
    const clickPulse = isObject(options?.clickPulseRef?.current)
        ? options.clickPulseRef.current
        : null;
    const lockedTarget = typeof options?.lockedTargetRef?.current === 'string'
        ? options.lockedTargetRef.current
        : null;
    // External (off-canvas) hover intent, e.g. the rhythm-band share canopy.
    // The worker merges it behind its own pointer hit-test.
    const hoverTarget = typeof options?.hoverTargetRef?.current === 'string' && options.hoverTargetRef.current
        ? options.hoverTargetRef.current
        : null;
    const selectedFishIntentRaw = options?.selectedFishIntentUidRef?.current;
    const hasSelectedFishIntent = selectedFishIntentRaw !== undefined;
    const selectedFishIntentUid = selectedFishIntentRaw === null
        ? null
        : toOptionalUid(selectedFishIntentRaw);
    const invitationRegistrationEntityId = options.invitationRegistrationEntityIdRef === undefined
        ? null
        : normalizeZenPondRegistrationEntityId(options.invitationRegistrationEntityIdRef.current);
    const clickPulseTokenCandidate = Number(clickPulse?.token);
    const clickPulseToken = Number.isFinite(clickPulseTokenCandidate)
        ? Math.max(0, Math.floor(clickPulseTokenCandidate))
        : null;
    const nextX = Number(pointer?.x);
    const nextY = Number(pointer?.y);
    const hasPointer = Number.isFinite(nextX) && Number.isFinite(nextY);
    const safePointer = hasPointer
        ? {
            x: roundNumber(nextX, 2, 0),
            y: roundNumber(nextY, 2, 0),
        }
        : null;
    const clickX = Number(clickPulse?.x);
    const clickY = Number(clickPulse?.y);
    const hasClickPointer = Number.isFinite(clickX) && Number.isFinite(clickY);
    const safeClickPointer = hasClickPointer
        ? {
            x: roundNumber(clickX, 2, 0),
            y: roundNumber(clickY, 2, 0),
        }
        : null;
    return {
        signature: [
            hasPointer ? `${safePointer.x}:${safePointer.y}` : 'none',
            lockedTarget || '',
            hoverTarget || '',
            hasSelectedFishIntent
                ? (selectedFishIntentUid === null ? 'clear' : String(selectedFishIntentUid))
                : '',
            clickPulseToken !== null ? String(clickPulseToken) : '',
            invitationRegistrationEntityId === null ? '' : invitationRegistrationEntityId,
        ].join('|'),
        payload: {
            pointer: safePointer,
            pointerSpace: 'viewport',
            lockedTarget,
            hoverTarget,
            invitationRegistrationEntityId,
            clickPulseToken,
            clickPointer: safeClickPointer,
            clickPointerSpace: 'viewport',
            ...(hasSelectedFishIntent ? { selectedFishUid: selectedFishIntentUid } : {}),
        },
    };
};

export const buildRuntimeParamsSceneIdentity = (runtimeParams = null) => {
    const visualProfile = isObject(runtimeParams?.visualProfile)
        ? runtimeParams.visualProfile
        : null;
    return [
        `quality:${typeof runtimeParams?.qualityMode === 'string' ? runtimeParams.qualityMode : ''}`,
        `floor:${typeof visualProfile?.floor === 'string' ? visualProfile.floor : ''}`,
        `plants:${typeof visualProfile?.plants === 'string' ? visualProfile.plants : ''}`,
        `rocks:${typeof visualProfile?.rocks === 'string' ? visualProfile.rocks : ''}`,
        `sunlight:${typeof visualProfile?.sunlight === 'string' ? visualProfile.sunlight : ''}`,
    ].join('|');
};

export const shouldCommitRuntimeParamsSceneRemountAck = ({
    sceneRemounted = false,
    acknowledgedSceneIdentity = '',
    latestSceneIdentity = '',
} = {}) => (
    sceneRemounted === true
    && typeof acknowledgedSceneIdentity === 'string'
    && acknowledgedSceneIdentity.length > 0
    && acknowledgedSceneIdentity === latestSceneIdentity
);

export const createZenPondWorkerRendererController = (options = {}) => {
    const handoff = rendererHandoff.acquire();
    let currentOptions = options;
    const mountId = `mount_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    let host = null;
    const debugGlobal = typeof globalThis !== 'undefined' ? globalThis : null;
    const topShadowProbeKey = '__ZEN_POND_LAST_TOP_SHADOW_PROBE';
    const waterEffectsProbeKey = '__ZEN_POND_LAST_WATER_EFFECTS_PROBE';
    const waterLayerApplyAckKey =
        '__ZEN_POND_LAST_WATER_LAYER_APPLY_ACK';
    const waterLayerApplyAckOwnerKey =
        '__ZEN_POND_LAST_WATER_LAYER_APPLY_ACK_OWNER';
    const topShadowReaderKey = '__ZEN_POND_READ_TOP_SHADOW_PROBE';
    const waterEffectsReaderKey = '__ZEN_POND_READ_WATER_EFFECTS_PROBE';
    const waterEffectsPrinterKey = '__ZEN_POND_PRINT_WATER_EFFECTS_PROBE';
    const topShadowReaderOwnerKey = '__ZEN_POND_READ_TOP_SHADOW_PROBE_OWNER';
    const mountDebug = (label, details = null) => {
        debugLog(`${label}`, {
            mountId,
            ...(isObject(details) ? details : {}),
        });
    };
    const emitControllerBootTrace = (event, details = null) => (
        emitZenMainBootTrace(event, currentOptions?.bootTraceContext || null, {
            mountId,
            ...(isObject(details) ? details : {}),
        })
    );
    const emitReadiness = ({
        phase,
        reason = '',
        firstFrameCommitted = false,
        degraded = false,
        error = null,
        metadata = null,
    } = {}) => {
        const snapshot = createZenPondReadinessSnapshot({
            phase,
            reason,
            mountId,
            firstFrameCommitted,
            degraded,
            error,
            metadata,
        });
        emitControllerBootTrace('pond_controller:readiness', {
            phase: snapshot.phase,
            reason: snapshot.reason,
            firstFrameCommitted: snapshot.firstFrameCommitted,
            degraded: snapshot.degraded,
            failed: snapshot.failed,
        });
        if (typeof currentOptions?.onReadinessChange === 'function') {
            currentOptions.onReadinessChange(snapshot);
        }
        return snapshot;
    };

    let firstFrameVisible = false;
    const workerCanvasHost = createThemeWorkerCanvasHostController({
        createCanvas: createWorkerCanvasElement,
        canvasOptions: {
            style: ZEN_POND_PENDING_CANVAS_STYLE,
        },
        resolveHost(nextHost) {
            return assertWorkerMountContract({
                ...currentOptions,
                backgroundHost: nextHost,
            });
        },
        onAttached({
            label,
            host: attachedHost,
            canvasConnected,
            hostClientWidth,
            hostClientHeight,
        } = {}) {
            host = attachedHost;
            emitReadiness({
                phase: ZEN_POND_READINESS_PHASE.ATTACHED,
                reason: label || 'worker_canvas_attached',
                // Reparenting a live canvas does not undo its committed frame.
                // Current scene admission remains owned by the scene ACK gate.
                firstFrameCommitted: firstFrameVisible,
                metadata: {
                    canvasConnected: canvasConnected === true,
                    hostClientWidth: Number(hostClientWidth) || 0,
                    hostClientHeight: Number(hostClientHeight) || 0,
                },
            });
            mountDebug(label || 'worker_canvas_attached', {
                hostClientWidth,
                hostClientHeight,
                canvasConnected,
            });
        },
    });
    const workerCanvas = workerCanvasHost.canvas;
    const setWorkerCanvasFirstFrameVisible = (visible) => {
        if (!workerCanvas?.style) return;
        firstFrameVisible = visible;
        workerCanvas.style.opacity = visible ? '1' : '0';
        workerCanvas.style.willChange = visible ? 'auto' : 'opacity';
        syncPetalReceiver();
    };

    let disposePetalReceiver = null;
    let receiverViewport = null;
    let disposed = false;
    let stopDprObservation = null;
    let runtimeClient = null;
    let lifecycleState = 'attached';
    let parked = false;
    let lastRuntimeActiveState = null;
    let lastInputStateSignature = '';
    let lastSceneSessionSignature = '';
    let lastEnvironmentAuthoritySignature = '';
    let lastRuntimeParamsSignature = '';
    let lastRuntimeParamsSceneIdentity = '';
    let runtimeParamsRequestSequence = 0;
    let lastFishRosterSignature = '';
    let lastRendererSizeSignature = '';
    let resizeSettleTimer = null;
    let pendingRendererSizeSignature = '';
    let pendingRendererSizeStableCount = 0;
    let lastRuntimeParamsProbe = null;
    let lastEnvironmentAuthorityProbe = null;
    let lastFishRosterProbe = null;
    let lastSceneSessionProbe = null;
    let lastTopShadowDebugBlackout = null;
    let runtimeGateLogCount = 0;
    let startupFirstFrameCommitted = false;
    let startupFirstFrameCallbackNotified = false;
    let expectedPresentationSceneCommit = null;
    let lastNotifiedPresentationSceneCommitKey = null;
    let lastCommittedPresentationSceneAckMetadata = null;
    let runtimeStartRequestedAtMs = 0;
    let runtimeFirstFrameAckElapsedMs = null;
    let expectedFirstFrameFishCount = 0;
    let expectedFirstFrameFishSignatureLength = 0;
    if (debugGlobal) {
        debugGlobal[topShadowProbeKey] = null;
        debugGlobal[waterEffectsProbeKey] = null;
        debugGlobal[waterLayerApplyAckKey] = null;
        debugGlobal[waterLayerApplyAckOwnerKey] = mountId;
    }
    const attachCanvasToHost = (nextHost, debugLabel = 'worker_canvas_attached') => {
        const resolvedHost = workerCanvasHost.attachToHost(nextHost, {
            label: debugLabel,
        });
        host = resolvedHost;
        return host;
    };

    attachCanvasToHost(currentOptions.backgroundHost, 'mount_canvas_attached');

    const readWaterEffectsMetrics = async () => {
        if (!runtimeClient || disposed) return null;
        try {
            return await runtimeClient.flushMetrics();
        } catch (error) {
            return {
                error: String(error?.message || error || 'ZEN_POND_WATER_EFFECTS_METRICS_READ_FAILED'),
            };
        }
    };
    const readWaterEffectsProbe = async () => {
        if (!runtimeClient || disposed) {
            return debugGlobal?.[waterEffectsProbeKey] || debugGlobal?.[topShadowProbeKey] || null;
        }
        const metrics = await readWaterEffectsMetrics();
        if (isObject(metrics?.error)) return metrics;
        if (typeof metrics?.error === 'string') {
            return {
                error: metrics.error,
            };
        }
        const probe = isObject(metrics?.mainMetrics)
            ? normalizeTopShadowProbe(metrics.mainMetrics.waterEffects)
            : null;
        if (debugGlobal) {
            debugGlobal[topShadowProbeKey] = probe;
            debugGlobal[waterEffectsProbeKey] = probe;
        }
        return probe;
    };
    const bindGlobalTopShadowReader = () => {
        if (!debugGlobal) return;
        debugGlobal[topShadowReaderOwnerKey] = mountId;
        debugGlobal[topShadowReaderKey] = readWaterEffectsProbe;
        debugGlobal[waterEffectsReaderKey] = readWaterEffectsProbe;
        debugGlobal[waterEffectsPrinterKey] = async () => {
            const probe = await readWaterEffectsProbe();
            if (typeof console !== 'undefined' && typeof console.log === 'function') {
                console.log('[ZenPond][waterEffectsProbe]', probe);
            }
            return probe;
        };
        bindZenPondWaterEffectsDebugControls({
            debugGlobal,
            mountId,
            syncRuntimeParams: pushRuntimeParams,
            readMetrics: readWaterEffectsMetrics,
            readProbe: readWaterEffectsProbe,
            injectSurfaceDisturbanceFixtures:
                (fixture) => {
                    if (!runtimeClient || disposed) {
                        throw new Error(
                            'ZEN_POND_DEBUG_DISTURBANCE_RUNTIME_INACTIVE',
                        );
                    }
                    return runtimeClient
                        .injectDebugSurfaceDisturbances(fixture);
                },
            isDisposed: () => disposed === true,
        });
    };
    const unbindGlobalTopShadowReader = () => {
        if (!debugGlobal) return;
        if (debugGlobal[topShadowReaderOwnerKey] !== mountId) return;
        debugGlobal[topShadowReaderOwnerKey] = null;
        debugGlobal[topShadowReaderKey] = null;
        debugGlobal[waterEffectsReaderKey] = null;
        debugGlobal[waterEffectsPrinterKey] = null;
        unbindZenPondWaterEffectsDebugControls({
            debugGlobal,
            mountId,
        });
    };
    const resolveRuntimeActive = () => (
        parked !== true
        && currentOptions.animationEnabledRef.current !== false
    );
    const emitRuntimeFirstFrameReady = (metadata = null) => {
        if (typeof currentOptions?.onFirstFrameReady !== 'function') return;
        try {
            currentOptions.onFirstFrameReady({
                mountId,
                renderer: 'zen_pond_worker_pixi_offscreen',
                ...(isObject(metadata) ? metadata : {}),
            });
        } catch (_) {
            // Callback failures must not destabilize the renderer control channel.
        }
    };
    const emitCommittedPresentationSceneReady = ({
        reason,
        metadata = null,
    } = {}) => {
        const readinessMetadata = isObject(metadata) ? metadata : null;
        setWorkerCanvasFirstFrameVisible(true);
        emitReadiness({
            phase: ZEN_POND_READINESS_PHASE.FIRST_FRAME_COMMITTED,
            reason,
            firstFrameCommitted: true,
            metadata: readinessMetadata,
        });
        emitRuntimeFirstFrameReady({
            ...(readinessMetadata || {}),
            reason,
            firstFrameAcked: true,
        });
    };
    const commitStartupFirstFrame = (metadata = null) => {
        if (startupFirstFrameCommitted) return false;
        startupFirstFrameCommitted = true;
        setWorkerCanvasFirstFrameVisible(true);
        emitReadiness({
            phase: ZEN_POND_READINESS_PHASE.FIRST_FRAME_COMMITTED,
            reason: 'first_frame_committed',
            firstFrameCommitted: true,
            degraded: metadata?.initOrderOk === false,
            metadata: isObject(metadata) ? metadata : null,
        });
        emitControllerBootTrace('pond_controller:first_frame_ready', {
            metadata,
        });
        return true;
    };
    const ensureWorkerCanvasAttached = () => {
        if (!workerCanvas || workerCanvasHost.isAttached()) return false;
        try {
            workerCanvasHost.attachToHost(host, {
                label: 'worker_canvas_reattached',
            });
            return true;
        } catch (_) {
            return false;
        }
    };
    const resolveRendererSize = () => {
        const dpr = readDevicePixelRatio(window);
        if (ZEN_POND_LOCK_RENDER_SIZE) {
            const width = Math.max(1, Math.round(Number(currentOptions?.width) || 560));
            const height = Math.max(1, Math.round(Number(currentOptions?.height) || 320));
            return createZenPondViewportMetrics({
                width,
                height,
                dpr,
            });
        }
        const sizeRef = currentOptions?.rendererSizeRef;
        const hostWidth = Number(host?.clientWidth ?? host?.offsetWidth ?? 0);
        const hostHeight = Number(host?.clientHeight ?? host?.offsetHeight ?? 0);
        const width = Number(sizeRef?.current?.width ?? currentOptions?.width ?? hostWidth);
        const height = Number(sizeRef?.current?.height ?? currentOptions?.height ?? hostHeight);
        const safeWidth = Number.isFinite(width) && width > 0
            ? Math.max(1, Math.round(width))
            : Math.max(1, Math.round(hostWidth) || 1);
        const safeHeight = Number.isFinite(height) && height > 0
            ? Math.max(1, Math.round(height))
            : Math.max(1, Math.round(hostHeight) || 1);
        return createZenPondViewportMetrics({
            width: safeWidth,
            height: safeHeight,
            dpr,
        });
    };
    const syncRendererSize = ({ force = false } = {}) => {
        if (ZEN_POND_LOCK_RENDER_SIZE) return false;
        if (!runtimeClient || disposed) return false;
        const nextSize = resolveRendererSize();
        if (!nextSize.width || !nextSize.height) return false;
        if (!force && nextSize.signature === lastRendererSizeSignature) return false;
        if (!force) {
            if (pendingRendererSizeSignature !== nextSize.signature) {
                pendingRendererSizeSignature = nextSize.signature;
                pendingRendererSizeStableCount = 1;
                return false;
            }
            pendingRendererSizeStableCount += 1;
            if (pendingRendererSizeStableCount < 2) {
                return false;
            }
        }
        pendingRendererSizeSignature = '';
        pendingRendererSizeStableCount = 0;
        lastRendererSizeSignature = nextSize.signature;
        mountDebug('sync_renderer_size', {
            force,
            signature: nextSize.signature,
            width: nextSize.width,
            height: nextSize.height,
            dpr: nextSize.dpr,
        });
        emitControllerBootTrace('pond_controller:sync_renderer_size_sent', {
            force,
            signature: nextSize.signature,
            width: nextSize.width,
            height: nextSize.height,
        });
        receiverViewport = { viewportWidth: nextSize.width, viewportHeight: nextSize.height, width: nextSize.width, height: nextSize.height };
        const resizePayload = { width: nextSize.width, height: nextSize.height, dpr: nextSize.dpr };
        runtimeClient.resize(resizePayload);
        clearTimeout(resizeSettleTimer);
        resizeSettleTimer = setTimeout(() => {
            resizeSettleTimer = null;
            if (!disposed && runtimeClient) runtimeClient.resize({ ...resizePayload, settled: true });
        }, ZEN_POND_RESIZE_SETTLE_MS);
        return true;
    };

    const pushInputState = ({ force = false } = {}) => {
        if (!runtimeClient || disposed || !resolveRuntimeActive()) return false;
        const inputStateSnapshot = buildWorkerInputStateControlSnapshot(currentOptions);
        const { signature, payload } = inputStateSnapshot;
        if (!force && signature === lastInputStateSignature) {
            return false;
        }
        lastInputStateSignature = signature;
        runtimeClient.setInputState({
            ...payload,
            onAck: (result = null) => {
                if (typeof currentOptions?.onWorkerInteractionFeedback !== 'function') return;
                const hoverDomain = typeof result?.hoverDomain === 'string' && result.hoverDomain
                    ? result.hoverDomain
                    : null;
                const hoveredFishUid = toOptionalUid(result?.hoveredFishUid);
                const selectedFishUid = toOptionalUid(result?.selectedFishUid);
                const clickPulseTokenRaw = toOptionalFiniteNumber(result?.clickPulseToken);
                const clickPulseToken = clickPulseTokenRaw !== null
                    ? Math.max(0, Math.floor(clickPulseTokenRaw))
                    : null;
                const clickDomain = typeof result?.clickDomain === 'string' && result.clickDomain
                    ? result.clickDomain
                    : null;
                const clickFishUid = toOptionalUid(result?.clickFishUid);
                const clickAction = typeof result?.clickAction === 'string' && result.clickAction
                    ? result.clickAction
                    : null;
                currentOptions.onWorkerInteractionFeedback({
                    hoverDomain,
                    hoveredFishUid,
                    hoverAction: result?.hoverAction === 'register_protected_site' ? result.hoverAction : null,
                    selectedFishUid,
                    clickPulseToken,
                    clickDomain,
                    clickFishUid,
                    clickAction,
                    clickEntityId: result?.clickEntityId,
                });
            },
        });
        recordControlPayloadTelemetry({
            channel: 'input',
            buildMs: 0,
            signature,
            sent: true,
        });
        return true;
    };

    const pushSceneSession = ({ force = false } = {}) => {
        if (!runtimeClient || disposed) return false;
        const nextProbe = buildSceneSessionInputProbe(currentOptions);
        if (!force && !shouldRebuildSceneSessionPayload(lastSceneSessionProbe, nextProbe)) {
            emitControllerBootTrace('pond_controller:sync_scene_session_skipped', {
                reason: 'probe_unchanged',
            });
            recordControlPayloadTelemetry({
                channel: 'scene_session',
                buildMs: 0,
                signature: '',
                sent: false,
                skippedByProbe: true,
            });
            return false;
        }
        lastSceneSessionProbe = nextProbe;
        const buildStartMs = nowPerfMs();
        const snapshot = buildSceneSessionSyncPayload(currentOptions);
        const buildMs = Math.max(0, nowPerfMs() - buildStartMs);
        const signature = snapshot?.signature || '';
        if (!snapshot || (!force && signature === lastSceneSessionSignature)) {
            emitControllerBootTrace('pond_controller:sync_scene_session_skipped', {
                reason: !snapshot ? 'no_snapshot' : 'signature_unchanged',
                signatureLength: signature.length,
            });
            recordControlPayloadTelemetry({
                channel: 'scene_session',
                buildMs,
                signature,
                sent: false,
            });
            return false;
        }
        lastSceneSessionSignature = signature;
        emitControllerBootTrace('pond_controller:sync_scene_session_sent', {
            force,
            signatureLength: signature.length,
            buildMs: Number(buildMs.toFixed(2)),
        });
        runtimeClient.syncSceneSession({
            sceneSession: snapshot.payload,
        });
        recordControlPayloadTelemetry({
            channel: 'scene_session',
            buildMs,
            signature,
            sent: true,
        });
        return true;
    };

    const pushEnvironmentAuthority = ({ force = false } = {}) => {
        if (!runtimeClient || disposed) return false;
        const nextProbe = buildEnvironmentAuthorityInputProbe(currentOptions);
        if (
            !force
            && !shouldRebuildEnvironmentAuthorityPayload(
                lastEnvironmentAuthorityProbe,
                nextProbe,
            )
        ) {
            emitControllerBootTrace('pond_controller:sync_environment_authority_skipped', {
                reason: 'probe_unchanged',
            });
            recordControlPayloadTelemetry({
                channel: 'environment_authority',
                buildMs: 0,
                signature: '',
                sent: false,
                skippedByProbe: true,
            });
            return false;
        }
        lastEnvironmentAuthorityProbe = nextProbe;
        const buildStartMs = nowPerfMs();
        const snapshot = buildEnvironmentAuthoritySyncPayload(currentOptions);
        const buildMs = Math.max(0, nowPerfMs() - buildStartMs);
        const signature = snapshot?.signature || '';
        if (!snapshot || (!force && signature === lastEnvironmentAuthoritySignature)) {
            emitControllerBootTrace('pond_controller:sync_environment_authority_skipped', {
                reason: !snapshot ? 'no_snapshot' : 'signature_unchanged',
                signatureLength: signature.length,
            });
            recordControlPayloadTelemetry({
                channel: 'environment_authority',
                buildMs,
                signature,
                sent: false,
            });
            return false;
        }
        lastEnvironmentAuthoritySignature = signature;
        emitControllerBootTrace('pond_controller:sync_environment_authority_sent', {
            force,
            signatureLength: signature.length,
            buildMs: Number(buildMs.toFixed(2)),
        });
        runtimeClient.syncEnvironmentAuthority({
            envAuthority: snapshot.payload,
        });
        recordControlPayloadTelemetry({
            channel: 'environment_authority',
            buildMs,
            signature,
            sent: true,
        });
        return true;
    };

    const pushRuntimeParams = ({ force = false } = {}) => {
        if (!runtimeClient || disposed) return false;
        const nextProbe = buildRuntimeParamsInputProbe(currentOptions);
        const nextTopShadowDebugBlackout = resolveTopShadowDebugBlackoutFlag();
        const topShadowDebugChanged = (
            lastTopShadowDebugBlackout === null
            || lastTopShadowDebugBlackout !== nextTopShadowDebugBlackout
        );
        if (
            !force
            && !topShadowDebugChanged
            && !shouldRebuildRuntimeParamsPayload(lastRuntimeParamsProbe, nextProbe)
        ) {
            emitControllerBootTrace('pond_controller:sync_runtime_params_skipped', {
                reason: 'probe_unchanged',
            });
            recordControlPayloadTelemetry({
                channel: 'runtime_params',
                buildMs: 0,
                signature: '',
                sent: false,
                skippedByProbe: true,
            });
            return false;
        }
        lastRuntimeParamsProbe = nextProbe;
        const buildStartMs = nowPerfMs();
        const snapshotRaw = buildRuntimeParamsSyncPayload(currentOptions);
        const snapshot = withTopShadowDebugRuntimeParams(snapshotRaw, nextTopShadowDebugBlackout);
        const buildMs = Math.max(0, nowPerfMs() - buildStartMs);
        const signature = snapshot?.signature || '';
        const sceneIdentity = buildRuntimeParamsSceneIdentity(snapshot?.payload);
        if (!snapshot || (!force && signature === lastRuntimeParamsSignature)) {
            emitControllerBootTrace('pond_controller:sync_runtime_params_skipped', {
                reason: !snapshot ? 'no_snapshot' : 'signature_unchanged',
                signatureLength: signature.length,
            });
            recordControlPayloadTelemetry({
                channel: 'runtime_params',
                buildMs,
                signature,
                sent: false,
            });
            return false;
        }
        lastRuntimeParamsSignature = signature;
        lastRuntimeParamsSceneIdentity = sceneIdentity;
        runtimeParamsRequestSequence += 1;
        const requestSequence = runtimeParamsRequestSequence;
        lastTopShadowDebugBlackout = nextTopShadowDebugBlackout;
        emitControllerBootTrace('pond_controller:sync_runtime_params_sent', {
            force,
            signatureLength: signature.length,
            buildMs: Number(buildMs.toFixed(2)),
        });
        runtimeClient.syncRuntimeParams({
            runtimeParams: snapshot.payload,
            onAck: (result = null) => {
                if (
                    disposed
                    || debugGlobal?.[waterLayerApplyAckOwnerKey] !== mountId
                ) {
                    return;
                }
                const applyAck = isObject(result)
                    ? {
                        mountId,
                        requestSequence,
                        runtimeParamsSignature: signature,
                        qualityChanged: result.qualityChanged === true,
                        visualProfileChanged: result.visualProfileChanged === true,
                        sceneRemounted: result.sceneRemounted === true,
                        waterLayerApplied:
                            result.waterLayerApplied === true,
                        waterLayerApply: isObject(result.waterLayerApply)
                            ? { ...result.waterLayerApply }
                            : null,
                    }
                    : null;
                if (debugGlobal) {
                    debugGlobal[waterLayerApplyAckKey] = applyAck;
                }
                emitControllerBootTrace(
                    'pond_controller:sync_runtime_params_applied',
                    applyAck,
                );
                if (shouldCommitRuntimeParamsSceneRemountAck({
                    sceneRemounted: result?.sceneRemounted === true,
                    acknowledgedSceneIdentity: sceneIdentity,
                    latestSceneIdentity: lastRuntimeParamsSceneIdentity,
                })) {
                    emitCommittedPresentationSceneReady({
                        reason: 'worker_runtime_params_scene_remount_ack',
                        metadata: {
                            ackKind: 'runtime_params_scene_remount',
                            requestSequence,
                            latestRequestSequence: runtimeParamsRequestSequence,
                            supersededByEquivalentRequest:
                                requestSequence !== runtimeParamsRequestSequence,
                            sceneIdentity,
                            qualityChanged: result.qualityChanged === true,
                            visualProfileChanged: result.visualProfileChanged === true,
                        },
                    });
                }
            },
        });
        recordControlPayloadTelemetry({
            channel: 'runtime_params',
            buildMs,
            signature,
            sent: true,
        });
        return true;
    };

    const pushFishRoster = ({ force = false } = {}) => {
        if (!runtimeClient || disposed) return false;
        const nextProbe = buildFishRosterInputProbe(currentOptions);
        if (!force && !shouldRebuildFishRosterPayload(lastFishRosterProbe, nextProbe)) {
            emitControllerBootTrace('pond_controller:sync_fish_roster_skipped', {
                reason: 'probe_unchanged',
            });
            recordControlPayloadTelemetry({
                channel: 'fish_roster',
                buildMs: 0,
                signature: '',
                sent: false,
                skippedByProbe: true,
            });
            return false;
        }
        lastFishRosterProbe = nextProbe;
        const buildStartMs = nowPerfMs();
        const snapshot = buildFishRosterSyncPayload(currentOptions);
        const buildMs = Math.max(0, nowPerfMs() - buildStartMs);
        const signature = snapshot?.signature || '';
        if (!snapshot || (!force && signature === lastFishRosterSignature)) {
            emitControllerBootTrace('pond_controller:sync_fish_roster_skipped', {
                reason: !snapshot ? 'no_snapshot' : 'signature_unchanged',
                signatureLength: signature.length,
            });
            recordControlPayloadTelemetry({
                channel: 'fish_roster',
                buildMs,
                signature,
                sent: false,
            });
            return false;
        }
        lastFishRosterSignature = signature;
        expectedFirstFrameFishCount = snapshot.expectedFishCount - snapshot.deferredInvitationCount;
        expectedFirstFrameFishSignatureLength = signature.length;
        expectedPresentationSceneCommit = buildZenPondExpectedPresentationSceneCommit(snapshot);
        emitControllerBootTrace('pond_controller:sync_fish_roster_sent', {
            force,
            signatureLength: signature.length,
            expectedFirstFrameFishCount,
            presentationSceneCommitKey: expectedPresentationSceneCommit?.presentationSceneCommitKey || null,
            presentationRequiredVisibleFishCount: expectedPresentationSceneCommit?.requiredVisibleFishCount ?? 0,
            buildMs: Number(buildMs.toFixed(2)),
        });
        runtimeClient.syncFishRoster({
            fishRoster: snapshot.payload,
            presentationSceneCommitKey: snapshot.presentationSceneCommitKey,
            presentationRosterSignature: snapshot.presentationRosterSignature,
            workerRosterSignature: snapshot.workerRosterSignature,
            expectedFishCount: snapshot.expectedFishCount,
            deferredInvitationCount: snapshot.deferredInvitationCount,
            requiredVisibleFishCount: snapshot.requiredVisibleFishCount,
        });
        recordControlPayloadTelemetry({
            channel: 'fish_roster',
            buildMs,
            signature,
            sent: true,
        });
        return true;
    };

    const syncPetalReceiver = () => {
        const active = !disposed && lifecycleState !== 'error' && firstFrameVisible
            && runtimeClient && resolveRuntimeActive();
        if (!active) {
            disposePetalReceiver?.();
            disposePetalReceiver = null;
        } else if (!disposePetalReceiver) {
            disposePetalReceiver = registerZenPetalReceiver({
                element: workerCanvas,
                getInteractionSurface: () => currentOptions.interactionSurfaceRef.current,
                getViewport: () => receiverViewport,
                submit: (landings) => runtimeClient.landPetals({ landings, ...receiverViewport }),
            });
        }
    };

    const applyRuntimeGate = ({ forcePush = false } = {}) => {
        if (!runtimeClient || disposed) return;
        ensureWorkerCanvasAttached();
        const active = resolveRuntimeActive();
        const stateChanged = lastRuntimeActiveState === null || lastRuntimeActiveState !== active;
        lastRuntimeActiveState = active;
        runtimeGateLogCount += 1;
        if (runtimeGateLogCount <= 5 || runtimeGateLogCount % 50 === 0 || stateChanged || forcePush) {
            mountDebug('apply_runtime_gate', {
                count: runtimeGateLogCount,
                active,
                stateChanged,
                forcePush,
                hostClientWidth: Number(host?.clientWidth) || 0,
                hostClientHeight: Number(host?.clientHeight) || 0,
                canvasWidth: Number(workerCanvas?.width) || 0,
                canvasHeight: Number(workerCanvas?.height) || 0,
                canvasConnected: workerCanvas?.isConnected === true,
                canvasParentMatchesHost: workerCanvas?.parentNode === host,
            });
        }
        if (stateChanged || forcePush) {
            emitControllerBootTrace('pond_controller:runtime_gate', {
                active,
                stateChanged,
                forcePush,
                hostClientWidth: Number(host?.clientWidth) || 0,
                hostClientHeight: Number(host?.clientHeight) || 0,
            });
        }
        runtimeClient.setVisibility({
            active,
        });
        syncPetalReceiver();
        if (!active) {
            return;
        }
        syncRendererSize({ force: stateChanged || forcePush });
        if (stateChanged || forcePush) {
            pushInputState({ force: true });
        }
    };

    const hardFailRuntime = (reason, error = null) => {
        if (disposed || lifecycleState === 'error') return;
        stopDprObservation?.();
        stopDprObservation = null;
        const errorMessage = error ? String(error?.message || error) : null;
        const errorCode = typeof error?.code === 'string' && error.code.trim()
            ? error.code.trim()
            : null;
        const startupProgress = error?.details?.startupProgress === null
            || error?.details?.startupProgress === undefined
            ? null
            : requireZenPondWorkerStartupProgress(
                error.details.startupProgress,
            );
        mountDebug('hard_fail_runtime', {
            reason,
            error: errorMessage,
            code: errorCode,
            startupProgress,
        });
        if (runtimeClient) {
            runtimeClient.terminate({ reason: `hard_fail_${reason}` });
        }
        lastRuntimeActiveState = null;
        runtimeClient = null;
        lifecycleState = 'error';
        syncPetalReceiver();
        unbindGlobalTopShadowReader();
        if (
            debugGlobal?.[waterLayerApplyAckOwnerKey] === mountId
        ) {
            debugGlobal[waterLayerApplyAckKey] = null;
            debugGlobal[waterLayerApplyAckOwnerKey] = null;
        }
        workerCanvasHost.detach();
        emitReadiness({
            phase: ZEN_POND_READINESS_PHASE.FAILED,
            reason,
            error: errorMessage,
            metadata: {
                presentationSceneCommitKey:
                    expectedPresentationSceneCommit?.presentationSceneCommitKey || null,
                errorCode,
                startupProgress,
            },
        });
        recordHardWorkerFailure(reason, {
            error: errorMessage,
            stack: typeof error?.stack === 'string' ? error.stack : null,
            code: errorCode,
            startupProgress,
        });
    };

    runtimeClient = createZenPondWorkerRuntimeClient({
        canvas: workerCanvas,
        onInvitationMembership(entityIds) {
            if (typeof currentOptions?.onWorkerInteractionFeedback === 'function') {
                currentOptions.onWorkerInteractionFeedback({ kind: 'invitation_membership', entityIds });
            }
        },
        onReady(capabilities = null) {
            emitReadiness({
                phase: ZEN_POND_READINESS_PHASE.WORKER_READY,
                reason: 'worker_ready',
                metadata: isObject(capabilities) ? { capabilities } : null,
            });
        },
        onError(error) {
            if (lifecycleState === 'error' || disposed) return;
            mountDebug('runtime_on_error', {
                error: String(error?.message || error || 'unknown'),
            });
            hardFailRuntime('runtime_error', error);
        },
        onMetrics(metrics) {
            if (!debugGlobal) return;
            const probe = isObject(metrics?.mainMetrics)
                ? normalizeTopShadowProbe(metrics.mainMetrics.waterEffects)
                : null;
            debugGlobal[topShadowProbeKey] = probe;
            debugGlobal[waterEffectsProbeKey] = probe;
        },
        onStartupTimeline(event = null) {
            emitControllerBootTrace('pond_controller:worker_start_pipeline', event);
        },
        onFirstFrameAck(message = null) {
            const metrics = isObject(message?.metrics) ? message.metrics : null;
            const runtimeHealth = isObject(message?.runtimeHealth) ? message.runtimeHealth : null;
            const initOrder = isObject(message?.initOrder)
                ? message.initOrder
                : (isObject(runtimeHealth?.initOrder) ? runtimeHealth.initOrder : null);
            const fromInitMs = isObject(initOrder?.fromInitMs) ? initOrder.fromInitMs : null;
            const deltasMs = isObject(initOrder?.deltasMs) ? initOrder.deltasMs : null;
            const waitGapsMs = isObject(initOrder?.waitGapsMs) ? initOrder.waitGapsMs : null;
            const workSpansMs = isObject(initOrder?.workSpansMs) ? initOrder.workSpansMs : null;
            const budgetMs = isObject(initOrder?.budgetMs) ? initOrder.budgetMs : null;
            const rendererModuleAdmission = isObject(initOrder?.rendererModuleAdmission)
                ? initOrder.rendererModuleAdmission
                : null;
            const frameMetrics = isObject(message?.frameMetrics) ? message.frameMetrics : null;
            const fishCount = Math.max(0, Math.floor(Number(message?.fishCount) || 0));
            const visibleFishCount = Math.max(0, Math.floor(Number(message?.visibleFishCount) || 0));
            const workerRequiredFirstFrameFishCount = Math.max(
                0,
                Math.floor(Number(message?.requiredFirstFrameFishCount) || 0),
            );
            const requiredFirstFrameFishCount = Math.max(
                expectedFirstFrameFishCount,
                workerRequiredFirstFrameFishCount,
            );
            const requiredVisibleFishCount = requiredFirstFrameFishCount > 0 ? 1 : 0;
            runtimeFirstFrameAckElapsedMs = runtimeStartRequestedAtMs > 0
                ? Number(Math.max(0, nowPerfMs() - runtimeStartRequestedAtMs).toFixed(1))
                : null;
            if (
                requiredFirstFrameFishCount > 0
                && (
                    fishCount < requiredFirstFrameFishCount
                    || visibleFishCount < requiredVisibleFishCount
                )
            ) {
                emitControllerBootTrace('pond_controller:first_frame_ack_rejected', {
                    reason: 'fish_roster_mismatch',
                    fishCount,
                    visibleFishCount,
                    requiredFirstFrameFishCount,
                    requiredVisibleFishCount,
                    expectedFirstFrameFishCount,
                    workerRequiredFirstFrameFishCount,
                    expectedFirstFrameFishSignatureLength,
                    ackElapsedMs: runtimeFirstFrameAckElapsedMs,
                    sinceWorkerStartMs: toOptionalFiniteNumber(message?.sinceInitMs),
                    frameMs: toOptionalFiniteNumber(message?.frameMs),
                    frameMetrics,
                });
                hardFailRuntime(
                    'first_frame_fish_roster_mismatch',
                    new Error(`ZEN_POND_FIRST_FRAME_FISH_ROSTER_MISMATCH:expected=${requiredFirstFrameFishCount}:actual=${fishCount}`),
                );
                return;
            }
            if (ZEN_POND_CONTROLLER_TRACE_ENABLED) {
                const firstFrameRuntimeLoopFrameCount = Math.max(0, Math.floor(Number(message?.runtimeLoopFrameCount) || 0));
                const requiredRuntimeLoopFrameCount = Math.max(0, Math.floor(Number(message?.requiredRuntimeLoopFrameCount) || 0));
                const firstFrameRenderSource = typeof message?.source === 'string' ? message.source : '';
                const firstFrameSurfaceEffects = {
                    requested: message?.surfaceEffectsRequested === true,
                    enabled: message?.surfaceEffectsEnabled === true,
                    deferred: message?.surfaceEffectsDeferredForFirstFrame === true,
                    waterLayerRequested: message?.waterLayerRequested === true,
                    waterLayerApplyReady: message?.waterLayerApplyReady === true,
                    waterLayerProbeReady: message?.waterLayerProbeReady === true,
                    essentialWaterAtmosphereReady: message?.essentialWaterAtmosphereReady === true,
                    reason: typeof message?.waterEffectsReason === 'string'
                        ? message.waterEffectsReason
                        : '',
                };
                emitControllerBootTrace('pond_controller:worker_first_frame_ack', {
                    hasMetrics: Boolean(metrics),
                    ackElapsedMs: runtimeFirstFrameAckElapsedMs,
                    sinceWorkerStartMs: toOptionalFiniteNumber(message?.sinceInitMs),
                    source: firstFrameRenderSource,
                    runtimeLoopMounted: message?.runtimeLoopMounted === true,
                    runtimeLoopFrameCount: firstFrameRuntimeLoopFrameCount,
                    requiredRuntimeLoopFrameCount,
                    surfaceEffects: firstFrameSurfaceEffects,
                    frameMs: toOptionalFiniteNumber(message?.frameMs),
                    frameMetrics,
                    fishCount,
                    visibleFishCount,
                    requiredFirstFrameFishCount,
                    requiredVisibleFishCount,
                    expectedFirstFrameFishCount,
                    workerRequiredFirstFrameFishCount,
                    firstFrameAckDeferredCount: Math.max(0, Math.floor(Number(message?.firstFrameAckDeferredCount) || 0)),
                    initOrderOk: initOrder?.ok === true,
                    rendererModuleAdmission,
                    fromInitMs,
                    deltasMs,
                    waitGapsMs,
                    workSpansMs,
                    budgetMs,
                });
                if (initOrder) {
                    emitControllerBootTrace('pond_controller:first_frame_timeline', {
                        ackElapsedMs: runtimeFirstFrameAckElapsedMs,
                        fromInitMs,
                        deltasMs,
                        waitGapsMs,
                        workSpansMs,
                        budgetMs,
                        rendererModuleAdmission,
                        frameMetrics,
                        recentEvents: Array.isArray(runtimeHealth?.events)
                            ? runtimeHealth.events.slice(-16).map((event) => ({
                                name: typeof event?.name === 'string' ? event.name : '',
                                atMs: Number(event?.atMs) || 0,
                                frame: Number(event?.frame) || 0,
                                details: isObject(event?.details) ? event.details : null,
                            }))
                            : [],
                    });
                }
                if (debugGlobal) {
                    debugGlobal.__ZEN_POND_LAST_FIRST_FRAME_ACK__ = {
                        mountId,
                        ackElapsedMs: runtimeFirstFrameAckElapsedMs,
                        sinceWorkerStartMs: toOptionalFiniteNumber(message?.sinceInitMs),
                        source: firstFrameRenderSource,
                        runtimeLoopMounted: message?.runtimeLoopMounted === true,
                        runtimeLoopFrameCount: firstFrameRuntimeLoopFrameCount,
                        requiredRuntimeLoopFrameCount,
                        surfaceEffects: firstFrameSurfaceEffects,
                        frameMs: toOptionalFiniteNumber(message?.frameMs),
                        frameMetrics,
                        fishCount,
                        visibleFishCount,
                        requiredFirstFrameFishCount,
                        requiredVisibleFishCount,
                        runtimeHealth,
                    };
                }
                if (runtimeHealth && debugGlobal) {
                    debugGlobal.__ZEN_POND_LAST_RUNTIME_HEALTH__ = runtimeHealth;
                }
            }
            const startupMetadata = {
                ackKind: 'startup_first_frame',
                reason: 'worker_first_frame_ack',
                firstFrameAcked: true,
                workerMetricsIncluded: Boolean(metrics),
                ackElapsedMs: runtimeFirstFrameAckElapsedMs,
                source: typeof message?.source === 'string' ? message.source : '',
                runtimeLoopMounted: message?.runtimeLoopMounted === true,
                runtimeLoopFrameCount: Math.max(0, Math.floor(Number(message?.runtimeLoopFrameCount) || 0)),
                requiredRuntimeLoopFrameCount: Math.max(0, Math.floor(Number(message?.requiredRuntimeLoopFrameCount) || 0)),
                surfaceEffectsRequested: message?.surfaceEffectsRequested === true,
                surfaceEffectsEnabled: message?.surfaceEffectsEnabled === true,
                surfaceEffectsDeferredForFirstFrame: message?.surfaceEffectsDeferredForFirstFrame === true,
                waterLayerRequested: message?.waterLayerRequested === true,
                waterLayerApplyReady: message?.waterLayerApplyReady === true,
                waterLayerProbeReady: message?.waterLayerProbeReady === true,
                essentialWaterAtmosphereReady: message?.essentialWaterAtmosphereReady === true,
                waterEffectsReason: typeof message?.waterEffectsReason === 'string'
                    ? message.waterEffectsReason
                    : '',
                fishCount,
                visibleFishCount,
                requiredFirstFrameFishCount,
                requiredVisibleFishCount,
                expectedFirstFrameFishCount,
                workerRequiredFirstFrameFishCount,
                firstFrameAckDeferredCount: Math.max(0, Math.floor(Number(message?.firstFrameAckDeferredCount) || 0)),
                initOrderOk: initOrder?.ok === true,
                fromInitMs,
                deltasMs,
                waitGapsMs,
                workSpansMs,
                budgetMs,
                frameMetrics,
            };
            commitStartupFirstFrame(startupMetadata);
            if (
                expectedPresentationSceneCommit === null
                && startupFirstFrameCallbackNotified !== true
            ) {
                startupFirstFrameCallbackNotified = true;
                emitRuntimeFirstFrameReady(startupMetadata);
            }
        },
        onPresentationSceneFrameAck(message = null) {
            const resolution = resolveZenPondPresentationSceneFrameAck({
                expected: expectedPresentationSceneCommit,
                message,
            });
            if (!resolution.accepted) {
                emitControllerBootTrace('pond_controller:presentation_scene_frame_ack_rejected', {
                    reason: resolution.reason,
                    expectedPresentationSceneCommitKey:
                        expectedPresentationSceneCommit?.presentationSceneCommitKey || null,
                    actualPresentationSceneCommitKey:
                        typeof message?.presentationSceneCommitKey === 'string'
                            ? message.presentationSceneCommitKey
                            : null,
                    expectedWorkerRosterSignatureLength:
                        expectedPresentationSceneCommit?.workerRosterSignature?.length || 0,
                    actualWorkerRosterSignatureLength:
                        typeof message?.workerRosterSignature === 'string'
                            ? message.workerRosterSignature.length
                            : 0,
                });
                return;
            }
            const sceneCommitKey = resolution.metadata.sceneCommitKey;
            lastCommittedPresentationSceneAckMetadata = resolution.metadata;
            if (lastNotifiedPresentationSceneCommitKey === sceneCommitKey) {
                emitControllerBootTrace('pond_controller:presentation_scene_frame_ack_duplicate', {
                    sceneCommitKey,
                });
                expectedPresentationSceneCommit = null;
                return;
            }
            lastNotifiedPresentationSceneCommitKey = sceneCommitKey;
            expectedPresentationSceneCommit = null;
            emitControllerBootTrace('pond_controller:presentation_scene_frame_committed', {
                ...resolution.metadata,
            });
            emitCommittedPresentationSceneReady({
                reason: 'worker_presentation_scene_frame_ack',
                metadata: resolution.metadata,
            });
        },
    });
    bindGlobalTopShadowReader();

    const initialSceneSessionSnapshot = buildSceneSessionSyncPayload(currentOptions);
    const initialEnvironmentAuthoritySnapshot = buildEnvironmentAuthoritySyncPayload(currentOptions);
    const initialTopShadowDebugBlackout = resolveTopShadowDebugBlackoutFlag();
    const initialRuntimeParamsSnapshot = withTopShadowDebugRuntimeParams(
        buildInitialRuntimeParamsSyncPayload(currentOptions),
        initialTopShadowDebugBlackout,
    );
    const initialRuntimeParamsControlSnapshot = withTopShadowDebugRuntimeParams(
        buildRuntimeParamsSyncPayload(currentOptions),
        initialTopShadowDebugBlackout,
    );
    const initialFishRosterSnapshot = buildFishRosterSyncPayload(currentOptions);
    lastSceneSessionProbe = buildSceneSessionInputProbe(currentOptions);
    lastEnvironmentAuthorityProbe = buildEnvironmentAuthorityInputProbe(currentOptions);
    lastRuntimeParamsProbe = buildRuntimeParamsInputProbe(currentOptions);
    lastFishRosterProbe = buildFishRosterInputProbe(currentOptions);
    lastSceneSessionSignature = initialSceneSessionSnapshot?.signature || '';
    lastEnvironmentAuthoritySignature = initialEnvironmentAuthoritySnapshot?.signature || '';
    lastTopShadowDebugBlackout = initialTopShadowDebugBlackout;
    lastRuntimeParamsSignature = initialRuntimeParamsControlSnapshot?.signature || '';
    lastRuntimeParamsSceneIdentity = buildRuntimeParamsSceneIdentity(
        initialRuntimeParamsControlSnapshot?.payload,
    );
    lastFishRosterSignature = initialFishRosterSnapshot?.signature || '';
    expectedFirstFrameFishCount = initialFishRosterSnapshot.expectedFishCount - initialFishRosterSnapshot.deferredInvitationCount;
    expectedFirstFrameFishSignatureLength = lastFishRosterSignature.length;
    expectedPresentationSceneCommit = buildZenPondExpectedPresentationSceneCommit(
        initialFishRosterSnapshot,
    );
    const initialRendererSize = resolveRendererSize();
    lastRendererSizeSignature = initialRendererSize.signature;
    receiverViewport = { viewportWidth: initialRendererSize.width, viewportHeight: initialRendererSize.height, width: initialRendererSize.width, height: initialRendererSize.height };
    stopDprObservation = observeDevicePixelRatio({
        browserWindow: window,
        onChange() {
            if (resolveRuntimeActive()) syncRendererSize({ force: true });
        },
    });
    const isRuntimeActive = resolveRuntimeActive();
    runtimeStartRequestedAtMs = nowPerfMs();
    mountDebug('runtime_start_request', {
        initialRendererSize,
        isRuntimeActive,
        initialRuntimeParamsSignature: lastRuntimeParamsSignature.length,
        initialFishRosterSignature: lastFishRosterSignature.length,
    });
    emitReadiness({
        phase: ZEN_POND_READINESS_PHASE.STARTING,
        reason: isRuntimeActive ? 'runtime_start_request' : 'runtime_start_inactive',
        metadata: {
            width: initialRendererSize.width,
            height: initialRendererSize.height,
            active: isRuntimeActive,
        },
    });
    emitControllerBootTrace('pond_controller:runtime_start_request', {
        initialRendererSize,
        isRuntimeActive,
        initialRuntimeParamsSignatureLength: lastRuntimeParamsSignature.length,
        initialFishRosterSignatureLength: lastFishRosterSignature.length,
        initialFishRosterCount: expectedFirstFrameFishCount,
        presentationSceneCommitKey: expectedPresentationSceneCommit?.presentationSceneCommitKey || null,
        presentationRequiredVisibleFishCount: expectedPresentationSceneCommit?.requiredVisibleFishCount ?? 0,
        initialSceneSessionSignatureLength: lastSceneSessionSignature.length,
        awaitFirstFrameAck: isRuntimeActive,
    });
    const startRuntime = () => disposed ? Promise.resolve() : runtimeClient.start({
        width: initialRendererSize.width,
        height: initialRendererSize.height,
        dpr: initialRendererSize.dpr,
        themeId: 'zen',
        sceneGenerationKey: initialSceneSessionSnapshot?.payload?.sceneGenerationKey || '',
        seed: Number(initialSceneSessionSnapshot?.payload?.seed) || 0,
        active: isRuntimeActive,
        runtimeParams: initialRuntimeParamsSnapshot?.payload,
        fishRoster: initialFishRosterSnapshot?.payload,
        requiredFirstFrameFishCount: expectedFirstFrameFishCount,
        presentationSceneCommitKey: initialFishRosterSnapshot?.presentationSceneCommitKey,
        presentationRosterSignature: initialFishRosterSnapshot?.presentationRosterSignature,
        workerRosterSignature: initialFishRosterSnapshot?.workerRosterSignature,
        expectedFishCount: initialFishRosterSnapshot?.expectedFishCount,
        deferredInvitationCount: initialFishRosterSnapshot.deferredInvitationCount,
        requiredVisibleFishCount: initialFishRosterSnapshot?.requiredVisibleFishCount,
        awaitFirstFrameAck: isRuntimeActive,
    });
    const startup = handoff.start(startRuntime);
    void startup.then(() => {
        if (!runtimeClient || disposed) return;
        if (!isRuntimeActive) {
            mountDebug('runtime_start_success_inactive_waiting_first_frame_ack');
        }
        mountDebug('runtime_start_success');
        emitControllerBootTrace('pond_controller:runtime_start_success', {
            isRuntimeActive,
            startElapsedMs: runtimeStartRequestedAtMs > 0
                ? Number(Math.max(0, nowPerfMs() - runtimeStartRequestedAtMs).toFixed(1))
                : null,
            firstFrameAckElapsedMs: runtimeFirstFrameAckElapsedMs,
        });
        applyRuntimeGate({ forcePush: true });
        pushSceneSession({ force: false });
        pushRuntimeParams({ force: false });
        pushFishRoster({ force: false });
    }).catch((error) => {
        if (disposed || lifecycleState === 'error') return;
        mountDebug('runtime_start_failed', {
            error: String(error?.message || error || 'unknown'),
        });
        emitControllerBootTrace('pond_controller:runtime_start_failed', {
            error,
        });
        hardFailRuntime('init_failed', error);
    });

    const replayCommittedPresentationSceneAck = () => {
        if (disposed) return false;
        const expected = buildZenPondExpectedPresentationSceneCommit(
            buildFishRosterSyncPayload(currentOptions),
        );
        const resolution = resolveZenPondRetainedPresentationSceneAckReplay({
            expected,
            committedMetadata: lastCommittedPresentationSceneAckMetadata,
        });
        if (!resolution.accepted) {
            emitControllerBootTrace('pond_controller:retained_scene_ack_replay_rejected', {
                reason: resolution.reason,
                expectedSceneCommitKey: expected?.presentationSceneCommitKey || null,
                committedSceneCommitKey:
                    lastCommittedPresentationSceneAckMetadata?.sceneCommitKey || null,
                expectedPresentationRosterSignatureLength:
                    expected?.presentationRosterSignature?.length || 0,
                committedPresentationRosterSignatureLength:
                    lastCommittedPresentationSceneAckMetadata?.presentationRosterSignature?.length || 0,
                expectedWorkerRosterSignatureLength:
                    expected?.workerRosterSignature?.length || 0,
                committedWorkerRosterSignatureLength:
                    lastCommittedPresentationSceneAckMetadata?.workerRosterSignature?.length || 0,
            });
            return false;
        }
        emitControllerBootTrace('pond_controller:retained_scene_ack_replayed', {
            sceneCommitKey: resolution.metadata.sceneCommitKey,
            presentationRosterSignatureLength:
                resolution.metadata.presentationRosterSignature.length,
            workerRosterSignatureLength: resolution.metadata.workerRosterSignature.length,
        });
        emitCommittedPresentationSceneReady({
            reason: 'retained_presentation_scene_ack_replay',
            metadata: {
                ...resolution.metadata,
                retainedAckReplay: true,
            },
        });
        return true;
    };

    let disposalPromise = null;
    const dispose = ({ reason = 'renderer_unmount' } = {}) => {
        if (disposed) return disposalPromise;
        disposed = true;
        syncPetalReceiver();
        clearTimeout(resizeSettleTimer);
        stopDprObservation?.();
        stopDprObservation = null;
        mountDebug('unmount_dispose_start');
        emitControllerBootTrace('pond_controller:dispose_start', {
            reason,
        });
        lastRuntimeActiveState = null;
        if (runtimeClient) {
            const client = runtimeClient;
            runtimeClient = null;
            disposalPromise = handoff.dispose(() => client.dispose({ reason }));
            void disposalPromise.then(() => {
                    mountDebug('unmount_dispose_worker_ack', { reason });
                })
                .catch((error) => {
                    mountDebug('unmount_dispose_worker_failed', {
                        reason,
                        error: String(error?.message || error || 'unknown'),
                    });
                });
        }
        unbindGlobalTopShadowReader();
        if (
            debugGlobal?.[waterLayerApplyAckOwnerKey] === mountId
        ) {
            debugGlobal[waterLayerApplyAckKey] = null;
            debugGlobal[waterLayerApplyAckOwnerKey] = null;
        }
        workerCanvasHost.dispose();
        lifecycleState = 'disposed';
        emitReadiness({
            phase: ZEN_POND_READINESS_PHASE.DISPOSED,
            reason,
        });
        mountDebug('unmount_dispose_done');
        emitControllerBootTrace('pond_controller:dispose_done', { reason });
        return disposalPromise;
    };

    return {
        attachToHost(nextHost) {
            if (disposed) return false;
            currentOptions = {
                ...currentOptions,
                backgroundHost: nextHost,
            };
            parked = false;
            lifecycleState = 'attached';
            emitControllerBootTrace('pond_controller:attach_to_host');
            attachCanvasToHost(nextHost, 'worker_canvas_reattached');
            if (runtimeClient) {
                syncRendererSize({ force: true });
                applyRuntimeGate({ forcePush: true });
            }
            return true;
        },
        park({ parkHost = null } = {}) {
            if (disposed) return false;
            parked = true;
            lifecycleState = 'parked';
            emitControllerBootTrace('pond_controller:park', {
                hasParkHost: Boolean(parkHost),
            });
            if (parkHost) {
                currentOptions = {
                    ...currentOptions,
                    backgroundHost: parkHost,
                };
                attachCanvasToHost(parkHost, 'worker_canvas_parked');
            }
            if (runtimeClient) {
                applyRuntimeGate({ forcePush: false });
            }
            return true;
        },
        updateOptions(nextOptions = {}) {
            if (disposed) return false;
            const previousHost = currentOptions?.backgroundHost || null;
            currentOptions = nextOptions;
            const nextHost = nextOptions?.backgroundHost || null;
            const hostChanged = previousHost !== nextHost;
            const needsAttach = (
                parked !== true
                && nextHost
                && (
                    hostChanged
                    || workerCanvasHost.getHost?.() !== nextHost
                    || workerCanvasHost.isAttached() !== true
                )
            );
            if (needsAttach) {
                attachCanvasToHost(nextOptions.backgroundHost, 'worker_canvas_attached');
                emitControllerBootTrace('pond_controller:update_options_attached_host', {
                    hostChanged,
                    parked,
                });
            }
            return true;
        },
        syncRuntimeGate({ forcePush = false } = {}) {
            if (disposed || !runtimeClient) return false;
            applyRuntimeGate({ forcePush });
            return true;
        },
        syncRendererSize,
        syncInputState: pushInputState,
        syncSceneSession: pushSceneSession,
        syncEnvironmentAuthority: pushEnvironmentAuthority,
        syncRuntimeParams: pushRuntimeParams,
        syncFishRoster: pushFishRoster,
        replayCommittedPresentationSceneAck,
        dispose,
        getState() {
            return lifecycleState;
        },
    };
};

export const mountZenPondWorkerRenderer = (options = {}) => {
    return createZenPondWorkerRendererController(options);
};
