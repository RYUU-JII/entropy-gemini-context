export const ZEN_SURFACE_DISTURBANCE_SOURCES = Object.freeze({
    TAP: 'tap',
    KOI_WAKE: 'koi_wake',
    PETAL: 'petal',
});

const SOURCE_PROFILES = Object.freeze({
    [ZEN_SURFACE_DISTURBANCE_SOURCES.TAP]: Object.freeze({
        baseAmplitude: 0.17,
        widthPx: 5.2,
        dampingPerSec: 0.16,
        secondaryOffsetPx: 0,
        secondaryAmplitudeRatio: 0,
        trailingWaveStrength: 1,
        dispersionStrength: 1.15,
        priority: 1.4,
    }),
    [ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE]: Object.freeze({
        baseAmplitude: 0.085,
        widthPx: 3.2,
        dampingPerSec: 0.24,
        secondaryOffsetPx: 0,
        secondaryAmplitudeRatio: 0,
        trailingWaveStrength: 0,
        dispersionStrength: 0.55,
        priority: 1,
    }),
    [ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL]: Object.freeze({
        baseAmplitude: 0.06,
        widthPx: 3.2,
        dampingPerSec: 0.32,
        secondaryOffsetPx: 0,
        secondaryAmplitudeRatio: 0,
        trailingWaveStrength: 0,
        dispersionStrength: 0.4,
        priority: 0.72,
    }),
});

export const ZEN_SURFACE_DISTURBANCE_TOGGLE_BY_SOURCE =
    Object.freeze({
        [ZEN_SURFACE_DISTURBANCE_SOURCES.TAP]:
            'tapDisturbanceEnabled',
        [ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE]:
            'koiWakeDisturbanceEnabled',
        [ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL]:
            'petalDisturbanceEnabled',
    });

export const ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT =
    'entropy.zen.surface-disturbance-source-telemetry';
export const ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION = 1;

const SURFACE_DISTURBANCE_INITIAL_RADIUS_PX = 2;
const SURFACE_DISTURBANCE_TERMINAL_RELEASE_START = 0.56;

const clampNumber = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_NUMBER_INVALID');
    }
    return Math.min(max, Math.max(min, numeric));
};

const smoothstep01 = (value) => {
    const progress = Math.min(1, Math.max(0, value));
    return progress * progress * (3 - 2 * progress);
};

export const readZenSurfaceDisturbanceSource = (source) => {
    if (Object.prototype.hasOwnProperty.call(SOURCE_PROFILES, source)) return source;
    throw new Error(`ZEN_SURFACE_DISTURBANCE_SOURCE_INVALID:${String(source || '')}`);
};

const createSourceTelemetryBucket = () => ({
    candidateCount: 0,
    admittedCount: 0,
    suppressedCount: 0,
});

export const createZenSurfaceDisturbanceTelemetryState = () => ({
    contract: ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT,
    version: ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION,
    sequence: 0,
    candidateCount: 0,
    admittedCount: 0,
    suppressedCount: 0,
    bySource: {
        [ZEN_SURFACE_DISTURBANCE_SOURCES.TAP]:
            createSourceTelemetryBucket(),
        [ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE]:
            createSourceTelemetryBucket(),
        [ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL]:
            createSourceTelemetryBucket(),
    },
});

const requireTelemetryState = (telemetryRef) => {
    const state = telemetryRef?.current;
    if (
        !state
        || state.contract
            !== ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT
        || state.version
            !== ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION
        || !state.bySource
    ) {
        throw new Error(
            'ZEN_SURFACE_DISTURBANCE_TELEMETRY_REF_MISSING',
        );
    }
    return state;
};

export const assertZenSurfaceDisturbanceRuntimeRefs = ({
    rendererDebugTogglesRef,
    surfaceDisturbanceTelemetryRef,
} = {}) => {
    if (
        !rendererDebugTogglesRef
        || !rendererDebugTogglesRef.current
        || typeof rendererDebugTogglesRef.current !== 'object'
        || Array.isArray(rendererDebugTogglesRef.current)
    ) {
        throw new Error(
            'ZEN_SURFACE_DISTURBANCE_DEBUG_TOGGLE_REF_MISSING',
        );
    }
    requireTelemetryState(surfaceDisturbanceTelemetryRef);
    return true;
};

export const resolveZenSurfaceDisturbanceSourceEnabled = (
    rendererDebugToggles,
    source,
) => {
    const normalizedSource =
        readZenSurfaceDisturbanceSource(source);
    if (
        !rendererDebugToggles
        || typeof rendererDebugToggles !== 'object'
        || Array.isArray(rendererDebugToggles)
    ) {
        throw new Error(
            'ZEN_SURFACE_DISTURBANCE_DEBUG_TOGGLES_MISSING',
        );
    }
    const toggleKey =
        ZEN_SURFACE_DISTURBANCE_TOGGLE_BY_SOURCE[
            normalizedSource
        ];
    const enabled = rendererDebugToggles[toggleKey];
    if (enabled !== true && enabled !== false) {
        throw new Error(
            'ZEN_SURFACE_DISTURBANCE_DEBUG_TOGGLE_MISSING:'
            + toggleKey,
        );
    }
    return enabled;
};

