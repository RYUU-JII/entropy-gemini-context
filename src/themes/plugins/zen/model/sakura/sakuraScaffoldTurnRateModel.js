import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';

const TWO_PI = Math.PI * 2;

const nextRandom = (rng = null, decisionType = 'random') => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return 0.5;
};

const pickWeighted = (rng = null, entries = [], decisionType = 'weighted_pick') => {
    const filtered = (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
            ...entry,
            weight: Math.max(0, Number(entry?.weight) || 0),
        }))
        .filter((entry) => entry.weight > 1e-6);
    if (!filtered.length) {
        return null;
    }
    const total = filtered.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = nextRandom(rng, decisionType) * total;
    for (let index = 0; index < filtered.length; index += 1) {
        threshold -= filtered[index].weight;
        if (threshold <= 0) {
            return filtered[index].value;
        }
    }
    return filtered[filtered.length - 1].value;
};

const clampSigned = (value = 0, absMax = 0) => {
    const cap = Math.max(0, Number(absMax) || 0);
    return clamp(Number(value) || 0, -cap, cap);
};

const smoothstep = (edge0, edge1, x) => {
    const span = Math.max(1e-6, Number(edge1) - Number(edge0));
    const t = clamp((Number(x) - Number(edge0)) / span, 0, 1);
    return t * t * (3 - 2 * t);
};

/**
 * Scaffold archetype system.
 *
 * Each tree has a "core personality" chosen once (via treeRng), then each
 * scaffold root gets a small per-branch variance applied on top.  This keeps
 * branches cohesive ("same family") while giving every one a subtle identity.
 *
 * Archetype blending weights (not discrete categories):
 *   sweepiness  – tendency to sweep in long arcs
 *   gnarliness  – tendency to kink and stay kinked
 *   straightness – tendency to stay straight
 *
 * The three weights are normalised so they sum to 1.
 */
const ARCHETYPE_PRESETS = [
    { name: 'upright', weight: 0.28, straightness: 0.72, sweepiness: 0.2, gnarliness: 0.08 },
    { name: 'graceful', weight: 0.32, straightness: 0.3, sweepiness: 0.58, gnarliness: 0.12 },
    { name: 'balanced', weight: 0.24, straightness: 0.46, sweepiness: 0.36, gnarliness: 0.18 },
    { name: 'windswept', weight: 0.1, straightness: 0.24, sweepiness: 0.62, gnarliness: 0.14 },
    { name: 'gnarled', weight: 0.06, straightness: 0.22, sweepiness: 0.22, gnarliness: 0.56 },
];

export const resolveScaffoldArchetype = ({
    treeRng = null,
    branchRng = null,
    variance = 0.12,
} = {}) => {
    const core = pickWeighted(
        treeRng,
        ARCHETYPE_PRESETS.map((preset) => ({
            value: preset,
            weight: preset.weight,
        })),
        'scaffold_archetype_core',
    ) || ARCHETYPE_PRESETS[0];

    // 2. Apply small per-branch jitter
    const v = clamp(variance, 0, 0.4);
    const jitterStraight = (nextRandom(branchRng, 'archetype_jitter_straight') - 0.5) * 2 * v;
    const jitterSweep = (nextRandom(branchRng, 'archetype_jitter_sweep') - 0.5) * 2 * v;
    const jitterGnarl = (nextRandom(branchRng, 'archetype_jitter_gnarl') - 0.5) * 2 * v;

    let s = Math.max(0.02, core.straightness + jitterStraight);
    let w = Math.max(0.02, core.sweepiness + jitterSweep);
    let g = Math.max(0.02, core.gnarliness + jitterGnarl);
    const total = s + w + g;
    s /= total;
    w /= total;
    g /= total;

    return { straightness: s, sweepiness: w, gnarliness: g, coreName: core.name };
};

/**
 * Derive HSMM overrides from a normalised archetype blend.
 */
