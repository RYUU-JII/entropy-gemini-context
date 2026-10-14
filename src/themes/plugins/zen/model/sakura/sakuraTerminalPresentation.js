import {
    normalizeZenBonsaiGrowthProjection,
} from '../ZenBonsaiGrowthProjection.js';
import {
    normalizeZenBonsaiActivationPresentation,
    resolveZenBonsaiActivationPresentationSignal,
} from '../bonsai/presentation/ZenBonsaiActivationPresentation.js';
import {
    resolveSakuraLifeAppearanceProfile,
    resolveSakuraLifeMood,
} from './sakuraLifeMood.js';
import { clamp, lerp } from './sakuraMath.js';
import { SAKURA_TERMINAL_PAINT_METRICS } from './sakuraRenderPaintMetrics.js';

const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const SAKURA_BLOOM_STAGES = new Set(['bud', 'half_open', 'full']);

export const resolveSakuraTerminalRenderDistance = (terminal = {}, lifeVisual = null) => {
    const distance = Number.isFinite(Number(terminal?.dist)) ? Number(terminal.dist) : 0;
    const reach = Number.isFinite(Number(lifeVisual?.reach))
        ? clamp(
            Number(lifeVisual.reach),
            0.36,
            SAKURA_TERMINAL_PAINT_METRICS.maximumReach,
        )
        : 1;
    const projected = distance * reach;
    const lineagedDevelopment = terminal?.classic2Development?.lineage === true;
    if (distance > 0 && terminal?.type === 'flower' && !lineagedDevelopment) {
        return Math.max(projected, 3.4 * clamp(reach, 0.72, 1));
    }
    return projected;
};