const recordSourceTelemetry = (
    telemetryRef,
    source,
    outcome,
) => {
    const state = requireTelemetryState(telemetryRef);
    const bucket = state.bySource[source];
    if (!bucket) {
        throw new Error(
            `ZEN_SURFACE_DISTURBANCE_TELEMETRY_SOURCE_MISSING:${source}`,
        );
    }
    const countKey = `${outcome}Count`;
    if (!Object.prototype.hasOwnProperty.call(bucket, countKey)) {
        throw new Error(
            `ZEN_SURFACE_DISTURBANCE_TELEMETRY_OUTCOME_INVALID:${outcome}`,
        );
    }
    state.sequence += 1;
    state[countKey] += 1;
    bucket[countKey] += 1;
};

const countActiveDisturbancesBySource = (
    disturbances = [],
) => {
    const counts = {
        [ZEN_SURFACE_DISTURBANCE_SOURCES.TAP]: 0,
        [ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE]: 0,
        [ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL]: 0,
    };
    const source = Array.isArray(disturbances)
        ? disturbances
        : [];
    for (let index = 0; index < source.length; index += 1) {
        const disturbanceSource =
            readZenSurfaceDisturbanceSource(
                source[index]?.source,
            );
        counts[disturbanceSource] += 1;
    }
    return counts;
};

export const snapshotZenSurfaceDisturbanceTelemetry = ({
    telemetryRef,
    disturbances = [],
    rendererDebugToggles,
} = {}) => {
    const state = requireTelemetryState(telemetryRef);
    const activeCounts =
        countActiveDisturbancesBySource(disturbances);
    const requested = {};
    const bySource = {};
    Object.values(ZEN_SURFACE_DISTURBANCE_SOURCES).forEach(
        (source) => {
            const bucket = state.bySource[source];
            requested[source] =
                resolveZenSurfaceDisturbanceSourceEnabled(
                    rendererDebugToggles,
                    source,
                );
            bySource[source] = Object.freeze({
                candidateCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.candidateCount) || 0,
                    ),
                ),
                admittedCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.admittedCount) || 0,
                    ),
                ),
                suppressedCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.suppressedCount) || 0,
                    ),
                ),
                activeCount: activeCounts[source],
            });
        },
    );
    return Object.freeze({
        contract: ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT,
        version:
            ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION,
        sequence: Math.max(
            0,
            Math.floor(Number(state.sequence) || 0),
        ),
        candidateCount: Math.max(
            0,
            Math.floor(Number(state.candidateCount) || 0),
        ),
        admittedCount: Math.max(
            0,
            Math.floor(Number(state.admittedCount) || 0),
        ),
        suppressedCount: Math.max(
            0,
            Math.floor(Number(state.suppressedCount) || 0),
        ),
        activeCount: Object.values(activeCounts).reduce(
            (sum, value) => sum + value,
            0,
        ),
        requested: Object.freeze(requested),
        bySource: Object.freeze(bySource),
    });
};

const resolvePropagationProfile = (source, impulse) => {
    if (source === ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE) {
        return {
            maxRadiusPx: 26 + impulse * 30,
            propagationSpeedPxSec: (0.48 + impulse * 0.34) * 60,
        };
    }
    if (source === ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL) {
        return {
            maxRadiusPx: 16 + impulse * 14,
            propagationSpeedPxSec: (0.44 + impulse * 0.24) * 60,
        };
    }
    return {
        maxRadiusPx: 38 + impulse * 32,
        propagationSpeedPxSec: (0.52 + impulse * 0.28) * 60,
    };
};

export const createZenSurfaceDisturbance = ({
    x,
    y,
    impulse = 1,
    source = ZEN_SURFACE_DISTURBANCE_SOURCES.TAP,
    selectionCue = false,
} = {}) => {
    const normalizedSource =
        readZenSurfaceDisturbanceSource(source);
    if (typeof selectionCue !== 'boolean' || (selectionCue && normalizedSource !== ZEN_SURFACE_DISTURBANCE_SOURCES.TAP)) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_SELECTION_CUE_INVALID');
    }
    const koiWake = normalizedSource === ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE;
    const normalizedImpulse = clampNumber(impulse, koiWake ? 0 : 0.2, 3);
    const profile = SOURCE_PROFILES[normalizedSource];
    const propagation = selectionCue
        ? { maxRadiusPx: 54, propagationSpeedPxSec: (54 - SURFACE_DISTURBANCE_INITIAL_RADIUS_PX) / 1.05 }
        : resolvePropagationProfile(normalizedSource, normalizedImpulse);
    // Submerged wake coupling must reach zero; the tap/petal minimum stays intact.
    const amplitudeGain = Math.min(1.45, Math.max(koiWake ? 0 : 0.65, Math.sqrt(normalizedImpulse / 1.2)));
    const initialAmplitude = profile.baseAmplitude * amplitudeGain * (selectionCue ? 0.42 : 1);

    return {
        x: clampNumber(x, -1e6, 1e6),
        y: clampNumber(y, -1e6, 1e6),
        source: normalizedSource,
        selectionCue,
        impulse: normalizedImpulse,
        ageSec: 0,
        radiusPx: SURFACE_DISTURBANCE_INITIAL_RADIUS_PX,
        maxRadiusPx: propagation.maxRadiusPx,
        propagationSpeedPxSec: propagation.propagationSpeedPxSec,
        initialWidthPx: profile.widthPx,
        widthPx: profile.widthPx,
        dispersionStrength: profile.dispersionStrength,
        dampingPerSec: profile.dampingPerSec,
        initialAmplitude,
        amplitude: initialAmplitude,
        life: 1,
        secondaryOffsetPx: profile.secondaryOffsetPx,
        secondaryAmplitudeRatio: profile.secondaryAmplitudeRatio,
        trailingWaveStrength: selectionCue ? 0 : profile.trailingWaveStrength,
        priority: profile.priority,
    };
};

