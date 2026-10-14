import {
    WORKER_RUNTIME_PRIORITY_ORDER,
    resolveWorkerRuntimePriority,
} from './types.js';

const noop = () => {};

const resolveErrorMessage = (error, fallback = 'WORKER_TASK_FAILED') => (
    String(error?.message || error || fallback)
);

const createRuntimeError = (message, code = 'WORKER_TASK_QUEUE_ERROR') => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const normalizeCancelKey = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);

const normalizeDedupeKey = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);

export class WorkerTaskQueue {
    constructor(options = {}) {
        this.concurrency = Number.isFinite(options?.concurrency)
            ? Math.max(1, Math.floor(options.concurrency))
            : 1;
        this.maxQueueSize = Number.isFinite(options?.maxQueueSize)
            ? Math.max(20, Math.floor(options.maxQueueSize))
            : 200;
        this.onEvent = typeof options?.onEvent === 'function'
            ? options.onEvent
            : noop;
        this.running = 0;
        this.queues = new Map(
            WORKER_RUNTIME_PRIORITY_ORDER.map((priority) => [priority, []]),
        );
        this.pendingByDedupeKey = new Map();
    }

    getQueuedCount() {
        let total = 0;
        WORKER_RUNTIME_PRIORITY_ORDER.forEach((priority) => {
            total += this.queues.get(priority)?.length || 0;
        });
        return total;
    }

    getStats() {
        return {
            queued: this.getQueuedCount(),
            running: this.running,
            concurrency: this.concurrency,
            maxQueueSize: this.maxQueueSize,
        };
    }

    setConcurrency(value) {
        if (!Number.isFinite(value)) {
            return;
        }
        this.concurrency = Math.max(1, Math.floor(value));
        this.drain();
    }

    enqueue(task = {}, runTask = null) {
        if (typeof runTask !== 'function') {
            return Promise.reject(
                createRuntimeError('runTask must be a function.', 'WORKER_TASK_INVALID'),
            );
        }

        const dedupeKey = normalizeDedupeKey(task?.dedupeKey);
        if (dedupeKey && this.pendingByDedupeKey.has(dedupeKey)) {
            return this.pendingByDedupeKey.get(dedupeKey).promise;
        }

        if (this.getQueuedCount() >= this.maxQueueSize) {
            this.onEvent({
                type: 'queue_dropped',
                reason: 'QUEUE_CAP_EXCEEDED',
                task,
            });
            return Promise.reject(
                createRuntimeError('Worker task queue capacity exceeded.', 'WORKER_TASK_QUEUE_FULL'),
            );
        }

        const priority = resolveWorkerRuntimePriority(task?.priority);
        const cancelKey = normalizeCancelKey(task?.cancelKey);
        const id = typeof task?.id === 'string' && task.id.trim()
            ? task.id.trim()
            : `task_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        const entry = {
            id,
            priority,
            cancelKey,
            dedupeKey,
            task,
            runTask,
            resolve: resolvePromise,
            reject: rejectPromise,
            promise,
            createdAt: Date.now(),
            canceled: false,
        };

        this.queues.get(priority).push(entry);
        if (dedupeKey) {
            this.pendingByDedupeKey.set(dedupeKey, entry);
        }
        this.drain();
        return promise;
    }

    cancelByKey(cancelKey, reason = 'WORKER_TASK_CANCELED') {
        const normalizedKey = normalizeCancelKey(cancelKey);
        if (!normalizedKey) {
            return 0;
        }

        let canceledCount = 0;
        WORKER_RUNTIME_PRIORITY_ORDER.forEach((priority) => {
            const queue = this.queues.get(priority);
            if (!queue?.length) {
                return;
            }
            for (let i = queue.length - 1; i >= 0; i -= 1) {
                const entry = queue[i];
                if (entry?.cancelKey !== normalizedKey) {
                    continue;
                }
                queue.splice(i, 1);
                entry.canceled = true;
                if (entry?.dedupeKey) {
                    this.pendingByDedupeKey.delete(entry.dedupeKey);
                }
                entry.reject(createRuntimeError(reason, 'WORKER_TASK_CANCELED'));
                canceledCount += 1;
            }
        });

        if (canceledCount > 0) {
            this.onEvent({
                type: 'request_canceled',
                cancelKey: normalizedKey,
                count: canceledCount,
            });
        }
        return canceledCount;
    }

    clear(reason = 'WORKER_TASK_QUEUE_CLEARED') {
        let canceledCount = 0;
        WORKER_RUNTIME_PRIORITY_ORDER.forEach((priority) => {
            const queue = this.queues.get(priority);
            if (!queue?.length) {
                return;
            }
            while (queue.length > 0) {
                const entry = queue.shift();
                if (!entry) {
                    continue;
                }
                entry.canceled = true;
                if (entry?.dedupeKey) {
                    this.pendingByDedupeKey.delete(entry.dedupeKey);
                }
                entry.reject(createRuntimeError(reason, 'WORKER_TASK_CANCELED'));
                canceledCount += 1;
            }
        });
        if (canceledCount > 0) {
            this.onEvent({
                type: 'queue_cleared',
                reason,
                count: canceledCount,
            });
        }
        return canceledCount;
    }

    drain() {
        while (this.running < this.concurrency) {
            const next = this.shiftNextEntry();
            if (!next) {
                return;
            }
            this.running += 1;
            void this.runEntry(next).finally(() => {
                this.running -= 1;
                this.drain();
            });
        }
    }

    shiftNextEntry() {
        for (const priority of WORKER_RUNTIME_PRIORITY_ORDER) {
            const queue = this.queues.get(priority);
            if (queue?.length) {
                return queue.shift();
            }
        }
        return null;
    }

    async runEntry(entry) {
        if (!entry || entry.canceled) {
            return;
        }

        try {
            const result = await entry.runTask(entry.task);
            entry.resolve(result);
        } catch (error) {
            this.onEvent({
                type: 'worker_fail',
                reason: 'WORKER_TASK_RUN_FAILED',
                task: entry.task,
                taskId: entry.id,
                priority: entry.priority,
                cancelKey: entry.cancelKey,
                dedupeKey: entry.dedupeKey,
                message: resolveErrorMessage(error),
                errorCode: typeof error?.code === 'string' && error.code.trim()
                    ? error.code.trim()
                    : null,
            });
            entry.reject(error);
        } finally {
            if (entry?.dedupeKey) {
                this.pendingByDedupeKey.delete(entry.dedupeKey);
            }
        }
    }
}
