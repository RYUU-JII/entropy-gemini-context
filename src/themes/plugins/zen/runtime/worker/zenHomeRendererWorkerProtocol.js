import { ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED } from './zenBonsaiInitDiagnosticsCapability.js';

const ZEN_HOME_RENDERER_CHANNEL_MESSAGE_TYPE = 'zen_home_renderer_channel';
const ZEN_HOME_RENDERER_CHANNEL_RELEASE_MESSAGE_TYPE = 'zen_home_renderer_channel_release';
const ZEN_HOME_RENDERER_CHANNEL_PREPARE_MESSAGE_TYPE = 'zen_home_renderer_channel_prepare';
const ZEN_HOME_RENDERER_DIAGNOSTICS_CONFIGURE_MESSAGE_TYPE =
    'zen_home_renderer_diagnostics_configure';
const ZEN_HOME_RENDERER_DIAGNOSTIC_MESSAGE_TYPE = 'zen_home_renderer_diagnostic';
const ZEN_HOME_RENDERER_WORLD_PREPARE_MESSAGE_TYPE = 'zen_home_renderer_world_prepare';

export const ZEN_HOME_RENDERER_CHANNEL = Object.freeze({
    POND: 'pond',
    BONSAI: 'bonsai',
    ARTIFACTS: 'artifacts',
});

export const ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT = Object.freeze({
    WORKER_ENTRY_READY: 'worker_entry_ready',
    POND_RUNTIME_IMPORT_START: 'pond_runtime_import_start',
    POND_RUNTIME_IMPORT_READY: 'pond_runtime_import_ready',
    POND_RUNTIME_IMPORT_FAILED: 'pond_runtime_import_failed',
    BONSAI_RUNTIME_IMPORT_START: 'bonsai_runtime_import_start',
    BONSAI_RUNTIME_IMPORT_READY: 'bonsai_runtime_import_ready',
    BONSAI_RUNTIME_IMPORT_FAILED: 'bonsai_runtime_import_failed',
    HOME_WORLD_PREPARE_START: 'home_world_prepare_start',
    HOME_WORLD_PREPARE_READY: 'home_world_prepare_ready',
    HOME_WORLD_PREPARE_FAILED: 'home_world_prepare_failed',
    CHANNEL_PREPARE_RECEIVED: 'channel_prepare_received',
    ...(ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED ? {
        BONSAI_INIT_RECEIVED: 'bonsai_init_received',
        BONSAI_INIT_READY: 'bonsai_init_ready',
    } : {}),
});

const CHANNEL_SET = new Set(Object.values(ZEN_HOME_RENDERER_CHANNEL));
const DIAGNOSTIC_EVENT_SET = new Set(Object.values(ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT));

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const createZenHomeRendererChannelReleaseMessage = () => Object.freeze({
    type: ZEN_HOME_RENDERER_CHANNEL_RELEASE_MESSAGE_TYPE,
});

export const createZenHomeRendererChannelPrepareMessage = () => Object.freeze({
    type: ZEN_HOME_RENDERER_CHANNEL_PREPARE_MESSAGE_TYPE,
});

export const createZenHomeRendererDiagnosticsConfigureMessage = ({
    enabled = true,
} = {}) => Object.freeze({
    type: ZEN_HOME_RENDERER_DIAGNOSTICS_CONFIGURE_MESSAGE_TYPE,
    enabled: enabled === true,
});

export const createZenHomeRendererWorldPrepareMessage = () => Object.freeze({
    type: ZEN_HOME_RENDERER_WORLD_PREPARE_MESSAGE_TYPE,
});

export const isZenHomeRendererDiagnosticsConfigureMessage = (value) => (
    isObject(value) && value.type === ZEN_HOME_RENDERER_DIAGNOSTICS_CONFIGURE_MESSAGE_TYPE
);

export const isZenHomeRendererWorldPrepareMessage = (value) => (
    isObject(value) && value.type === ZEN_HOME_RENDERER_WORLD_PREPARE_MESSAGE_TYPE
);

export const createZenHomeRendererDiagnosticMessage = (
    event,
    workerAtMs,
    details = null,
) => {
    if (!DIAGNOSTIC_EVENT_SET.has(event)) {
        throw new Error(`ZEN_HOME_RENDERER_DIAGNOSTIC_EVENT_INVALID:${String(event)}`);
    }
    const normalizedWorkerAtMs = Number(workerAtMs);
    if (!Number.isFinite(normalizedWorkerAtMs) || normalizedWorkerAtMs < 0) {
        throw new Error('ZEN_HOME_RENDERER_DIAGNOSTIC_WORKER_TIME_INVALID');
    }
    if (details !== null && !isObject(details)) {
        throw new Error('ZEN_HOME_RENDERER_DIAGNOSTIC_DETAILS_INVALID');
    }
    return Object.freeze({
        type: ZEN_HOME_RENDERER_DIAGNOSTIC_MESSAGE_TYPE,
        event,
        workerAtMs: Number(normalizedWorkerAtMs.toFixed(2)),
        details: details === null ? null : Object.freeze({ ...details }),
    });
};

export const isZenHomeRendererDiagnosticMessage = (value) => (
    isObject(value) && value.type === ZEN_HOME_RENDERER_DIAGNOSTIC_MESSAGE_TYPE
);

export const requireZenHomeRendererDiagnosticMessage = (value) => {
    if (!isZenHomeRendererDiagnosticMessage(value)) {
        throw new Error('ZEN_HOME_RENDERER_DIAGNOSTIC_MESSAGE_REQUIRED');
    }
    return createZenHomeRendererDiagnosticMessage(
        value.event,
        value.workerAtMs,
        value.details ?? null,
    );
};

export const isZenHomeRendererChannelReleaseMessage = (value) => (
    isObject(value) && value.type === ZEN_HOME_RENDERER_CHANNEL_RELEASE_MESSAGE_TYPE
);

export const isZenHomeRendererChannelPrepareMessage = (value) => (
    isObject(value) && value.type === ZEN_HOME_RENDERER_CHANNEL_PREPARE_MESSAGE_TYPE
);

const requireChannel = (value) => {
    if (!CHANNEL_SET.has(value)) {
        throw new Error(`ZEN_HOME_RENDERER_CHANNEL_INVALID:${String(value)}`);
    }
    return value;
};

const requireMessage = (value) => {
    if (!isObject(value)) {
        throw new Error('ZEN_HOME_RENDERER_CHANNEL_MESSAGE_REQUIRED');
    }
    return value;
};

const requireChannelSessionId = (value) => {
    if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
        throw new Error('ZEN_HOME_RENDERER_CHANNEL_SESSION_ID_REQUIRED');
    }
    return value;
};

export const createZenHomeRendererChannelEnvelope = (
    channel,
    channelSessionId,
    message,
) => Object.freeze({
    type: ZEN_HOME_RENDERER_CHANNEL_MESSAGE_TYPE,
    channel: requireChannel(channel),
    channelSessionId: requireChannelSessionId(channelSessionId),
    message: requireMessage(message),
});

export const requireZenHomeRendererChannelEnvelope = (value) => {
    if (!isObject(value)) {
        throw new Error('ZEN_HOME_RENDERER_CHANNEL_ENVELOPE_REQUIRED');
    }
    if (value.type !== ZEN_HOME_RENDERER_CHANNEL_MESSAGE_TYPE) {
        throw new Error(`ZEN_HOME_RENDERER_CHANNEL_ENVELOPE_TYPE_INVALID:${String(value.type)}`);
    }
    return createZenHomeRendererChannelEnvelope(
        value.channel,
        value.channelSessionId,
        value.message,
    );
};