export const stepZenSurfaceDisturbance = (disturbance, dtSec) => {
    if (!disturbance || typeof disturbance !== 'object') {
        throw new Error('ZEN_SURFACE_DISTURBANCE_STATE_MISSING');
    }
    if (disturbance.settled === true) return false;
    const safeStepSec = clampNumber(dtSec, 0, 0.25);
    disturbance.ageSec += safeStepSec;
    disturbance.radiusPx += disturbance.propagationSpeedPxSec * safeStepSec;
    const progress = Math.min(1, disturbance.radiusPx / disturbance.maxRadiusPx);
    const dispersionProgress = smoothstep01(progress);
    disturbance.widthPx = disturbance.initialWidthPx * (
        1 + disturbance.dispersionStrength * dispersionProgress
    );
    const travelDistancePx = Math.max(
        0,
        disturbance.radiusPx - SURFACE_DISTURBANCE_INITIAL_RADIUS_PX,
    );
    const spreadingLengthPx = Math.max(
        disturbance.initialWidthPx * 1.75,
        disturbance.maxRadiusPx * 0.12,
    );
    // A circular wave loses amplitude as its energy spreads over a longer
    // circumference. A terminal smoothstep then lets that already-weakened
    // packet converge to zero before it leaves the simulation.
    const geometricAttenuation = Math.sqrt(
        spreadingLengthPx
        / (spreadingLengthPx + travelDistancePx),
    );
    const terminalRelease = smoothstep01(
        (progress - SURFACE_DISTURBANCE_TERMINAL_RELEASE_START)
        / (1 - SURFACE_DISTURBANCE_TERMINAL_RELEASE_START),
    );
    const temporalAttenuation = Math.exp(-disturbance.dampingPerSec * disturbance.ageSec);
    disturbance.life =
        geometricAttenuation
        * temporalAttenuation
        * (1 - terminalRelease);
    disturbance.amplitude = disturbance.initialAmplitude * disturbance.life;
    if (
        disturbance.radiusPx >= disturbance.maxRadiusPx
        || disturbance.amplitude <= 0.00002
    ) {
        disturbance.radiusPx = Math.min(
            disturbance.radiusPx,
            disturbance.maxRadiusPx,
        );
        disturbance.life = 0;
        disturbance.amplitude = 0;
        // Preserve one fully-settled sample before compaction so every
        // consumer observes the packet at zero energy before it is removed.
        disturbance.settled = true;
    }
    return true;
};

export const pushZenSurfaceDisturbance = (
    surfaceDisturbancesRef,
    input,
    {
        rendererDebugToggles,
        surfaceDisturbanceTelemetryRef,
    } = {},
) => {
    if (!surfaceDisturbancesRef || !Array.isArray(surfaceDisturbancesRef.current)) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_REF_MISSING');
    }
    const source = readZenSurfaceDisturbanceSource(
        input?.source,
    );
    recordSourceTelemetry(
        surfaceDisturbanceTelemetryRef,
        source,
        'candidate',
    );
    if (
        resolveZenSurfaceDisturbanceSourceEnabled(
            rendererDebugToggles,
            source,
        ) !== true
    ) {
        recordSourceTelemetry(
            surfaceDisturbanceTelemetryRef,
            source,
            'suppressed',
        );
        return null;
    }
    const disturbance = createZenSurfaceDisturbance(input);
    surfaceDisturbancesRef.current.push(disturbance);
    recordSourceTelemetry(
        surfaceDisturbanceTelemetryRef,
        source,
        'admitted',
    );
    return disturbance;
};

export const resolveZenSurfaceDisturbancePriority = (disturbance) => {
    const amplitude = Number(disturbance?.amplitude);
    const priority = Number(disturbance?.priority);
    if (!Number.isFinite(amplitude) || !Number.isFinite(priority)) return -1;
    return amplitude * priority;
};
