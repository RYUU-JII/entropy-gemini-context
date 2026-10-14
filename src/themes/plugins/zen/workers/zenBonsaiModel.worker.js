import { createZenBonsaiPlumeGeneratedRequest } from '../model/bonsai/plume/ZenBonsaiPlumeGeneratedRequest.js';
import { serializeZenWorkerError } from '../model/ZenWorkerError.js';
import {
    createZenBonsaiPlumeWorkerDiagnostics,
    zenBonsaiPlumeModelClock,
    ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED,
    ZEN_BONSAI_PLUME_MODEL_DIAGNOSTIC_MESSAGE,
} from '../model/bonsai/plume/ZenBonsaiPlumeModelDiagnostics.js';
import { runZenBonsaiPlumeModelProfileBarrier } from '../model/bonsai/plume/ZenBonsaiPlumeModelProfileBarrier.js';

// This marks module-body entry after static dependencies have evaluated. It is
// not a claim to measure individual module fetches or dependency evaluation.
const moduleEvaluated = ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED ? zenBonsaiPlumeModelClock() : null;

self.onmessage = ({ data }) => {
    const { type, id, payload } = data;
    if (type === 'PING') {
        const diagnostics = createZenBonsaiPlumeWorkerDiagnostics(data.diagnosticIdentity, null);
        if (diagnostics) {
            diagnostics.record('worker_module_evaluated', moduleEvaluated);
            diagnostics.record('init_ping_received');
            diagnostics.record('ready_post_start');
        }
        self.postMessage({ type: 'READY', ...(diagnostics ? {
            diagnosticIdentity: data.diagnosticIdentity, diagnosticEvents: diagnostics.events,
        } : {}) });
        return;
    }
    let diagnostics = null;
    const sendError = error => {
        diagnostics?.record('operation_failed');
        self.postMessage({ type: 'ERROR', id, error: serializeZenWorkerError(error),
            ...(diagnostics ? { diagnosticIdentity: payload.diagnosticIdentity, diagnosticEvents: diagnostics.events } : {}) });
    };
    try {
        const request = createZenBonsaiPlumeGeneratedRequest(type, payload, id);
        diagnostics = request.diagnostics;
        diagnostics?.record('request_received');
        const result = request.execute();
        const sendResult = () => {
            const start = diagnostics?.record('result_post_start');
            self.postMessage({ type: 'RESULT', id, result, ...(diagnostics ? {
                diagnosticIdentity: payload.diagnosticIdentity, diagnosticEvents: diagnostics.events,
            } : {}) });
            if (diagnostics) {
                const end = diagnostics.record('result_post_end');
                end.durationMs = end.atMs - start.atMs;
                // The RESULT cannot contain the duration of its own native
                // postMessage call. This small ordered receipt measures only
                // synchronous serialization/enqueue, not receiver decode.
                self.postMessage({ type: ZEN_BONSAI_PLUME_MODEL_DIAGNOSTIC_MESSAGE, id,
                    diagnosticIdentity: payload.diagnosticIdentity, diagnosticEvents: [end] });
            }
        };
        const profileBarrier = runZenBonsaiPlumeModelProfileBarrier({ id, type, diagnostics });
        if (profileBarrier) profileBarrier.then(sendResult).catch(sendError);
        else sendResult();
    } catch (error) {
        sendError(error);
    }
};
