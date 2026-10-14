export const ZEN_POND_ROSTER_AUTHORITY_STATES = Object.freeze({
    BOOT_VISUAL_MEMORY_ELIGIBLE: 'boot_visual_memory_eligible',
    EMPTY_ALLOWED: 'empty_allowed',
    FIRST_VISION_PRESENTATION: 'first_vision_presentation',
    STATS_SNAPSHOT_CURRENT: 'stats_snapshot_current',
    WAITING_STATS_SNAPSHOT: 'waiting_stats_snapshot',
});

export const ZEN_POND_ROSTER_AUTHORITY_SOURCES = Object.freeze({
    BOOT_VISUAL_MEMORY: 'boot_visual_memory',
    EMPTY: 'empty',
    EXPERIMENT_SYNTHETIC: 'experiment_synthetic',
    FIRST_VISION: 'first_vision',
    STATS_SNAPSHOT: 'stats_snapshot',
    WAITING: 'waiting',
});

export function resolveZenPondRosterAuthority({
    mainWidgetThemeId = '',
    pondFirstVisionPresentation = false,
    registeredSiteDomainCount = 0,
    statusSnapshotPolicyCurrent = false,
    statusSnapshotReady = false,
} = {}) {
    const isZenMainSurface = mainWidgetThemeId === 'zen';
    const hasRegisteredSites = Number(registeredSiteDomainCount) > 0;
    const snapshotCurrent = statusSnapshotReady === true && statusSnapshotPolicyCurrent === true;
    const requireRosterForRuntimeMount = (
        isZenMainSurface
        && pondFirstVisionPresentation !== true
        && hasRegisteredSites
    );

    if (pondFirstVisionPresentation === true) {
        return Object.freeze({
            state: ZEN_POND_ROSTER_AUTHORITY_STATES.FIRST_VISION_PRESENTATION,
            source: ZEN_POND_ROSTER_AUTHORITY_SOURCES.FIRST_VISION,
            runtimeMountReady: true,
            requireRosterForRuntimeMount: false,
        });
    }
    if (!hasRegisteredSites) {
        return Object.freeze({
            state: ZEN_POND_ROSTER_AUTHORITY_STATES.EMPTY_ALLOWED,
            source: ZEN_POND_ROSTER_AUTHORITY_SOURCES.EMPTY,
            runtimeMountReady: true,
            requireRosterForRuntimeMount,
        });
    }
    if (snapshotCurrent) {
        return Object.freeze({
            state: ZEN_POND_ROSTER_AUTHORITY_STATES.STATS_SNAPSHOT_CURRENT,
            source: ZEN_POND_ROSTER_AUTHORITY_SOURCES.STATS_SNAPSHOT,
            runtimeMountReady: true,
            requireRosterForRuntimeMount,
        });
    }
    if (isZenMainSurface) {
        return Object.freeze({
            state: ZEN_POND_ROSTER_AUTHORITY_STATES.BOOT_VISUAL_MEMORY_ELIGIBLE,
            source: ZEN_POND_ROSTER_AUTHORITY_SOURCES.BOOT_VISUAL_MEMORY,
            runtimeMountReady: true,
            requireRosterForRuntimeMount,
        });
    }
    return Object.freeze({
        state: ZEN_POND_ROSTER_AUTHORITY_STATES.WAITING_STATS_SNAPSHOT,
        source: ZEN_POND_ROSTER_AUTHORITY_SOURCES.WAITING,
        runtimeMountReady: false,
        requireRosterForRuntimeMount,
    });
}
