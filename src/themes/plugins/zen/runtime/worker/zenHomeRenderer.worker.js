import {
    ZEN_POND_WORKER_MESSAGE_TYPE,
} from '../../pond/renderers/worker/core/zenPondWorkerProtocol.js';
import {
    zenPondRendererModuleAdmission,
} from '../../pond/renderers/worker/core/zenPondRendererModuleAdmission.js';
import {
    ZEN_BONSAI_WORKER_MESSAGE_TYPE,
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
} from './zenBonsaiWorkerProtocol.js';
import {
    zenBonsaiG15PixiRendererModuleAdmission,
    zenBonsaiPlumePixiRendererModuleAdmission,
    zenBonsaiPixiRendererModuleAdmission,
} from './renderers/zenBonsaiPixiRendererModuleAdmission.js';
import {
    ZEN_HOME_RENDERER_CHANNEL,
    createZenHomeRendererChannelEnvelope,
    createZenHomeRendererDiagnosticMessage,
    isZenHomeRendererChannelPrepareMessage,
    isZenHomeRendererChannelReleaseMessage,
    isZenHomeRendererDiagnosticsConfigureMessage,
    isZenHomeRendererWorldPrepareMessage,
    requireZenHomeRendererChannelEnvelope,
    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT,
} from './zenHomeRendererWorkerProtocol.js';
import { ensurePixiWorkerRuntimeEnvironment } from './zenPixiWorkerEnvironment.js';
import { ZEN_ARTIFACT_MESSAGE } from './zenArtifactWorkerMessages.js';
import { ZEN_RENDERER_WORK_JOURNAL_ENABLED } from './zenRendererWorkJournal.js';
import { createZenHomeRendererWorkJournal } from './zenHomeRendererWorkJournal.js';
import { ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED } from './zenBonsaiInitDiagnosticsCapability.js';

const homeWorkJournal = ZEN_RENDERER_WORK_JOURNAL_ENABLED
    ? createZenHomeRendererWorkJournal()
    : null;

const channelSessions = {
    [ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS]: {
        id: null, disposePending: false, pendingSessionId: null, messageChain: Promise.resolve(),
    },
    [ZEN_HOME_RENDERER_CHANNEL.POND]: {
        id: null,
        disposePending: false,
        pendingSessionId: null,
        messageChain: Promise.resolve(),
    },
    [ZEN_HOME_RENDERER_CHANNEL.BONSAI]: {
        id: null,
        disposePending: false,
        pendingSessionId: null,
        messageChain: Promise.resolve(),
    },
};

if (typeof self.reportError !== 'function') {
    throw new Error('ZEN_HOME_RENDERER_REPORT_ERROR_REQUIRED');
}

let terminalError = null;
let activeBonsaiInitDiagnostic = null;
const bonsaiInitAttemptOrdinals = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED ? new Map() : null;

const toError = (value) => (
    value instanceof Error
        ? value
        : new Error(String(value || 'ZEN_HOME_RENDERER_CHANNEL_RUNTIME_FAILED'))
);

const reportTerminalFailure = (value) => {
    if (terminalError) return terminalError;
    terminalError = toError(value);
    self.reportError(terminalError);
    return terminalError;
};

const postChannelMessage = (channel) => (message, transfer = []) => {
    const channelSessionId = channelSessions[channel].id;
    if (channelSessionId === null) {
        return false;
    }
    if (ZEN_RENDERER_WORK_JOURNAL_ENABLED) {
        if (
            channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
            && message.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.FRAME_RENDERED
        ) {
            homeWorkJournal.recordBonsaiFrame(message.payload, {
                receivedAtMs: nowWorkerMs(),
                channelSessionId,
            });
        }
        if (
            channel === ZEN_HOME_RENDERER_CHANNEL.POND
            && message.type === ZEN_POND_WORKER_MESSAGE_TYPE.RESULT
            && message.result?.metrics
        ) {
            message = {
                ...message,
                result: {
                    ...message.result,
                    metrics: {
                        ...message.result.metrics,
                        homeRendererJournal: homeWorkJournal.snapshot(),
                    },
                },
            };
        }
    }
    try {
        const initDiagnostic = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
            && ownerDiagnosticsEnabled
            && channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
            && message.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.READY
            ? activeBonsaiInitDiagnostic
            : null;
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && initDiagnostic) initDiagnostic.readyPostStartedAtMs = nowWorkerMs();
        self.postMessage(createZenHomeRendererChannelEnvelope(
            channel,
            channelSessionId,
            message,
        ), transfer);
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && initDiagnostic) {
            initDiagnostic.readyPostCompletedAtMs = nowWorkerMs();
            postOwnerDiagnostic(
                ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.BONSAI_INIT_READY,
                buildBonsaiInitDiagnosticSummary(initDiagnostic, message.payload?.workerTiming),
            );
        }
        return true;
    } catch (error) {
        reportTerminalFailure(error);
        return false;
    }
};

