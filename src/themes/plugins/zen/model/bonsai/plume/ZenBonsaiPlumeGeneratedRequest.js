import { createZenGeneratedBonsaiPlumePreparation, projectZenGeneratedBonsaiPlumePreparedTopology,
    projectZenGeneratedBonsaiPlumeSnapshot } from './ZenBonsaiPlumeSpecies.js';
import { runZenBonsaiPlumeModelOperation, requireZenBonsaiPlumeModelProjectionKey } from './ZenBonsaiPlumeModelOperationCore.js';
import { createZenBonsaiPlumeWorkerDiagnostics } from './ZenBonsaiPlumeModelDiagnostics.js';
import { finalizeZenGeneratedBonsaiPlumeProductStudy, createZenBonsaiPlumeProductLiveStudy,
    createZenBonsaiPlumeProjectionLiveStudy, requireZenGeneratedBonsaiPlumeFrozenCamera } from './ZenBonsaiPlumeProductStudy.js';
import { requireZenBonsaiPlumeProjectionRequest, createZenBonsaiPlumeProjectionResult } from './ZenBonsaiPlumeProjectionTransport.js';

// Transport conversion belongs to this compute-only request owner. Species
// stays independent of the product DTO and its renderer closure never imports it.
function createProductStudy(seed, diagnostics) {
    const preparation = createZenGeneratedBonsaiPlumePreparation(seed, diagnostics);
    return diagnostics
        ? diagnostics.measure('study_deep_freeze', () => finalizeZenGeneratedBonsaiPlumeProductStudy(preparation))
        : finalizeZenGeneratedBonsaiPlumeProductStudy(preparation);
}
function projectProductTopology(study, payload, diagnostics) {
    const liveStudy = createZenBonsaiPlumeProductLiveStudy(study);
    return projectZenGeneratedBonsaiPlumePreparedTopology(liveStudy, payload, diagnostics,
        requireZenGeneratedBonsaiPlumeFrozenCamera(study));
}

// Only zenBonsaiModel.worker.js prepares this ephemeral handle from native
// structured-cloned message data. The recorder is constructed here, never
// injected. It exposes scalar receipts and cannot replace/observe model data.
export function createZenBonsaiPlumeGeneratedRequest(operation, payload, messageId) {
    const diagnostics = createZenBonsaiPlumeWorkerDiagnostics(payload?.diagnosticIdentity, messageId);
    return {
        diagnostics,
        execute() {
            if (operation === 'PROJECT_PLUME_TOPOLOGY') {
                requireZenBonsaiPlumeModelProjectionKey(payload);
                requireZenBonsaiPlumeProjectionRequest(payload);
                const study = createZenBonsaiPlumeProjectionLiveStudy(payload.study);
                const project = () => projectZenGeneratedBonsaiPlumeSnapshot(study, payload, diagnostics);
                const projection = diagnostics ? diagnostics.measure('projection', project) : project();
                return createZenBonsaiPlumeProjectionResult(projection, payload);
            }
            return runZenBonsaiPlumeModelOperation(operation, payload, diagnostics,
                createProductStudy, projectProductTopology);
        },
    };
}
