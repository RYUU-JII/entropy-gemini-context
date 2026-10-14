import {
    WORKER_RUNTIME_SURFACE_IDS,
    createAdmittedWorkerRuntimeSession,
} from '@/platform/workers/runtime/index.js';
import {
    ZEN_HOME_RENDERER_CHANNEL,
    createZenHomeRendererChannelEnvelope,
    createZenHomeRendererChannelPrepareMessage,
    createZenHomeRendererChannelReleaseMessage,
    createZenHomeRendererDiagnosticsConfigureMessage,
    createZenHomeRendererWorldPrepareMessage,
    isZenHomeRendererDiagnosticMessage,
    requireZenHomeRendererChannelEnvelope,
    requireZenHomeRendererDiagnosticMessage,
} from './zenHomeRendererWorkerProtocol.js';
import {
    emitZenTrace,
    isZenTraceEnabled,
} from '@zen-trace';
import { releaseZenArtifactMessage } from './zenArtifactWorkerProtocol.js';
import { ZEN_BONSAI_WORKER_MESSAGE_TYPE } from './zenBonsaiWorkerProtocol.js';
import { ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED } from './zenBonsaiInitDiagnosticsCapability.js';

const CHANNEL_VALUES = new Set(Object.values(ZEN_HOME_RENDERER_CHANNEL));
const HOME_WORKER_DIAGNOSTIC_LIMIT = 32;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const readPageTimeOriginMs = () => (
    typeof globalThis.performance?.now === 'function'
    && Number.isFinite(globalThis.performance.timeOrigin)
        ? globalThis.performance.timeOrigin
        : null
);

const roundMs = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Number(parsed.toFixed(2)));
};

const requireChannel = (value) => {
    if (!CHANNEL_VALUES.has(value)) {
        throw new Error(`ZEN_HOME_RENDERER_CHANNEL_INVALID:${String(value || 'missing')}`);
    }
    return value;
};

const toError = (value, fallback = 'ZEN_HOME_RENDERER_WORKER_FAILED') => {
    if (value instanceof Error) return value;
    const message = typeof value?.message === 'string' && value.message
        ? value.message
        : String(value || fallback);
    const error = new Error(message);
    if (typeof value?.code === 'string' && value.code) error.code = value.code;
    return error;
};

const createWorkerErrorEvent = (error) => Object.freeze({
    error,
    message: error.message,
});

function createChannelPort({
    channel,
    channelSessionId,
    postMessage,
    release,
} = {}) {
    let terminated = false;
    let messageHandler = null;
    let errorHandler = null;
    const pendingMessages = [];
    const pendingErrors = [];

    const flushMessages = () => {
        if (typeof messageHandler !== 'function') return;
        while (pendingMessages.length > 0 && !terminated) {
            messageHandler(pendingMessages.shift());
        }
    };
    const flushErrors = () => {
        if (typeof errorHandler !== 'function') return;
        while (pendingErrors.length > 0 && !terminated) {
            errorHandler(pendingErrors.shift());
        }
    };

    const port = {
        get onmessage() {
            return messageHandler;
        },
        set onmessage(handler) {
            messageHandler = typeof handler === 'function' ? handler : null;
            flushMessages();
        },
        get onerror() {
            return errorHandler;
        },
        set onerror(handler) {
            errorHandler = typeof handler === 'function' ? handler : null;
            flushErrors();
        },
        postMessage(message, transfer = undefined) {
            if (terminated) {
                throw new Error(`ZEN_HOME_RENDERER_CHANNEL_TERMINATED:${channel}`);
            }
            return postMessage(channel, channelSessionId, message, transfer);
        },
        terminate(reason = 'zen_home_renderer_channel_released') {
            if (terminated) return false;
            terminated = true;
            pendingMessages.forEach(event => releaseZenArtifactMessage(event.data));
            pendingMessages.length = 0;
            pendingErrors.length = 0;
            messageHandler = null;
            errorHandler = null;
            release(channel, port, reason);
            return true;
        },
        isTerminated() {
            return terminated;
        },
        get channelSessionId() {
            return channelSessionId;
        },
        dispatchMessage(message) {
            if (terminated) { releaseZenArtifactMessage(message); return false; }
            const event = Object.freeze({ data: message });
            if (typeof messageHandler === 'function') {
                messageHandler(event);
            } else {
                pendingMessages.push(event);
            }
            return true;
        },
        dispatchError(value) {
            if (terminated) return false;
            const event = createWorkerErrorEvent(toError(value));
            if (typeof errorHandler === 'function') {
                errorHandler(event);
            } else {
                pendingErrors.push(event);
            }
            return true;
        },
        closeFromOwner() {
            if (terminated) return false;
            terminated = true;
            pendingMessages.forEach(event => releaseZenArtifactMessage(event.data));
            pendingMessages.length = 0;
            pendingErrors.length = 0;
            messageHandler = null;
            errorHandler = null;
            return true;
        },
    };
    return port;
}

