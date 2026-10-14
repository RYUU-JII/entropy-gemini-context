import {
    WorkerRequestClient,
    WORKER_RUNTIME_SURFACE_IDS,
    WORKER_RUNTIME_TASK_TYPE,
    createWorkerRequestClientConfig,
    requireWorkerRuntimeSurface,
} from '../../../../../platform/workers/runtime/index.js';
import { BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS } from '../../../../../platform/build/releaseCapabilities.js';
import { ZEN_ENGINE_MODE } from '../ZenEngineMode';
import {
    createZenWorkerError,
    createZenWorkerUnavailableError,
    normalizeZenWorkerErrorPayload,
} from '../ZenWorkerError.js';
import ZenVNextOptimizerWorker from '@zen-vnext-optimizer-worker';

const ZEN_VNEXT_OPTIMIZER_WORKER_SURFACE = requireWorkerRuntimeSurface(
    WORKER_RUNTIME_SURFACE_IDS.ZEN_VNEXT_OPTIMIZER,
);
const DEFAULT_INIT_TIMEOUT_MS = ZEN_VNEXT_OPTIMIZER_WORKER_SURFACE.initTimeoutMs;
const DEFAULT_REQUEST_TIMEOUT_MS = ZEN_VNEXT_OPTIMIZER_WORKER_SURFACE.requestTimeoutMs;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);
const resolveValueShape = (value) => {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value === null) {
        return 'null';
    }
    return typeof value;
};
const createZenVNextOptimizerWorker = () => {
    if (!BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS) {
        throw new Error('ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED');
    }
    return new ZenVNextOptimizerWorker();
};
const createOptimizerUnavailableError = (reason) => createZenWorkerUnavailableError({
    code: 'ZEN_VNEXT_OPTIMIZER_WORKER_UNAVAILABLE',
    message: reason,
    reason,
    surface: ZEN_VNEXT_OPTIMIZER_WORKER_SURFACE,
});
const createOptimizerResultInvalidPayload = (value) => ({
    code: 'ZEN_VNEXT_OPTIMIZER_WORKER_RESULT_INVALID',
    message: 'Zen VNext optimizer worker returned malformed result.',
    details: {
        requestType: 'OPTIMIZE',
        expectedShape: 'object',
        actualShape: resolveValueShape(value),
    },
});
const requireOptimizerResult = (value) => {
    if (isPlainObject(value)) {
        return value;
    }
    throw createZenWorkerError(createOptimizerResultInvalidPayload(value), {
        fallbackMessage: 'Zen VNext optimizer worker returned malformed result.',
    });
};

const resolveOptimizerResponse = ({ message = {}, requestOptions = null } = {}) => {
    const type = String(message?.type || '');
    if (type === 'PROGRESS') {
        const onProgress = requestOptions?.onProgress;
        if (typeof onProgress === 'function') {
            onProgress(clamp01(Number(message?.progress)));
        }
        return { pending: true };
    }
    if (type === 'RESULT') {
        if (isPlainObject(message?.result)) {
            return {
                ok: true,
                result: message.result,
            };
        }
        return {
            ok: false,
            error: createOptimizerResultInvalidPayload(message?.result),
        };
    }
    if (type === 'ERROR') {
        return {
            ok: false,
            error: normalizeZenWorkerErrorPayload(
                message?.error,
                {
                    fallbackCode: 'ZEN_VNEXT_OPTIMIZER_WORKER_REQUEST_FAILED',
                    fallbackMessage: 'Zen VNext optimizer worker request failed.',
                    details: {
                        requestType: 'OPTIMIZE',
                    },
                },
            ),
        };
    }
    return {
        ok: false,
        error: normalizeZenWorkerErrorPayload(
            {
                code: 'ZEN_VNEXT_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                message: 'Zen VNext optimizer worker returned an unsupported message type.',
                details: {
                    requestType: 'OPTIMIZE',
                    receivedType: type || null,
                },
            },
            {
                fallbackCode: 'ZEN_VNEXT_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                fallbackMessage: 'Zen VNext optimizer worker returned an unsupported message type.',
            },
        ),
    };
};

export class ZenVNextOptimizerWorkerClient {
    constructor(options = {}) {
        this.enabled = options?.enabled !== false;
        this.disabledReason = this.enabled
            ? null
            : 'ZEN_VNEXT_OPTIMIZER_WORKER_DISABLED_BY_OPTIONS';
        this.initTimeoutMs = Number.isFinite(options?.initTimeoutMs)
            ? Math.max(400, Math.floor(options.initTimeoutMs))
            : DEFAULT_INIT_TIMEOUT_MS;
        this.requestTimeoutMs = Number.isFinite(options?.requestTimeoutMs)
            ? Math.max(1500, Math.floor(options.requestTimeoutMs))
            : DEFAULT_REQUEST_TIMEOUT_MS;
        this.workerAvailable = typeof Worker !== 'undefined';
        this.client = null;
    }

    resolveUnavailableReason() {
        if (this.client?.lastDisableReason) {
            return this.client.lastDisableReason;
        }
        if (this.disabledReason) {
            return this.disabledReason;
        }
        if (!this.workerAvailable) {
            return 'WORKER_API_UNAVAILABLE';
        }
        return 'ZEN_VNEXT_OPTIMIZER_WORKER_INIT_FAILED';
    }

    getClient() {
        if (this.client) {
            return this.client;
        }
        this.client = new WorkerRequestClient(createWorkerRequestClientConfig(
            WORKER_RUNTIME_SURFACE_IDS.ZEN_VNEXT_OPTIMIZER,
            {
                workerFactory: createZenVNextOptimizerWorker,
                initMessage: { type: 'PING' },
                initReadyTypes: ['READY'],
                initTimeoutMs: this.initTimeoutMs,
                requestTimeoutMs: this.requestTimeoutMs,
                responseResolver: resolveOptimizerResponse,
            },
        ));
        return this.client;
    }

    async init() {
        if (!this.enabled || !this.workerAvailable) {
            return false;
        }
        return this.getClient().init();
    }

    async optimize(payload = {}, options = {}) {
        const isReady = await this.init();
        if (!isReady) {
            throw createOptimizerUnavailableError(this.resolveUnavailableReason());
        }
        const safePayload = isPlainObject(payload) ? { ...payload } : {};
        safePayload.engineMode = ZEN_ENGINE_MODE.VNEXT;
        const result = await this.getClient().request(
            'OPTIMIZE',
            safePayload,
            {
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_OPTIMIZE_VNEXT,
                priority: ZEN_VNEXT_OPTIMIZER_WORKER_SURFACE.priority,
                timeoutMs: Number.isFinite(options?.timeoutMs)
                    ? Math.max(600, Math.floor(options.timeoutMs))
                    : this.requestTimeoutMs,
                onProgress: typeof options?.onProgress === 'function'
                    ? options.onProgress
                    : null,
            },
        );
        return requireOptimizerResult(result);
    }

    dispose(reason = 'ZEN_VNEXT_OPTIMIZER_WORKER_DISPOSED') {
        if (!this.client) {
            return;
        }
        this.client.disable(reason);
        this.client = null;
    }
}
