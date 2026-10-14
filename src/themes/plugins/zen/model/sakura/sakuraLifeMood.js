import { clamp } from './sakuraMath';
import {
    normalizeZenBonsaiActivationPresentation,
} from '../bonsai/presentation/ZenBonsaiActivationPresentation.js';
import { SAKURA_TERMINAL_PAINT_METRICS } from './sakuraRenderPaintMetrics.js';

const clamp01 = (value) => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, 0, 1);
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
const lerp = (from, to, amount) => from + ((to - from) * clamp01(amount));

const resolveActivationAppearance = (candidate = null) => {
    const activation = normalizeZenBonsaiActivationPresentation(candidate);
    if (!activation) {
        return Object.freeze({
            hasActivationPresentation: false,
            activationRatio: null,
            activationBand: null,
            activationReliability: null,
            activationExpressionStrength: 0,
            leafScaleFactor: 1,
            flowerScaleFactor: 1,
            leafSaturation: 1,
            flowerSaturation: 1,
            terminalBrightness: 1,
            leafTilt: 0,
            activationDroop: 0,
            budSwelling: 1,
            blossomOpenness: 1,
            tipBudScale: 1,
            tipBudAlpha: 1,
            recoveryAccent: 0,
        });
    }

    const ratio = activation.ratio;
    const expressionStrength = lerp(0.58, 1, activation.reliability);
    const centered = (ratio - 0.5) * 2;
    const quietPressure = smoothstepRange(1 - ratio, 0.42, 0.82);
    const highLift = smoothstepRange(ratio, 0.48, 0.92);
    return Object.freeze({
        hasActivationPresentation: true,
        activationRatio: ratio,
        activationBand: activation.band,
        activationReliability: activation.reliability,
        activationExpressionStrength: expressionStrength,
        leafScaleFactor: clamp(1 + (centered * 0.26 * expressionStrength), 0.66, 1.34),
        flowerScaleFactor: clamp(1 + (centered * 0.14 * expressionStrength), 0.82, 1.18),
        leafSaturation: clamp(1 + (centered * 0.5 * expressionStrength), 0.5, 1.5),
        flowerSaturation: clamp(1 + (centered * 0.34 * expressionStrength), 0.64, 1.36),
        terminalBrightness: clamp(1 + (centered * 0.14 * expressionStrength), 0.86, 1.14),
        leafTilt: clamp(
            (quietPressure * 0.2 * expressionStrength) - (highLift * 0.06 * expressionStrength),
            -0.065,
            0.21,
        ),
        activationDroop: clamp01(quietPressure * 0.2 * expressionStrength),
        budSwelling: clamp(1 + (centered * 0.3 * expressionStrength), 0.64, 1.34),
        blossomOpenness: clamp(
            0.82 + (ratio * 0.28 * expressionStrength),
            0.8,
            SAKURA_TERMINAL_PAINT_METRICS.maximumFlowerBloomScale,
        ),
        tipBudScale: clamp(0.62 + (ratio * 0.82 * expressionStrength), 0.62, 1.44),
        tipBudAlpha: clamp(0.54 + (ratio * 0.44 * expressionStrength), 0.54, 0.98),
        recoveryAccent: clamp01(highLift * expressionStrength),
    });
};

export const resolveSakuraLifeMood = (lifeState = null) => {
    const hasLifeState = Boolean(lifeState && typeof lifeState === 'object');
    if (!hasLifeState) {
        return {
            hasLifeState: false,
            vitality: 1,
            stress: 0,
            bloom: 1,
            dryness: 0,
            branchSag: 0,
            windResponse: 1,
            analysisConfidence: 1,
            wither: 0,
            recoveryGlow: 0.54,
            floorDebris: 0,
            shadowWeight: 1,
            ambientDim: 0,
            petalLoss: 0,
            leafFade: 0,
        };
    }

    const vitality = clamp01(lifeState.vitality ?? 0.78);
    const stress = clamp01(lifeState.stress ?? (1 - vitality));
    const bloom = clamp01(lifeState.bloom ?? vitality);
    const dryness = clamp01(lifeState.dryness ?? 0);
    const branchSag = clamp01(lifeState.branchSag ?? 0);
    const windResponse = clamp(Number.isFinite(Number(lifeState.windResponse)) ? Number(lifeState.windResponse) : vitality, 0.18, 1.08);
    const analysisConfidence = clamp01(lifeState.analysisConfidence ?? 1);
    const wither = clamp01(analysisConfidence * (
        (dryness * 0.58)
        + (stress * 0.28)
        + ((1 - vitality) * 0.18)
        + (branchSag * 0.12)
    ));
    const petalLoss = clamp01(analysisConfidence * (
        ((1 - bloom) * 0.58)
        + (dryness * 0.24)
        + (stress * 0.18)
    ));
    const recoveryGlow = clamp01(analysisConfidence * (
        (vitality * 0.46)
        + (bloom * 0.3)
        + (windResponse * 0.16)
        - (wither * 0.34)
    ));
    const floorDebris = clamp01(
        (wither * 0.74)
        + (petalLoss * 0.28)
        - (recoveryGlow * 0.12),
    );

    return {
        hasLifeState,
        vitality,
        stress,
        bloom,
        dryness,
        branchSag,
        windResponse,
        analysisConfidence,
        wither,
        recoveryGlow,
        floorDebris,
        shadowWeight: clamp(1 + (wither * 0.58) - (recoveryGlow * 0.18), 0.76, 1.52),
        ambientDim: clamp01((wither * 0.5) + (stress * 0.14)),
        petalLoss,
        leafFade: clamp01((dryness * 0.46) + (stress * 0.18) + ((1 - vitality) * 0.16)),
    };
};

