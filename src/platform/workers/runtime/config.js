import {
    WORKER_RUNTIME_CONTEXT,
    resolveWorkerRuntimeContext,
} from './types.js';

export const WORKER_RUNTIME_FLAG_KEY = Object.freeze({
    ENABLED: 'worker_runtime_enabled',
    ZEN_EXPERIMENTAL_ENABLED: 'worker_runtime_zen_experimental_enabled',
    DEBUG_TELEMETRY_ENABLED: 'worker_runtime_debug_telemetry_enabled',
});

export const WORKER_RUNTIME_ADMISSION_GROUP = Object.freeze({
    PRESENTATION: 'presentation',
    COMPUTE: 'compute',
});

export const WORKER_RUNTIME_BUDGET = Object.freeze({
    UI: Object.freeze({
        maxWorkers: 2,
        burstMaxWorkers: 3,
        burstWindowMs: 15000,
        admissionGroups: Object.freeze({
            [WORKER_RUNTIME_ADMISSION_GROUP.PRESENTATION]: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 2,
                burstWindowMs: 15000,
            }),
            [WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE]: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
                burstWindowMs: 0,
            }),
        }),
        lanes: Object.freeze({
            compute: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
            }),
            render: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 2,
                burstWindowMs: 15000,
            }),
            ceremony: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
            }),
        }),
    }),
    BACKGROUND: Object.freeze({
        maxWorkers: 2,
        lanes: Object.freeze({
            secure: 1,
            compute: 1,
        }),
    }),
    CONTENT: Object.freeze({
        maxWorkers: 1,
        burstMaxWorkers: 1,
        burstWindowMs: 0,
        lanes: Object.freeze({
            render: 1,
            ceremony: 1,
        }),
    }),
});

export const LOW_CORE_RUNTIME_BUDGET = Object.freeze({
    UI: Object.freeze({
        maxWorkers: 2,
        burstMaxWorkers: 2,
        burstWindowMs: 0,
        admissionGroups: Object.freeze({
            [WORKER_RUNTIME_ADMISSION_GROUP.PRESENTATION]: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
                burstWindowMs: 0,
            }),
            [WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE]: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
                burstWindowMs: 0,
            }),
        }),
        lanes: Object.freeze({
            compute: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
            }),
            render: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
            }),
            ceremony: Object.freeze({
                maxWorkers: 1,
                burstMaxWorkers: 1,
            }),
        }),
    }),
    BACKGROUND: Object.freeze({
        maxWorkers: 1,
        lanes: Object.freeze({
            secure: 1,
            compute: 1,
        }),
    }),
    CONTENT: Object.freeze({
        maxWorkers: 1,
        burstMaxWorkers: 1,
        burstWindowMs: 0,
        lanes: Object.freeze({
            render: 1,
            ceremony: 1,
        }),
    }),
});

const toSafeCpuCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.max(0, Math.floor(n));
};

export const getHardwareConcurrency = () => (
    toSafeCpuCount(globalThis?.navigator?.hardwareConcurrency || 0)
);

export const isLowCoreEnvironment = (cpuCount = getHardwareConcurrency()) => (
    toSafeCpuCount(cpuCount) > 0 && toSafeCpuCount(cpuCount) < 4
);

export const resolveWorkerRuntimeBudget = ({
    context = WORKER_RUNTIME_CONTEXT.UI,
    cpuCount = getHardwareConcurrency(),
} = {}) => {
    const normalizedContext = resolveWorkerRuntimeContext(context);
    const lowCore = isLowCoreEnvironment(cpuCount);
    const policy = lowCore ? LOW_CORE_RUNTIME_BUDGET : WORKER_RUNTIME_BUDGET;

    if (normalizedContext === WORKER_RUNTIME_CONTEXT.BACKGROUND) {
        return {
            context: WORKER_RUNTIME_CONTEXT.BACKGROUND,
            ...policy.BACKGROUND,
        };
    }

    if (normalizedContext === WORKER_RUNTIME_CONTEXT.CONTENT) {
        return {
            context: WORKER_RUNTIME_CONTEXT.CONTENT,
            ...policy.CONTENT,
        };
    }

    return {
        context: WORKER_RUNTIME_CONTEXT.UI,
        ...policy.UI,
    };
};
