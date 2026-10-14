export const ZEN_HOME_FIRST_VISUAL_PARTS = Object.freeze({
    POND: 'pond',
    BONSAI: 'bonsai',
    FIRST_VIEWPORT: 'first_viewport',
});

export const ZEN_HOME_FIRST_VISUAL_PHASES = Object.freeze({
    IDLE: 'idle',
    WAITING_VISUAL_PARTS: 'waiting_visual_parts',
    POND_STARTING: 'pond_starting',
    BONSAI_STARTING: 'bonsai_starting',
    PARTIAL_READY: 'partial_ready',
    COMPOSITE_COMMITTED: 'composite_committed',
    FAILED: 'failed',
});

export const ZEN_HOME_FIRST_VISUAL_SOURCES = Object.freeze({
    HOME_READY: 'home_ready',
    HOME_READINESS_FAILED: 'home_readiness_failed',
    COMPOSITE_FIRST_FRAME: 'zen_home_composite_first_frame',
    FIRST_VISUAL_FAILED: 'zen_home_first_visual_failed',
});

const ZEN_HOME_FIRST_VISUAL_POND_READINESS_PREFIX = 'pond:readiness';

export const ZEN_HOME_FIRST_VISUAL_MILESTONES = Object.freeze({
    POND_FIRST_FRAME_CALLBACK: 'pond:first_frame_callback',
    POND_FIRST_FRAME_COMMITTED: 'pond:first_frame_committed',
    POND_READINESS_PREFIX: ZEN_HOME_FIRST_VISUAL_POND_READINESS_PREFIX,
    POND_READINESS_FAILED: `${ZEN_HOME_FIRST_VISUAL_POND_READINESS_PREFIX}:failed`,
    BONSAI_RUNTIME_INPUTS_READY: 'bonsai:runtime_inputs_ready',
    BONSAI_RUNTIME_INPUTS_WAIT: 'bonsai:runtime_inputs_wait',
    BONSAI_LINEAGE_WAIT: 'bonsai:lineage_wait',
    BONSAI_LINEAGE_READY: 'bonsai:lineage_ready',
    BONSAI_LINEAGE_FAILED: 'bonsai:lineage_failed',
    BONSAI_FIRST_FRAME_READY: 'bonsai:first_frame_ready',
    BONSAI_WORKER_READY: 'bonsai:worker_ready',
    BONSAI_WAITING_CANVAS: 'bonsai:waiting_canvas',
    BONSAI_MOUNT_RENDERER: 'bonsai:mount_renderer',
    BONSAI_MOUNT_RENDERER_READY: 'bonsai:mount_renderer_ready',
    BONSAI_UPDATE_SCENE_HELD: 'bonsai:update_scene_held',
    BONSAI_UPDATE_SCENE_SENT: 'bonsai:update_scene_sent',
    BONSAI_UPDATE_SCENE_SKIPPED: 'bonsai:update_scene_skipped',
    BONSAI_FAILED_MOUNT_OR_UPDATE: 'bonsai:failed_mount_or_update',
    FIRST_VIEWPORT_READY: 'first_viewport:ready',
});

const ZEN_HOME_FIRST_VISUAL_PHASE_RANK = Object.freeze({
    [ZEN_HOME_FIRST_VISUAL_PHASES.IDLE]: 0,
    [ZEN_HOME_FIRST_VISUAL_PHASES.WAITING_VISUAL_PARTS]: 1,
    [ZEN_HOME_FIRST_VISUAL_PHASES.POND_STARTING]: 2,
    [ZEN_HOME_FIRST_VISUAL_PHASES.BONSAI_STARTING]: 2,
    [ZEN_HOME_FIRST_VISUAL_PHASES.PARTIAL_READY]: 3,
    [ZEN_HOME_FIRST_VISUAL_PHASES.COMPOSITE_COMMITTED]: 4,
    [ZEN_HOME_FIRST_VISUAL_PHASES.FAILED]: 5,
});

const ZEN_HOME_FIRST_VISUAL_PHASE_VALUES = new Set(Object.values(ZEN_HOME_FIRST_VISUAL_PHASES));

export const isZenHomeFirstVisualPhase = (value) => (
    ZEN_HOME_FIRST_VISUAL_PHASE_VALUES.has(value)
);

export const createZenHomeFirstVisualPondReadinessMilestone = (phase) => {
    const normalizedPhase = typeof phase === 'string' && phase.trim()
        ? phase.trim()
        : 'unknown';
    return `${ZEN_HOME_FIRST_VISUAL_MILESTONES.POND_READINESS_PREFIX}:${normalizedPhase}`;
};

