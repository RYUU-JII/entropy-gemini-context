import { createZenBonsaiPlumeStudy, projectZenBonsaiPlumeTopology } from './ZenBonsaiPlumeSpecies.js';
import { runZenBonsaiPlumeModelOperation } from './ZenBonsaiPlumeModelOperationCore.js';

// Stateless operations: the requesting surface owns the returned study DTO.
// Nothing is retained when the strict compute lease becomes idle.
export function executeZenBonsaiPlumeModelOperation(operation, payload, diagnostics = null) {
    return runZenBonsaiPlumeModelOperation(operation, payload, diagnostics,
        createZenBonsaiPlumeStudy, projectZenBonsaiPlumeTopology);
}
