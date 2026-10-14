import {
    ZEN_POND_WORKER_STARTUP_EVENT,
    requireZenPondWorkerStartupProgress,
} from './zenPondWorkerStartupContract.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toSafeId = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Number(parsed);
};

const resolvePayload = (message) => (
    isObject(message?.payload) ? message.payload : message
);

export const createZenPondWorkerTransport = ({
    messageType,
    nowMs,
    postMessage,
    runtimeDebugEnabled = false,
} = {}) => {
    if (typeof postMessage !== 'function') {
        throw new Error('ZEN_POND_WORKER_TRANSPORT_POST_MESSAGE_REQUIRED');
    }

    const respondResult = (id, result = null) => {
        if (id === null) return;
        postMessage({
            type: messageType.RESULT,
            id,
            result,
        });
    };

    const respondError = (id, error) => {
        const message = String(error || 'ZEN_POND_RENDERER_ERROR');
        if (id !== null) {
            postMessage({
                type: messageType.ERROR,
                id,
                error: message,
            });
            return;
        }
        postMessage({
            type: messageType.ERROR,
            error: message,
        });
    };

    const emitRendererEvent = (event, details = null) => {
        postMessage({
            type: messageType.RENDERER_EVENT,
            event,
            details: isObject(details) ? details : null,
        });
    };

    const emitWorkerRuntimeDebug = (stage, details = null) => {
        if (!runtimeDebugEnabled) return;
        emitRendererEvent('worker_runtime_debug', {
            stage: typeof stage === 'string' && stage ? stage : 'unknown',
            ts: nowMs(),
            ...(isObject(details) ? details : {}),
        });
    };

    const emitWorkerRuntimeWarn = (stage, error, details = null) => {
        postMessage({
            type: messageType.RENDERER_EVENT,
            event: 'worker_runtime_warn',
            details: {
                stage: typeof stage === 'string' && stage ? stage : 'unknown',
                warning: String(error?.message || error || 'worker_runtime_warn'),
                ...(isObject(details) ? details : {}),
            },
        });
    };

    const emitWorkerStartupProgress = (progress) => {
        const normalized = requireZenPondWorkerStartupProgress(progress);
        emitRendererEvent(ZEN_POND_WORKER_STARTUP_EVENT, normalized);
        return normalized;
    };

    const createMessageHandler = ({
        sessionGate,
        commandRouter,
        buildControlAck,
    } = {}) => {
        const handleMessage = async (event) => {
            const message = isObject(event?.data) ? event.data : {};
            const payload = resolvePayload(message);
            const type = String(message?.type || '');
            const id = toSafeId(message?.id);
            emitWorkerRuntimeDebug('message_received', {
                type: type || 'unknown',
                id,
            });

            const sessionStatus = sessionGate.evaluate({ type, payload });
            if (sessionStatus.stale) {
                emitWorkerRuntimeDebug('message_stale_ignored', {
                    type: type || 'unknown',
                    id,
                    reason: typeof sessionStatus.reason === 'string' ? sessionStatus.reason : 'stale',
                });
                const reason = typeof sessionStatus.reason === 'string' ? sessionStatus.reason : 'stale';
                respondResult(id, {
                    ignored: true,
                    reason,
                    ack: buildControlAck({
                        payload,
                        channel: type || 'unknown',
                        applied: false,
                        stale: true,
                        reason,
                    }),
                });
                return;
            }

            try {
                const handled = await commandRouter.run({
                    type,
                    id,
                    payload,
                    event,
                });
                emitWorkerRuntimeDebug('message_handled', {
                    type: type || 'unknown',
                    id,
                    handled: handled === true,
                });
                if (!handled) {
                    const unknownTypeError = `UNKNOWN_MESSAGE_TYPE:${type || 'unknown'}`;
                    emitRendererEvent('worker_runtime_warn', {
                        type: type || 'unknown',
                        warning: unknownTypeError,
                    });
                    respondError(id, unknownTypeError);
                }
            } catch (error) {
                emitWorkerRuntimeDebug('message_handler_failed', {
                    type: type || 'unknown',
                    id,
                    error: String(error?.message || error || 'ZEN_POND_WORKER_RUNTIME_ERROR'),
                });
                emitRendererEvent('worker_runtime_error', {
                    type,
                    error: String(error?.message || error || 'ZEN_POND_WORKER_RUNTIME_ERROR'),
                });
                respondError(id, String(error?.message || error || 'ZEN_POND_WORKER_REQUEST_FAILED'));
            }
        };

        let messageChain = Promise.resolve();
        return (event) => {
            messageChain = messageChain
                .then(() => handleMessage(event))
                .catch((error) => {
                    emitWorkerRuntimeDebug('message_chain_failed', {
                        error: String(error?.message || error || 'ZEN_POND_WORKER_MESSAGE_CHAIN_ERROR'),
                    });
                    emitRendererEvent('worker_runtime_error', {
                        type: 'MESSAGE_CHAIN',
                        error: String(error?.message || error || 'ZEN_POND_WORKER_MESSAGE_CHAIN_ERROR'),
                    });
                });
            return messageChain;
        };
    };

    return {
        respondResult,
        respondError,
        emitRendererEvent,
        emitWorkerRuntimeDebug,
        emitWorkerRuntimeWarn,
        emitWorkerStartupProgress,
        createMessageHandler,
    };
};
