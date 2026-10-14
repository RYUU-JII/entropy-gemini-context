import { ZEN_BONSAI_PLUME_MODEL_OPERATION } from './ZenBonsaiPlumeModelProtocol.js';

// Internal operation body for the public injected-diagnostics entry and the
// Worker-owned generated request. Each entry supplies its fixed study producer
// and projector; request data supplies neither function nor strategy flag.
export function requireZenBonsaiPlumeModelProjectionKey(payload) {
    const { seed, projectionKey } = payload;
    if (projectionKey !== null && (typeof projectionKey !== 'string'
        || projectionKey !== JSON.stringify({ seed, lifeState: payload.lifeState, phenotype: payload.phenotype }))) {
        throw new Error('ZEN_PLUME_MODEL_PROJECTION_IDENTITY_INVALID');
    }
}

export function runZenBonsaiPlumeModelOperation(operation, payload, diagnostics, createStudy, projectTopology) {
    requireZenBonsaiPlumeModelProjectionKey(payload);
    const { seed, projectionKey } = payload;
    if (operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE) {
        const study = diagnostics
            ? diagnostics.measure('study', () => createStudy(seed, diagnostics))
            : createStudy(seed, diagnostics);
        const topology = projectionKey === null ? null : diagnostics
            ? diagnostics.measure('projection', () => projectTopology(study, payload, diagnostics))
            : projectTopology(study, payload);
        return { operation, seed, projectionKey, study, topology };
    }
    if (operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT && projectionKey !== null) {
        return { operation, seed, projectionKey,
            topology: diagnostics
                ? diagnostics.measure('projection', () => projectTopology(payload.study, payload, diagnostics))
                : projectTopology(payload.study, payload) };
    }
    throw new Error('ZEN_PLUME_MODEL_OPERATION_INVALID');
}