ensurePixiWorkerRuntimeEnvironment();

const nowWorkerMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const readWorkerTimeOriginMs = () => (
    typeof globalThis.performance?.now === 'function'
    && Number.isFinite(globalThis.performance.timeOrigin)
        ? globalThis.performance.timeOrigin
        : null
);

const roundWorkerMs = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Number(parsed.toFixed(2)));
};

const workerEntryReadyAtMs = nowWorkerMs();
let ownerDiagnosticsEnabled = false;

const postOwnerDiagnostic = (event, details = null) => {
    if (!ownerDiagnosticsEnabled) return false;
    self.postMessage(createZenHomeRendererDiagnosticMessage(
        event,
        nowWorkerMs(),
        details,
    ));
    return true;
};

const recordBonsaiInitDiagnostic = (phase, atMs) => {
    if (!ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED || !ownerDiagnosticsEnabled || !activeBonsaiInitDiagnostic) return;
    const field = {
        logical_enqueued: 'logicalEnqueuedAtMs',
        logical_handler_started: 'logicalHandlerStartedAtMs',
        init_entered: 'initEnteredAtMs',
    }[phase];
    if (!field) throw new Error(`ZEN_HOME_RENDERER_BONSAI_INIT_PHASE_INVALID:${phase}`);
    activeBonsaiInitDiagnostic[field] = atMs === undefined ? nowWorkerMs() : atMs;
};

const buildBonsaiInitDiagnosticSummary = (diagnostic, rendererTiming) => {
    const stampFields = [
        'receivedAtMs', 'channelHandlerStartedAtMs', 'runtimeAwaitStartedAtMs',
        'runtimeReadyAtMs', 'logicalEnqueuedAtMs', 'logicalHandlerStartedAtMs',
        'initEnteredAtMs', 'readyPostStartedAtMs', 'readyPostCompletedAtMs',
    ];
    const complete = stampFields.every((field, index) => (
        Number.isFinite(diagnostic[field])
        && (index === 0 || diagnostic[field] >= diagnostic[stampFields[index - 1]])
    ));
    const duration = (start, end) => (
        Number.isFinite(diagnostic[start]) && Number.isFinite(diagnostic[end])
        && diagnostic[end] >= diagnostic[start]
            ? roundWorkerMs(diagnostic[end] - diagnostic[start])
            : null
    );
    return {
        contract: 'zen_bonsai_init_timing_v1',
        status: complete ? 'complete' : 'incomplete',
        channel: ZEN_HOME_RENDERER_CHANNEL.BONSAI,
        channelSessionId: diagnostic.channelSessionId,
        initAttemptOrdinal: diagnostic.initAttemptOrdinal,
        renderBackend: diagnostic.renderBackend,
        workerTimeOriginMs: readWorkerTimeOriginMs(),
        workerStamps: Object.fromEntries(stampFields.map((field) => [
            field, Number.isFinite(diagnostic[field]) ? roundWorkerMs(diagnostic[field]) : null,
        ])),
        workerDurations: {
            receiptToChannelHandlerMs: duration('receivedAtMs', 'channelHandlerStartedAtMs'),
            channelRuntimeAwaitMs: duration('runtimeAwaitStartedAtMs', 'runtimeReadyAtMs'),
            channelHandlerToLogicalEnqueueMs: duration('channelHandlerStartedAtMs', 'logicalEnqueuedAtMs'),
            logicalQueueWaitMs: duration('logicalEnqueuedAtMs', 'logicalHandlerStartedAtMs'),
            logicalHandlerToInitMs: duration('logicalHandlerStartedAtMs', 'initEnteredAtMs'),
            initEntryToReadyPostMs: duration('initEnteredAtMs', 'readyPostStartedAtMs'),
            readyPostMs: duration('readyPostStartedAtMs', 'readyPostCompletedAtMs'),
            receiptToReadyPostStartMs: duration('receivedAtMs', 'readyPostStartedAtMs'),
            receiptToReadyPostEndMs: duration('receivedAtMs', 'readyPostCompletedAtMs'),
        },
        rendererTiming: rendererTiming && typeof rendererTiming === 'object' ? rendererTiming : null,
    };
};

