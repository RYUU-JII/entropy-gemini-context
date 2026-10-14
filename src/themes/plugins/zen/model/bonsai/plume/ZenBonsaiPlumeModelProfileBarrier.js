import { ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED } from './ZenBonsaiPlumeModelDiagnostics.js';

const READY_BINDING = '__ENTROPY_QA_ZEN_MODEL_PROFILE_READY__';
const ACK_BINDING = '__ENTROPY_QA_ZEN_MODEL_PROFILE_ACK__';
const PROFILE_WAIT_LIMIT_MS = 15_000;

// Only the canonical CPU-profile collector installs this native CDP binding.
// Ordinary development boots remain synchronous and change no worker lifetime.
export function runZenBonsaiPlumeModelProfileBarrier({ id, type, diagnostics }) {
    if (!ZEN_BONSAI_PLUME_MODEL_DIAGNOSTICS_ENABLED || typeof self[READY_BINDING] !== 'function') return null;
    if (!diagnostics || typeof diagnostics.record !== 'function') {
        throw new Error('ZEN_PLUME_MODEL_PROFILE_DIAGNOSTICS_REQUIRED');
    }
    if (Object.hasOwn(self, ACK_BINDING)) throw new Error('ZEN_PLUME_MODEL_PROFILE_WAIT_ALREADY_ACTIVE');
    const start = diagnostics.record('profile_wait_start');
    return new Promise((resolve, reject) => {
        let finished = false;
        const finish = (waitOutcome, error = null) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);
            delete self[ACK_BINDING];
            try {
                const end = diagnostics.record('profile_wait_end', { waitOutcome });
                end.durationMs = end.atMs - start.atMs;
            } catch (recordError) { error = recordError; }
            if (error) reject(error);
            else resolve();
        };
        const timeoutId = setTimeout(() => finish('timeout',
            new Error('ZEN_PLUME_MODEL_PROFILE_COLLECTOR_TIMEOUT')), PROFILE_WAIT_LIMIT_MS);
        self[ACK_BINDING] = (requestId) => {
            if (requestId !== id) throw new Error('ZEN_PLUME_MODEL_PROFILE_ACK_ID_MISMATCH');
            finish('success');
            return id;
        };
        try {
            self[READY_BINDING](JSON.stringify({ runtimeName: self.name, requestId: id,
                requestType: type, operationId: start.operationId, phase: 'before_result',
                atMs: start.atMs, timeOriginMs: start.timeOriginMs }));
        } catch (error) { finish('binding_failed', error); }
    });
}