export const resolveSakuraTerminalDisplayScale = (terminal = {}, lifeVisual = null) => {
    const baseScale = (Number(terminal?.scale) || 1) * clamp(
        Number(lifeVisual?.scale ?? 1),
        0.05,
        SAKURA_TERMINAL_PAINT_METRICS.maximumLifeScale,
    );
    if (terminal?.type !== 'flower') {
        return baseScale;
    }
    if (terminal?.classic2Development?.lineage === true) {
        return baseScale;
    }
    const minimumScale = Number.isFinite(Number(lifeVisual?.minimumScale))
        ? clamp(Number(lifeVisual.minimumScale), 0, 0.82)
        : 0;
    return Math.max(baseScale, minimumScale);
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

export const resolveSakuraActivationBloomStage = ({
    structuralStage,
    activationPresentation = null,
    cohort = 0,
    lifeGrowth = 1,
} = {}) => {
    if (!SAKURA_BLOOM_STAGES.has(structuralStage)) {
        throw new Error('ZEN_SAKURA_ACTIVATION_BLOOM_STAGE_INVALID');
    }
    const activation = normalizeZenBonsaiActivationPresentation(activationPresentation);
    if (!activation) {
        return structuralStage;
    }
    const normalizedCohort = Number(cohort);
    if (!Number.isFinite(normalizedCohort) || normalizedCohort < 0 || normalizedCohort > 1) {
        throw new Error('ZEN_SAKURA_ACTIVATION_BLOOM_COHORT_INVALID');
    }
    const normalizedGrowth = Number(lifeGrowth);
    if (!Number.isFinite(normalizedGrowth) || normalizedGrowth < 0 || normalizedGrowth > 1) {
        throw new Error('ZEN_SAKURA_ACTIVATION_BLOOM_GROWTH_INVALID');
    }
    const activationSignal = resolveZenBonsaiActivationPresentationSignal(activation);
    const matureOpenCohort = clamp(
        0.16 + (0.86 * (activationSignal ** 1.2)),
        0.16,
        0.96,
    );
    const growthReadiness = smoothstep01((normalizedGrowth - 0.82) / 0.17);
    const earlyDevelopmentScale = lerp(0.63, 0.66, activationSignal);
    const developmentScale = lerp(earlyDevelopmentScale, 1, growthReadiness);
    const openCohort = matureOpenCohort * developmentScale;
    if (structuralStage === 'bud') {
        const budOpeningPressure = smoothstep01((activationSignal - 0.38) / 0.54);
        const budHalfOpenCohort = Math.min(
            matureOpenCohort * 0.6,
            0.12 + (budOpeningPressure * 0.42),
        );
        return normalizedCohort <= budHalfOpenCohort ? 'half_open' : 'bud';
    }
    if (normalizedCohort > openCohort) {
        return 'bud';
    }
    if (structuralStage === 'half_open') {
        const halfOpenFullCohort = openCohort
            * smoothstep01((activationSignal - 0.52) / 0.44)
            * 0.72;
        return normalizedCohort <= halfOpenFullCohort
            ? 'full'
            : 'half_open';
    }
    const fullOpeningPressure = smoothstep01((activationSignal - 0.42) / 0.5);
    const fullCohort = openCohort * fullOpeningPressure;
    return normalizedCohort <= fullCohort
        ? 'full'
        : 'half_open';
};

/**
 * Builds the terminal-presentation inputs shared by paint and render bounds.
 * Keeping this projection here prevents camera fit from inventing a second
 * growth/life visibility policy.
 */
export const resolveSakuraTerminalPresentationContext = ({
    lifeState = null,
    activationPresentation = null,
    growthProjection = null,
} = {}) => {
    const hasLifeState = Boolean(lifeState && typeof lifeState === 'object');
    const lifeGrowth = hasLifeState
        ? clamp(Number.isFinite(Number(lifeState.growth)) ? Number(lifeState.growth) : 1, 0.16, 1)
        : 1;
    const lifeVitality = hasLifeState ? clamp01(lifeState.vitality ?? 0.78) : 1;
    const lifeMood = resolveSakuraLifeMood(lifeState);
    const growthPlan = normalizeZenBonsaiGrowthProjection(growthProjection);
    const growthPlanActive = growthPlan.active === true;
    const imprintGravityBias = growthPlanActive ? clamp01(growthPlan.gravityBias ?? 0) : 0;
    const imprintCanopyBudget = growthPlanActive
        ? clamp(growthPlan.canopyBudget ?? 1, 0.34, 1)
        : 1;
    const projectedLifeGrowth = growthPlanActive
        ? Math.max(lifeGrowth, growthPlan.terminalGrowthFloor)
        : lifeGrowth;
    const lifeAppearance = resolveSakuraLifeAppearanceProfile(lifeState, {
        activationPresentation,
        growth: lifeGrowth,
        projectedGrowth: projectedLifeGrowth,
        leafDensityFloor: growthPlanActive
            ? Math.max(0.08, growthPlan.leafDensityFloor * lerp(0.62, 1.08, imprintCanopyBudget))
            : 0.035,
        flowerGateScale: growthPlanActive
            ? growthPlan.flowerGateScale * lerp(0.56, 1.1, imprintCanopyBudget)
            : 1,
        bloomDevelopmentFloor: growthPlanActive
            ? growthPlan.bloomDevelopmentFloor
            : 0,
        miniatureBloomScale: growthPlanActive
            ? growthPlan.miniatureBloomScale
            : 1,
    });

    return Object.freeze({
        activationPresentation,
        growthPlan,
        growthPlanActive,
        imprintGravityBias,
        lifeAppearance,
        lifeGrowth,
        lifeLeafDensity: lifeAppearance.leafPresence,
        lifeMood,
        lifeVitality,
        effectiveBloom: lifeAppearance.flowerPresence,
    });
};

export const resolveSakuraTerminalLifeVisual = ({
    child = {},
    node = {},
    depth = 1,
    index = 0,
    presentationContext = null,
} = {}) => {
    const context = presentationContext || resolveSakuraTerminalPresentationContext();
    const {
        activationPresentation,
        effectiveBloom,
        growthPlan,
        growthPlanActive,
        lifeAppearance,
        lifeGrowth,
        lifeLeafDensity,
        lifeMood,
        lifeVitality,
    } = context;
    const key = [
        node?.nodeId || 'node',
        child?.type || 'terminal',
        depth,
        index,
        Number(child?.angle) || 0,
        Number(child?.dist) || 0,
        Number(child?.scale) || 1,
    ].join('|');
    const hasClassic2Lineage = child?.classic2Development?.lineage === true;
    const activationLineagedCarrier = hasClassic2Lineage
        && lifeAppearance.hasActivationPresentation;
    if (
        growthPlanActive
        && !activationLineagedCarrier
        && hashUnit(`${key}|terminal_reveal`) > clamp01(growthPlan.terminalReveal)
    ) {
        return null;
    }
    const classic2Age = Number(child?.classic2Development?.age);
    const hasClassic2Development = Number.isFinite(classic2Age);
    const developmentAge = hasClassic2Development ? clamp01(classic2Age) : 0;
    const growthGate = child?.type === 'flower'
        ? (hasClassic2Development
            ? lerp(0.54, 0.82, hashUnit(`${key}|flower_growth`))
            : lerp(0.68, 0.96, hashUnit(`${key}|flower_growth`)))
        : (hasClassic2Development
            ? lerp(0.28, 0.74, hashUnit(`${key}|leaf_growth`))
            : lerp(0.34, 0.9, hashUnit(`${key}|leaf_growth`)));
    const terminalRenderGrowth = Number(child?.classic2Development?.renderGrowth);
    const terminalGrowthSignal = Number.isFinite(terminalRenderGrowth)
        ? Math.max(lifeGrowth, clamp01(terminalRenderGrowth))
        : lifeGrowth;
    const growthScale = clamp((terminalGrowthSignal - (growthGate - 0.1)) / 0.18, 0, 1);
    const visibleGrowthScale = hasClassic2Lineage
        ? Math.max(
            growthScale,
            lerp(0.02, child?.type === 'flower' ? 0.74 : 0.66, developmentAge ** 2.2),
        )
        : (hasClassic2Development
            ? Math.max(
                growthScale,
                child?.type === 'flower'
                    ? lerp(0.3, 0.74, developmentAge)
                    : lerp(0.26, 0.66, developmentAge),
            )
            : growthScale);
    if (growthScale <= 0.02 && !activationLineagedCarrier) {
        if (!hasClassic2Development || visibleGrowthScale <= 0.02) {
            return null;
        }
    }
    if (child?.type === 'flower') {
        const flowerPresenceScale = growthPlanActive
            ? clamp(Number(child?.structuralFlowerPresenceScale ?? 1), 0.32, 1.12)
            : 1;
        if (hasClassic2Lineage && lifeAppearance.hasActivationPresentation) {
            return Object.freeze({
                scale: visibleGrowthScale * lifeAppearance.flowerScale,
                alpha: lifeAppearance.flowerAlpha,
                reach: clamp(0.78 + (visibleGrowthScale * 0.22), 0.72, 1.06),
                minimumScale: 0,
                presentationBloomStage: resolveSakuraActivationBloomStage({
                    structuralStage: child?.blossom?.bloomStage,
                    activationPresentation,
                    cohort: hashUnit(`${key}|activation_bloom_cohort`),
                    lifeGrowth,
                }),
            });
        }
        const developmentalBloomPresence = hasClassic2Development
            ? clamp(
                (
                    0.16
                    + (developmentAge * 0.42)
                    + ((growthPlanActive ? growthPlan.bloomDevelopmentFloor : 0) * 0.3)
                    + ((growthPlanActive ? growthPlan.terminalDevelopment : 0) * 0.1)
                ) * clamp(0.62 + (lifeVitality * 0.4) - (lifeMood.wither * 0.22), 0.42, 1),
                0,
                0.82,
            )
            : 0;
        if (hashUnit(`${key}|bloom_presence`) > clamp01(Math.max(
            effectiveBloom * flowerPresenceScale,
            developmentalBloomPresence,
        ))) {
            return null;
        }
        return Object.freeze({
            scale: visibleGrowthScale * lifeAppearance.flowerScale,
            alpha: lifeAppearance.flowerAlpha,
            reach: clamp(0.78 + (visibleGrowthScale * 0.22), 0.72, 1.06),
            minimumScale: hasClassic2Lineage
                ? 0
                : (hasClassic2Development
                    ? lerp(0.38, 0.64, developmentAge)
                    : (growthPlanActive
                        ? clamp(growthPlan.miniatureBloomScale * 0.82, 0.22, 0.5)
                        : 0)),
        });
    }
    const leafPresenceScale = growthPlanActive
        ? clamp(Number(child?.structuralPresenceScale ?? 1), 0.48, 1.1)
        : 1;
    if (hashUnit(`${key}|leaf_presence`) > clamp01(lifeLeafDensity * leafPresenceScale)) {
        return null;
    }
    return Object.freeze({
        scale: visibleGrowthScale * lifeAppearance.leafScale,
        alpha: lifeAppearance.leafAlpha,
        reach: clamp(0.64 + (visibleGrowthScale * 0.36), 0.54, 1.06),
    });
};