let pondRuntimePromise = null;
let bonsaiRuntimePromise = null;

const loadPondRuntime = () => {
    if (!pondRuntimePromise) {
        const startedAtMs = nowWorkerMs();
        postOwnerDiagnostic(ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.POND_RUNTIME_IMPORT_START);
        pondRuntimePromise = import('../../pond/renderers/worker/zenPondRenderer.worker.js')
            .then(({ initializeZenPondRendererWorker }) => {
                const importReadyAtMs = nowWorkerMs();
                if (typeof initializeZenPondRendererWorker !== 'function') {
                    throw new Error('ZEN_POND_LOGICAL_WORKER_INITIALIZER_MISSING');
                }
                const runtime = initializeZenPondRendererWorker({
                    postMessage: postChannelMessage(ZEN_HOME_RENDERER_CHANNEL.POND),
                });
                const initializedAtMs = nowWorkerMs();
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.POND_RUNTIME_IMPORT_READY,
                    {
                        importMs: roundWorkerMs(importReadyAtMs - startedAtMs),
                        initializeMs: roundWorkerMs(initializedAtMs - importReadyAtMs),
                        totalMs: roundWorkerMs(initializedAtMs - startedAtMs),
                    },
                );
                return runtime;
            })
            .catch((error) => {
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.POND_RUNTIME_IMPORT_FAILED,
                    {
                        durationMs: roundWorkerMs(nowWorkerMs() - startedAtMs),
                        error: error?.message || String(error),
                    },
                );
                throw error;
            });
    }
    return pondRuntimePromise;
};

const loadBonsaiRuntime = () => {
    if (!bonsaiRuntimePromise) {
        const startedAtMs = nowWorkerMs();
        postOwnerDiagnostic(ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.BONSAI_RUNTIME_IMPORT_START);
        bonsaiRuntimePromise = import('./zenBonsaiRenderer.worker.js')
            .then(({ initializeZenBonsaiRendererWorker }) => {
                const importReadyAtMs = nowWorkerMs();
                if (typeof initializeZenBonsaiRendererWorker !== 'function') {
                    throw new Error('ZEN_BONSAI_LOGICAL_WORKER_INITIALIZER_MISSING');
                }
                const runtime = initializeZenBonsaiRendererWorker({
                    postMessage: postChannelMessage(ZEN_HOME_RENDERER_CHANNEL.BONSAI),
                    onInitDiagnostic: ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED ? recordBonsaiInitDiagnostic : null,
                });
                const initializedAtMs = nowWorkerMs();
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.BONSAI_RUNTIME_IMPORT_READY,
                    {
                        importMs: roundWorkerMs(importReadyAtMs - startedAtMs),
                        initializeMs: roundWorkerMs(initializedAtMs - importReadyAtMs),
                        totalMs: roundWorkerMs(initializedAtMs - startedAtMs),
                    },
                );
                return runtime;
            })
            .catch((error) => {
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.BONSAI_RUNTIME_IMPORT_FAILED,
                    {
                        durationMs: roundWorkerMs(nowWorkerMs() - startedAtMs),
                        error: error?.message || String(error),
                    },
                );
                throw error;
            });
    }
    return bonsaiRuntimePromise;
};

let artifactRuntimePromise = null;
const loadArtifactRuntime = () => {
    if (!artifactRuntimePromise) artifactRuntimePromise = import('./zenArtifactRendererRuntime.js').then(({ createZenArtifactRendererRuntime }) =>
        createZenArtifactRendererRuntime({ postMessage: postChannelMessage(ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS) }));
    return artifactRuntimePromise;
};
const loadChannelRuntime = (channel) => {
    if (channel === ZEN_HOME_RENDERER_CHANNEL.POND) return loadPondRuntime();
    if (channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI) return loadBonsaiRuntime();
    if (channel === ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS) return loadArtifactRuntime();
    throw new Error('ZEN_HOME_RENDERER_CHANNEL_INVALID');
};

const preparePondStartupRuntime = () => {
    const rendererPreparation = zenPondRendererModuleAdmission.prepare();
    const logicalRuntimePreparation = loadPondRuntime().then((runtime) => {
        if (typeof runtime?.prepare !== 'function') {
            throw new Error('ZEN_HOME_RENDERER_CHANNEL_PREPARE_UNSUPPORTED:pond');
        }
        return runtime.prepare();
    });
    return Promise.all([
        rendererPreparation,
        logicalRuntimePreparation,
    ]);
};

