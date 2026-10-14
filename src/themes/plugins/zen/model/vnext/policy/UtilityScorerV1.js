import {
    listFactorMapEntriesV1,
} from '../factors/FactorMapV1';
import {
    VNEXT_FACTOR_TRANSFORM,
    getDefaultFactorVectorV1,
    getFactorSchemaDefV1,
    normalizeFactorVectorV1,
} from '../factors/FactorSchemaV1';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const safeAbs = (value) => Math.abs(Number.isFinite(value) ? value : 0);

const setPath = (target, path, value) => {
    if (!target || typeof target !== 'object' || typeof path !== 'string' || !path.trim()) {
        return;
    }
    const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
    if (!segments.length) {
        return;
    }
    let cursor = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        const next = cursor[key];
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
};

const getPath = (target, path, fallback = undefined) => {
    if (!target || typeof target !== 'object' || typeof path !== 'string' || !path.trim()) {
        return fallback;
    }
    const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
    let cursor = target;
    for (let index = 0; index < segments.length; index += 1) {
        const key = segments[index];
        if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) {
            return fallback;
        }
        cursor = cursor[key];
    }
    return cursor;
};

const resolveNormalized01FromSchema = (key, value) => {
    const def = getFactorSchemaDefV1(key);
    if (!def) {
        return clamp01(Number(value));
    }
    const span = Math.max(1e-9, Number(def.max) - Number(def.min));
    const normalized = (Number(value) - Number(def.min)) / span;
    return clamp01(normalized);
};

export const resolveTransformedFactorValueV1 = (key, normalizedFactorValue) => {
    const def = getFactorSchemaDefV1(key);
    if (!def) {
        return clamp01(Number(normalizedFactorValue));
    }
    const normalized01 = resolveNormalized01FromSchema(key, normalizedFactorValue);
    switch (def.transform) {
        case VNEXT_FACTOR_TRANSFORM.CENTERED_LINEAR:
            return round((normalized01 * 2) - 1, 6);
        case VNEXT_FACTOR_TRANSFORM.SIGMOID: {
            const shifted = (normalized01 - 0.5) * 8;
            return round(1 / (1 + Math.exp(-shifted)), 6);
        }
        case VNEXT_FACTOR_TRANSFORM.PIECEWISE:
            // V1에서는 piecewise를 선형 근사로 처리한다.
            return round(normalized01, 6);
        case VNEXT_FACTOR_TRANSFORM.STEP:
            return Number.isFinite(Number(normalizedFactorValue))
                ? Math.round(Number(normalizedFactorValue))
                : Math.round(Number(def.default));
        case VNEXT_FACTOR_TRANSFORM.LINEAR:
        default:
            return round(normalized01, 6);
    }
};

export const resolveRuntimeParamsFromFactorsV1 = (inputFactors = {}) => {
    const factorVector = normalizeFactorVectorV1({
        ...getDefaultFactorVectorV1(),
        ...(inputFactors || {}),
    });
    const runtimeParams = {};
    const traceInputs = {};

    listFactorMapEntriesV1().forEach((entry) => {
        const factorValue = factorVector[entry.name];
        const transformed = resolveTransformedFactorValueV1(entry.name, factorValue);
        entry.affects.forEach((path) => {
            setPath(runtimeParams, path, transformed);
        });
        traceInputs[entry.traceKey] = transformed;
    });

    return {
        factorVector,
        runtimeParams,
        traceInputs,
    };
};

export const resolveUtilityWeightsV1 = ({ factorVector = {}, runtimeParams = {} } = {}) => {
    const wLightRaw = toNumber(
        getPath(runtimeParams, 'utility.weights.lightAlign'),
        clamp01(factorVector?.phototropism_gain),
    );
    const wSpaceRaw = toNumber(
        getPath(runtimeParams, 'utility.weights.spaceClearance'),
        clamp01(factorVector?.space_avoid_gain),
    );
    const wBalanceRaw = toNumber(
        getPath(runtimeParams, 'utility.weights.massBalance'),
        clamp01(factorVector?.mass_balance_gain),
    );
    const canopyBiasRaw = toNumber(
        getPath(runtimeParams, 'fieldPolicy.canopyEnvelopeBias'),
        0,
    );
    const cascadeRaw = toNumber(
        getPath(runtimeParams, 'stylePolicy.cascadeBias'),
        clamp01(factorVector?.cascade_bias),
    );
    const windsweptRaw = toNumber(
        getPath(runtimeParams, 'stylePolicy.windsweptBias'),
        0,
    );
    const collisionRaw = toNumber(
        getPath(runtimeParams, 'prunePolicy.collisionGain'),
        clamp01(factorVector?.collision_prune_gain),
    );

    const styleSignal = clamp01(
        (safeAbs(canopyBiasRaw) * 0.38)
        + (clamp01(cascadeRaw) * 0.34)
        + (safeAbs(windsweptRaw) * 0.28),
    );
    const continuitySignal = clamp01(
        (clamp01(factorVector?.apical_dominance) * 0.58)
        + (clamp01(factorVector?.trunk_taper_strength) * 0.42),
    );
    const resourceCostSignal = clamp01(
        (clamp01(factorVector?.branch_density) * 0.55)
        + (clamp01(factorVector?.branch_depth_budget) * 0.45),
    );

    const weights = {
        lightAlign: round(lerp(0.18, 0.72, wLightRaw), 6),
        spaceClearance: round(lerp(0.2, 0.78, wSpaceRaw), 6),
        styleAlign: round(lerp(0.16, 0.64, styleSignal), 6),
        massBalance: round(lerp(0.12, 0.58, wBalanceRaw), 6),
        continuity: round(lerp(0.2, 0.66, continuitySignal), 6),
        collisionPenalty: round(lerp(0.24, 0.86, collisionRaw), 6),
        resourceCostPenalty: round(lerp(0.14, 0.58, resourceCostSignal), 6),
    };

    return {
        ...weights,
        __meta: {
            styleSignal: round(styleSignal, 6),
            continuitySignal: round(continuitySignal, 6),
            resourceCostSignal: round(resourceCostSignal, 6),
        },
    };
};

