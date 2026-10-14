import {
    normalizeZenBonsaiLifeState,
} from './ZenBonsaiLifeState.js';
import {
    SAKURA_BRANCH_ORDER,
} from './bonsai/generation/shapePriorModel.js';

export const ZEN_BONSAI_GROWTH_PHASES = Object.freeze({
    SEED: 'seed',
    SPROUT: 'sprout',
    SEEDLING: 'seedling',
    JUVENILE: 'juvenile',
    MATURE: 'mature',
    DISPLAY: 'display',
});

export const ZEN_BONSAI_GROWTH_EVENT_KINDS = Object.freeze({
    NONE: 'none',
    MILESTONE_SHOOT: 'milestone_shoot',
    RECOVERY_SHOOT: 'recovery_shoot',
});

export const ZEN_BONSAI_SURFACE_FEEDBACK_KINDS = Object.freeze({
    NONE: 'none',
    DEW_GLINT: 'dew_glint',
    LEAF_FALL: 'leaf_fall',
});

export const ZEN_BONSAI_MOSS_STATES = Object.freeze({
    SATURATED: 'saturated',
    NORMAL: 'normal',
    PALE: 'pale',
    DRY: 'dry',
});

export const ZEN_BONSAI_GROWTH_BASELINE_DAYS = 7;

const DEFAULT_STRUCTURE_DEPTH = 6;
const MIN_STRUCTURE_DEPTH = 1;
const MAX_STRUCTURE_DEPTH = 9;
const DEFAULT_BRANCH_DEPTH_LIMIT = 6;

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return min;
    }
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const smoothstepRange = (value, min, max) => {
    const span = Number(max) - Number(min);
    if (!Number.isFinite(span) || span <= 0) {
        return value >= max ? 1 : 0;
    }
    return smoothstep01((value - min) / span);
};
const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(numeric.toFixed(digits));
};

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const clampStructureDepth = (value = DEFAULT_STRUCTURE_DEPTH) => (
    Math.max(
        MIN_STRUCTURE_DEPTH,
        Math.min(MAX_STRUCTURE_DEPTH, Math.round(Number(value) || DEFAULT_STRUCTURE_DEPTH)),
    )
);

const resolveProjectionPhase = (maturity) => {
    if (maturity.phase === 'mature') {
        if (
            maturity.growth >= 0.96
            && maturity.analysisConfidence >= 0.9
        ) {
            return ZEN_BONSAI_GROWTH_PHASES.DISPLAY;
        }
        return ZEN_BONSAI_GROWTH_PHASES.MATURE;
    }
    if (maturity.phase === 'juvenile') {
        return ZEN_BONSAI_GROWTH_PHASES.JUVENILE;
    }
    if (
        maturity.dataDays <= 0
        && maturity.analysisConfidence <= 0.02
        && maturity.growth < 0.3
    ) {
        return ZEN_BONSAI_GROWTH_PHASES.SPROUT;
    }
    return ZEN_BONSAI_GROWTH_PHASES.SEEDLING;
};

const resolveProjectionProgress = (maturity, phase) => {
    const baselineProgress = clamp01(maturity.dataDays / ZEN_BONSAI_GROWTH_BASELINE_DAYS);
    const confidence = clamp01(maturity.analysisConfidence);
    const growth = clamp01(maturity.growth);
    switch (phase) {
        case ZEN_BONSAI_GROWTH_PHASES.SPROUT:
            return round(clamp(0.22 + (growth * 0.18), 0.22, 0.34));
        case ZEN_BONSAI_GROWTH_PHASES.SEEDLING: {
            const seedlingGrowthProgress = smoothstepRange(growth, 0.3, 0.42);
            return round(clamp(
                0.31
                + (seedlingGrowthProgress * 0.22)
                + (smoothstep01(baselineProgress) * 0.03)
                + (confidence * 0.02),
                0.3,
                0.58,
            ));
        }
        case ZEN_BONSAI_GROWTH_PHASES.JUVENILE: {
            const juvenileGrowthProgress = smoothstepRange(growth, 0.4, 0.84);
            return round(clamp(
                0.58
                + (juvenileGrowthProgress * 0.21)
                + (confidence * 0.01),
                0.52,
                0.8,
            ));
        }
        case ZEN_BONSAI_GROWTH_PHASES.DISPLAY:
            return round(clamp(
                0.94
                + (growth * 0.06),
                0.94,
                1,
            ));
        case ZEN_BONSAI_GROWTH_PHASES.MATURE:
        default: {
            const matureGrowthProgress = smoothstepRange(growth, 0.82, 0.98);
            return round(clamp(
                0.78
                + (matureGrowthProgress * 0.15)
                + (confidence * 0.02),
                0.78,
                0.97,
            ));
        }
    }
};

const resolveVisibleDepth = ({ progress, phase, structureDepth }) => {
    const targetDepth = clampStructureDepth(structureDepth);
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SPROUT) {
        return 1;
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SEEDLING) {
        return Math.min(4, targetDepth);
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.JUVENILE) {
        return Math.min(
            Math.max(3, Math.round(lerp(3, Math.min(5, targetDepth), smoothstep01((progress - 0.52) / 0.28)))),
            targetDepth,
        );
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.MATURE) {
        const earlyMatureDepth = Math.min(5, targetDepth);
        return Math.min(
            Math.max(
                earlyMatureDepth,
                Math.round(lerp(
                    earlyMatureDepth,
                    targetDepth,
                    smoothstep01((progress - 0.82) / 0.15),
                )),
            ),
            targetDepth,
        );
    }
    return targetDepth;
};