let homeWorldRuntimePreparationPromise = null;
const prepareHomeWorldRuntimes = () => {
    if (!homeWorldRuntimePreparationPromise) {
        const startedAtMs = nowWorkerMs();
        postOwnerDiagnostic(ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.HOME_WORLD_PREPARE_START);
        homeWorldRuntimePreparationPromise = Promise.all([
            preparePondStartupRuntime(),
            loadBonsaiRuntime(),
        ]).then(
            (runtimes) => {
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.HOME_WORLD_PREPARE_READY,
                    {
                        durationMs: roundWorkerMs(nowWorkerMs() - startedAtMs),
                    },
                );
                return runtimes;
            },
            (error) => {
                postOwnerDiagnostic(
                    ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.HOME_WORLD_PREPARE_FAILED,
                    {
                        durationMs: roundWorkerMs(nowWorkerMs() - startedAtMs),
                        error: error?.message || String(error),
                    },
                );
                throw error;
            },
        );
    }
    return homeWorldRuntimePreparationPromise;
};

const isChannelDisposeMessage = (channel, message) => (
    channel === ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS ? message?.type === ZEN_ARTIFACT_MESSAGE.DISPOSE
    : channel === ZEN_HOME_RENDERER_CHANNEL.POND
        ? message?.type === ZEN_POND_WORKER_MESSAGE_TYPE.DISPOSE
        : message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.DISPOSE
);

const shouldPrepareBonsaiPixiRenderer = (channel, message) => (
    channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
    && message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.INIT
    && (
        message?.payload?.renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI
        || message?.payload?.renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
        || message?.payload?.renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME
    )
);

const handleChannelMessage = async (envelope, initDiagnostic = null) => {
    if (terminalError) throw terminalError;
    if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && initDiagnostic) {
        initDiagnostic.channelHandlerStartedAtMs = nowWorkerMs();
        activeBonsaiInitDiagnostic = initDiagnostic;
    }
    const channelSession = channelSessions[envelope.channel];
    const isRelease = isZenHomeRendererChannelReleaseMessage(envelope.message);
    const isPrepare = isZenHomeRendererChannelPrepareMessage(envelope.message);
    if (channelSession.id === null) {
        channelSession.id = envelope.channelSessionId;
        if (channelSession.pendingSessionId === envelope.channelSessionId) {
            channelSession.pendingSessionId = null;
        }
    } else if (channelSession.id !== envelope.channelSessionId) {
        throw new Error(
            `ZEN_HOME_RENDERER_CHANNEL_SESSION_MISMATCH:${envelope.channel}`
            + `:expected=${channelSession.id}:actual=${envelope.channelSessionId}`,
        );
    }
    const resetsChannelSession = (
        isRelease || isChannelDisposeMessage(envelope.channel, envelope.message)
    );
    try {
        if (isPrepare) {
            if (envelope.channel !== ZEN_HOME_RENDERER_CHANNEL.POND) {
                throw new Error(
                    `ZEN_HOME_RENDERER_CHANNEL_PREPARE_UNSUPPORTED:${envelope.channel}`,
                );
            }
            postOwnerDiagnostic(
                ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.CHANNEL_PREPARE_RECEIVED,
                { channel: envelope.channel },
            );
            Promise.resolve(prepareHomeWorldRuntimes()).catch(reportTerminalFailure);
            return true;
        }
        if (shouldPrepareBonsaiPixiRenderer(envelope.channel, envelope.message)) {
            const admissionPromise = envelope.message?.payload?.renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME
                ? zenBonsaiPlumePixiRendererModuleAdmission.prepare()
                : envelope.message?.payload?.renderBackend === ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15
                ? zenBonsaiG15PixiRendererModuleAdmission.prepare()
                : zenBonsaiPixiRendererModuleAdmission.prepare();
            Promise.resolve(admissionPromise)
                .catch(reportTerminalFailure);
        }
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && initDiagnostic) initDiagnostic.runtimeAwaitStartedAtMs = nowWorkerMs();
        const channelRuntime = await loadChannelRuntime(envelope.channel);
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && initDiagnostic) initDiagnostic.runtimeReadyAtMs = nowWorkerMs();
        const handled = isRelease
            ? channelRuntime.dispose()
            : channelRuntime.handleMessage({ data: envelope.message });
        if (isRelease && envelope.channel === ZEN_HOME_RENDERER_CHANNEL.ARTIFACTS) artifactRuntimePromise = null;
        return await handled;
    } finally {
        if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED && activeBonsaiInitDiagnostic === initDiagnostic) activeBonsaiInitDiagnostic = null;
        if (resetsChannelSession) {
            if (ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED) bonsaiInitAttemptOrdinals.delete(envelope.channelSessionId);
            if (channelSession.id === envelope.channelSessionId) {
                channelSession.id = null;
            }
            channelSession.disposePending = false;
        }
    }
};

