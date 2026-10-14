const noop = () => {};

const resolveErrorMessage = (error, fallback = 'WORKER_POOL_FAILED') => (
    String(error?.message || error || fallback)
);

const resolveErrorCode = (error, fallback = null) => (
    typeof error?.code === 'string' && error.code.trim()
        ? error.code.trim()
        : fallback
);

const createPoolError = (message, code = 'WORKER_POOL_ERROR') => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const normalizeMaxWorkers = (value) => {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.max(1, Math.floor(value));
};

export class WorkerPool {
    constructor(options = {}) {
        this.maxWorkers = normalizeMaxWorkers(options?.maxWorkers);
        this.createWorker = typeof options?.createWorker === 'function'
            ? options.createWorker
            : null;
        this.onEvent = typeof options?.onEvent === 'function'
            ? options.onEvent
            : noop;
        this.slots = Array.from({ length: this.maxWorkers }, () => ({
            worker: null,
            busy: false,
            runs: 0,
            failures: 0,
            lastStartedAt: 0,
            lastFinishedAt: 0,
        }));
        this.roundRobinCursor = 0;
    }

    hasFactory() {
        return typeof this.createWorker === 'function';
    }

    recordFailure({
        slotIndex = null,
        error = null,
        stage = 'run',
        type = 'worker_fail',
    } = {}) {
        this.onEvent({
            type,
            slotIndex,
            stage,
            message: resolveErrorMessage(error, 'WORKER_POOL_FAILED'),
            errorCode: resolveErrorCode(error),
        });
    }

    getStats() {
        return {
            maxWorkers: this.maxWorkers,
            activeWorkers: this.slots.filter((slot) => !!slot.worker).length,
            busyWorkers: this.slots.filter((slot) => slot.busy).length,
            slots: this.slots.map((slot, index) => ({
                index,
                busy: slot.busy,
                runs: slot.runs,
                failures: slot.failures,
                hasWorker: !!slot.worker,
                lastStartedAt: slot.lastStartedAt,
                lastFinishedAt: slot.lastFinishedAt,
            })),
        };
    }

    async withNextWorker(run) {
        if (typeof run !== 'function') {
            throw new Error('run must be a function.');
        }
        const slotIndex = this.acquireSlotIndex();
        return this.withWorker(slotIndex, run);
    }

    async withWorker(slotIndex, run) {
        if (typeof run !== 'function') {
            throw new Error('run must be a function.');
        }
        const normalizedIndex = this.normalizeSlotIndex(slotIndex);
        const slot = this.slots[normalizedIndex];

        slot.busy = true;
        slot.lastStartedAt = Date.now();
        slot.runs += 1;

        try {
            const worker = this.getOrCreateWorker(normalizedIndex);
            const result = await run(worker, normalizedIndex);
            return result;
        } catch (error) {
            if (error?.poolEventEmitted !== true) {
                slot.failures += 1;
                this.recordFailure({
                    slotIndex: normalizedIndex,
                    error,
                    stage: slot.worker ? 'run' : 'worker_factory',
                });
            }
            throw error;
        } finally {
            slot.busy = false;
            slot.lastFinishedAt = Date.now();
        }
    }

    terminate(slotIndex) {
        const normalizedIndex = this.normalizeSlotIndex(slotIndex);
        const slot = this.slots[normalizedIndex];
        if (!slot?.worker) {
            return;
        }
        try {
            slot.worker.terminate();
        } catch (error) {
            this.onEvent({
                type: 'worker_terminate_fail',
                slotIndex: normalizedIndex,
                message: String(error?.message || error || 'WORKER_TERMINATE_FAILED'),
            });
        }
        slot.worker = null;
        slot.busy = false;
    }

    terminateAll() {
        for (let index = 0; index < this.slots.length; index += 1) {
            this.terminate(index);
        }
    }

    acquireSlotIndex() {
        const idleIndex = this.slots.findIndex((slot) => !slot.busy);
        if (idleIndex >= 0) {
            this.roundRobinCursor = (idleIndex + 1) % this.slots.length;
            return idleIndex;
        }
        const index = this.roundRobinCursor % this.slots.length;
        this.roundRobinCursor = (index + 1) % this.slots.length;
        return index;
    }

    getOrCreateWorker(slotIndex) {
        const slot = this.slots[slotIndex];
        if (!slot) {
            const error = createPoolError('WorkerPool slot not found.', 'WORKER_POOL_SLOT_NOT_FOUND');
            this.recordFailure({
                slotIndex,
                error,
                stage: 'slot_lookup',
            });
            error.poolEventEmitted = true;
            throw error;
        }
        if (slot.worker) {
            return slot.worker;
        }
        if (!this.hasFactory()) {
            const error = createPoolError(
                'WorkerPool createWorker factory is not configured.',
                'WORKER_POOL_FACTORY_UNAVAILABLE',
            );
            slot.failures += 1;
            this.recordFailure({
                slotIndex,
                error,
                stage: 'worker_factory',
            });
            error.poolEventEmitted = true;
            throw error;
        }
        try {
            slot.worker = this.createWorker(slotIndex);
        } catch (error) {
            const emittedError = error && typeof error === 'object'
                ? error
                : createPoolError(
                    resolveErrorMessage(error, 'WORKER_POOL_FACTORY_FAILED'),
                    'WORKER_POOL_FACTORY_FAILED',
                );
            slot.failures += 1;
            this.recordFailure({
                slotIndex,
                error: emittedError,
                stage: 'worker_factory',
            });
            emittedError.poolEventEmitted = true;
            throw emittedError;
        }
        return slot.worker;
    }

    normalizeSlotIndex(slotIndex) {
        const n = Number(slotIndex);
        if (!Number.isFinite(n)) {
            return 0;
        }
        const index = Math.floor(n);
        if (index < 0) {
            return 0;
        }
        if (index >= this.slots.length) {
            return this.slots.length - 1;
        }
        return index;
    }
}