const assertZenHomeFirstVisualMilestone = (milestone) => {
    if (typeof milestone !== 'string' || !milestone.trim()) {
        throw new Error('ZEN_HOME_FIRST_VISUAL_MILESTONE_REQUIRED');
    }
    return milestone.trim();
};

const assertZenHomeFirstVisualSource = (source) => {
    if (!Object.values(ZEN_HOME_FIRST_VISUAL_PARTS).includes(source)) {
        throw new Error('ZEN_HOME_FIRST_VISUAL_SOURCE_INVALID');
    }
    return source;
};

export const createZenHomeFirstVisualMilestoneEvent = ({
    milestone,
    source,
    details = null,
} = {}) => {
    const normalizedMilestone = assertZenHomeFirstVisualMilestone(milestone);
    const normalizedSource = assertZenHomeFirstVisualSource(source);
    return Object.freeze({
        milestone: normalizedMilestone,
        source: normalizedSource,
        ...(details && typeof details === 'object' ? details : {}),
    });
};

export const createZenHomeFirstVisualPondMilestoneEvent = (milestone, details = null) => (
    createZenHomeFirstVisualMilestoneEvent({
        milestone,
        source: ZEN_HOME_FIRST_VISUAL_PARTS.POND,
        details,
    })
);

export const createZenHomeFirstVisualBonsaiMilestoneEvent = (milestone, details = null) => (
    createZenHomeFirstVisualMilestoneEvent({
        milestone,
        source: ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI,
        details,
    })
);

export const normalizeZenHomeFirstVisualMilestone = (value) => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
        const milestone = typeof value.milestone === 'string'
            ? value.milestone
            : (typeof value.event === 'string' ? value.event : '');
        return milestone.trim();
    }
    return '';
};

const ZEN_HOME_FIRST_VISUAL_TERMINAL_FAILURE_MILESTONES = new Set([
    ZEN_HOME_FIRST_VISUAL_MILESTONES.POND_READINESS_FAILED,
    ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_LINEAGE_FAILED,
    ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_FAILED_MOUNT_OR_UPDATE,
]);

export const isZenHomeFirstVisualTerminalFailureMilestone = (value) => {
    const milestone = normalizeZenHomeFirstVisualMilestone(value);
    return ZEN_HOME_FIRST_VISUAL_TERMINAL_FAILURE_MILESTONES.has(milestone);
};

export const isZenHomeFirstVisualFatalMilestone = (value) => (
    isZenHomeFirstVisualTerminalFailureMilestone(value)
);

export const resolveZenHomeFirstVisualPhaseForMilestone = (value, currentPhase) => {
    const milestone = normalizeZenHomeFirstVisualMilestone(value);
    if (!milestone) return currentPhase;
    if (isZenHomeFirstVisualTerminalFailureMilestone(milestone)) {
        return ZEN_HOME_FIRST_VISUAL_PHASES.FAILED;
    }
    if (milestone.startsWith(`${ZEN_HOME_FIRST_VISUAL_PARTS.POND}:`)) {
        if (milestone.includes('first_frame')) {
            return ZEN_HOME_FIRST_VISUAL_PHASES.PARTIAL_READY;
        }
        return ZEN_HOME_FIRST_VISUAL_PHASES.POND_STARTING;
    }
    if (milestone.startsWith(`${ZEN_HOME_FIRST_VISUAL_PARTS.BONSAI}:`)) {
        if (milestone.includes('first_frame_ready')) {
            return ZEN_HOME_FIRST_VISUAL_PHASES.PARTIAL_READY;
        }
        return ZEN_HOME_FIRST_VISUAL_PHASES.BONSAI_STARTING;
    }
    if (milestone.startsWith(`${ZEN_HOME_FIRST_VISUAL_PARTS.FIRST_VIEWPORT}:`)) {
        return ZEN_HOME_FIRST_VISUAL_PHASES.PARTIAL_READY;
    }
    return currentPhase;
};

export const shouldAcceptZenHomeFirstVisualPhaseTransition = (previousPhase, nextPhase) => {
    if (previousPhase === nextPhase) return false;
    if (nextPhase === ZEN_HOME_FIRST_VISUAL_PHASES.FAILED) return true;
    if (previousPhase === ZEN_HOME_FIRST_VISUAL_PHASES.FAILED) return false;
    const previousRank = ZEN_HOME_FIRST_VISUAL_PHASE_RANK[previousPhase] ?? 0;
    const nextRank = ZEN_HOME_FIRST_VISUAL_PHASE_RANK[nextPhase] ?? 0;
    return nextRank > previousRank;
};
