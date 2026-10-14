import {
    WORKER_RUNTIME_EVENT_TYPE,
} from './WorkerTelemetry.js';

export const WORKER_FALLBACK_POLICY = Object.freeze({
    STRICT: 'strict',
});

export const DEFAULT_WORKER_FALLBACK_POLICY = WORKER_FALLBACK_POLICY.STRICT;

const now = () => Date.now();

const resolveErrorMessage = (error, fallback = 'WORKER_EXECUTION_FAILED') => (
    String(error?.message || error || fallback)
);

const createRuntimeError = (message, code = 'WORKER_EXECUTION_FAILED') => {
    const error = new Error(message);
    error.code = code;
    return error;
};

export const resolveWorkerFallbackPolicy = (value = null) => {
    if (value === null || value === undefined || value === WORKER_FALLBACK_POLICY.STRICT) {
        return WORKER_FALLBACK_POLICY.STRICT;
    }
    throw createRuntimeError(
        'Worker fallback policy must be strict. Graceful fallback is prohibited.',
        'WORKER_FALLBACK_POLICY_INVALID',
    );
};

const noop = () => {};

export class WorkerExecutionController {
    constructor(options = {}) {
        this.workerId = typeof options?.workerId === 'string' && options.workerId.trim()
            ? options.workerId.trim()
            : 'unknown_worker';
        this.fallbackPolicy = resolveWorkerFallbackPolicy(
            options?.fallbackPolicy ?? DEFAULT_WORKER_FALLBACK_POLICY,
        );
        this.maxConsecutiveFailures = Number.isFinite(options?.maxConsecutiveFailures)
            ? Math.max(1, Math.floor(options.maxConsecutiveFailures))
            : 3;
        this.circuitOpenMs = Number.isFinite(options?.circuitOpenMs)
            ? Math.max(1000, Math.floor(options.circuitOpenMs))
            : 15000;
        this.eventRecorder = typeof options?.eventRecorder === 'function'
            ? options.eventRecorder
            : noop;
        this.failureCount = 0;
        this.circuitOpenUntil = 0;
        this.lastError = null;
        this.lastFailureAt = 0;
    }

    setFallbackPolicy(policy = DEFAULT_WORKER_FALLBACK_POLICY) {
        this.fallbackPolicy = resolveWorkerFallbackPolicy(policy);
    }

    isCircuitOpen(currentTime = now()) {
        return Number(this.circuitOpenUntil) > Number(currentTime);
    }

    getStatus(currentTime = now()) {
        return {
            workerId: this.workerId,
            fallbackPolicy: this.fallbackPolicy,
            failureCount: this.failureCount,
            circuitOpenUntil: this.circuitOpenUntil,
            circuitOpen: this.isCircuitOpen(currentTime),
            lastFailureAt: this.lastFailureAt,
            lastError: this.lastError,
        };
    }

    recordEvent(type, message = null, details = null) {
        this.eventRecorder({
            type,
            worker: this.workerId,
            message,
            details: details && typeof details === 'object' ? details : null,
        });
    }

    onWorkerSuccess(meta = null) {
        const hadFailures = this.failureCount > 0 || this.lastFailureAt > 0;
        this.failureCount = 0;
        this.circuitOpenUntil = 0;
        this.lastError = null;
        this.lastFailureAt = 0;
        this.recordEvent(WORKER_RUNTIME_EVENT_TYPE.SUCCESS, null, meta);
        if (hadFailures) {
            this.recordEvent(WORKER_RUNTIME_EVENT_TYPE.RECOVER, null, meta);
        }
    }

    onWorkerFailure(error, meta = null) {
        this.failureCount += 1;
        this.lastFailureAt = now();
        this.lastError = resolveErrorMessage(error);
        this.recordEvent(
            WORKER_RUNTIME_EVENT_TYPE.FAIL,
            this.lastError,
            { ...(meta || {}), failureCount: this.failureCount },
        );
        if (this.failureCount >= this.maxConsecutiveFailures) {
            this.circuitOpenUntil = this.lastFailureAt + this.circuitOpenMs;
            this.recordEvent(
                WORKER_RUNTIME_EVENT_TYPE.CIRCUIT_OPEN,
                'Worker circuit opened due to repeated failures.',
                {
                    ...(meta || {}),
                    failureCount: this.failureCount,
                    circuitOpenUntil: this.circuitOpenUntil,
                },
            );
        }
    }

    async execute({
        runWorker,
        runFallback = null,
        meta = null,
    } = {}) {
        if (typeof runWorker !== 'function') {
            return {
                ok: false,
                mode: 'error',
                error: createRuntimeError('runWorker must be a function.', 'WORKER_RUNNER_INVALID'),
            };
        }
        if (runFallback !== null && runFallback !== undefined) {
            return {
                ok: false,
                mode: 'error',
                error: createRuntimeError(
                    'runFallback is prohibited. Worker execution must fail fast.',
                    'WORKER_FALLBACK_PROHIBITED',
                ),
            };
        }

        const nowTs = now();
        if (this.isCircuitOpen(nowTs)) {
            return {
                ok: false,
                mode: 'blocked',
                error: createRuntimeError(
                'Worker circuit is open.',
                'WORKER_CIRCUIT_OPEN',
                ),
            };
        }

        this.recordEvent(WORKER_RUNTIME_EVENT_TYPE.START, null, meta);
        try {
            const workerResult = await runWorker();
            this.onWorkerSuccess(meta);
            return {
                ok: true,
                mode: 'worker',
                result: workerResult,
            };
        } catch (workerError) {
            this.onWorkerFailure(workerError, meta);
            return {
                ok: false,
                mode: 'worker_error',
                error: workerError,
            };
        }
    }
}