const resolveProjectionDevelopment = ({ progress, phase }) => {
    const safeProgress = clamp01(progress);
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SPROUT) {
        return {
            scaffoldDevelopment: 0,
            twigDevelopment: 0,
            terminalDevelopment: 0.18,
            bloomDevelopmentFloor: 0,
            miniatureBloomScale: 0.34,
            ramificationFloor: 0.04,
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SEEDLING) {
        const reveal = smoothstep01((safeProgress - 0.3) / 0.28);
        return {
            scaffoldDevelopment: round(lerp(0.36, 0.54, reveal)),
            twigDevelopment: round(lerp(0.08, 0.22, reveal)),
            terminalDevelopment: round(lerp(0.48, 0.66, reveal)),
            bloomDevelopmentFloor: round(lerp(0.08, 0.18, reveal)),
            miniatureBloomScale: round(lerp(0.36, 0.5, reveal)),
            ramificationFloor: round(lerp(0.12, 0.24, reveal)),
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.JUVENILE) {
        const juvenileReveal = smoothstep01((safeProgress - 0.55) / 0.25);
        const structureReveal = smoothstep01((safeProgress - 0.52) / 0.28);
        return {
            scaffoldDevelopment: round(lerp(0.46, 0.76, structureReveal)),
            twigDevelopment: round(lerp(0.22, 0.56, structureReveal)),
            terminalDevelopment: round(lerp(0.62, 0.84, structureReveal)),
            bloomDevelopmentFloor: round(lerp(0.16, 0.38, juvenileReveal)),
            miniatureBloomScale: round(lerp(0.48, 0.72, juvenileReveal)),
            ramificationFloor: round(lerp(0.22, 0.48, structureReveal)),
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.MATURE) {
        const matureReveal = smoothstep01((safeProgress - 0.8) / 0.17);
        const matureFlowerReveal = smoothstep01((safeProgress - 0.84) / 0.15);
        return {
            scaffoldDevelopment: round(lerp(0.68, 0.94, matureReveal)),
            twigDevelopment: round(lerp(0.38, 0.92, matureReveal)),
            terminalDevelopment: round(lerp(0.84, 0.98, matureReveal)),
            bloomDevelopmentFloor: round(lerp(0.32, 0.92, matureFlowerReveal)),
            miniatureBloomScale: round(lerp(0.72, 0.96, matureReveal)),
            ramificationFloor: round(lerp(0.5, 0.9, matureReveal)),
        };
    }
    return {
        scaffoldDevelopment: 1,
        twigDevelopment: 1,
        terminalDevelopment: 1,
        bloomDevelopmentFloor: 1,
        miniatureBloomScale: 1,
        ramificationFloor: 1,
    };
};

const resolveProjectionScales = ({ progress, phase }) => {
    const development = resolveProjectionDevelopment({ progress, phase });
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SPROUT) {
        return {
            lengthScale: round(lerp(0.38, 0.5, progress / 0.34)),
            widthScale: round(lerp(0.32, 0.42, progress / 0.34)),
            trunkReveal: 0.24,
            scaffoldReveal: 0,
            twigReveal: 0,
            terminalReveal: 0.18,
            terminalGrowthFloor: 0.48,
            leafDensityFloor: 0.56,
            flowerGateScale: 0,
            frontierReveal: 1,
            growthTipScale: 0.92,
            ...development,
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.SEEDLING) {
        const reveal = smoothstep01((progress - 0.3) / 0.28);
        return {
            lengthScale: round(lerp(0.52, 0.68, reveal)),
            widthScale: round(lerp(0.34, 0.5, reveal)),
            trunkReveal: round(lerp(0.4, 0.58, reveal)),
            scaffoldReveal: round(lerp(0.36, 0.54, reveal)),
            twigReveal: round(lerp(0.08, 0.22, reveal)),
            terminalReveal: round(lerp(0.58, 0.76, reveal)),
            terminalGrowthFloor: 0.66,
            leafDensityFloor: 0.62,
            flowerGateScale: round(lerp(0.12, 0.22, reveal)),
            frontierReveal: round(lerp(0.78, 0.92, reveal)),
            growthTipScale: 0.86,
            ...development,
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.JUVENILE) {
        const juvenileReveal = smoothstep01((progress - 0.55) / 0.25);
        const structureReveal = smoothstep01((progress - 0.52) / 0.28);
        return {
            lengthScale: round(lerp(0.64, 0.88, structureReveal)),
            widthScale: round(lerp(0.46, 0.74, structureReveal)),
            trunkReveal: round(lerp(0.62, 0.86, structureReveal)),
            scaffoldReveal: round(lerp(0.46, 0.76, structureReveal)),
            twigReveal: round(lerp(0.22, 0.56, structureReveal)),
            terminalReveal: round(lerp(0.7, 0.9, structureReveal)),
            terminalGrowthFloor: round(lerp(0.68, 0.5, juvenileReveal)),
            leafDensityFloor: round(lerp(0.52, 0.34, juvenileReveal)),
            flowerGateScale: round(lerp(0.22, 0.5, juvenileReveal)),
            frontierReveal: round(lerp(0.74, 0.94, structureReveal)),
            growthTipScale: round(lerp(0.8, 0.46, juvenileReveal)),
            ...development,
        };
    }
    if (phase === ZEN_BONSAI_GROWTH_PHASES.MATURE) {
        const matureReveal = smoothstep01((progress - 0.8) / 0.17);
        const matureLeafReveal = smoothstep01((progress - 0.83) / 0.16);
        const matureFlowerReveal = smoothstep01((progress - 0.84) / 0.15);
        return {
            lengthScale: round(lerp(0.9, 1, matureReveal)),
            widthScale: round(lerp(0.9, 1, matureReveal)),
            trunkReveal: round(lerp(0.86, 0.98, matureReveal)),
            scaffoldReveal: round(lerp(0.68, 0.94, matureReveal)),
            twigReveal: round(lerp(0.38, 0.92, matureReveal)),
            terminalReveal: round(lerp(0.84, 0.98, matureReveal)),
            terminalGrowthFloor: round(lerp(0.34, 0, matureReveal)),
            leafDensityFloor: round(lerp(0.78, 0, matureLeafReveal)),
            flowerGateScale: round(lerp(0.12, 0.92, matureFlowerReveal)),
            frontierReveal: round(lerp(0.9, 1, matureReveal)),
            growthTipScale: round(lerp(0.46, 0.08, matureReveal)),
            ...development,
        };
    }
    return {
        lengthScale: 1,
        widthScale: 1,
        trunkReveal: 1,
        scaffoldReveal: 1,
        twigReveal: 1,
        terminalReveal: 1,
        terminalGrowthFloor: 0,
        leafDensityFloor: 0,
        flowerGateScale: phase === ZEN_BONSAI_GROWTH_PHASES.DISPLAY ? 1 : 0.92,
        frontierReveal: 1,
        growthTipScale: 0,
        ...development,
    };
};

const resolveVigorSource = (lifeState = null) => (
    lifeState?.vigor && typeof lifeState.vigor === 'object'
        ? lifeState.vigor
        : lifeState
);

export const resolveZenBonsaiStageFlowerAvailability = ({
    phase = '',
    lifeState = null,
    growthProjection = null,
    baseFlowerChance = 0,
} = {}) => {
    const plan = normalizeZenBonsaiGrowthProjection(growthProjection);
    const resolvedPhase = typeof phase === 'string' && phase
        ? phase
        : (typeof lifeState?.phase === 'string' ? lifeState.phase : plan.phase);
    const vigor = resolveVigorSource(lifeState);
    const vitality = clamp01(vigor?.vitality ?? 0.78);
    const bloom = clamp01(vigor?.bloom ?? 0);
    const vitalityBloom = smoothstepRange(vitality, 0.82, 0.98);
    const developmentBloom = clamp01(plan.bloomDevelopmentFloor * vitalityBloom);
    const bloomSignal = Math.max(bloom, developmentBloom);
    const sourceChance = clamp01(baseFlowerChance);

    if (resolvedPhase === 'seedling' || plan.phase === ZEN_BONSAI_GROWTH_PHASES.SEEDLING) {
        return round(clamp(
            Math.max(sourceChance, 0.02) + (bloomSignal * 0.78),
            0.02,
            0.18,
        ));
    }

    if (resolvedPhase === 'juvenile' || plan.phase === ZEN_BONSAI_GROWTH_PHASES.JUVENILE) {
        return round(clamp(
            Math.max(sourceChance, 0.08) + (bloomSignal * 0.7),
            0.08,
            0.34,
        ));
    }

    return round(sourceChance);
};

const buildProjectionSignature = (projection) => [
    projection.phase,
    projection.progress,
    projection.visibleDepth,
    projection.lengthScale,
    projection.widthScale,
    projection.trunkReveal,
    projection.scaffoldReveal,
    projection.twigReveal,
    projection.terminalReveal,
    projection.terminalGrowthFloor,
    projection.leafDensityFloor,
    projection.flowerGateScale,
    projection.frontierReveal,
    projection.growthTipScale,
    projection.scaffoldDevelopment,
    projection.twigDevelopment,
    projection.terminalDevelopment,
    projection.bloomDevelopmentFloor,
    projection.miniatureBloomScale,
    projection.ramificationFloor,
    projection.growthEventKind,
    projection.growthEventStrength,
    projection.growthEventSeed,
    projection.surfaceFeedbackKind,
    projection.surfaceFeedbackStrength,
    projection.surfaceFeedbackSeed,
    projection.mossState,
    projection.mossSaturation,
    projection.kinkPressure,
    projection.scaffoldCompression,
    projection.gravityBias,
    projection.canopyBudget,
    projection.recoveryShootBias,
    (Array.isArray(projection.growthSegments) ? projection.growthSegments : [])
        .map((segment) => [
            segment.milestone,
            segment.kinkPressure,
            segment.scaffoldCompression,
            segment.gravityBias,
            segment.canopyBudget,
        ].join(':'))
        .join(','),
].join('|');

const resolveProjectionGrowthEvent = (lifeState = null) => {
    const event = lifeState?.growthEvent && typeof lifeState.growthEvent === 'object'
        ? lifeState.growthEvent
        : {};
    const kind = Object.values(ZEN_BONSAI_GROWTH_EVENT_KINDS).includes(event.kind)
        ? event.kind
        : ZEN_BONSAI_GROWTH_EVENT_KINDS.NONE;
    const strength = kind === ZEN_BONSAI_GROWTH_EVENT_KINDS.NONE
        ? 0
        : clamp01(event.strength ?? (kind === ZEN_BONSAI_GROWTH_EVENT_KINDS.MILESTONE_SHOOT ? 1 : 0.62));
    const seed = [
        kind,
        Math.max(0, Math.floor(Number(event.milestone) || 0)),
        event.milestoneEventDateKey || '',
        event.lastClosedDateKey || '',
    ].join(':');
    return Object.freeze({
        kind,
        strength: round(strength),
        seed,
    });
};

const resolveProjectionSurfaceFeedback = (lifeState = null) => {
    const event = lifeState?.growthEvent && typeof lifeState.growthEvent === 'object'
        ? lifeState.growthEvent
        : {};
    const kind = Object.values(ZEN_BONSAI_SURFACE_FEEDBACK_KINDS).includes(event.microFeedback)
        ? event.microFeedback
        : ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE;
    const vigor = lifeState?.vigor && typeof lifeState.vigor === 'object'
        ? lifeState.vigor
        : lifeState;
    const vitality = clamp01(vigor?.vitality ?? 0.78);
    const stress = clamp01(vigor?.stress ?? 0);
    const dryness = clamp01(vigor?.dryness ?? 0);
    const strength = (() => {
        if (kind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.DEW_GLINT) {
            return clamp(0.58 + (vitality * 0.3) - (dryness * 0.08), 0.38, 1);
        }
        if (kind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.LEAF_FALL) {
            return clamp(0.52 + (dryness * 0.22) + (stress * 0.16), 0.42, 0.88);
        }
        return 0;
    })();
    const seed = kind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE
        ? ''
        : [
            kind,
            event.lastClosedDateKey || '',
            event.milestoneEventDateKey || '',
            Math.round(vitality * 100),
            Math.round(dryness * 100),
        ].join(':');
    return Object.freeze({
        kind,
        strength: round(kind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE ? 0 : strength),
        seed,
    });
};

const resolveProjectionMossState = (lifeState = null) => {
    const vigor = lifeState?.vigor && typeof lifeState.vigor === 'object'
        ? lifeState.vigor
        : lifeState;
    const vitality = clamp01(vigor?.vitality ?? 0.78);
    const dryness = clamp01(vigor?.dryness ?? 0);
    const stress = clamp01(vigor?.stress ?? 0);
    const mossPressure = clamp01((dryness * 0.68) + (stress * 0.22) + ((1 - vitality) * 0.26));
    const state = (() => {
        if (dryness >= 0.62 || vitality <= 0.42 || mossPressure >= 0.58) {
            return ZEN_BONSAI_MOSS_STATES.DRY;
        }
        if (dryness >= 0.34 || vitality <= 0.62 || mossPressure >= 0.34) {
            return ZEN_BONSAI_MOSS_STATES.PALE;
        }
        if (vitality >= 0.88 && dryness <= 0.08 && stress <= 0.16) {
            return ZEN_BONSAI_MOSS_STATES.SATURATED;
        }
        return ZEN_BONSAI_MOSS_STATES.NORMAL;
    })();
    const baseSaturation = {
        [ZEN_BONSAI_MOSS_STATES.SATURATED]: 1,
        [ZEN_BONSAI_MOSS_STATES.NORMAL]: 0.72,
        [ZEN_BONSAI_MOSS_STATES.PALE]: 0.42,
        [ZEN_BONSAI_MOSS_STATES.DRY]: 0.18,
    }[state];
    return Object.freeze({
        state,
        saturation: round(clamp(
            baseSaturation + ((vitality - 0.78) * 0.12) - (dryness * 0.08),
            0.08,
            1,
        )),
    });
};

const normalizeProjectionStructuralMemory = (structuralImprint = null) => {
    if (!structuralImprint || typeof structuralImprint !== 'object' || Array.isArray(structuralImprint)) {
        return null;
    }
    const exposureQuality = round(clamp01(structuralImprint.exposureQuality));
    const stressWood = round(clamp01(structuralImprint.stressWood));
    const recoveryWood = round(clamp01(structuralImprint.recoveryWood));
    const volatility = round(clamp01(structuralImprint.volatility));
    const canopyReserve = round(clamp01(structuralImprint.canopyReserve ?? 0.62));
    const active = structuralImprint.active === true
        || exposureQuality > 0
        || stressWood > 0
        || recoveryWood > 0
        || volatility > 0
        || Math.abs(canopyReserve - 0.62) > 0.001;
    if (!active) {
        return null;
    }
    return Object.freeze({
        exposureQuality,
        stressWood,
        recoveryWood,
        volatility,
        canopyReserve,
    });
};

const deriveProjectionStructuralFields = ({
    exposureQuality = 0,
    stressWood = 0,
    recoveryWood = 0,
    volatility = 0,
    canopyReserve = 0.62,
    compressionCue = 0,
    gravityCue = 0,
    canopyInfluence = 1,
    sourceWeight = null,
    structuralMemoryPressure = null,
} = {}) => {
    const memoryWeight = sourceWeight !== null
        && sourceWeight !== undefined
        && Number.isFinite(Number(sourceWeight))
        ? clamp01(sourceWeight)
        : lerp(0.62, 0.88, exposureQuality);
    const weightedStressWood = clamp01(stressWood * memoryWeight);
    const weightedRecoveryWood = clamp01(recoveryWood * memoryWeight);
    const weightedVolatility = clamp01(volatility * memoryWeight);
    const weightedCanopyReserve = clamp01(canopyReserve);
    const pressureFloor = structuralMemoryPressure !== null
        && structuralMemoryPressure !== undefined
        && Number.isFinite(Number(structuralMemoryPressure))
        ? clamp01(structuralMemoryPressure)
        : (stressWood * memoryWeight);
    const compressionPressure = clamp01(compressionCue);
    const gravityPressure = clamp01(gravityCue);
    const canopyWeight = clamp01(canopyInfluence);
    const rawKinkPressure = (
        (weightedStressWood * 0.62)
        + (weightedVolatility * 0.32)
        - (weightedRecoveryWood * 0.36)
    );
    const rawScaffoldCompression = (
        (weightedStressWood * 0.58)
        + (compressionPressure * 0.12)
        - (weightedCanopyReserve * canopyWeight * 0.16)
    );
    const rawGravityBias = (
        (weightedStressWood * 0.42)
        + (gravityPressure * 0.22)
        - (weightedRecoveryWood * 0.3)
    );
    const canopyBudget = clamp(
        0.62
        + ((weightedCanopyReserve - 0.62) * 0.48 * canopyWeight)
        + (weightedRecoveryWood * 0.14)
        - (weightedStressWood * 0.2),
        0.34,
        1,
    );
    return Object.freeze({
        kinkPressure: round(clamp(Math.max(rawKinkPressure, pressureFloor * 0.24), 0, 0.62)),
        scaffoldCompression: round(clamp(Math.max(rawScaffoldCompression, pressureFloor * 0.16), 0, 0.5)),
        gravityBias: round(clamp(Math.max(rawGravityBias, pressureFloor * 0.2), 0, 0.62)),
        canopyBudget: round(canopyBudget),
        recoveryShootBias: round(weightedRecoveryWood),
    });
};

const normalizeProjectionGrowthSegments = (growthSegments = null) => {
    if (!Array.isArray(growthSegments)) {
        return Object.freeze([]);
    }
    return Object.freeze(growthSegments
        .map((segment) => {
            if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
                return null;
            }
            const milestone = Math.max(0, Math.floor(Number(segment.milestone) || 0));
            if (milestone <= 0) {
                return null;
            }
            const base = {
                id: typeof segment.id === 'string' && segment.id.trim()
                    ? segment.id.trim()
                    : `m${milestone}`,
                milestone,
                growthScore: round(clamp(segment.growthScore, 0, 100), 2),
                dateKey: typeof segment.dateKey === 'string' ? segment.dateKey.trim() : '',
                exposureQuality: round(clamp01(segment.exposureQuality)),
                stressWood: round(clamp01(segment.stressWood)),
                recoveryWood: round(clamp01(segment.recoveryWood)),
                volatility: round(clamp01(segment.volatility)),
                canopyReserve: round(clamp01(segment.canopyReserve ?? 0.62)),
                healthH: round(clamp01(segment.healthH ?? 0.68)),
                vitalityTier: typeof segment.vitalityTier === 'string' ? segment.vitalityTier.trim() : '',
            };
            return Object.freeze({
                ...base,
                ...deriveProjectionStructuralFields(base),
            });
        })
        .filter(Boolean)
        .sort((left, right) => left.milestone - right.milestone));
};

const resolveProjectionStructuralImprint = (lifeState = null) => {
    const maturity = lifeState?.maturity && typeof lifeState.maturity === 'object'
        ? lifeState.maturity
        : lifeState;
    const vigor = lifeState?.vigor && typeof lifeState.vigor === 'object'
        ? lifeState.vigor
        : lifeState;
    const event = lifeState?.growthEvent && typeof lifeState.growthEvent === 'object'
        ? lifeState.growthEvent
        : {};
    const dataDays = Math.max(0, Math.floor(Number(maturity?.dataDays ?? lifeState?.dataDays) || 0));
    const evidenceGate = smoothstepRange(dataDays, ZEN_BONSAI_GROWTH_BASELINE_DAYS, 21);
    const vitality = clamp01(vigor?.vitality ?? 0.78);
    const stress = clamp01(vigor?.stress ?? 0);
    const bloom = clamp01(vigor?.bloom ?? 0);
    const dryness = clamp01(vigor?.dryness ?? 0);
    const branchSag = clamp01(vigor?.branchSag ?? 0);
    let stressWood = clamp01((
        (stress * 0.52)
        + (dryness * 0.32)
        + ((1 - vitality) * 0.24)
    ) * evidenceGate);
    let volatility = clamp01((
        Math.abs(stress - dryness) * 0.28
        + (event.microFeedback === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.LEAF_FALL ? 0.34 : 0)
    ) * evidenceGate);
    let recoveryWood = clamp01((
        (event.kind === ZEN_BONSAI_GROWTH_EVENT_KINDS.RECOVERY_SHOOT ? 0.58 : 0)
        + (event.recoveryOverlay === true ? 0.22 : 0)
        + (event.microFeedback === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.DEW_GLINT ? 0.18 : 0)
        + (vitality > 0.82 && stress < 0.24 ? (vitality - 0.82) * 0.56 : 0)
    ) * evidenceGate);
    let canopyReserve = clamp01(
        0.18
        + (vitality * 0.48)
        + (bloom * 0.2)
        + ((1 - dryness) * 0.14)
        - (stress * 0.22),
    );
    const structuralMemory = normalizeProjectionStructuralMemory(lifeState?.structuralImprint);
    let structuralMemoryPressure = 0;
    if (structuralMemory) {
        const memoryWeight = lerp(0.62, 0.88, structuralMemory.exposureQuality);
        structuralMemoryPressure = structuralMemory.stressWood * memoryWeight;
        stressWood = clamp01(Math.max(stressWood, structuralMemory.stressWood * memoryWeight));
        volatility = clamp01(Math.max(volatility, structuralMemory.volatility * memoryWeight));
        recoveryWood = clamp01(Math.max(recoveryWood, structuralMemory.recoveryWood * memoryWeight));
        canopyReserve = clamp01(
            (canopyReserve * (1 - memoryWeight))
            + (structuralMemory.canopyReserve * memoryWeight),
        );
    }
    return deriveProjectionStructuralFields({
        stressWood,
        recoveryWood,
        volatility,
        canopyReserve,
        compressionCue: dryness * evidenceGate,
        // Keep the existing live sag contribution while routing the bridge math
        // through the same structural field helper used by stamped segments.
        gravityCue: branchSag * evidenceGate * 2,
        canopyInfluence: evidenceGate,
        sourceWeight: 1,
        structuralMemoryPressure,
    });
};

export const normalizeZenBonsaiGrowthProjection = (candidate = null) => {
    if (!candidate || typeof candidate !== 'object') {
        const fallback = {
            phase: ZEN_BONSAI_GROWTH_PHASES.MATURE,
            progress: 1,
            visibleDepth: DEFAULT_STRUCTURE_DEPTH,
            lengthScale: 1,
            widthScale: 1,
            trunkReveal: 1,
            scaffoldReveal: 1,
            twigReveal: 1,
            terminalReveal: 1,
            terminalGrowthFloor: 0,
            leafDensityFloor: 0,
            flowerGateScale: 1,
            frontierReveal: 1,
            growthTipScale: 0,
            scaffoldDevelopment: 1,
            twigDevelopment: 1,
            terminalDevelopment: 1,
            bloomDevelopmentFloor: 1,
            miniatureBloomScale: 1,
            ramificationFloor: 1,
            growthEventKind: ZEN_BONSAI_GROWTH_EVENT_KINDS.NONE,
            growthEventStrength: 0,
            growthEventSeed: '',
            surfaceFeedbackKind: ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE,
            surfaceFeedbackStrength: 0,
            surfaceFeedbackSeed: '',
            mossState: ZEN_BONSAI_MOSS_STATES.NORMAL,
            mossSaturation: 1,
            kinkPressure: 0,
            scaffoldCompression: 0,
            gravityBias: 0,
            canopyBudget: 1,
            recoveryShootBias: 0,
            growthSegments: Object.freeze([]),
            baselineProgress: 1,
            active: false,
        };
        return Object.freeze({
            ...fallback,
            signature: buildProjectionSignature(fallback),
        });
    }
    const phase = Object.values(ZEN_BONSAI_GROWTH_PHASES).includes(candidate.phase)
        ? candidate.phase
        : ZEN_BONSAI_GROWTH_PHASES.MATURE;
    const growthEventKind = Object.values(ZEN_BONSAI_GROWTH_EVENT_KINDS).includes(candidate.growthEventKind)
        ? candidate.growthEventKind
        : ZEN_BONSAI_GROWTH_EVENT_KINDS.NONE;
    const surfaceFeedbackKind = Object.values(ZEN_BONSAI_SURFACE_FEEDBACK_KINDS).includes(candidate.surfaceFeedbackKind)
        ? candidate.surfaceFeedbackKind
        : ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE;
    const progress = round(clamp01(candidate.progress));
    const development = resolveProjectionDevelopment({ phase, progress });
    const normalized = {
        phase,
        progress,
        visibleDepth: clampStructureDepth(candidate.visibleDepth),
        lengthScale: round(clamp(candidate.lengthScale, 0.12, 1)),
        widthScale: round(clamp(candidate.widthScale, 0.16, 1)),
        trunkReveal: round(clamp01(candidate.trunkReveal ?? 1)),
        scaffoldReveal: round(clamp01(candidate.scaffoldReveal ?? 1)),
        twigReveal: round(clamp01(candidate.twigReveal ?? 1)),
        terminalReveal: round(clamp01(candidate.terminalReveal ?? 1)),
        terminalGrowthFloor: round(clamp01(candidate.terminalGrowthFloor)),
        leafDensityFloor: round(clamp01(candidate.leafDensityFloor)),
        flowerGateScale: round(clamp01(candidate.flowerGateScale)),
        frontierReveal: round(clamp01(candidate.frontierReveal)),
        growthTipScale: round(clamp01(candidate.growthTipScale)),
        scaffoldDevelopment: round(clamp01(candidate.scaffoldDevelopment ?? development.scaffoldDevelopment)),
        twigDevelopment: round(clamp01(candidate.twigDevelopment ?? development.twigDevelopment)),
        terminalDevelopment: round(clamp01(candidate.terminalDevelopment ?? development.terminalDevelopment)),
        bloomDevelopmentFloor: round(clamp01(candidate.bloomDevelopmentFloor ?? development.bloomDevelopmentFloor)),
        miniatureBloomScale: round(clamp(candidate.miniatureBloomScale ?? development.miniatureBloomScale, 0.18, 1)),
        ramificationFloor: round(clamp01(candidate.ramificationFloor ?? development.ramificationFloor)),
        growthEventKind,
        growthEventStrength: growthEventKind === ZEN_BONSAI_GROWTH_EVENT_KINDS.NONE
            ? 0
            : round(clamp01(candidate.growthEventStrength)),
        growthEventSeed: typeof candidate.growthEventSeed === 'string' ? candidate.growthEventSeed : '',
        surfaceFeedbackKind,
        surfaceFeedbackStrength: surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE
            ? 0
            : round(clamp01(candidate.surfaceFeedbackStrength)),
        surfaceFeedbackSeed: surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE
            ? ''
            : (typeof candidate.surfaceFeedbackSeed === 'string' ? candidate.surfaceFeedbackSeed : ''),
        mossState: Object.values(ZEN_BONSAI_MOSS_STATES).includes(candidate.mossState)
            ? candidate.mossState
            : ZEN_BONSAI_MOSS_STATES.NORMAL,
        mossSaturation: round(clamp01(candidate.mossSaturation ?? 1)),
        kinkPressure: round(clamp(candidate.kinkPressure, 0, 0.62)),
        scaffoldCompression: round(clamp(candidate.scaffoldCompression, 0, 0.5)),
        gravityBias: round(clamp(candidate.gravityBias, 0, 0.62)),
        canopyBudget: round(clamp(candidate.canopyBudget ?? 1, 0.34, 1)),
        recoveryShootBias: round(clamp01(candidate.recoveryShootBias)),
        growthSegments: normalizeProjectionGrowthSegments(candidate.growthSegments),
        baselineProgress: round(clamp01(candidate.baselineProgress)),
        active: candidate.active === true,
    };
    return Object.freeze({
        ...normalized,
        signature: buildProjectionSignature(normalized),
    });
};

const resolveNormalizedProjection = (candidate = null) => (
    candidate
    && typeof candidate === 'object'
    && typeof candidate.signature === 'string'
        ? candidate
        : normalizeZenBonsaiGrowthProjection(candidate)
);

export const resolveZenBonsaiGrowthProjection = ({
    lifeState = null,
    structureDepth = DEFAULT_STRUCTURE_DEPTH,
} = {}) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return normalizeZenBonsaiGrowthProjection({
            phase: ZEN_BONSAI_GROWTH_PHASES.MATURE,
            progress: 1,
            visibleDepth: structureDepth,
            lengthScale: 1,
            widthScale: 1,
            trunkReveal: 1,
            scaffoldReveal: 1,
            twigReveal: 1,
            terminalReveal: 1,
            terminalGrowthFloor: 0,
            leafDensityFloor: 0,
            flowerGateScale: 1,
            frontierReveal: 1,
            growthTipScale: 0,
            scaffoldDevelopment: 1,
            twigDevelopment: 1,
            terminalDevelopment: 1,
            bloomDevelopmentFloor: 1,
            miniatureBloomScale: 1,
            ramificationFloor: 1,
            surfaceFeedbackKind: ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE,
            surfaceFeedbackStrength: 0,
            surfaceFeedbackSeed: '',
            mossState: ZEN_BONSAI_MOSS_STATES.NORMAL,
            mossSaturation: 1,
            kinkPressure: 0,
            scaffoldCompression: 0,
            gravityBias: 0,
            canopyBudget: 1,
            recoveryShootBias: 0,
            growthSegments: Object.freeze([]),
            baselineProgress: 1,
            active: false,
        });
    }
    const state = normalizeZenBonsaiLifeState(lifeState);
    const maturity = state.maturity;
    const phase = resolveProjectionPhase(maturity);
    const progress = resolveProjectionProgress(maturity, phase);
    const visibleDepth = resolveVisibleDepth({ progress, phase, structureDepth });
    const scales = resolveProjectionScales({ progress, phase });
    const event = resolveProjectionGrowthEvent(state);
    const surfaceFeedback = resolveProjectionSurfaceFeedback(state);
    const moss = resolveProjectionMossState(state);
    const structuralImprint = resolveProjectionStructuralImprint(state);
    const growthSegments = normalizeProjectionGrowthSegments(state.growthSegments);
    const hasStampedStructure = growthSegments.some((segment) => (
        segment.stressWood > 0.02
        || segment.recoveryWood > 0.02
        || segment.volatility > 0.02
        || Math.abs(segment.canopyReserve - 0.62) > 0.02
    ));
    return normalizeZenBonsaiGrowthProjection({
        phase,
        progress,
        visibleDepth,
        ...scales,
        growthEventKind: event.kind,
        growthEventStrength: event.strength,
        growthEventSeed: event.seed,
        surfaceFeedbackKind: surfaceFeedback.kind,
        surfaceFeedbackStrength: surfaceFeedback.strength,
        surfaceFeedbackSeed: surfaceFeedback.seed,
        mossState: moss.state,
        mossSaturation: moss.saturation,
        ...structuralImprint,
        growthSegments,
        baselineProgress: maturity.dataDays / ZEN_BONSAI_GROWTH_BASELINE_DAYS,
        active: progress < 0.985 || phase !== ZEN_BONSAI_GROWTH_PHASES.DISPLAY || hasStampedStructure,
    });
};