export function createZenHomeRendererWorkerSessionOwner() {
    const ports = new Map();
    let physicalSession = null;
    let physicalWorker = null;
    let physicalGenerationSequence = 0;
    let activePhysicalGeneration = 0;
    let channelSessionSequence = 0;
    let staleResponseCount = 0;
    let stalePhysicalEventCount = 0;
    let terminalError = null;
    let physicalWorkerCreatedAtMs = null;
    let physicalWorkerDiagnostics = [];
    let physicalOwnerDiagnosticsEnabled = false;
    const bonsaiInitAttemptCounts = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED ? new Map() : null;
    let startupReservation = null;
    let startupReservationSequence = 0;
    const dashboardLeases = new Set();

    const isCurrentPhysicalGeneration = (generation, worker) => (
        activePhysicalGeneration === generation
        && physicalSession !== null
        && physicalWorker === worker
    );

    const dispatchOwnerFailure = (value) => {
        const error = toError(value);
        terminalError = error;
        ports.forEach((port) => {
            try {
                port.dispatchError(error);
            } catch (_) {
                // The physical owner must still notify remaining channels and release its lease.
            }
        });
        return error;
    };

    const terminatePhysicalSession = (reason, {
        generation = null,
        worker = null,
    } = {}) => {
        if (
            generation !== null
            && !isCurrentPhysicalGeneration(generation, worker)
        ) {
            stalePhysicalEventCount += 1;
            return false;
        }
        const session = physicalSession;
        const activeWorker = physicalWorker;
        const reservation = startupReservation;
        physicalSession = null;
        physicalWorker = null;
        activePhysicalGeneration = 0;
        physicalWorkerCreatedAtMs = null;
        physicalOwnerDiagnosticsEnabled = false;
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED) bonsaiInitAttemptCounts.clear();
        startupReservation = null;
        reservation?.markTerminated(reason);
        if (activeWorker) {
            activeWorker.onmessage = null;
            activeWorker.onerror = null;
        }
        if (!session) return false;
        return session.terminate({
            reason,
            throwOnError: false,
        });
    };

    const handlePhysicalMessage = (event, generation, worker) => {
        if (!isCurrentPhysicalGeneration(generation, worker)) {
            stalePhysicalEventCount += 1;
            releaseZenArtifactMessage(event?.data?.message);
            return;
        }
        const bonsaiReadyReceivedAtMs = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
            && physicalOwnerDiagnosticsEnabled
            && event?.data?.channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
            && event?.data?.message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.READY
            ? nowMs()
            : null;
        if (isZenHomeRendererDiagnosticMessage(event?.data)) {
            const diagnostic = requireZenHomeRendererDiagnosticMessage(event.data);
            const receivedAtMs = nowMs();
            const projected = Object.freeze({
                generation,
                event: diagnostic.event,
                workerAtMs: diagnostic.workerAtMs,
                receivedAtMs: roundMs(receivedAtMs),
                sincePhysicalWorkerCreateMs: physicalWorkerCreatedAtMs === null
                    ? null
                    : roundMs(receivedAtMs - physicalWorkerCreatedAtMs),
                details: diagnostic.details,
            });
            physicalWorkerDiagnostics = [
                ...physicalWorkerDiagnostics,
                projected,
            ].slice(-HOME_WORKER_DIAGNOSTIC_LIMIT);
            emitZenTrace(`zen_home_worker:${diagnostic.event}`, projected);
            return;
        }
        let envelope;
        try {
            envelope = requireZenHomeRendererChannelEnvelope(event?.data);
        } catch (error) {
            try {
                dispatchOwnerFailure(error);
            } finally {
                terminatePhysicalSession('zen_home_renderer_protocol_failed', {
                    generation,
                    worker,
                });
            }
            return;
        }
        const port = ports.get(envelope.channel) || null;
        if (!port || port.channelSessionId !== envelope.channelSessionId) {
            staleResponseCount += 1;
            releaseZenArtifactMessage(envelope.message);
            return;
        }
        if (
            ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
            && physicalOwnerDiagnosticsEnabled
            && envelope.channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
            && envelope.message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.READY
        ) {
            const counts = bonsaiInitAttemptCounts.get(envelope.channelSessionId);
            if (counts) counts.ready += 1;
            emitZenTrace('zen_home_worker:bonsai_ready_received', {
                generation,
                channel: envelope.channel,
                channelSessionId: envelope.channelSessionId,
                initAttemptOrdinal: counts ? counts.ready : null,
                status: counts && counts.ready <= counts.posted ? 'complete' : 'incomplete',
                pageTimeOriginMs: readPageTimeOriginMs(),
                receivedAtMs: roundMs(bonsaiReadyReceivedAtMs),
            });
        }
        port.dispatchMessage(envelope.message);
    };

    const handlePhysicalError = (event, generation, worker) => {
        if (!isCurrentPhysicalGeneration(generation, worker)) {
            stalePhysicalEventCount += 1;
            return;
        }
        try {
            dispatchOwnerFailure(
                event?.error || event?.message || 'ZEN_HOME_RENDERER_WORKER_FAILED',
            );
        } finally {
            terminatePhysicalSession('zen_home_renderer_worker_failed', {
                generation,
                worker,
            });
        }
    };

    const ensurePhysicalSession = () => {
        if (physicalSession?.isActive() && physicalWorker) return physicalSession;
        if (terminalError) throw terminalError;
        const generation = ++physicalGenerationSequence;
        let worker = null;
        const workerCreatedAtMs = nowMs();
        const session = createAdmittedWorkerRuntimeSession({
            surfaceId: WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER,
            admissionMetadata: {
                owner: 'zen_home_renderer_session',
            },
            createWorker: () => new Worker(
                new URL('./zenHomeRenderer.worker.js', import.meta.url),
                {
                    type: 'module',
                    name: 'zen-home-renderer',
                },
            ),
            onRevoked(details = {}) {
                if (!isCurrentPhysicalGeneration(generation, worker)) {
                    stalePhysicalEventCount += 1;
                    return;
                }
                dispatchOwnerFailure(new Error(
                    `ZEN_HOME_RENDERER_ADMISSION_REVOKED:${details?.reason || 'unknown'}`,
                ));
                worker.onmessage = null;
                worker.onerror = null;
                physicalSession = null;
                physicalWorker = null;
                activePhysicalGeneration = 0;
            },
        });
        worker = session.worker;
        physicalSession = session;
        physicalWorker = session.worker;
        activePhysicalGeneration = generation;
        physicalWorkerCreatedAtMs = workerCreatedAtMs;
        physicalWorkerDiagnostics = [];
        physicalOwnerDiagnosticsEnabled = isZenTraceEnabled();
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED) bonsaiInitAttemptCounts.clear();
        physicalWorker.onmessage = (event) => handlePhysicalMessage(
            event,
            generation,
            worker,
        );
        physicalWorker.onerror = (event) => handlePhysicalError(
            event,
            generation,
            worker,
        );
        if (physicalOwnerDiagnosticsEnabled) {
            physicalWorker.postMessage(createZenHomeRendererDiagnosticsConfigureMessage({
                enabled: true,
            }));
            emitZenTrace('zen_home_worker:physical_session_created', {
                generation,
                createdAtMs: roundMs(workerCreatedAtMs),
            });
        }
        return physicalSession;
    };

    const postChannelMessage = (
        channel,
        channelSessionId,
        message,
        transfer = undefined,
    ) => {
        const session = ensurePhysicalSession();
        const worker = session.worker;
        if (!worker) throw new Error('ZEN_HOME_RENDERER_PHYSICAL_WORKER_MISSING');
        const envelope = createZenHomeRendererChannelEnvelope(
            channel,
            channelSessionId,
            message,
        );
        const captureInit = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
            && physicalOwnerDiagnosticsEnabled
            && channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
            && message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.INIT;
        let initAttemptOrdinal = null;
        let postStartedAtMs = null;
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && captureInit) {
            if (!bonsaiInitAttemptCounts.has(channelSessionId)) {
                bonsaiInitAttemptCounts.set(channelSessionId, { posted: 0, ready: 0 });
            }
            const counts = bonsaiInitAttemptCounts.get(channelSessionId);
            initAttemptOrdinal = ++counts.posted;
            postStartedAtMs = nowMs();
        }
        try {
            if (Array.isArray(transfer)) {
                worker.postMessage(envelope, transfer);
            } else {
                worker.postMessage(envelope);
            }
            if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && captureInit) {
                const postCompletedAtMs = nowMs();
                emitZenTrace('zen_home_worker:bonsai_init_posted', {
                    generation: activePhysicalGeneration,
                    channel,
                    channelSessionId,
                    initAttemptOrdinal,
                    renderBackend: message.payload?.renderBackend,
                    pageTimeOriginMs: readPageTimeOriginMs(),
                    postStartedAtMs: roundMs(postStartedAtMs),
                    postCompletedAtMs: roundMs(postCompletedAtMs),
                    postDurationMs: roundMs(postCompletedAtMs - postStartedAtMs),
                });
            }
        } catch (error) {
            const terminalFailure = dispatchOwnerFailure(error);
            terminatePhysicalSession('zen_home_renderer_channel_post_failed');
            throw terminalFailure;
        }
        return true;
    };

    const postPhysicalOwnerMessage = (message, failureReason) => {
        const session = ensurePhysicalSession();
        const worker = session.worker;
        if (!worker) throw new Error('ZEN_HOME_RENDERER_PHYSICAL_WORKER_MISSING');
        try {
            worker.postMessage(message);
        } catch (error) {
            const terminalFailure = dispatchOwnerFailure(error);
            terminatePhysicalSession(failureReason);
            throw terminalFailure;
        }
        return true;
    };

    const preparePhysicalSession = () => {
        if (startupReservation) return startupReservation.handle;
        if (ports.size > 0) {
            throw new Error('ZEN_HOME_RENDERER_STARTUP_PREPARE_AFTER_CHANNEL_ACQUIRE');
        }
        ensurePhysicalSession();
        const reservationId = `zen_home_startup:${++startupReservationSequence}`;
        let state = 'active';
        const reservation = {
            handle: null,
            markAdopted() {
                if (state !== 'active') return false;
                state = 'adopted';
                return true;
            },
            markTerminated() {
                if (state !== 'active') return false;
                state = 'terminated';
                return true;
            },
        };
        reservation.handle = Object.freeze({
            id: reservationId,
            get state() {
                return state;
            },
            release(reason = 'zen_home_renderer_startup_released') {
                if (state !== 'active' || startupReservation !== reservation) return false;
                state = 'released';
                startupReservation = null;
                if (ports.size === 0 && dashboardLeases.size === 0) {
                    terminatePhysicalSession(reason);
                }
                return true;
            },
        });
        startupReservation = reservation;
        postPhysicalOwnerMessage(
            createZenHomeRendererWorldPrepareMessage(),
            'zen_home_renderer_world_prepare_post_failed',
        );
        emitZenTrace('zen_home_worker:startup_prepare_requested', {
            reservationId,
            physicalGeneration: activePhysicalGeneration,
        });
        return reservation.handle;
    };

    const releaseChannel = (
        channel,
        port,
        reason = 'zen_home_renderer_channel_released',
    ) => {
        if (ports.get(channel) !== port) return false;
        ports.delete(channel);
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED) bonsaiInitAttemptCounts.delete(port.channelSessionId);
        if (ports.size === 0 && dashboardLeases.size === 0) {
            terminalError = null;
            terminatePhysicalSession('zen_home_renderer_last_channel_released');
            return true;
        }
        if (
            !terminalError
            && physicalSession?.isActive()
            && physicalWorker
        ) {
            try {
                physicalWorker.postMessage(createZenHomeRendererChannelEnvelope(
                    channel,
                    port.channelSessionId,
                    createZenHomeRendererChannelReleaseMessage(),
                ));
            } catch (error) {
                try {
                    dispatchOwnerFailure(error);
                } finally {
                    terminatePhysicalSession(
                        `zen_home_renderer_channel_release_failed:${String(reason)}`,
                    );
                }
            }
        }
        return true;
    };

    const acquireChannel = (channelInput) => {
        const channel = requireChannel(channelInput);
        if (ports.has(channel)) {
            throw new Error(`ZEN_HOME_RENDERER_CHANNEL_ALREADY_ACQUIRED:${channel}`);
        }
        channelSessionSequence += 1;
        const channelSessionId = [
            'zen_home_renderer',
            channel,
            Date.now(),
            channelSessionSequence,
        ].join(':');
        const port = createChannelPort({
            channel,
            channelSessionId,
            postMessage: postChannelMessage,
            release: releaseChannel,
        });
        ports.set(channel, port);
        try {
            ensurePhysicalSession();
            if (channel === ZEN_HOME_RENDERER_CHANNEL.POND) {
                postChannelMessage(
                    channel,
                    channelSessionId,
                    createZenHomeRendererChannelPrepareMessage(),
                );
            }
            if (startupReservation) {
                startupReservation.markAdopted();
                startupReservation = null;
                emitZenTrace('zen_home_worker:startup_prepare_adopted', {
                    channel,
                    physicalGeneration: activePhysicalGeneration,
                });
            }
        } catch (error) {
            ports.delete(channel);
            port.closeFromOwner();
            throw error;
        }
        return port;
    };

    const dispose = ({ reason = 'zen_home_renderer_owner_disposed' } = {}) => {
        const activePorts = Array.from(ports.values());
        ports.clear();
        dashboardLeases.clear();
        terminalError = null;
        startupReservation?.markTerminated(reason);
        startupReservation = null;
        activePorts.forEach((port) => port.closeFromOwner());
        return terminatePhysicalSession(reason);
    };

    return Object.freeze({
        acquireChannel,
        retainDashboard() {
            const lease = {}; dashboardLeases.add(lease);
            try { ensurePhysicalSession(); } catch (error) { dashboardLeases.delete(lease); throw error; }
            return { release() {
                if (!dashboardLeases.delete(lease)) return;
                if (dashboardLeases.size === 0 && ports.size === 0 && !startupReservation) {
                    terminatePhysicalSession('zen_dashboard_render_lifetime_released');
                }
            } };
        },
        dispose,
        getSnapshot() {
            return Object.freeze({
                active: physicalSession?.isActive() === true,
                leaseId: physicalSession?.lease?.id || null,
                channels: Object.freeze(Array.from(ports.keys()).sort()),
                dashboardLeaseCount: dashboardLeases.size,
                staleResponseCount,
                stalePhysicalEventCount,
                physicalGeneration: activePhysicalGeneration || null,
                terminalFailure: terminalError?.message || null,
                physicalWorkerCreatedAtMs: roundMs(physicalWorkerCreatedAtMs),
                diagnostics: Object.freeze([...physicalWorkerDiagnostics]),
                startupReserved: startupReservation !== null,
                startupReservationId: startupReservation?.handle?.id || null,
            });
        },
        prepare: preparePhysicalSession,
    });
}

const zenHomeRendererWorkerSessionOwner = createZenHomeRendererWorkerSessionOwner();

export const acquireZenHomeRendererWorkerChannel = ({ channel } = {}) => (
    zenHomeRendererWorkerSessionOwner.acquireChannel(channel)
);

export const getZenHomeRendererWorkerSessionSnapshot = () => (
    zenHomeRendererWorkerSessionOwner.getSnapshot()
);

export const prepareZenHomeRendererWorkerSession = () => (
    zenHomeRendererWorkerSessionOwner.prepare()
);
export const retainZenDashboardRendererSession = () => zenHomeRendererWorkerSessionOwner.retainDashboard();