const applyArchetypeToParams = (baseParams = {}, archetype = null) => {
    if (!archetype) return baseParams;
    const { straightness, sweepiness, gnarliness } = archetype;
    return {
        ...baseParams,
        straightBias: clamp(
            baseParams.straightBias + (straightness - 0.44) * 0.28,
            0, 1,
        ),
        sweepProb: clamp(
            baseParams.sweepProb + (sweepiness - 0.34) * 0.22,
            0, 1,
        ),
        kinkProb: clamp(
            baseParams.kinkProb + (gnarliness - 0.16) * 0.08,
            0, 1,
        ),
        sweepAmpRad: clamp(
            baseParams.sweepAmpRad * lerp(0.82, 1.24, sweepiness),
            degToRad(4), degToRad(40),
        ),
        sweepFreq: clamp(
            baseParams.sweepFreq * lerp(1.16, 0.72, sweepiness),
            0.1, 3.2,
        ),
        kinkAngleRad: clamp(
            baseParams.kinkAngleRad * lerp(0.82, 1.16, gnarliness),
            degToRad(2), degToRad(48),
        ),
        recovery: clamp(
            baseParams.recovery * lerp(1.08, 0.72, gnarliness),
            0.08, 1,
        ),
        noise: clamp(
            baseParams.noise + gnarliness * 0.08,
            0, 1,
        ),
    };
};

const resolveStateDuration = ({
    state = 'straight',
    persistence = 0.58,
    rng = null,
    decisionType = 'duration',
}) => {
    const p = clamp(persistence, 0, 1);
    const durationScale = lerp(0.72, 1.5, p);
    const range = (() => {
        if (state === 'sweep') return [3, 6];
        if (state === 'kink') return [1, 1];
        if (state === 'recover') return [1, 3];
        return [2, 7];
    })();
    const raw = lerp(range[0], range[1], nextRandom(rng, decisionType));
    if (state === 'kink') {
        // Keep kink as a short burst window and avoid persistence-scaling explosion.
        return Math.max(1, Math.round(raw));
    }
    return Math.max(1, Math.round(raw * durationScale));
};

const resolveTransition = ({
    currentState = 'straight',
    straightBias = 0.58,
    sweepProb = 0.28,
    kinkProb = 0.12,
    rng = null,
    decisionType = 'transition',
}) => {
    if (currentState === 'kink') {
        return 'recover';
    }
    if (currentState === 'recover') {
        return pickWeighted(rng, [
            { value: 'straight', weight: 0.96 + straightBias * 1.9 },
            { value: 'sweep', weight: 0.14 + sweepProb * 1.3 },
        ], decisionType) || 'straight';
    }
    if (currentState === 'sweep') {
        return pickWeighted(rng, [
            { value: 'sweep', weight: 0.74 + sweepProb * 2.05 },
            { value: 'straight', weight: 0.48 + straightBias * 1.8 },
            { value: 'kink', weight: 0.012 + kinkProb * 0.72 },
        ], decisionType) || 'straight';
    }
    return pickWeighted(rng, [
        { value: 'straight', weight: 0.94 + straightBias * 2 },
        { value: 'sweep', weight: 0.2 + sweepProb * 1.9 },
        { value: 'kink', weight: 0.01 + kinkProb * 0.56 },
    ], decisionType) || 'straight';
};