self.onmessage = (event) => {
    if (terminalError) throw terminalError;
    const initReceivedAtMs = ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
        && ownerDiagnosticsEnabled
        && event?.data?.channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
        && event?.data?.message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.INIT
        ? nowWorkerMs()
        : null;
    if (isZenHomeRendererDiagnosticsConfigureMessage(event?.data)) {
        ownerDiagnosticsEnabled = event.data.enabled === true;
        if (ownerDiagnosticsEnabled) {
            postOwnerDiagnostic(
                ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.WORKER_ENTRY_READY,
                {
                    entryReadyAtMs: roundWorkerMs(workerEntryReadyAtMs),
                    configuredAfterEntryMs: roundWorkerMs(nowWorkerMs() - workerEntryReadyAtMs),
                },
            );
        }
        return true;
    }
    if (isZenHomeRendererWorldPrepareMessage(event?.data)) {
        Promise.resolve(prepareHomeWorldRuntimes()).catch(reportTerminalFailure);
        return true;
    }
    const envelope = requireZenHomeRendererChannelEnvelope(event?.data);
    const channelSession = channelSessions[envelope.channel];
    const isRelease = isZenHomeRendererChannelReleaseMessage(envelope.message);
    const isDispose = isChannelDisposeMessage(envelope.channel, envelope.message);

    if (channelSession.disposePending) {
        if (channelSession.id === envelope.channelSessionId && !isRelease) {
            throw new Error(`ZEN_HOME_RENDERER_CHANNEL_DISPOSING:${envelope.channel}`);
        }
        if (
            channelSession.id !== envelope.channelSessionId
            && channelSession.pendingSessionId === null
        ) {
            channelSession.pendingSessionId = envelope.channelSessionId;
        } else if (
            channelSession.id !== envelope.channelSessionId
            && channelSession.pendingSessionId !== envelope.channelSessionId
        ) {
            throw new Error(
                `ZEN_HOME_RENDERER_PENDING_CHANNEL_SESSION_MISMATCH:${envelope.channel}`
                + `:expected=${channelSession.pendingSessionId}`
                + `:actual=${envelope.channelSessionId}`,
            );
        }
    } else if (
        channelSession.id !== null
        && channelSession.id !== envelope.channelSessionId
    ) {
        throw new Error(
            `ZEN_HOME_RENDERER_CHANNEL_SESSION_MISMATCH:${envelope.channel}`
            + `:expected=${channelSession.id}:actual=${envelope.channelSessionId}`,
        );
    }

    if (channelSession.id === null) {
        channelSession.id = envelope.channelSessionId;
    }
    if (isDispose || isRelease) {
        channelSession.disposePending = true;
    }
    let initDiagnostic = null;
    if (
        ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED
        && ownerDiagnosticsEnabled
        && envelope.channel === ZEN_HOME_RENDERER_CHANNEL.BONSAI
        && envelope.message?.type === ZEN_BONSAI_WORKER_MESSAGE_TYPE.INIT
    ) {
        const initAttemptOrdinal = bonsaiInitAttemptOrdinals.has(envelope.channelSessionId)
            ? bonsaiInitAttemptOrdinals.get(envelope.channelSessionId) + 1
            : 1;
        bonsaiInitAttemptOrdinals.set(envelope.channelSessionId, initAttemptOrdinal);
        initDiagnostic = {
            channelSessionId: envelope.channelSessionId,
            initAttemptOrdinal,
            renderBackend: envelope.message.payload?.renderBackend,
            receivedAtMs: initReceivedAtMs,
        };
        postOwnerDiagnostic(ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT.BONSAI_INIT_RECEIVED, {
            channel: envelope.channel,
            channelSessionId: envelope.channelSessionId,
            initAttemptOrdinal,
            renderBackend: initDiagnostic.renderBackend,
            workerTimeOriginMs: readWorkerTimeOriginMs(),
            receivedAtMs: roundWorkerMs(initDiagnostic.receivedAtMs),
        });
    }
    const queued = channelSession.messageChain.then(() => handleChannelMessage(envelope, initDiagnostic));
    const guarded = queued.catch((error) => {
        reportTerminalFailure(error);
    });
    channelSession.messageChain = guarded;
    return guarded;
};
