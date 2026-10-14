export const ENTROPY_RELEASE_PROFILE = Object.freeze({
    PUBLIC: 'public',
    DEV: 'dev',
});

const normalizeReleaseProfile = (
    value,
    fallback = ENTROPY_RELEASE_PROFILE.DEV,
) => {
    const normalized = typeof value === 'string'
        ? value.trim().toLowerCase()
        : '';
    if (normalized === ENTROPY_RELEASE_PROFILE.PUBLIC) {
        return ENTROPY_RELEASE_PROFILE.PUBLIC;
    }
    if (normalized === ENTROPY_RELEASE_PROFILE.DEV) {
        return ENTROPY_RELEASE_PROFILE.DEV;
    }
    return fallback;
};

const resolveCompileTimeBoolean = (value, fallback = true) => (
    value === true || value === false
        ? value
        : fallback
);

export const BUILD_RELEASE_PROFILE = normalizeReleaseProfile(
    typeof __ENTROPY_RELEASE_PROFILE__ !== 'undefined'
        ? __ENTROPY_RELEASE_PROFILE__
        : null,
    ENTROPY_RELEASE_PROFILE.DEV,
);

export const BUILD_INCLUDE_EXPERIMENT_TAB = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_EXPERIMENT_TAB__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_EXPERIMENT_TAB__
        : undefined,
    true,
);

export const BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS__
        : undefined,
    true,
);

export const BUILD_INCLUDE_ZEN_VNEXT = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_ZEN_VNEXT__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_ZEN_VNEXT__
        : undefined,
    true,
);

export const BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS__
        : undefined,
    true,
);

export const BUILD_INCLUDE_CLSE_LABS = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_CLSE_LABS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_CLSE_LABS__
        : undefined,
    BUILD_RELEASE_PROFILE === ENTROPY_RELEASE_PROFILE.DEV,
);

export const BUILD_INCLUDE_DEBUG_TOOLS = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : undefined,
    BUILD_RELEASE_PROFILE === ENTROPY_RELEASE_PROFILE.DEV,
);

export const BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION__ !== 'undefined'
        ? __ENTROPY_BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION__
        : undefined,
    false,
);

export const BUILD_ENABLE_CONTENT_FLOW_SIGNALS = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_ENABLE_CONTENT_FLOW_SIGNALS__ !== 'undefined'
        ? __ENTROPY_BUILD_ENABLE_CONTENT_FLOW_SIGNALS__
        : undefined,
    true,
);

export const BUILD_ENABLE_CONTENT_CLSE_REPORTER = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_REPORTER__ !== 'undefined'
        ? __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_REPORTER__
        : undefined,
    BUILD_INCLUDE_CLSE_LABS,
);

export const BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY__ !== 'undefined'
        ? __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY__
        : undefined,
    BUILD_INCLUDE_CLSE_LABS,
);

// The skip guard is an unconditional hard block. The cooldown ledger that predates it
// stays wired but dormant: with this off, no pool repository, storage listener, or
// background merge route is constructed at all.
export const BUILD_ENABLE_VIDEO_SKIP_COOLDOWN = resolveCompileTimeBoolean(
    typeof __ENTROPY_BUILD_ENABLE_VIDEO_SKIP_COOLDOWN__ !== 'undefined'
        ? __ENTROPY_BUILD_ENABLE_VIDEO_SKIP_COOLDOWN__
        : undefined,
    false,
);

export const BUILD_RELEASE_CAPABILITIES = Object.freeze({
    profile: BUILD_RELEASE_PROFILE,
    includeExperimentTab: BUILD_INCLUDE_EXPERIMENT_TAB,
    includeZenClassicExperiments: BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS,
    includeZenVNext: BUILD_INCLUDE_ZEN_VNEXT,
    includeZenExperimentalWorkers: BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS,
    includeClseLabs: BUILD_INCLUDE_CLSE_LABS,
    includeDebugTools: BUILD_INCLUDE_DEBUG_TOOLS,
    enableSharedInterventionAdmission: BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION,
    enableContentFlowSignals: BUILD_ENABLE_CONTENT_FLOW_SIGNALS,
    enableContentClseReporter: BUILD_ENABLE_CONTENT_CLSE_REPORTER,
    enableContentClseAlertOverlay: BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY,
    enableVideoSkipCooldown: BUILD_ENABLE_VIDEO_SKIP_COOLDOWN,
});
