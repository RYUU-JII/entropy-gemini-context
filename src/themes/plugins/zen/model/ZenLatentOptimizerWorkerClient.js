import { isZenExperimentalWorkerRuntimeEnabled } from './SakuraV2Runtime';
import {
    createZenWorkerError,
    createZenWorkerUnavailableError,
    normalizeZenWorkerErrorPayload,
} from './ZenWorkerError.js';
import {
    WorkerRequestClient,
    WORKER_RUNTIME_SURFACE_IDS,
    WORKER_RUNTIME_TASK_TYPE,
    createWorkerRequestClientConfig,
    requireWorkerRuntimeSurface,
} from '../../../../platform/workers/runtime/index.js';
import ZenLatentOptimizerWorker from '@zen-latent-optimizer-worker';
import ZenModelRepository from '../state/ZenModelRepository.js';
import {
    createZenWorkerClientProfileGenerationLease,
    requireZenWorkerResponseProfileGeneration,
} from '../contracts/ZenWorkerProfileGenerationContract.js';

const ZEN_LATENT_OPTIMIZER_WORKER_SURFACE = requireWorkerRuntimeSurface(
    WORKER_RUNTIME_SURFACE_IDS.ZEN_LATENT_OPTIMIZER,
);
const DEFAULT_INIT_TIMEOUT_MS = ZEN_LATENT_OPTIMIZER_WORKER_SURFACE.initTimeoutMs;
const DEFAULT_REQUEST_TIMEOUT_MS = ZEN_LATENT_OPTIMIZER_WORKER_SURFACE.requestTimeoutMs;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const resolveWorkerSupport = () => (
    typeof Worker !== 'undefined'
);
const createZenLatentOptimizerWorker = () => {
    if (!isZenExperimentalWorkerRuntimeEnabled()) {
        throw new Error('ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED');
    }
    return new ZenLatentOptimizerWorker();
};
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
const createOptimizerUnavailableError = (reason) => createZenWorkerUnavailableError({
    code: 'ZEN_OPTIMIZER_WORKER_UNAVAILABLE',
    message: reason,
    reason,
    surface: ZEN_LATENT_OPTIMIZER_WORKER_SURFACE,
});
const createOptimizerResultInvalidPayload = (value) => ({
    code: 'ZEN_OPTIMIZER_WORKER_RESULT_INVALID',
    message: 'Zen optimizer worker returned malformed result.',
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
        fallbackMessage: 'Zen optimizer worker returned malformed result.',
    });
};

const resolveOptimizerResponse = ({ message = {}, requestOptions = null } = {}) => {
    const type = String(message?.type || '');
    try {
        requireZenWorkerResponseProfileGeneration(
            message,
            requestOptions?.expectedProfileGeneration,
        );
    } catch (error) {
        return {
            ok: false,
            error: normalizeZenWorkerErrorPayload(error, {
                fallbackCode: 'ZEN_OPTIMIZER_WORKER_PROFILE_GENERATION_INVALID',
                fallbackMessage: 'Zen optimizer worker returned an invalid profile generation.',
                details: {
                    requestType: 'OPTIMIZE',
                },
            }),
        };
    }
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
                    fallbackCode: 'ZEN_OPTIMIZER_WORKER_REQUEST_FAILED',
                    fallbackMessage: 'Zen optimizer worker request failed.',
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
                code: 'ZEN_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                message: 'Zen optimizer worker returned an unsupported message type.',
                details: {
                    requestType: 'OPTIMIZE',
                    receivedType: type || null,
                },
            },
            {
                fallbackCode: 'ZEN_OPTIMIZER_WORKER_MESSAGE_TYPE_INVALID',
                fallbackMessage: 'Zen optimizer worker returned an unsupported message type.',
            },
        ),
    };
};

export class ZenLatentOptimizerWorkerClient {
    constructor(options = {}) {
        const optionEnabled = options?.enabled !== false;
        const runtimeEnabled = isZenExperimentalWorkerRuntimeEnabled();
        this.enabled = optionEnabled && runtimeEnabled;
        this.disabledReason = this.enabled
            ? null
            : (
                optionEnabled
                    ? 'ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED'
                    : 'ZEN_OPTIMIZER_WORKER_DISABLED_BY_OPTIONS'
            );
        this.initTimeoutMs = Number.isFinite(options?.initTimeoutMs)
            ? Math.max(400, Math.floor(options.initTimeoutMs))
            : DEFAULT_INIT_TIMEOUT_MS;
        this.requestTimeoutMs = Number.isFinite(options?.requestTimeoutMs)
            ? Math.max(1500, Math.floor(options.requestTimeoutMs))
            : DEFAULT_REQUEST_TIMEOUT_MS;
        this.workerAvailable = resolveWorkerSupport();
        this.client = null;
        this.profileGenerationOwner = options?.profileGenerationOwner || null;
        this.profileGenerationLease = null;
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
        return 'ZEN_OPTIMIZER_WORKER_INIT_FAILED';
    }

    getClient() {
        if (this.client) {
            return this.client;
        }
        this.client = new WorkerRequestClient(createWorkerRequestClientConfig(
            WORKER_RUNTIME_SURFACE_IDS.ZEN_LATENT_OPTIMIZER,
            {
                workerFactory: createZenLatentOptimizerWorker,
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
        const profileGeneration = await this.requireProfileGeneration();
        const result = await this.getClient().request(
            'OPTIMIZE',
            {
                ...(isPlainObject(payload) ? payload : {}),
                profileGeneration,
            },
            {
                taskType: WORKER_RUNTIME_TASK_TYPE.ZEN_OPTIMIZE,
                priority: ZEN_LATENT_OPTIMIZER_WORKER_SURFACE.priority,
                timeoutMs: Number.isFinite(options?.timeoutMs)
                    ? Math.max(600, Math.floor(options.timeoutMs))
                    : this.requestTimeoutMs,
                onProgress: typeof options?.onProgress === 'function'
                    ? options.onProgress
                    : null,
                expectedProfileGeneration: profileGeneration,
            },
        );
        await this.requireProfileGeneration();
        return requireOptimizerResult(result);
    }

    getProfileGenerationLease() {
        if (this.profileGenerationLease === null) {
            this.profileGenerationLease = createZenWorkerClientProfileGenerationLease({
                profileGenerationOwner: this.profileGenerationOwner
                    || ZenModelRepository.getInstance(),
            });
        }
        return this.profileGenerationLease;
    }

    requireProfileGeneration() {
        return this.getProfileGenerationLease().requireCurrent();
    }

    dispose(reason = 'ZEN_OPTIMIZER_WORKER_DISPOSED') {
        if (!this.client) {
            return;
        }
        this.client.disable(reason);
        this.client = null;
    }
}