export const applyZenBonsaiGrowthProjectionToStage = (
    stage = {},
    projection = null,
) => {
    const normalized = normalizeZenBonsaiGrowthProjection(projection);
    const canopyBudget = clamp(normalized.canopyBudget ?? 1, 0.34, 1);
    const canopyLeafScale = lerp(0.68, 1.08, canopyBudget);
    const canopyFlowerScale = lerp(0.46, 1.1, canopyBudget);
    const leafChance = clamp(
        Math.max(
            (Number(stage?.leafChance) || 0) * canopyLeafScale,
            normalized.leafDensityFloor * lerp(0.68, 0.92, canopyBudget),
        ),
        0,
        1,
    );
    const flowerChance = clamp01(
        (Number(stage?.flowerChance) || 0)
        * normalized.flowerGateScale
        * canopyFlowerScale,
    );
    return Object.freeze({
        ...(stage || {}),
        depth: normalized.visibleDepth,
        leafChance: round(leafChance),
        flowerChance: round(flowerChance),
        growthProjection: normalized,
    });
};

export const ZEN_BONSAI_GROWTH_NODE_ROLES = Object.freeze({
    TRUNK: 'trunk',
    SCAFFOLD: 'scaffold',
    TWIG: 'twig',
});

export const ZEN_BONSAI_BRANCH_TAPER_PROFILES = Object.freeze({
    TRUNK_CONTINUATION: 'trunk_continuation',
    SCAFFOLD_CONTINUATION: 'scaffold_continuation',
    TWIG_FRONTIER: 'twig_frontier',
    TERMINAL_SPUR: 'terminal_spur',
});