const resolveTopContributions = (contributions = {}, {
    positive = true,
    limit = 3,
} = {}) => {
    const entries = Object.entries(contributions)
        .filter(([, value]) => (
            positive
                ? Number(value) > 0
                : Number(value) < 0
        ))
        .sort((a, b) => (
            positive
                ? Number(b[1]) - Number(a[1])
                : Number(a[1]) - Number(b[1])
        ))
        .slice(0, Math.max(1, Math.floor(limit)));
    return entries.map(([key, value]) => ({
        key,
        value: round(Number(value), 6),
    }));
};

export const scoreUtilityV1 = ({
    factors = {},
    runtime = null,
    signals = {},
    penalties = {},
    noiseEpsilon = 0,
} = {}) => {
    const resolvedRuntime = runtime && typeof runtime === 'object'
        ? runtime
        : resolveRuntimeParamsFromFactorsV1(factors);
    const factorVector = resolvedRuntime.factorVector || normalizeFactorVectorV1(factors);
    const runtimeParams = resolvedRuntime.runtimeParams || {};
    const weights = resolveUtilityWeightsV1({
        factorVector,
        runtimeParams,
    });

    const lightAlign = clamp01(toNumber(signals?.lightAlign));
    const spaceClearance = clamp01(toNumber(signals?.spaceClearance));
    const styleAlign = clamp01(toNumber(signals?.styleAlign));
    const massBalance = clamp01(toNumber(signals?.massBalance));
    const continuity = clamp01(toNumber(signals?.continuity));
    const collision = clamp01(toNumber(penalties?.collision));
    const resourceCost = clamp01(toNumber(penalties?.resourceCost));
    const epsilon = toNumber(noiseEpsilon, 0);

    const lightTerm = weights.lightAlign * lightAlign;
    const spaceTerm = weights.spaceClearance * spaceClearance;
    const styleTerm = weights.styleAlign * styleAlign;
    const massTerm = weights.massBalance * massBalance;
    const continuityTerm = weights.continuity * continuity;
    const collisionTerm = -weights.collisionPenalty * collision;
    const resourceTerm = -weights.resourceCostPenalty * resourceCost;
    const total = lightTerm
        + spaceTerm
        + styleTerm
        + massTerm
        + continuityTerm
        + collisionTerm
        + resourceTerm
        + epsilon;

    const contributions = {
        w_light_align: round(lightTerm, 6),
        w_space_clearance: round(spaceTerm, 6),
        style_cascade_bias: round(styleTerm * 0.5, 6),
        style_windswept_bias: round(styleTerm * 0.5, 6),
        w_mass_balance: round(massTerm, 6),
        apical_dominance: round(continuityTerm * 0.58, 6),
        trunk_taper_strength: round(continuityTerm * 0.42, 6),
        collision_prune_gain: round(collisionTerm, 6),
        branch_density: round(resourceTerm * 0.55, 6),
        branch_depth_budget: round(resourceTerm * 0.45, 6),
        noise_epsilon: round(epsilon, 6),
    };

    return {
        total: round(total, 6),
        terms: {
            light: round(lightTerm, 6),
            space: round(spaceTerm, 6),
            style: round(styleTerm, 6),
            mass: round(massTerm, 6),
            continuity: round(continuityTerm, 6),
            collision: round(collisionTerm, 6),
            resourceCost: round(resourceTerm, 6),
            epsilon: round(epsilon, 6),
        },
        weights,
        contributions,
        topPositive: resolveTopContributions(contributions, { positive: true, limit: 3 }),
        topNegative: resolveTopContributions(contributions, { positive: false, limit: 3 }),
    };
};

export const scoreActionCandidatesV1 = ({
    factors = {},
    runtime = null,
    candidates = [],
    noiseByCandidateId = {},
} = {}) => {
    const resolvedRuntime = runtime && typeof runtime === 'object'
        ? runtime
        : resolveRuntimeParamsFromFactorsV1(factors);
    const scored = (Array.isArray(candidates) ? candidates : [])
        .map((candidate, index) => {
            const candidateId = String(candidate?.id || `candidate_${index + 1}`);
            const score = scoreUtilityV1({
                factors: resolvedRuntime.factorVector,
                runtime: resolvedRuntime,
                signals: candidate?.signals || {},
                penalties: candidate?.penalties || {},
                noiseEpsilon: toNumber(noiseByCandidateId?.[candidateId], 0),
            });
            return {
                id: candidateId,
                action: candidate?.action || null,
                score,
                raw: candidate,
            };
        })
        .sort((a, b) => Number(b.score.total) - Number(a.score.total));

    return {
        best: scored[0] || null,
        scored,
        runtime: resolvedRuntime,
    };
};