export const createScaffoldTurnRateFlow = ({
    rng = null,
    sideSign = 1,
    depthLimit = 5,
    straightBias = 0.58,
    sweepProb = 0.28,
    kinkProb = 0.12,
    sweepAmpDeg = 18,
    sweepFreq = 0.45,
    kinkAngleDeg = 20,
    recovery = 0.42,
    persistence = 0.58,
    noise = 0.24,
    depthDamping = 0.46,
    archetype = null,
    initialState = 'straight',
} = {}) => {
    if (initialState !== 'straight' && initialState !== 'sweep') {
        throw new Error(`ZEN_SAKURA_SCAFFOLD_INITIAL_TURN_STATE_INVALID:${initialState}`);
    }
    const initialDwell = resolveStateDuration({
        state: initialState,
        persistence,
        rng,
        decisionType: 'scaffold_hsmm_state_duration_init',
    });
    const baseParams = {
        straightBias: clamp(straightBias, 0, 1),
        sweepProb: clamp(sweepProb, 0, 1),
        kinkProb: clamp(kinkProb, 0, 1),
        sweepAmpRad: degToRad(clamp(sweepAmpDeg, 0, 40)),
        sweepFreq: clamp(sweepFreq, 0.1, 3.2),
        kinkAngleRad: degToRad(clamp(kinkAngleDeg, 2, 48)),
        recovery: clamp(recovery, 0, 1),
        persistence: clamp(persistence, 0, 1),
        noise: clamp(noise, 0, 1),
        depthDamping: clamp(depthDamping, 0, 1),
    };
    const resolvedParams = applyArchetypeToParams(baseParams, archetype);
    return {
        step: 0,
        depthLimit: Math.max(2, Math.round(Number(depthLimit) || 2)),
        state: initialState,
        dwellRemaining: initialDwell,
        stateDuration: initialDwell,
        stateStep: 0,
        sweepPhase: nextRandom(rng, 'scaffold_hsmm_sweep_phase_init') * TWO_PI,
        sweepSign: sideSign >= 0 ? 1 : -1,
        pendingKinkSign: sideSign >= 0 ? 1 : -1,
        prevTurnRate: 0,
        params: resolvedParams,
    };
};

export const stepScaffoldTurnRateFlow = ({
    flow = null,
    rng = null,
    depthNorm = 0,
    sideSign = 1,
} = {}) => {
    if (!flow) {
        return {
            turnRate: 0,
            state: 'straight',
            dwellRemaining: 0,
            flow: null,
        };
    }
    const params = flow.params || {};
    let state = String(flow.state || 'straight');
    let dwellRemaining = Math.max(0, Math.round(Number(flow.dwellRemaining) || 0));
    let stateDuration = Math.max(1, Math.round(Number(flow.stateDuration) || dwellRemaining || 1));
    let stateStep = Math.max(0, Math.round(Number(flow.stateStep) || 0));
    let sweepPhase = Number(flow.sweepPhase) || 0;
    let sweepSign = Math.sign(Number(flow.sweepSign) || 0) || (sideSign >= 0 ? 1 : -1);
    let pendingKinkSign = Math.sign(Number(flow.pendingKinkSign) || 0) || sweepSign;

    if (dwellRemaining <= 0) {
        const depthKinkSuppression = 1 - (smoothstep(0.52, 1, depthNorm) * 0.82);
        state = resolveTransition({
            currentState: state,
            straightBias: params.straightBias,
            sweepProb: params.sweepProb,
            kinkProb: (Number(params.kinkProb) || 0) * depthKinkSuppression,
            rng,
            decisionType: `scaffold_hsmm_state_transition_${flow.step || 0}`,
        });
        if (state === 'sweep') {
            const keepSide = nextRandom(rng, `scaffold_hsmm_sweep_keep_side_${flow.step || 0}`) < 0.66;
            sweepSign = keepSide
                ? sweepSign
                : -sweepSign;
        }
        if (state === 'kink') {
            const preferred = Math.sign(sideSign || sweepSign || 1) || 1;
            pendingKinkSign = nextRandom(rng, `scaffold_hsmm_kink_sign_${flow.step || 0}`) < 0.72
                ? preferred
                : -preferred;
        }
        dwellRemaining = resolveStateDuration({
            state,
            persistence: params.persistence,
            rng,
            decisionType: `scaffold_hsmm_state_duration_${flow.step || 0}`,
        });
        stateDuration = Math.max(1, dwellRemaining);
        stateStep = 0;
    }

    const noiseAmp = degToRad(lerp(0.15, 3.4, params.noise || 0));
    const centered = (nextRandom(rng, `scaffold_hsmm_emission_noise_${flow.step || 0}`) - 0.5) * 2;
    let rawTurnRate = 0;
    if (state === 'straight') {
        rawTurnRate = centered * noiseAmp * 0.28;
    } else if (state === 'sweep') {
        const phaseAdvance = TWO_PI * (Number(params.sweepFreq) || 0.45) * (1 / Math.max(2, flow.depthLimit || 2));
        sweepPhase += phaseAdvance;
        // Sweep envelope: amplitude ramps up over the first ~35% of the state duration
        const sweepEnvelope = smoothstep(0, 0.35, stateStep / Math.max(1, stateDuration));
        const ampRad = (Number(params.sweepAmpRad) || degToRad(18));
        rawTurnRate = (
            Math.sin(sweepPhase) * ampRad * sweepSign * sweepEnvelope
            + centered * noiseAmp * 0.14
        );
    } else if (state === 'kink') {
        const depthKinkGain = 1 - (smoothstep(0.72, 1, depthNorm) * 0.55);
        const kinkImpulseDecay = Math.pow(0.52, stateStep + 0.1);
        rawTurnRate = (
            pendingKinkSign
            * (Number(params.kinkAngleRad) || degToRad(20))
            * kinkImpulseDecay
            * depthKinkGain
            * 0.64
            + centered * noiseAmp * 0.06 * kinkImpulseDecay
        );
    } else {
        // Recover: slower recovery preserves directional momentum after kink
        const recovery = clamp(Number(params.recovery) || 0.42, 0, 1);
        const effectiveRecovery = recovery * 0.68;
        rawTurnRate = (
            (Number(flow.prevTurnRate) || 0) * (1 - effectiveRecovery)
            + centered * noiseAmp * 0.22
        );
    }

    const response = state === 'kink'
        ? 0.74
        : (state === 'sweep' ? 0.62 : (state === 'recover' ? 0.48 : 0.32));
    const blendedTurnRate = lerp(Number(flow.prevTurnRate) || 0, rawTurnRate, response);
    const damping = 1 - (clamp(depthNorm, 0, 1) * clamp(params.depthDamping, 0, 1) * 0.72);
    const dampedTurnRate = blendedTurnRate * clamp(damping, 0.22, 1);
    const turnRate = clampSigned(dampedTurnRate, degToRad(26));
    const nextDwellRemaining = Math.max(0, dwellRemaining - 1);
    const nextStateStep = nextDwellRemaining > 0
        ? stateStep + 1
        : 0;

    return {
        turnRate,
        state,
        dwellRemaining: nextDwellRemaining,
        flow: {
            ...flow,
            step: (Number(flow.step) || 0) + 1,
            state,
            dwellRemaining: nextDwellRemaining,
            stateDuration,
            stateStep: nextStateStep,
            sweepPhase,
            sweepSign,
            pendingKinkSign,
            prevTurnRate: turnRate,
            params,
        },
    };
};