export const ZEN_BONSAI_ENDPOINT_KINDS = Object.freeze({
    STRUCTURAL_CONTINUATION: 'structural_continuation',
    HIDDEN_FRONTIER: 'hidden_frontier',
    TERMINAL_MIXED: 'terminal_mixed',
    TERMINAL_FLOWER: 'terminal_flower',
    TERMINAL_LEAF: 'terminal_leaf',
    TERMINAL_SPUR: 'terminal_spur',
    GROWTH_TIP: 'growth_tip',
    STRUCTURAL_BARE: 'structural_bare',
});

export const resolveZenBonsaiGrowthNodeRole = (node = {}) => {
    const order = Number(node?.branchOrder);
    if (order === SAKURA_BRANCH_ORDER.TRUNK) return ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK;
    if (order === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) return ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG;
    return ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD;
};

const resolveNodeRoleDepth = (node = {}, traversalDepth = 1) => {
    const role = resolveZenBonsaiGrowthNodeRole(node);
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return Math.max(1, Math.floor(Number(node?.trunkMainDepth ?? traversalDepth) || 1));
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return Math.max(1, Math.floor(Number(node?.twigDepth ?? 1) || 1));
    }
    return Math.max(1, Math.floor(Number(node?.scaffoldDepth ?? 1) || 1));
};

