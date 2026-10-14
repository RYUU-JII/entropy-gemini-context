import {
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    WORKER_RUNTIME_TASK_TYPE,
} from './types.js';
import { WORKER_RUNTIME_ADMISSION_GROUP } from './config.js';

export const WORKER_RUNTIME_SURFACE_IDS = Object.freeze({
    CRYPTO: 'crypto',
    ZEN_AB_TRIAL: 'zen_ab_trial',
    ZEN_BONSAI_MODEL: 'zen_bonsai_model',
    ZEN_LATENT_OPTIMIZER: 'zen_latent_optimizer',
    ZEN_VNEXT_OPTIMIZER: 'zen_vnext_optimizer',
    ZEN_VNEXT_PREFERENCE_TRAINER: 'zen_vnext_preference_trainer',
    ZEN_HOME_RENDERER: 'zen_home_renderer',
    NUDGE_CONTENT_SWARM: 'nudge_content_swarm',
    DASHBOARD_BOOT_RENDERER: 'dashboard_boot_renderer',
    CEREMONY_OVERLAY_RENDERER: 'ceremony_overlay_renderer',
});

export const WORKER_RUNTIME_SURFACE_KIND = Object.freeze({
    REQUEST: 'request',
    OFFSCREEN_RENDER: 'offscreen_render',
    CONTENT_RENDER: 'content_render',
    CEREMONY: 'ceremony',
});

export const WORKER_RUNTIME_DEGRADATION_MODE = Object.freeze({
    STRICT: 'strict',
    LOCAL_MAIN_THREAD: 'local_main_thread',
    PRESENTATION_DEGRADE: 'presentation_degrade',
    DISABLED_BY_FLAG: 'disabled_by_flag',
});

export const WORKER_RUNTIME_SURFACE_STATUS = Object.freeze({
    ACTIVE: 'active',
    DISABLED: 'disabled',
    PLANNED: 'planned',
});

const createTaskTypes = ({
    init = null,
    default: defaultTask,
    control = null,
    telemetry = null,
} = {}) => Object.freeze({
    init,
    default: defaultTask,
    control,
    telemetry,
});

const createAdmissionMetadata = (admission = null) => (
    admission && typeof admission === 'object'
        ? Object.freeze({ ...admission })
        : null
);

const createSurface = (surface) => Object.freeze({
    ...surface,
    taskTypes: createTaskTypes(surface.taskTypes),
    admission: createAdmissionMetadata(surface.admission),
});