export const resolveScaffoldCurveFromTurnRate = ({
    turnRate = 0,
    length = 0,
    maxCurveRatio = 0.32,
} = {}) => {
    const safeLength = Math.max(1e-3, Number(length) || 0);
    const cappedTurn = clampSigned(turnRate, degToRad(30));
    const normalized = Math.tanh(cappedTurn / degToRad(28));
    return normalized * safeLength * clamp(maxCurveRatio, 0.06, 0.4);
};

export const resolveScaffoldCurvatureMemory = ({
    previousTurnRate = 0,
    turnRateIn = 0,
    turnRateOut = 0,
    curveIn = 0,
    curveOut = 0,
    length = 0,
    maxCurveRatio = 0.32,
} = {}) => {
    const turnDelta = Math.abs((Number(turnRateOut) || 0) - (Number(turnRateIn) || 0));
    const continuity = clamp(1 - (turnDelta / degToRad(24)), 0.28, 0.86);
    const memoryCurve = resolveScaffoldCurveFromTurnRate({
        turnRate: previousTurnRate,
        length,
        maxCurveRatio: clamp(maxCurveRatio * 0.86, 0.06, 0.4),
    });
    const rememberedCurveIn = lerp(
        Number(curveIn) || 0,
        memoryCurve,
        0.3 * continuity,
    );
    const rememberedCurveOut = lerp(
        Number(curveOut) || 0,
        ((Number(curveOut) || 0) * 0.78) + (rememberedCurveIn * 0.22),
        0.18 * continuity,
    );

    return {
        curveIn: rememberedCurveIn,
        curveOut: rememberedCurveOut,
        curve: (rememberedCurveIn + rememberedCurveOut) * 0.5,
    };
};
