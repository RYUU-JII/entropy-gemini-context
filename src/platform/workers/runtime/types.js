export const WORKER_RUNTIME_CONTEXT = Object.freeze({
    UI: 'ui',
    BACKGROUND: 'background',
    CONTENT: 'content',
});

export const WORKER_RUNTIME_LANE = Object.freeze({
    SECURE: 'secure',
    COMPUTE: 'compute',
    RENDER: 'render',
    CEREMONY: 'ceremony',
});

export const WORKER_RUNTIME_PRIORITY = Object.freeze({
    INTERACTIVE: 'interactive',
    USER_VISIBLE: 'user_visible',
    BACKGROUND: 'background',
});

export const WORKER_RUNTIME_PRIORITY_ORDER = Object.freeze([
    WORKER_RUNTIME_PRIORITY.INTERACTIVE,
    WORKER_RUNTIME_PRIORITY.USER_VISIBLE,
    WORKER_RUNTIME_PRIORITY.BACKGROUND,
]);

export const WORKER_RUNTIME_TASK_TYPE = Object.freeze({
    CRYPTO_INIT: 'crypto_init',
    CRYPTO_ENCRYPT_BATCH: 'crypto_encrypt_batch',
    CRYPTO_DECRYPT_BATCH: 'crypto_decrypt_batch',
    DASHBOARD_BOOT_RENDER_INIT: 'dashboard_boot_render_init',
    DASHBOARD_BOOT_RENDER_CONTROL: 'dashboard_boot_render_control',
    DASHBOARD_BOOT_RENDER_TELEMETRY: 'dashboard_boot_render_telemetry',
    CEREMONY_RENDER_INIT: 'ceremony_render_init',
    CEREMONY_RENDER_CONTROL: 'ceremony_render_control',
    CEREMONY_RENDER_TELEMETRY: 'ceremony_render_telemetry',
    ZEN_HOME_RENDER_INIT: 'zen_home_render_init',
    ZEN_HOME_RENDER_CONTROL: 'zen_home_render_control',
    ZEN_HOME_RENDER_TELEMETRY: 'zen_home_render_telemetry',
    ZEN_POND_RENDER_INIT: 'zen_pond_render_init',
    ZEN_POND_RENDER_CONTROL: 'zen_pond_render_control',
    ZEN_POND_RENDER_TELEMETRY: 'zen_pond_render_telemetry',
    ZEN_BONSAI_RENDER_INIT: 'zen_bonsai_render_init',
    ZEN_BONSAI_RENDER_CONTROL: 'zen_bonsai_render_control',
    ZEN_BONSAI_RENDER_TELEMETRY: 'zen_bonsai_render_telemetry',
    NUDGE_CONTENT_RENDER_INIT: 'nudge_content_render_init',
    NUDGE_CONTENT_RENDER_CONTROL: 'nudge_content_render_control',
    NUDGE_CONTENT_RENDER_TELEMETRY: 'nudge_content_render_telemetry',
    ZEN_AB_TRIAL_EVAL: 'zen_ab_trial_eval',
    ZEN_BONSAI_MODEL: 'zen_bonsai_model',
    ZEN_COLD_START_POOL: 'zen_cold_start_pool',
    ZEN_OPTIMIZE: 'zen_optimize',
    ZEN_OPTIMIZE_VNEXT: 'zen_optimize_vnext',
    ZEN_TRAIN_VNEXT_PREFERENCE: 'zen_train_vnext_preference',
});

export const resolveWorkerRuntimeContext = (value = null) => (
    value === WORKER_RUNTIME_CONTEXT.BACKGROUND
        ? WORKER_RUNTIME_CONTEXT.BACKGROUND
        : (value === WORKER_RUNTIME_CONTEXT.CONTENT
            ? WORKER_RUNTIME_CONTEXT.CONTENT
            : WORKER_RUNTIME_CONTEXT.UI)
);

export const resolveWorkerRuntimeLane = (value = null) => (
    value === WORKER_RUNTIME_LANE.SECURE
        ? WORKER_RUNTIME_LANE.SECURE
        : (value === WORKER_RUNTIME_LANE.RENDER
            ? WORKER_RUNTIME_LANE.RENDER
            : (value === WORKER_RUNTIME_LANE.CEREMONY
                ? WORKER_RUNTIME_LANE.CEREMONY
                : WORKER_RUNTIME_LANE.COMPUTE))
);

export const resolveWorkerRuntimePriority = (value = null) => {
    if (value === WORKER_RUNTIME_PRIORITY.INTERACTIVE) {
        return WORKER_RUNTIME_PRIORITY.INTERACTIVE;
    }
    if (value === WORKER_RUNTIME_PRIORITY.USER_VISIBLE) {
        return WORKER_RUNTIME_PRIORITY.USER_VISIBLE;
    }
    return WORKER_RUNTIME_PRIORITY.BACKGROUND;
};