export const WORKER_RUNTIME_SURFACE_REGISTRY = Object.freeze([
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.CRYPTO,
        workerId: 'crypto_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.BACKGROUND,
        lane: WORKER_RUNTIME_LANE.SECURE,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: {
            init: WORKER_RUNTIME_TASK_TYPE.CRYPTO_INIT,
            default: WORKER_RUNTIME_TASK_TYPE.CRYPTO_ENCRYPT_BATCH,
        },
        initTimeoutMs: 8000,
        requestTimeoutMs: 30000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.LOCAL_MAIN_THREAD,
        ownerPath: 'src/platform/security/CryptoService.js',
        scriptPath: 'src/platform/workers/crypto.worker.js',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_BONSAI_MODEL,
        workerId: 'zen_bonsai_model_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.COMPUTE,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: { default: WORKER_RUNTIME_TASK_TYPE.ZEN_BONSAI_MODEL },
        initTimeoutMs: 10000,
        requestTimeoutMs: 30000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE,
            rank: 200,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeModelClient.js',
        scriptPath: 'src/themes/plugins/zen/workers/zenBonsaiModel.worker.js',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_AB_TRIAL,
        workerId: 'zen_ab_trial_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.COMPUTE,
        priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        taskTypes: {
            default: WORKER_RUNTIME_TASK_TYPE.ZEN_AB_TRIAL_EVAL,
        },
        initTimeoutMs: 1800,
        requestTimeoutMs: 120000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE,
            rank: 150,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/model/ZenABTrialWorkerClient.js',
        scriptPath: 'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js',
        activationFlagName: 'BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_LATENT_OPTIMIZER,
        workerId: 'zen_latent_optimizer_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.COMPUTE,
        priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        taskTypes: {
            default: WORKER_RUNTIME_TASK_TYPE.ZEN_OPTIMIZE,
        },
        initTimeoutMs: 1800,
        requestTimeoutMs: 120000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE,
            rank: 250,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/model/ZenLatentOptimizerWorkerClient.js',
        scriptPath: 'src/themes/plugins/zen/workers/zenLatentOptimizer.worker.js',
        activationFlagName: 'ZEN_EXPERIMENTAL_WORKER_RUNTIME',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_VNEXT_OPTIMIZER,
        workerId: 'zen_vnext_optimizer_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.COMPUTE,
        priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        taskTypes: {
            default: WORKER_RUNTIME_TASK_TYPE.ZEN_OPTIMIZE_VNEXT,
        },
        initTimeoutMs: 1800,
        requestTimeoutMs: 120000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE,
            rank: 250,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/model/vnext/ZenVNextOptimizerWorkerClient.js',
        scriptPath: 'src/themes/plugins/zen/workers/zenVNextOptimizer.worker.js',
        activationFlagName: 'BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_VNEXT_PREFERENCE_TRAINER,
        workerId: 'zen_vnext_preference_trainer_worker',
        kind: WORKER_RUNTIME_SURFACE_KIND.REQUEST,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.COMPUTE,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: {
            default: WORKER_RUNTIME_TASK_TYPE.ZEN_TRAIN_VNEXT_PREFERENCE,
        },
        initTimeoutMs: 1800,
        requestTimeoutMs: 120000,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.COMPUTE,
            rank: 125,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/model/vnext/ZenVNextPreferenceTrainerWorkerClient.js',
        scriptPath: 'src/themes/plugins/zen/workers/zenVNextPreferenceTrainer.worker.js',
        activationFlagName: 'BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.ZEN_HOME_RENDERER,
        workerId: 'zen_home_renderer',
        kind: WORKER_RUNTIME_SURFACE_KIND.OFFSCREEN_RENDER,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.RENDER,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: {
            init: WORKER_RUNTIME_TASK_TYPE.ZEN_HOME_RENDER_INIT,
            default: WORKER_RUNTIME_TASK_TYPE.ZEN_HOME_RENDER_CONTROL,
            control: WORKER_RUNTIME_TASK_TYPE.ZEN_HOME_RENDER_CONTROL,
            telemetry: WORKER_RUNTIME_TASK_TYPE.ZEN_HOME_RENDER_TELEMETRY,
        },
        initTimeoutMs: 10000,
        requestTimeoutMs: 3200,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.STRICT,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.PRESENTATION,
            rank: 400,
            preemptible: false,
        },
        ownerPath: 'src/themes/plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js',
        scriptPath: 'src/themes/plugins/zen/runtime/worker/zenHomeRenderer.worker.js',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.NUDGE_CONTENT_SWARM,
        workerId: 'nudge_content_swarm',
        kind: WORKER_RUNTIME_SURFACE_KIND.CONTENT_RENDER,
        status: WORKER_RUNTIME_SURFACE_STATUS.DISABLED,
        context: WORKER_RUNTIME_CONTEXT.CONTENT,
        lane: WORKER_RUNTIME_LANE.RENDER,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: {
            init: WORKER_RUNTIME_TASK_TYPE.NUDGE_CONTENT_RENDER_INIT,
            default: WORKER_RUNTIME_TASK_TYPE.NUDGE_CONTENT_RENDER_CONTROL,
            control: WORKER_RUNTIME_TASK_TYPE.NUDGE_CONTENT_RENDER_CONTROL,
            telemetry: WORKER_RUNTIME_TASK_TYPE.NUDGE_CONTENT_RENDER_TELEMETRY,
        },
        initTimeoutMs: 3000,
        requestTimeoutMs: 3200,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.DISABLED_BY_FLAG,
        ownerPath: 'src/domains/nudge/runtime/NudgePreparedWorkerRuntime.js',
        scriptPath: 'src/domains/nudge/nudgeSwarm.worker.js',
        activationFlagName: 'NUDGE_CONTENT_WORKER_RUNTIME_ENABLED',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.DASHBOARD_BOOT_RENDERER,
        workerId: 'dashboard_boot_renderer',
        kind: WORKER_RUNTIME_SURFACE_KIND.OFFSCREEN_RENDER,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.RENDER,
        priority: WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
        taskTypes: {
            init: WORKER_RUNTIME_TASK_TYPE.DASHBOARD_BOOT_RENDER_INIT,
            default: WORKER_RUNTIME_TASK_TYPE.DASHBOARD_BOOT_RENDER_CONTROL,
            control: WORKER_RUNTIME_TASK_TYPE.DASHBOARD_BOOT_RENDER_CONTROL,
            telemetry: WORKER_RUNTIME_TASK_TYPE.DASHBOARD_BOOT_RENDER_TELEMETRY,
        },
        initTimeoutMs: 5000,
        requestTimeoutMs: 3200,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.PRESENTATION_DEGRADE,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.PRESENTATION,
            rank: 200,
            preemptible: true,
        },
        ownerPath: 'src/themes/plugins/zen/presentation/ZenSoftBootShell.js',
        scriptPath: 'src/themes/plugins/zen/presentation/ZenSoftBootShell.worker.js',
    }),
    createSurface({
        id: WORKER_RUNTIME_SURFACE_IDS.CEREMONY_OVERLAY_RENDERER,
        workerId: 'ceremony_overlay_renderer',
        kind: WORKER_RUNTIME_SURFACE_KIND.CEREMONY,
        status: WORKER_RUNTIME_SURFACE_STATUS.ACTIVE,
        context: WORKER_RUNTIME_CONTEXT.UI,
        lane: WORKER_RUNTIME_LANE.CEREMONY,
        priority: WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        taskTypes: {
            init: WORKER_RUNTIME_TASK_TYPE.CEREMONY_RENDER_INIT,
            default: WORKER_RUNTIME_TASK_TYPE.CEREMONY_RENDER_CONTROL,
            control: WORKER_RUNTIME_TASK_TYPE.CEREMONY_RENDER_CONTROL,
            telemetry: WORKER_RUNTIME_TASK_TYPE.CEREMONY_RENDER_TELEMETRY,
        },
        initTimeoutMs: 5000,
        requestTimeoutMs: 2400,
        degradationMode: WORKER_RUNTIME_DEGRADATION_MODE.PRESENTATION_DEGRADE,
        admission: {
            group: WORKER_RUNTIME_ADMISSION_GROUP.PRESENTATION,
            rank: 300,
            preemptible: true,
        },
        ownerPath: 'src/platform/ceremony/CeremonyOverlay.jsx',
        scriptPath: 'src/platform/ceremony/CeremonyOverlay.worker.js',
    }),
]);