const resolveNodeRoleLimit = (node = {}, traversalDepth = 1) => {
    const role = resolveZenBonsaiGrowthNodeRole(node);
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return Math.max(
            1,
            Math.floor(Number(node?.trunkSegmentLimit ?? node?.trunkDepthLimit ?? Math.max(traversalDepth, DEFAULT_BRANCH_DEPTH_LIMIT)) || 1),
        );
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return Math.max(1, Math.floor(Number(node?.twigMaxDepth ?? DEFAULT_BRANCH_DEPTH_LIMIT) || 1));
    }
    return Math.max(
        1,
        Math.floor(Number(node?.scaffoldDepthLimit ?? node?.scaffoldMaxDepth ?? DEFAULT_BRANCH_DEPTH_LIMIT) || 1),
    );
};

const resolveRoleReveal = (growthPlan = {}, role) => {
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) return clamp01(growthPlan.trunkReveal);
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) return clamp01(growthPlan.twigReveal);
    return clamp01(growthPlan.scaffoldReveal);
};

const hasTerminalSet = (node = {}) => (
    Array.isArray(node?.terminals) && node.terminals.length > 0
);

const hasDescendantRamificationCarrier = (node = {}, remainingDepth = 2) => {
    if (!Array.isArray(node?.branches) || remainingDepth <= 0) {
        return false;
    }
    return node.branches.some((child) => {
        const childNode = child?.obj;
        if (!childNode || childNode.type !== 'branch') {
            return false;
        }
        if (hasTerminalSet(childNode)) {
            return true;
        }
        return resolveZenBonsaiGrowthNodeRole(childNode) === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
            || hasDescendantRamificationCarrier(childNode, remainingDepth - 1);
    });
};

const resolveRamificationCarrierSignal = (growthPlan = {}) => clamp01(
    (clamp01(growthPlan.ramificationFloor) * 0.65)
    + (clamp01(growthPlan.terminalDevelopment) * 0.35),
);

const resolveRamificationCarrierReach = (growthPlan = {}, role, reveal) => {
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return clamp(
            Math.max(
                reveal,
                clamp01(growthPlan.ramificationFloor) + (clamp01(growthPlan.terminalDevelopment) * 0.24),
            ),
            reveal,
            0.76,
        );
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD) {
        return clamp(
            Math.max(
                reveal,
                clamp01(growthPlan.scaffoldDevelopment)
                    + (clamp01(growthPlan.terminalDevelopment) * 0.2)
                    + (clamp01(growthPlan.ramificationFloor) * 0.12),
            ),
            reveal,
            0.86,
        );
    }
    return reveal;
};

