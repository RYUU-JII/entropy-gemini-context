import {
    ZEN_POND_WORKER_STARTUP_EVENT,
    requireZenPondWorkerStartupErrorCode,
    requireZenPondWorkerStartupProgress,
} from '../../renderers/worker/core/zenPondWorkerStartupContract.js';
import { normalizeZenKoiInvitationEntityIds } from '../../roster/zenKoiInvitationSlots.js';

export const createZenPondWorkerMessageBus = ({
    messageType,
    workerId,
    waterEffectsProbeAutoLogKey,
    isObject,
    normalizeTopShadowProbe,
    resolveWorkerRuntimeEventErrorMessage,
    recordWorkerRuntimeEvent,
    runtimeEventType,
    runtimeTaskType,
    runtimeLane,
    runtimeLaneValue = runtimeLane?.COMPUTE,
    runtimePriority,
    runtimeContext,
    runtimeContextValue = runtimeContext?.UI,
    runtimeDebug,
    ackGate,
    onFirstFrameAck,
    onPresentationSceneFrameAck,
    onInvitationMembership,
    emitError,
    onReady,
    getCapabilities,
    setCapabilities,
    requireReadyPayload,
} = {}) => {
    return ({ type, message } = {}) => {
        runtimeDebug('worker_message', {
            type,
            id: Number(message?.id) || 0,
        });

        if (type === messageType.FIRST_FRAME_ACK) {
            const ack = ackGate.markReceived(message);
            runtimeDebug('first_frame_ack_received', message);
            if (ack.isFirst && typeof onFirstFrameAck === 'function') {
                try {
                    onFirstFrameAck(ack.payload);
                } catch (_) {
                    // Ignore callback-side errors to keep runtime channel stable.
                }
            }
            return;
        }

        if (type === messageType.PRESENTATION_SCENE_FRAME_ACK) {
            runtimeDebug('presentation_scene_frame_ack_received', message);
            if (typeof onPresentationSceneFrameAck === 'function') {
                try {
                    onPresentationSceneFrameAck(message);
                } catch (_) {
                    // Keep recurring presentation ACK delivery isolated from callback failures.
                }
            }
            return;
        }

        if (type === messageType.RENDERER_EVENT) {
            const eventName = typeof message?.event === 'string' ? message.event : '';
            if (eventName === 'invitation_membership_changed') {
                const entityIds = normalizeZenKoiInvitationEntityIds(message?.details?.entityIds);
                if (typeof onInvitationMembership === 'function') onInvitationMembership(entityIds);
                return;
            }
            if (eventName === ZEN_POND_WORKER_STARTUP_EVENT) {
                const progress = requireZenPondWorkerStartupProgress(message?.details);
                ackGate.markProgress(progress);
                runtimeDebug('worker_startup_progress', progress);
                return;
            }
            if (eventName === 'topShadow_probe') {
                const details = isObject(message?.details) ? normalizeTopShadowProbe(message.details) : null;
                if (typeof globalThis !== 'undefined') {
                    globalThis.__ZEN_POND_LAST_TOP_SHADOW_PROBE = details;
                    globalThis.__ZEN_POND_LAST_WATER_EFFECTS_PROBE = details;
                    if (globalThis[waterEffectsProbeAutoLogKey] === true) {
                        if (typeof console !== 'undefined' && typeof console.log === 'function') {
                            console.log('[ZenPond][waterEffectsProbe]', details);
                        }
                    }
                }
                return;
            }
            if (eventName === 'worker_runtime_debug') {
                runtimeDebug('worker_runtime_debug', message?.details || null);
                return;
            }
            if (eventName === 'worker_runtime_error') {
                const details = isObject(message?.details) ? message.details : null;
                const errorMessage = resolveWorkerRuntimeEventErrorMessage(details);
                const runtimeError = new Error(errorMessage);
                if (typeof details?.errorStack === 'string') runtimeError.stack = details.errorStack;
                const startupProgress = details?.startupProgress === undefined
                    ? ackGate.getProgress()
                    : requireZenPondWorkerStartupProgress(details.startupProgress);
                if (details?.errorCode !== undefined) {
                    runtimeError.code = requireZenPondWorkerStartupErrorCode(
                        details.errorCode,
                    );
                }
                if (startupProgress) {
                    runtimeError.details = Object.freeze({ startupProgress });
                }
                const runtimeEventType = typeof details?.type === 'string'
                    ? details.type
                    : '';
                if (runtimeEventType === messageType.RESIZE) {
                    runtimeDebug('worker_runtime_resize_error', details);
                    return;
                }
                if (ackGate.hasPendingWaiter()) {
                    ackGate.rejectPending(runtimeError);
                    return;
                }
                emitError(runtimeError);
                return;
            }
            if (eventName === 'worker_runtime_warn') {
                runtimeDebug('worker_runtime_warn', message?.details || null);
                recordWorkerRuntimeEvent({
                    type: runtimeEventType.FAIL,
                    worker: workerId,
                    taskType: runtimeTaskType.ZEN_POND_RENDER_CONTROL,
                    lane: runtimeLaneValue,
                    priority: runtimePriority.BACKGROUND,
                    context: runtimeContextValue,
                    message: String(message?.details?.warning || 'ZEN_POND_WORKER_RUNTIME_WARN'),
                });
                return;
            }
            return;
        }

        if (type === messageType.READY) {
            const readyPayload = requireReadyPayload(message);
            runtimeDebug('worker_ready_message', readyPayload);
            const capabilities = getCapabilities();
            const nextCapabilities = {
                supportsWorkerRaf: typeof readyPayload.supportsWorkerRaf === 'boolean'
                    ? readyPayload.supportsWorkerRaf
                    : capabilities.supportsWorkerRaf,
                renderer: typeof readyPayload.renderer === 'string'
                    ? readyPayload.renderer
                    : (capabilities.renderer || 'zen_pond_worker_pixi_offscreen'),
            };
            setCapabilities(nextCapabilities);
            if (typeof onReady === 'function') {
                onReady(nextCapabilities);
            }
        }
    };
};