const SURFACE_BY_ID = new Map(WORKER_RUNTIME_SURFACE_REGISTRY.map((surface) => [surface.id, surface]));

const isNonEmptyString = (value) => (
    typeof value === 'string' && value.trim().length > 0
);

export const getWorkerRuntimeSurface = (surfaceId) => (
    isNonEmptyString(surfaceId)
        ? (SURFACE_BY_ID.get(surfaceId.trim()) || null)
        : null
);

export const requireWorkerRuntimeSurface = (surfaceId) => {
    const surface = getWorkerRuntimeSurface(surfaceId);
    if (!surface) {
        throw new Error(`WORKER_RUNTIME_SURFACE_UNKNOWN:${String(surfaceId || '')}`);
    }
    return surface;
};

export const listWorkerRuntimeSurfaces = ({
    context = null,
    lane = null,
    status = null,
    kind = null,
} = {}) => WORKER_RUNTIME_SURFACE_REGISTRY.filter((surface) => (
    (!context || surface.context === context)
    && (!lane || surface.lane === lane)
    && (!status || surface.status === status)
    && (!kind || surface.kind === kind)
));

export const resolveWorkerRuntimeSurfaceTaskType = (surfaceId, taskKey = 'default') => {
    const surface = requireWorkerRuntimeSurface(surfaceId);
    const normalizedTaskKey = isNonEmptyString(taskKey) ? taskKey.trim() : 'default';
    const taskType = surface.taskTypes?.[normalizedTaskKey];
    if (!isNonEmptyString(taskType)) {
        throw new Error(`WORKER_RUNTIME_SURFACE_TASK_UNKNOWN:${surface.id}:${normalizedTaskKey}`);
    }
    return taskType;
};

export const resolveWorkerRuntimeSurfaceDegradationMode = (surfaceId) => (
    requireWorkerRuntimeSurface(surfaceId).degradationMode
);

export const createWorkerRequestClientConfig = (surfaceId, overrides = {}) => {
    const surface = requireWorkerRuntimeSurface(surfaceId);
    const admissionRequired = (
        surface.status === WORKER_RUNTIME_SURFACE_STATUS.ACTIVE
        && surface.context === WORKER_RUNTIME_CONTEXT.UI
        && surface.kind === WORKER_RUNTIME_SURFACE_KIND.REQUEST
    );
    const canonicalSurfaceMeta = {
        surfaceId: surface.id,
        surfaceStatus: surface.status,
        surfaceKind: surface.kind,
        degradationMode: surface.degradationMode,
        activationFlagName: isNonEmptyString(surface.activationFlagName)
            ? surface.activationFlagName
            : null,
        admissionRequired,
        releaseAdmissionOnIdle: admissionRequired,
    };

    return {
        workerId: surface.workerId,
        context: surface.context,
        lane: surface.lane,
        priority: surface.priority,
        taskType: resolveWorkerRuntimeSurfaceTaskType(surface.id, 'default'),
        initTimeoutMs: surface.initTimeoutMs,
        requestTimeoutMs: surface.requestTimeoutMs,
        ...canonicalSurfaceMeta,
        ...overrides,
        ...canonicalSurfaceMeta,
    };
};

export const createWorkerRuntimeEventBase = (surfaceId, {
    taskKey = 'default',
    priority = null,
} = {}) => {
    const surface = requireWorkerRuntimeSurface(surfaceId);
    return {
        worker: surface.workerId,
        taskType: resolveWorkerRuntimeSurfaceTaskType(surface.id, taskKey),
        lane: surface.lane,
        priority: priority || surface.priority,
        context: surface.context,
    };
};
