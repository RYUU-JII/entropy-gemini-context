import { requireZenBonsaiPlumeProductStudy } from './ZenBonsaiPlumeProductStudy.js';
import { requireZenBonsaiPlumeProjectionResult } from './ZenBonsaiPlumeProjectionTransport.js';

export const ZEN_BONSAI_PLUME_MODEL_OPERATION = Object.freeze({
    PREPARE: 'PREPARE_PLUME_STUDY',
    PROJECT: 'PROJECT_PLUME_TOPOLOGY',
});

export function requireZenBonsaiPlumeModelResult(result, { operation, seed, projectionKey }) {
    if (!result || result.operation !== operation || result.seed !== seed
        || result.projectionKey !== projectionKey) {
        throw new Error('ZEN_PLUME_MODEL_RESPONSE_IDENTITY_INVALID');
    }
    if (operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE) {
        if (result.study?.product?.contract !== 'zen_bonsai_plume_species_v1'
            || result.study.product.seed !== seed || !Array.isArray(result.study.cameraSnapshots)) {
            throw new Error('ZEN_PLUME_MODEL_STUDY_INVALID');
        }
    } else if (operation !== ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT) {
        throw new Error('ZEN_PLUME_MODEL_OPERATION_INVALID');
    }
    if (projectionKey === null) {
        if (operation !== ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE || result.topology !== null) {
            throw new Error('ZEN_PLUME_MODEL_TOPOLOGY_UNEXPECTED');
        }
    } else if (result.topology?.contract !== 'zen_bonsai_plume_topology_v1'
        || result.topology.seed !== seed || !result.topology.snapshot
        || !Array.isArray(result.topology.cameraSnapshots)) {
        throw new Error('ZEN_PLUME_MODEL_TOPOLOGY_INVALID');
    }
    return result;
}
// The public operation keeps its complete audit-study result. Native Worker
// transport has a distinct versioned product-study contract, with no full-study
// compatibility read at this boundary.
export function requireZenBonsaiPlumeProductModelResult(result, identity) {
    if (identity.operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT) {
        return requireZenBonsaiPlumeProjectionResult(result, identity);
    }
    requireZenBonsaiPlumeModelResult(result, identity);
    if (identity.operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE) {
        requireZenBonsaiPlumeProductStudy(result.study, { seed: identity.seed });
        if (identity.projectionKey !== null && result.topology.cameraSnapshots !== result.study.cameraSnapshots) {
            throw new Error('ZEN_PLUME_MODEL_PREPARATION_CAMERA_IDENTITY_INVALID');
        }
    }
    return result;
}