const shouldRenderRamificationCarrierNode = ({
    growthPlan = {},
    node = {},
    role,
    roleNorm,
    reveal,
    traversalDepth = 1,
}) => {
    if (
        role !== ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
        && role !== ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD
    ) {
        return false;
    }
    const carriesOwnTerminals = hasTerminalSet(node);
    const carriesChildRamification = hasDescendantRamificationCarrier(node, role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD ? 3 : 2);
    if (!carriesOwnTerminals && !carriesChildRamification) {
        return false;
    }

    const carrierSignal = resolveRamificationCarrierSignal(growthPlan);
    if (carrierSignal <= 0) {
        return false;
    }

    const carrierReach = resolveRamificationCarrierReach(growthPlan, role, reveal);
    const carrierBand = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.24 : 0.24;
    const carrierProgress = clamp01((carrierReach + carrierBand - roleNorm) / Math.max(0.0001, carrierBand));
    if (carrierProgress <= 0) {
        return false;
    }
    if (
        role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
        && carriesOwnTerminals
        && roleNorm <= carrierReach
    ) {
        return true;
    }
    if (
        role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD
        && carriesChildRamification
        && carrierSignal >= 0.34
        && roleNorm <= carrierReach
    ) {
        return true;
    }

    const baseDensity = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
        ? lerp(0.12, 0.46, carrierSignal)
        : lerp(0.12, 0.42, carrierSignal);
    const terminalBonus = carriesOwnTerminals
        ? (clamp01(growthPlan.terminalDevelopment) * 0.08)
        : 0;
    const childBonus = carriesChildRamification
        ? (clamp01(growthPlan.ramificationFloor) * 0.08)
        : 0;
    const densityCap = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.62 : 0.38;
    const carrierDensity = clamp(baseDensity + terminalBonus + childBonus, 0, densityCap);
    return hashUnit(`${resolveNodeGrowthKey(node, traversalDepth)}|ramification_carrier`) <= (
        carrierProgress * carrierDensity * clamp01(growthPlan.frontierReveal)
    );
};

const resolveNodeGrowthKey = (node = {}, depth = 1) => [
    node?.nodeId || 'node',
    node?.branchOrderName || '',
    Number(node?.branchOrder) || 0,
    resolveNodeRoleDepth(node, depth),
    Number(node?.length) || 0,
    Number(node?.width) || 0,
].join('|');

const resolveZenBonsaiStampedSegmentForNode = (growthPlan = null, node = {}, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    const segments = Array.isArray(plan.growthSegments) ? plan.growthSegments : [];
    if (!segments.length) {
        return null;
    }
    const role = resolveZenBonsaiGrowthNodeRole(node);
    const roleDepth = resolveNodeRoleDepth(node, traversalDepth);
    const roleLimit = resolveNodeRoleLimit(node, traversalDepth);
    const roleNorm = clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const minMilestone = segments[0].milestone;
    const maxMilestone = segments[segments.length - 1].milestone;
    const targetMilestone = (() => {
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            return lerp(minMilestone, Math.max(minMilestone, maxMilestone * 0.48), roleNorm);
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
            return lerp(Math.max(minMilestone, maxMilestone * 0.56), maxMilestone, roleNorm);
        }
        return lerp(Math.max(minMilestone, maxMilestone * 0.28), Math.max(minMilestone, maxMilestone * 0.84), roleNorm);
    })();
    return segments.reduce((best, segment) => {
        if (!best) return segment;
        const bestDistance = Math.abs(best.milestone - targetMilestone);
        const distance = Math.abs(segment.milestone - targetMilestone);
        return distance < bestDistance ? segment : best;
    }, null);
};

const resolveNodeStructuralProjection = (growthPlan = null, node = {}, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    const segment = resolveZenBonsaiStampedSegmentForNode(plan, node, traversalDepth);
    if (!segment) {
        return plan;
    }
    return Object.freeze({
        kinkPressure: Math.max(segment.kinkPressure, clamp01(plan.kinkPressure) * 0.35),
        scaffoldCompression: Math.max(segment.scaffoldCompression, clamp01(plan.scaffoldCompression) * 0.35),
        gravityBias: Math.max(segment.gravityBias, clamp01(plan.gravityBias) * 0.5),
        canopyBudget: clamp(
            (segment.canopyBudget * 0.78) + (clamp(plan.canopyBudget ?? 1, 0.34, 1) * 0.22),
            0.34,
            1,
        ),
        recoveryShootBias: Math.max(segment.recoveryShootBias, clamp01(plan.recoveryShootBias) * 0.4),
        structuralSegmentId: segment.id,
        structuralSegmentMilestone: segment.milestone,
    });
};

export const shouldRenderZenBonsaiGrowthNode = (growthPlan = null, node = {}, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    if (plan.active !== true) {
        return true;
    }
    if (!node || node.type !== 'branch') {
        return false;
    }
    const role = resolveZenBonsaiGrowthNodeRole(node);
    const roleDepth = resolveNodeRoleDepth(node, traversalDepth);
    const roleLimit = resolveNodeRoleLimit(node, traversalDepth);
    const roleNorm = clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const reveal = resolveRoleReveal(plan, role);
    if (role !== ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK && reveal <= 0) {
        return false;
    }
    if (roleNorm <= reveal) {
        return true;
    }
    const frontierBand = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 0.035 : 0.12;
    const frontierProgress = clamp01((reveal + frontierBand - roleNorm) / Math.max(0.0001, frontierBand));
    if (frontierProgress <= 0) {
        return shouldRenderRamificationCarrierNode({
            growthPlan: plan,
            node,
            role,
            roleNorm,
            reveal,
            traversalDepth,
        });
    }
    if (hashUnit(`${resolveNodeGrowthKey(node, traversalDepth)}|frontier`) <= (
        frontierProgress * clamp01(plan.frontierReveal)
    )) {
        return true;
    }
    return shouldRenderRamificationCarrierNode({
        growthPlan: plan,
        node,
        role,
        roleNorm,
        reveal,
        traversalDepth,
    });
};

export const resolveZenBonsaiSegmentGrowthScales = (growthPlan = null, node = {}, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    if (plan.active !== true) {
        return {
            length: 1,
            width: 1,
        };
    }
    const role = resolveZenBonsaiGrowthNodeRole(node);
    const roleDepth = resolveNodeRoleDepth(node, traversalDepth);
    const roleLimit = resolveNodeRoleLimit(node, traversalDepth);
    const roleNorm = clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const structural = resolveNodeStructuralProjection(plan, node, traversalDepth);
    const compression = clamp(structural.scaffoldCompression ?? plan.scaffoldCompression ?? 0, 0, 0.5);
    const canopyRelief = clamp01(structural.canopyBudget ?? plan.canopyBudget ?? 1);
    const displayFull = plan.phase === ZEN_BONSAI_GROWTH_PHASES.DISPLAY && plan.progress >= 0.985;
    if (displayFull) {
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            return {
                length: clamp(1 - (compression * 0.05 * roleNorm), 0.9, 1.04),
                width: 1,
            };
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
            return {
                length: clamp(1 - (compression * lerp(0.12, 0.28, roleNorm)), 0.72, 1.04),
                width: clamp(lerp(0.92, 1.06, canopyRelief) * (1 - (compression * 0.12)), 0.74, 1.08),
            };
        }
        return {
            length: clamp(1 - (compression * lerp(0.12, 0.24, roleNorm)), 0.76, 1.04),
            width: clamp(lerp(0.94, 1.06, canopyRelief) * (1 - (compression * 0.14)), 0.76, 1.08),
        };
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
        return {
            length: clamp(
                plan.lengthScale
                * lerp(1.08, 0.9, roleNorm)
                * (1 - (compression * 0.05 * roleNorm)),
                0.18,
                1,
            ),
            width: clamp(plan.widthScale * lerp(1.08, 0.82, roleNorm), 0.28, 1),
        };
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return {
            length: clamp(
                plan.lengthScale
                * lerp(0.88, 0.64, roleNorm)
                * (1 - (compression * lerp(0.12, 0.26, roleNorm))),
                0.12,
                1,
            ),
            width: clamp(
                plan.widthScale
                * lerp(0.86, 0.58, roleNorm)
                * lerp(0.88, 1.06, canopyRelief)
                * (1 - (compression * 0.1)),
                0.16,
                1,
            ),
        };
    }
    return {
        length: clamp(
            plan.lengthScale
            * lerp(0.98, 0.76, roleNorm)
            * (1 - (compression * lerp(0.1, 0.24, roleNorm))),
            0.14,
            1,
        ),
        width: clamp(
            plan.widthScale
            * lerp(0.94, 0.68, roleNorm)
            * lerp(0.9, 1.06, canopyRelief)
            * (1 - (compression * 0.14)),
            0.16,
            1,
        ),
    };
};

