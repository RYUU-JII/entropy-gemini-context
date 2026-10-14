export const ZEN_POND_WORKER_PROTOCOL_VERSION = 'zen_pond_worker_protocol_v1';

export const ZEN_POND_WORKER_MESSAGE_TYPE = Object.freeze({
    PING: 'PING',
    READY: 'READY',
    INIT_CANVAS: 'INIT_CANVAS',
    SYNC_SCENE_SESSION: 'SYNC_SCENE_SESSION',
    SYNC_ENVIRONMENT_AUTHORITY: 'SYNC_ENVIRONMENT_AUTHORITY',
    SYNC_RUNTIME_PARAMS: 'SYNC_RUNTIME_PARAMS',
    SYNC_FISH_ROSTER: 'SYNC_FISH_ROSTER',
    RESIZE: 'RESIZE',
    SET_VISIBILITY: 'SET_VISIBILITY',
    SET_INPUT_STATE: 'SET_INPUT_STATE',
    LAND_PETALS: 'LAND_PETALS',
    INJECT_DEBUG_SURFACE_DISTURBANCES:
        'INJECT_DEBUG_SURFACE_DISTURBANCES',
    FLUSH_METRICS: 'FLUSH_METRICS',
    DISPOSE: 'DISPOSE',
    RESULT: 'RESULT',
    ERROR: 'ERROR',
    RENDERER_EVENT: 'RENDERER_EVENT',
    FIRST_FRAME_ACK: 'FIRST_FRAME_ACK',
    PRESENTATION_SCENE_FRAME_ACK: 'PRESENTATION_SCENE_FRAME_ACK',
});

export const ZEN_POND_WORKER_SESSION_FREE_TYPES = Object.freeze([
    ZEN_POND_WORKER_MESSAGE_TYPE.PING,
    ZEN_POND_WORKER_MESSAGE_TYPE.FLUSH_METRICS,
]);

export const buildZenPondWorkerReadyPayload = ({
    renderer = null,
    rendererKind = null,
    supportsWorkerRaf = null,
    supportsPixiOffscreen = true,
} = {}) => (
    {
        protocolVersion: ZEN_POND_WORKER_PROTOCOL_VERSION,
        renderer,
        rendererKind,
        supportsWorkerRaf,
        supportsPixiOffscreen: supportsPixiOffscreen !== false,
    }
);

export const buildZenPondWorkerInitPayload = (payload = null) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ZEN_POND_WORKER_INIT_PAYLOAD_INVALID');
    }
    return {
        ...payload,
        protocolVersion: ZEN_POND_WORKER_PROTOCOL_VERSION,
    };
};

export const requireZenPondWorkerProtocolVersion = (value) => {
    if (value !== ZEN_POND_WORKER_PROTOCOL_VERSION) {
        throw new Error(
            `ZEN_POND_WORKER_PROTOCOL_VERSION_MISMATCH:${value || 'missing'}`,
        );
    }
    return value;
};

export const requireZenPondWorkerInitPayload = (payload = null) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ZEN_POND_WORKER_INIT_PAYLOAD_INVALID');
    }
    requireZenPondWorkerProtocolVersion(payload.protocolVersion);
    return payload;
};

export const requireZenPondWorkerReadyPayload = (payload = null) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('ZEN_POND_WORKER_READY_PAYLOAD_INVALID');
    }
    requireZenPondWorkerProtocolVersion(payload.protocolVersion);
    return payload;
};
