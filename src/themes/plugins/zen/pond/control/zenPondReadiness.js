export const ZEN_POND_READINESS_PHASE = Object.freeze({
    IDLE: 'idle',
    MOUNT_WAIT: 'mount_wait',
    ATTACHED: 'attached',
    STARTING: 'starting',
    WORKER_READY: 'worker_ready',
    FIRST_FRAME_COMMITTED: 'first_frame_committed',
    DEGRADED: 'degraded',
    FAILED: 'failed',
    DISPOSED: 'disposed',
});

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const normalizePhase = (phase) => {
    const key = typeof phase === 'string' ? phase.trim() : '';
    const allowed = Object.values(ZEN_POND_READINESS_PHASE);
    if (allowed.includes(key)) return key;
    throw new Error(`ZEN_POND_READINESS_PHASE_INVALID:${key || 'empty'}`);
};

export const createZenPondReadinessSnapshot = ({
    phase = ZEN_POND_READINESS_PHASE.IDLE,
    reason = '',
    mountId = null,
    firstFrameCommitted = false,
    degraded = false,
    error = null,
    metadata = null,
    atMs = null,
} = {}) => {
    const normalizedPhase = normalizePhase(phase);
    const hasFirstFrame = (
        firstFrameCommitted === true
        || normalizedPhase === ZEN_POND_READINESS_PHASE.FIRST_FRAME_COMMITTED
    );
    const failed = normalizedPhase === ZEN_POND_READINESS_PHASE.FAILED;
    const degradedState = degraded === true || normalizedPhase === ZEN_POND_READINESS_PHASE.DEGRADED;
    const numericAt = Number(atMs);
    return Object.freeze({
        phase: normalizedPhase,
        reason: typeof reason === 'string' && reason.trim()
            ? reason.trim()
            : normalizedPhase,
        mountId: typeof mountId === 'string' && mountId.trim() ? mountId.trim() : null,
        firstFrameCommitted: hasFirstFrame,
        degraded: degradedState,
        failed,
        error: typeof error === 'string' && error.trim() ? error.trim() : null,
        metadata: isObject(metadata) ? metadata : null,
        atMs: Number.isFinite(numericAt) ? Math.max(0, numericAt) : nowMs(),
    });
};

export const createInitialZenPondReadinessSnapshot = (reason = 'surface_idle') => (
    createZenPondReadinessSnapshot({
        phase: ZEN_POND_READINESS_PHASE.IDLE,
        reason,
    })
);

export const isZenPondFirstFrameCommitted = (snapshot = null) => (
    snapshot?.firstFrameCommitted === true
    || snapshot?.phase === ZEN_POND_READINESS_PHASE.FIRST_FRAME_COMMITTED
);