const resolveZenBonsaiTerminalGrowthScales = (growthPlan = null, node = {}, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    if (plan.active !== true) {
        return {
            dist: 1,
            scale: 1,
        };
    }
    const roleDepth = resolveNodeRoleDepth(node, traversalDepth);
    const roleLimit = resolveNodeRoleLimit(node, traversalDepth);
    const roleNorm = clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const reveal = clamp01(plan.terminalReveal);
    const structural = resolveNodeStructuralProjection(plan, node, traversalDepth);
    const canopyBudget = clamp01(structural.canopyBudget ?? plan.canopyBudget ?? 1);
    const gravityBias = clamp01(structural.gravityBias ?? plan.gravityBias ?? 0);
    const recoveryShootBias = clamp01(structural.recoveryShootBias ?? plan.recoveryShootBias ?? 0);
    const displayFull = plan.phase === ZEN_BONSAI_GROWTH_PHASES.DISPLAY && plan.progress >= 0.985;
    if (displayFull) {
        return {
            dist: clamp(
                lerp(0.82, 1.08, canopyBudget)
                * (1 - (gravityBias * 0.12))
                * (1 + (recoveryShootBias * 0.035)),
                0.72,
                1.12,
            ),
            scale: clamp(
                lerp(0.78, 1.1, canopyBudget)
                * (1 + (recoveryShootBias * 0.05)),
                0.66,
                1.12,
            ),
            presence: clamp(lerp(0.66, 1.06, canopyBudget), 0.58, 1.08),
            flowerPresence: clamp(lerp(0.48, 1.08, canopyBudget), 0.42, 1.1),
            gravityTilt: clamp(gravityBias * 0.14, 0, 0.18),
        };
    }
    return {
        dist: clamp(
            lerp(0.52, 1, reveal)
            * lerp(1.02, 0.78, roleNorm)
            * lerp(0.78, 1.06, canopyBudget)
            * (1 - (gravityBias * 0.12)),
            0.34,
            1.08,
        ),
        scale: clamp(
            lerp(0.44, 1, reveal)
            * lerp(1.04, 0.82, roleNorm)
            * lerp(0.76, 1.08, canopyBudget)
            * (1 + (recoveryShootBias * 0.05)),
            0.24,
            1.08,
        ),
        presence: clamp(lerp(0.62, 1.06, canopyBudget), 0.54, 1.08),
        flowerPresence: clamp(lerp(0.44, 1.08, canopyBudget), 0.38, 1.1),
        gravityTilt: clamp(gravityBias * lerp(0.06, 0.16, roleNorm), 0, 0.2),
    };
};

const resolveTerminalReachScale = (terminalScales = {}, terminal = {}) => {
    const base = Number(terminalScales.dist);
    const safeBase = Number.isFinite(base) ? base : 1;
    const minimumReach = terminal?.type === 'flower' ? 0.68 : 0.56;
    return clamp(safeBase, minimumReach, 1.12);
};

export const resolveZenBonsaiBranchWidthProfile = ({
    role = ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD,
    width = 0,
    roleNorm = 0,
    childBranchCount = 0,
    terminalCount = 0,
} = {}) => {
    const baseWidth = Math.max(0.01, Number(width) || 0.01);
    const safeRoleNorm = clamp01(roleNorm);
    const hasChildBranch = Number(childBranchCount) > 0;
    const hasTerminals = Number(terminalCount) > 0;
    const terminalEnd = !hasChildBranch && hasTerminals;
    const bareEnd = !hasChildBranch && !hasTerminals;

    const profile = (() => {
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            return ZEN_BONSAI_BRANCH_TAPER_PROFILES.TRUNK_CONTINUATION;
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
            return terminalEnd || bareEnd
                ? ZEN_BONSAI_BRANCH_TAPER_PROFILES.TERMINAL_SPUR
                : ZEN_BONSAI_BRANCH_TAPER_PROFILES.TWIG_FRONTIER;
        }
        return terminalEnd || bareEnd
            ? ZEN_BONSAI_BRANCH_TAPER_PROFILES.TWIG_FRONTIER
            : ZEN_BONSAI_BRANCH_TAPER_PROFILES.SCAFFOLD_CONTINUATION;
    })();

    const shoulderRatio = (() => {
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            return lerp(0.9, 0.76, safeRoleNorm);
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
            return lerp(0.72, 0.54, safeRoleNorm);
        }
        return lerp(0.82, 0.62, safeRoleNorm);
    })();

    const tipRatio = (() => {
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK) {
            return lerp(hasChildBranch ? 0.76 : 0.64, hasChildBranch ? 0.52 : 0.42, safeRoleNorm);
        }
        if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
            return terminalEnd || bareEnd
                ? lerp(0.34, 0.18, safeRoleNorm)
                : lerp(0.48, 0.3, safeRoleNorm);
        }
        return terminalEnd || bareEnd
            ? lerp(0.46, 0.28, safeRoleNorm)
            : lerp(0.62, 0.4, safeRoleNorm);
    })();

    const floor = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
        ? 0.045
        : (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 0.16 : 0.08);
    const tipWidth = Math.max(floor, baseWidth * tipRatio);
    const shoulderWidth = Math.max(tipWidth, baseWidth * shoulderRatio);
    return Object.freeze({
        profile,
        baseWidth: round(baseWidth),
        shoulderT: role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK ? 0.72 : 0.64,
        shoulderWidth: round(shoulderWidth),
        tipStartT: role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.78 : 0.82,
        tipWidth: round(tipWidth),
        terminalEnd,
        bareEnd,
    });
};

const makeTerminalContinuityStats = () => ({
    generatedNodes: 0,
    visibleNodes: 0,
    generatedEnds: {
        trunk: 0,
        scaffold: 0,
        twig: 0,
    },
    visibleBareEnds: {
        trunk: 0,
        scaffold: 0,
        twig: 0,
    },
    visibleTerminalEnds: {
        trunk: 0,
        scaffold: 0,
        twig: 0,
    },
    hiddenFrontierEnds: {
        trunk: 0,
        scaffold: 0,
        twig: 0,
    },
    endpointKinds: Object.fromEntries(
        Object.values(ZEN_BONSAI_ENDPOINT_KINDS).map((kind) => [kind, 0]),
    ),
    trunkApexTransitionCount: 0,
    scaffoldTwigFrontierCount: 0,
    terminalTwigFrontierCount: 0,
    flowerCarrierCount: 0,
    flowerTerminalCount: 0,
    terminalCount: 0,
    terminalDistTotal: 0,
    flowerDistTotal: 0,
});

const freezeRoleCounts = (counts = {}) => Object.freeze({
    trunk: counts.trunk || 0,
    scaffold: counts.scaffold || 0,
    twig: counts.twig || 0,
});

const freezeEndpointKindCounts = (counts = {}) => Object.freeze(
    Object.fromEntries(
        Object.values(ZEN_BONSAI_ENDPOINT_KINDS).map((kind) => [kind, counts[kind] || 0]),
    ),
);

const resolveEndpointKind = ({
    role,
    visibleChildCount = 0,
    hiddenChildCount = 0,
    projectedTerminals = [],
    projected = {},
    plan = null,
    depth = 1,
} = {}) => {
    if (visibleChildCount > 0) {
        return ZEN_BONSAI_ENDPOINT_KINDS.STRUCTURAL_CONTINUATION;
    }
    const terminals = Array.isArray(projectedTerminals) ? projectedTerminals : [];
    if (terminals.length > 0) {
        const flowerCount = terminals.filter((terminal) => terminal?.type === 'flower').length;
        const leafCount = terminals.filter((terminal) => terminal?.type === 'leaf').length;
        if (flowerCount > 0 && leafCount > 0) {
            return ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_MIXED;
        }
        if (flowerCount > 0) {
            return ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_FLOWER;
        }
        if (leafCount > 0) {
            return ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_LEAF;
        }
        return ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_MIXED;
    }
    if (hiddenChildCount > 0) {
        return ZEN_BONSAI_ENDPOINT_KINDS.HIDDEN_FRONTIER;
    }
    if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
        return ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_SPUR;
    }
    if (
        plan?.active === true
        && clamp01(plan.growthTipScale) > 0
        && depth >= Math.max(1, (Number(plan.visibleDepth) || 1) - 1)
    ) {
        return ZEN_BONSAI_ENDPOINT_KINDS.GROWTH_TIP;
    }
    return ZEN_BONSAI_ENDPOINT_KINDS.STRUCTURAL_BARE;
};