export const resolveSakuraBloomDevelopmentGate = ({
    projectedGrowth = 1,
    bloomDevelopmentFloor = 0,
} = {}) => {
    const lateGrowthGate = clamp((projectedGrowth - 0.58) / 0.38, 0, 1);
    return clamp(Math.max(lateGrowthGate, clamp01(bloomDevelopmentFloor)), 0, 1);
};

export const resolveSakuraLifeAppearanceProfile = (lifeState = null, options = {}) => {
    const mood = resolveSakuraLifeMood(lifeState);
    const activationAppearance = resolveActivationAppearance(options.activationPresentation);
    const lifeGrowth = clamp(
        Number.isFinite(Number(options.growth))
            ? Number(options.growth)
            : (Number.isFinite(Number(lifeState?.growth)) ? Number(lifeState.growth) : 1),
        0.16,
        1,
    );
    const projectedGrowth = clamp(
        Number.isFinite(Number(options.projectedGrowth)) ? Number(options.projectedGrowth) : lifeGrowth,
        0.16,
        1,
    );
    const leafDensityFloor = clamp(
        Number.isFinite(Number(options.leafDensityFloor)) ? Number(options.leafDensityFloor) : 0.035,
        0,
        0.28,
    );
    const flowerGateScale = clamp(
        Number.isFinite(Number(options.flowerGateScale)) ? Number(options.flowerGateScale) : 1,
        0,
        1.2,
    );
    const bloomDevelopmentFloor = clamp01(options.bloomDevelopmentFloor ?? 0);
    const miniatureBloomScale = clamp(
        Number.isFinite(Number(options.miniatureBloomScale)) ? Number(options.miniatureBloomScale) : 1,
        0.18,
        1,
    );
    const growthLeafScale = clamp(0.5 + (projectedGrowth * 0.5), 0.12, 1);
    const growthBloomGate = resolveSakuraBloomDevelopmentGate({
        projectedGrowth,
        bloomDevelopmentFloor,
    });
    const vitalityBloomFloor = clamp01(
        bloomDevelopmentFloor
        * smoothstepRange(mood.vitality, 0.82, 0.98),
    );
    const leafPresence = clamp(
        (
            0.28
            + (mood.vitality * 0.68)
            - (mood.dryness * 0.32)
            - (mood.leafFade * 0.26)
            - (mood.wither * 0.18)
        ) * growthLeafScale,
        leafDensityFloor,
        1,
    );
    const bloomPresenceCore = Math.max(
        mood.bloom
        * mood.analysisConfidence
        * growthBloomGate
        * flowerGateScale,
        vitalityBloomFloor,
    );
    const flowerPresence = clamp01(
        bloomPresenceCore
        * (1 - (mood.petalLoss * 0.72))
        * (1 - (mood.wither * 0.18))
    );
    const blossomWilt = clamp01(
        (mood.petalLoss * 0.62)
        + (mood.dryness * 0.24)
        + (mood.wither * 0.2)
    );
    const structuralDryness = clamp01((mood.wither - 0.16) / 0.84);

    return {
        ...mood,
        ...activationAppearance,
        recoveryGlow: clamp01(mood.recoveryGlow + (activationAppearance.recoveryAccent * 0.18)),
        leafPresence,
        flowerPresence,
        leafAlpha: clamp(
            0.56 + (mood.vitality * 0.34) - (mood.leafFade * 0.18) - (mood.wither * 0.08),
            0.38,
            1,
        ),
        flowerAlpha: clamp(
            0.72 + (mood.vitality * 0.25) - (mood.petalLoss * 0.08) - (mood.wither * 0.05),
            0.56,
            1,
        ),
        leafScale: clamp(
            (0.72 + (mood.vitality * 0.3))
            * (1 - (mood.wither * 0.18))
            * activationAppearance.leafScaleFactor,
            0.32,
            1.18,
        ),
        flowerScale: clamp(
            (0.58 + (mood.vitality * 0.46))
            * miniatureBloomScale
            * (1 - (mood.wither * 0.24))
            * activationAppearance.flowerScaleFactor,
            0.16,
            1.2,
        ),
        bloomDevelopmentGate: growthBloomGate,
        bloomDevelopmentFloor,
        vitalityBloomFloor,
        miniatureBloomScale,
        blossomWilt,
        terminalDroop: clamp01(
            (mood.branchSag * 0.76)
            + (mood.wither * 0.28)
            + activationAppearance.activationDroop,
        ),
        branchWidthScale: clamp(1 - (mood.dryness * 0.07) - (structuralDryness * 0.09), 0.84, 1),
        barkDryness: clamp01((mood.wither * 0.82) + (mood.dryness * 0.18)),
        barkTextureScale: clamp(1 + (mood.wither * 0.82) + (mood.dryness * 0.18), 1, 1.82),
        pedicelDryness: clamp01((blossomWilt * 0.58) + (mood.wither * 0.22)),
        runtimeBranchDryTint: clamp01((mood.wither * 0.48) + (mood.dryness * 0.08)),
        runtimeFoliageDryTint: clamp01((mood.wither * 0.1) + (mood.leafFade * 0.08)),
        runtimeBackAlpha: clamp(1 - (mood.wither * 0.045), 0.94, 1),
        runtimeFrontAlpha: clamp(1 - (mood.wither * 0.06), 0.92, 1),
        runtimeBranchAlpha: clamp(1 - (mood.wither * 0.14), 0.84, 1),
    };
};

export default resolveSakuraLifeMood;
