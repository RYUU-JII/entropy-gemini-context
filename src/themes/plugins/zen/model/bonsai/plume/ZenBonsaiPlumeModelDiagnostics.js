export const ZEN_BONSAI_PLUME_MODEL_TIMING_CONTRACT = 'zen_bonsai_plume_model_timing_v1';
export const ZEN_BONSAI_PLUME_MODEL_DIAGNOSTIC_MESSAGE = 'MODEL_DIAGNOSTIC';
export const ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        && __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ === true
);
const EVENT_LIMIT = 80;
let clientSequence = 0;

export function zenBonsaiPlumeModelClock() {
    return { atMs: performance.now(), timeOriginMs: performance.timeOrigin };
}

export function requireZenBonsaiPlumeModelDiagnosticIdentity(identity, workerInstanceId = null) {
    if (!identity || identity.contract !== ZEN_BONSAI_PLUME_MODEL_TIMING_CONTRACT
        || typeof identity.operationId !== 'string' || !identity.operationId
        || typeof identity.workerInstanceId !== 'string' || !identity.workerInstanceId
        || (workerInstanceId !== null && identity.workerInstanceId !== workerInstanceId)
        || !['PREPARE_PLUME_STUDY', 'PROJECT_PLUME_TOPOLOGY'].includes(identity.operation)
        || !Number.isFinite(identity.seed) || typeof identity.hasProjection !== 'boolean') {
        throw new Error('ZEN_PLUME_MODEL_DIAGNOSTIC_IDENTITY_INVALID');
    }
    return identity;
}

// Diagnostic IDs and scalar events are bounded and surface-local. They never
// enter study/topology objects, storage, renderer commands or model caches.
export function createZenBonsaiPlumeModelDiagnostics({ seed, onEvent } = {}) {
    if (!ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED || typeof onEvent !== 'function') return null;
    const clientId = `${performance.timeOrigin.toString(36)}-${++clientSequence}`;
    let operationSequence = 0;
    let physicalGeneration = 0;
    return {
        createOperation(operation, hasProjection) {
            return { contract: ZEN_BONSAI_PLUME_MODEL_TIMING_CONTRACT,
                operationId: `zen-plume-operation-${clientId}-${++operationSequence}`,
                workerInstanceId: null, operation, seed, hasProjection };
        },
        createWorkerInstanceId() {
            return `zen-plume-model-${clientId}-${++physicalGeneration}`;
        },
        record(identity, stage, details = {}) {
            if (!identity) return;
            onEvent({ ...identity, stage, realm: 'page', ...zenBonsaiPlumeModelClock(),
                messageId: null, ...details });
        },
        receive(identity, events) {
            if (!Array.isArray(events) || events.length > EVENT_LIMIT) {
                throw new Error('ZEN_PLUME_MODEL_DIAGNOSTIC_EVENTS_INVALID');
            }
            for (const event of events) {
                if (!event || event.contract !== ZEN_BONSAI_PLUME_MODEL_TIMING_CONTRACT
                    || event.operationId !== identity.operationId
                    || event.workerInstanceId !== identity.workerInstanceId
                    || event.operation !== identity.operation || event.seed !== identity.seed
                    || event.realm !== 'model_worker' || typeof event.stage !== 'string'
                    || !Number.isFinite(event.atMs) || !Number.isFinite(event.timeOriginMs)) {
                    throw new Error('ZEN_PLUME_MODEL_DIAGNOSTIC_EVENT_IDENTITY_INVALID');
                }
                onEvent(event);
            }
        },
    };
}

export function createZenBonsaiPlumeWorkerDiagnostics(identity, messageId) {
    if (!ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED || !identity) return null;
    requireZenBonsaiPlumeModelDiagnosticIdentity(identity, self.name);
    const events = [];
    const record = (stage, details = {}) => {
        if (events.length >= EVENT_LIMIT) throw new Error('ZEN_PLUME_MODEL_DIAGNOSTIC_EVENT_LIMIT');
        const event = { ...identity, stage, realm: 'model_worker', ...zenBonsaiPlumeModelClock(),
            messageId, ...details };
        events.push(event);
        return event;
    };
    return {
        events,
        record,
        measure(stage, task) {
            const start = record(`${stage}_start`);
            const value = task();
            const end = record(`${stage}_end`);
            end.durationMs = end.atMs - start.atMs;
            return value;
        },
    };
}