export const collectZenBonsaiTerminalContinuityStats = (node = null, {
    growthPlan = null,
} = {}) => {
    const plan = resolveNormalizedProjection(growthPlan);
    const stats = makeTerminalContinuityStats();

    const walk = (rawNode = null, depth = 1, ancestorVisible = true) => {
        if (!rawNode || rawNode.type !== 'branch') {
            return;
        }
        const role = resolveZenBonsaiGrowthNodeRole(rawNode);
        const branches = Array.isArray(rawNode.branches) ? rawNode.branches : [];
        const terminals = Array.isArray(rawNode.terminals) ? rawNode.terminals : [];
        const generatedEnd = branches.length <= 0;
        stats.generatedNodes += 1;
        if (generatedEnd) {
            stats.generatedEnds[role] += 1;
        }

        const visible = ancestorVisible && shouldRenderZenBonsaiGrowthNode(plan, rawNode, depth);
        const childVisibility = branches.map((child) => (
            visible && shouldRenderZenBonsaiGrowthNode(plan, child?.obj, depth + 1)
        ));
        const visibleChildCount = childVisibility.filter(Boolean).length;
        const hiddenChildCount = visible
            ? childVisibility.filter((childVisible) => !childVisible).length
            : 0;

        if (visible) {
            const projected = projectZenBonsaiGrowthNode(rawNode, plan, depth);
            const projectedTerminals = Array.isArray(projected.terminals) ? projected.terminals : terminals;
            const projectedTerminalCount = projectedTerminals.length;
            const projectedFlowers = projectedTerminals.filter((terminal) => terminal?.type === 'flower');
            stats.visibleNodes += 1;
            stats.terminalCount += projectedTerminalCount;
            stats.flowerTerminalCount += projectedFlowers.length;
            projectedTerminals.forEach((terminal) => {
                stats.terminalDistTotal += Math.max(0, Number(terminal?.dist) || 0);
            });
            projectedFlowers.forEach((terminal) => {
                stats.flowerDistTotal += Math.max(0, Number(terminal?.dist) || 0);
            });
            if (projectedFlowers.length) {
                stats.flowerCarrierCount += 1;
            }
            if (visibleChildCount <= 0) {
                const endpointKind = resolveEndpointKind({
                    role,
                    visibleChildCount,
                    hiddenChildCount,
                    projectedTerminals,
                    projected,
                    plan,
                    depth,
                });
                stats.endpointKinds[endpointKind] += 1;
                if (projectedTerminalCount > 0) {
                    stats.visibleTerminalEnds[role] += 1;
                }
                if (endpointKind === ZEN_BONSAI_ENDPOINT_KINDS.STRUCTURAL_BARE) {
                    stats.visibleBareEnds[role] += 1;
                }
                if (endpointKind === ZEN_BONSAI_ENDPOINT_KINDS.HIDDEN_FRONTIER) {
                    stats.hiddenFrontierEnds[role] += 1;
                }
                if (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG) {
                    stats.terminalTwigFrontierCount += 1;
                }
            } else {
                stats.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.STRUCTURAL_CONTINUATION] += 1;
            }
            if (
                role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
                && branches.some((child, index) => (
                    childVisibility[index]
                    && resolveZenBonsaiGrowthNodeRole(child?.obj) !== ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
                ))
            ) {
                stats.trunkApexTransitionCount += 1;
            }
            if (
                role === ZEN_BONSAI_GROWTH_NODE_ROLES.SCAFFOLD
                && branches.some((child, index) => (
                    childVisibility[index]
                    && resolveZenBonsaiGrowthNodeRole(child?.obj) === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG
                ))
            ) {
                stats.scaffoldTwigFrontierCount += 1;
            }
        }

        branches.forEach((child, index) => {
            walk(child?.obj, depth + 1, visible && childVisibility[index]);
        });
    };

    walk(node, 1, true);
    return Object.freeze({
        generatedNodes: stats.generatedNodes,
        visibleNodes: stats.visibleNodes,
        generatedEnds: freezeRoleCounts(stats.generatedEnds),
        visibleBareEnds: freezeRoleCounts(stats.visibleBareEnds),
        visibleTerminalEnds: freezeRoleCounts(stats.visibleTerminalEnds),
        hiddenFrontierEnds: freezeRoleCounts(stats.hiddenFrontierEnds),
        endpointKinds: freezeEndpointKindCounts(stats.endpointKinds),
        trunkApexTransitionCount: stats.trunkApexTransitionCount,
        scaffoldTwigFrontierCount: stats.scaffoldTwigFrontierCount,
        terminalTwigFrontierCount: stats.terminalTwigFrontierCount,
        flowerCarrierCount: stats.flowerCarrierCount,
        flowerTerminalCount: stats.flowerTerminalCount,
        terminalCount: stats.terminalCount,
        meanTerminalDist: round(stats.terminalDistTotal / Math.max(1, stats.terminalCount)),
        meanFlowerDist: round(stats.flowerDistTotal / Math.max(1, stats.flowerTerminalCount)),
    });
};

export const projectZenBonsaiGrowthNode = (node = {}, growthPlan = null, traversalDepth = 1) => {
    const plan = resolveNormalizedProjection(growthPlan);
    if (plan.active !== true) {
        return node;
    }
    const scales = resolveZenBonsaiSegmentGrowthScales(plan, node, traversalDepth);
    const terminalScales = resolveZenBonsaiTerminalGrowthScales(plan, node, traversalDepth);
    const structural = resolveNodeStructuralProjection(plan, node, traversalDepth);
    const role = resolveZenBonsaiGrowthNodeRole(node);
    const nodeKey = resolveNodeGrowthKey(node, traversalDepth);
    const roleWeight = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
        ? 0.48
        : (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.72 : 1);
    const roleDepth = resolveNodeRoleDepth(node, traversalDepth);
    const roleLimit = resolveNodeRoleLimit(node, traversalDepth);
    const roleNorm = clamp01((roleDepth - 1) / Math.max(1, roleLimit - 1));
    const curveSign = hashUnit(`${nodeKey}|structural_imprint_sign`) >= 0.5 ? 1 : -1;
    const length = (Number(node?.length) || 0) * scales.length;
    const kinkPressure = clamp01(structural.kinkPressure ?? plan.kinkPressure);
    const gravityBias = clamp01(structural.gravityBias ?? plan.gravityBias);
    const canopyBudget = clamp(structural.canopyBudget ?? plan.canopyBudget ?? 1, 0.34, 1);
    const curveImpulse = length * roleWeight * (
        (curveSign * kinkPressure * 0.13)
        + (gravityBias * 0.095)
    );
    const structuralAngleOffset = (
        (gravityBias * roleWeight * lerp(0.018, 0.075, roleNorm))
        + (curveSign * kinkPressure * roleWeight * lerp(0.006, 0.026, roleNorm))
    );
    const terminals = Array.isArray(node?.terminals)
        ? node.terminals.map((terminal) => ({
            ...terminal,
            angle: Number.isFinite(Number(terminal?.angle))
                ? Number(terminal.angle) + (terminalScales.gravityTilt * lerp(0.45, 1, roleNorm))
                : terminal?.angle,
            dist: Number.isFinite(Number(terminal?.dist))
                ? Number(terminal.dist) * resolveTerminalReachScale(terminalScales, terminal)
                : terminal?.dist,
            scale: Number.isFinite(Number(terminal?.scale))
                ? Number(terminal.scale) * terminalScales.scale
                : terminal?.scale,
            structuralCanopyBudget: canopyBudget,
            structuralPresenceScale: terminalScales.presence,
            structuralFlowerPresenceScale: terminalScales.flowerPresence,
            structuralGravityTilt: terminalScales.gravityTilt,
        }))
        : node?.terminals;
    const widthFloor = role === ZEN_BONSAI_GROWTH_NODE_ROLES.TRUNK
        ? 0.28
        : (role === ZEN_BONSAI_GROWTH_NODE_ROLES.TWIG ? 0.1 : 0.16);
    const width = Math.max(widthFloor, (Number(node?.width) || 0) * scales.width);
    const widthProfile = resolveZenBonsaiBranchWidthProfile({
        role,
        width,
        roleNorm,
        childBranchCount: Array.isArray(node?.branches) ? node.branches.length : 0,
        terminalCount: Array.isArray(terminals) ? terminals.length : 0,
    });
    const projectCurve = (value = 0, weight = 1) => (
        Number.isFinite(Number(value))
            ? Number(value) + (curveImpulse * weight)
            : value
    );
    const projectedCurve = projectCurve(node?.curve, 0.74);
    const projectedCurveIn = projectCurve(node?.curveIn, 0.38);
    const projectedCurveOut = projectCurve(node?.curveOut, 1.14);
    const exactCubicControl = node?.exactCubicControl
        ? {
            ...node.exactCubicControl,
            cp1Along: Number(node.exactCubicControl.cp1Along) * scales.length,
            cp1Normal: projectedCurveIn,
            cp2Along: Number(node.exactCubicControl.cp2Along) * scales.length,
            cp2Normal: projectedCurveOut,
        }
        : null;
    return {
        ...node,
        length,
        width,
        widthProfile,
        angle: Number.isFinite(Number(node?.angle))
            ? Number(node.angle) + structuralAngleOffset
            : node?.angle,
        curve: projectedCurve,
        curveIn: projectedCurveIn,
        curveOut: projectedCurveOut,
        ...(exactCubicControl ? { exactCubicControl } : {}),
        terminals,
    };
};

export default resolveZenBonsaiGrowthProjection;
