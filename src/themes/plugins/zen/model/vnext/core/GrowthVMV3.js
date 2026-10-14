import { buildStructuralNodeId, sampleStructuralRandom } from '../../bonsai/random/StructuralHashRandom';
import { OccupancyFieldModel, LightFieldModel, StyleFieldModel } from '../fields/index';
import { ProvenanceRecorderV1 } from '../trace/index';
import { TreeGraph } from './TreeGraph';
import { resolveVNextMorphologyFeatures } from './VNextMorphologyFeatures';
import { resolveVNextRuntimeV2 } from './v2/resolveVNextRuntimeV2';
import {
    buildTopContributions,
    clamp,
    clamp01,
    distance2,
    lerp,
    rotate2D,
    round,
    signedCentered,
    toNumber,
    vecAdd,
    vecLerp,
    vecNormalize2,
    vecScale,
} from './v2/VNextGrowthMath';

const DEFAULT_CONSTRAINTS = Object.freeze({
    maxNodes: 180,
    maxSteps: 34,
    maxDepth: 9,
    bounds: {
        width: 420,
        height: 420,
        depth: 420,
    },
});

const DEFAULT_OPTIONS = Object.freeze({
    traceLevel: 'compact',
    maxProvenanceEvents: 4096,
    enableDeadwood: true,
});

const ATTRACTOR_KIND = Object.freeze({
    TRUNK_GUIDE: 'trunk_guide',
    LIGHT: 'light',
    SPACE: 'space',
    STYLE: 'style',
    PAD: 'pad',
    VOID: 'void',
    APEX: 'apex',
});

const CLAIMABLE_ATTRACTOR_KINDS = new Set([
    ATTRACTOR_KIND.TRUNK_GUIDE,
    ATTRACTOR_KIND.LIGHT,
    ATTRACTOR_KIND.SPACE,
    ATTRACTOR_KIND.STYLE,
    ATTRACTOR_KIND.PAD,
    ATTRACTOR_KIND.APEX,
]);

const resolveOptions = (options = {}) => ({
    ...DEFAULT_OPTIONS,
    ...(options || {}),
});

const resolveConstraints = (constraints = {}) => {
    const merged = {
        ...DEFAULT_CONSTRAINTS,
        ...(constraints || {}),
        bounds: {
            ...DEFAULT_CONSTRAINTS.bounds,
            ...(constraints?.bounds || {}),
        },
    };
    return {
        maxNodes: Math.max(24, Math.floor(toNumber(merged.maxNodes, DEFAULT_CONSTRAINTS.maxNodes))),
        maxSteps: Math.max(4, Math.floor(toNumber(merged.maxSteps, DEFAULT_CONSTRAINTS.maxSteps))),
        maxDepth: Math.max(3, Math.floor(toNumber(merged.maxDepth, DEFAULT_CONSTRAINTS.maxDepth))),
        bounds: {
            width: Math.max(120, toNumber(merged.bounds.width, DEFAULT_CONSTRAINTS.bounds.width)),
            height: Math.max(120, toNumber(merged.bounds.height, DEFAULT_CONSTRAINTS.bounds.height)),
            depth: Math.max(40, toNumber(merged.bounds.depth, DEFAULT_CONSTRAINTS.bounds.depth)),
        },
    };
};
const createSampleRandom = (seed = 0) => (decisionType = 'v3', index = 0) => sampleStructuralRandom({
    seed,
    nodeId: 'vnext_v3',
    decisionType,
    index: Math.max(0, Math.floor(toNumber(index, 0))),
});

const resolveNodeRole = (order = 0) => {
    if (order <= 0) return 'trunk';
    if (order >= 3) return 'twig';
    return 'branch';
};

const resolvePhase = (bud = {}) => {
    if (toNumber(bud.order, 0) <= 0) return 'trunk';
    if (toNumber(bud.order, 0) >= 3 || toNumber(bud.depth, 0) >= 5) return 'twig';
    return 'branch';
};

const normalizeHeading = (heading = [0, 1, 0]) => {
    const normalized = vecNormalize2(heading);
    return normalized[1] < -0.72
        ? vecNormalize2([normalized[0], -0.72, 0])
        : normalized;
};

const smoothstep = (value = 0) => {
    const t = clamp01(toNumber(value, 0));
    return t * t * (3 - (2 * t));
};

const serializePoint = (position = [0, 0, 0]) => [
    round(toNumber(position?.[0], 0), 4),
    round(toNumber(position?.[1], 0), 4),
    round(toNumber(position?.[2], 0), 4),
];

const toOptionalIndex = (value = null) => (
    value === null || value === undefined
        ? null
        : (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : null)
);

const toOptionalProgress = (value = null) => (
    value === null || value === undefined
        ? null
        : (Number.isFinite(Number(value)) ? round(clamp01(Number(value)), 6) : null)
);

const createAttractor = ({
    id,
    kind,
    position,
    radius = 72,
    energy = 0.5,
    targetOrder = null,
    weight = 1,
    terminalBias = 0.5,
    guideIndex = null,
    progress = null,
} = {}) => ({
    id,
    kind,
    position: serializePoint(position),
    radius: Math.max(12, toNumber(radius, 72)),
    energy: clamp01(toNumber(energy, 0.5)),
    targetOrder: Number.isFinite(Number(targetOrder)) ? Math.max(0, Math.floor(Number(targetOrder))) : null,
    weight: clamp(toNumber(weight, 1), 0.05, 2),
    terminalBias: clamp01(toNumber(terminalBias, 0.5)),
    guideIndex: toOptionalIndex(guideIndex),
    progress: toOptionalProgress(progress),
    claimedBy: null,
});

const createVNextAttractorFieldV3 = ({
    runtime = {},
    constraints = {},
    sampleRandom,
} = {}) => {
    const bounds = runtime?.bounds || constraints?.bounds || DEFAULT_CONSTRAINTS.bounds;
    const width = Math.max(120, toNumber(bounds?.width, 420));
    const height = Math.max(120, toNumber(bounds?.height, 420));
    const xReach = width * lerp(0.18, 0.42, clamp01(runtime?.budField?.openness));
    const branchDensity = clamp01(runtime?.lineage?.branchDensity);
    const openness = clamp01(runtime?.budField?.openness);
    const blossom = clamp01(runtime?.sakura?.flowerChance);
    const movement = clamp01(runtime?.backbone?.curveEnergy);
    const primarySweep = clamp01(runtime?.backbone?.primarySweep ?? movement);
    const counterSweep = clamp01(runtime?.backbone?.counterSweep ?? movement);
    const training = clamp01(runtime?.backbone?.trainingIntensity);
    const maxDepth = Math.max(3, Math.floor(toNumber(constraints?.maxDepth, DEFAULT_CONSTRAINTS.maxDepth)));
    const lean = clamp(toNumber(runtime?.backbone?.lean, 0), -1, 1);
    const windswept = clamp(toNumber(runtime?.lineage?.windsweptBias, 0), -1, 1);
    const droop = clamp01(runtime?.lineage?.cascadeBias);
    const attractors = [];

    const push = (entry) => {
        attractors.push(createAttractor({
            ...entry,
            id: `v3_attr_${attractors.length}_${entry.kind}`,
        }));
    };

    const dominantSign = (sampleRandom('v3_dominant_sign', 0) < 0.5 ? -1 : 1) * (Math.sign(lean || windswept) || 1);
    const apexX = dominantSign * xReach * lerp(0.08, 0.34, clamp01(runtime?.backbone?.apexReach));
    const apexY = height * lerp(0.72, 0.94, clamp01(runtime?.backbone?.apexReach));
    const trunkGuideCount = clamp(
        Math.round(lerp(
            4,
            6,
            clamp01(
                (movement * 0.58)
                + (Math.max(primarySweep, counterSweep) * 0.24)
                + (training * 0.18),
            ),
        )),
        4,
        Math.max(4, maxDepth - 2),
    );
    const guidePhase = sampleRandom('v3_trunk_guide_phase', 0) * Math.PI * 2;
    const guideFrequency = lerp(
        0.72,
        1.58,
        clamp01((movement * 0.56) + (primarySweep * 0.28) + (counterSweep * 0.16)),
    );
    const guideAmplitude = xReach * lerp(0.08, 0.34, movement) * lerp(0.86, 1.12, training);
    const counterAmplitude = xReach * lerp(0.03, 0.16, counterSweep) * lerp(0.82, 1.08, movement);
    for (let index = 0; index < trunkGuideCount; index += 1) {
        const progress = (index + 1) / (trunkGuideCount + 1);
        const eased = smoothstep(progress);
        const envelope = Math.sin(Math.PI * progress);
        const leanDrift = lean * width * 0.18 * progress;
        const waveX = Math.sin((progress * Math.PI * guideFrequency) + guidePhase)
            * guideAmplitude
            * envelope;
        const counterX = -dominantSign
            * Math.sin((progress * Math.PI * 2) + (guidePhase * 0.37))
            * counterAmplitude
            * envelope
            * progress;
        const jitterX = signedCentered(sampleRandom('v3_trunk_guide_jitter', index))
            * xReach
            * 0.04
            * movement
            * envelope;
        push({
            kind: ATTRACTOR_KIND.TRUNK_GUIDE,
            position: [
                clamp(
                    (apexX * eased * 0.72) + leanDrift + waveX + counterX + jitterX,
                    -width * 0.46,
                    width * 0.46,
                ),
                apexY * progress,
                0,
            ],
            radius: lerp(height * 0.08, height * 0.13, movement),
            energy: clamp01(0.68 + (movement * 0.2) + (training * 0.08)),
            targetOrder: 0,
            terminalBias: 0.08,
            weight: 1.36,
            guideIndex: index,
            progress,
        });
    }

    push({
        kind: ATTRACTOR_KIND.APEX,
        position: [apexX, apexY, 0],
        radius: height * 0.24,
        energy: 0.95,
        targetOrder: 0,
        weight: 1.24,
    });

    const bandCount = Math.max(4, Math.round(lerp(4, 7, branchDensity)));
    for (let index = 0; index < bandCount; index += 1) {
        const t = bandCount === 1 ? 0.5 : index / (bandCount - 1);
        const bandY = height * lerp(0.26, 0.86, t);
        const alternationSign = index % 2 === 0 ? dominantSign : -dominantSign;
        const jitter = signedCentered(sampleRandom('v3_band_jitter', index));
        const sideReach = xReach * lerp(0.38, 1.08, clamp01((movement * 0.46) + (openness * 0.36) + (branchDensity * 0.18)));
        const baseX = alternationSign * sideReach * lerp(0.35, 0.95, t);
        const sweepX = (windswept * width * 0.12 * t) + (jitter * xReach * 0.16);
        const targetOrder = index < 2 ? 1 : (index < bandCount - 1 ? 2 : 3);

        push({
            kind: index % 3 === 0 ? ATTRACTOR_KIND.SPACE : ATTRACTOR_KIND.PAD,
            position: [baseX + sweepX, bandY - (droop * height * 0.08 * t), 0],
            radius: lerp(42, 86, openness),
            energy: clamp01(0.46 + (branchDensity * 0.24) + (blossom * 0.16) + (t * 0.1)),
            targetOrder,
            terminalBias: clamp01((blossom * 0.62) + (t * 0.24)),
            weight: 0.88,
        });

        push({
            kind: ATTRACTOR_KIND.LIGHT,
            position: [
                (-alternationSign * xReach * lerp(0.18, 0.64, t)) + (windswept * width * 0.1),
                Math.min(height * 0.96, bandY + height * lerp(0.08, 0.18, t)),
                0,
            ],
            radius: lerp(50, 96, clamp01(runtime?.budField?.phototropism)),
            energy: clamp01(0.42 + (openness * 0.22) + (t * 0.18)),
            targetOrder,
            terminalBias: clamp01((blossom * 0.48) + (t * 0.34)),
            weight: 0.76,
        });
    }

    const voidCount = Math.max(2, Math.round(lerp(2, 4, openness)));
    for (let index = 0; index < voidCount; index += 1) {
        const t = (index + 1) / (voidCount + 1);
        push({
            kind: ATTRACTOR_KIND.VOID,
            position: [
                dominantSign * xReach * lerp(0.08, 0.42, t),
                height * lerp(0.34, 0.74, t),
                0,
            ],
            radius: lerp(54, 104, openness),
            energy: clamp01(0.52 + (openness * 0.32)),
            weight: lerp(0.72, 1.18, openness),
        });
    }

    push({
        kind: ATTRACTOR_KIND.STYLE,
        position: [
            dominantSign * xReach * lerp(0.52, 1.16, movement),
            height * lerp(0.42, 0.68, 1 - droop),
            0,
        ],
        radius: lerp(72, 118, movement),
        energy: clamp01(0.5 + (movement * 0.3)),
        targetOrder: 1,
        weight: 1,
    });

    return attractors;
};

const resolveNextTrunkAttractor = (attractors = []) => {
    const nextGuide = [...attractors]
        .filter((entry) => entry.kind === ATTRACTOR_KIND.TRUNK_GUIDE && !entry.claimedBy)
        .sort((left, right) => toNumber(left.guideIndex, 0) - toNumber(right.guideIndex, 0))[0];
    if (nextGuide) {
        return nextGuide;
    }
    return attractors.find((entry) => entry.kind === ATTRACTOR_KIND.APEX && !entry.claimedBy) || null;
};

const resolveNearestVoidPenalty = ({
    attractors = [],
    probe = [0, 0, 0],
} = {}) => {
    const voidAttractors = attractors.filter((entry) => entry.kind === ATTRACTOR_KIND.VOID);
    if (!voidAttractors.length) {
        return 0;
    }
    return voidAttractors.reduce((penalty, attractor) => {
        const proximity = clamp01(1 - (distance2(probe, attractor.position) / Math.max(1, attractor.radius)));
        return Math.max(penalty, proximity * attractor.energy * attractor.weight);
    }, 0);
};

const scoreVNextClaimCandidate = ({
    bud,
    attractor,
    attractors,
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
} = {}) => {
    if (!bud || !attractor || !CLAIMABLE_ATTRACTOR_KINDS.has(attractor.kind)) {
        return null;
    }
    if (attractor.claimedBy) {
        return null;
    }
    const phase = resolvePhase(bud);
    const trunkTarget = phase === 'trunk' ? resolveNextTrunkAttractor(attractors) : null;
    if (phase === 'trunk' && (!trunkTarget || attractor.id !== trunkTarget.id)) {
        return null;
    }
    if (phase !== 'trunk' && (attractor.kind === ATTRACTOR_KIND.TRUNK_GUIDE || attractor.kind === ATTRACTOR_KIND.APEX)) {
        return null;
    }
    const budOrder = Math.max(0, toNumber(bud.order, 0));
    const bounds = runtime?.bounds || constraints?.bounds || DEFAULT_CONSTRAINTS.bounds;
    const distance = distance2(bud.position, attractor.position);
    const reachScale = attractor.kind === ATTRACTOR_KIND.TRUNK_GUIDE
        ? 2.25
        : (phase === 'trunk' ? 1.42 : 1.24);
    const reach = Math.max(16, attractor.radius * reachScale);
    const distanceFit = clamp01(1 - (distance / reach));
    if (distanceFit <= 0 && attractor.kind !== ATTRACTOR_KIND.APEX) {
        return null;
    }

    const desiredHeading = normalizeHeading(vecNormalize2([
        toNumber(attractor.position?.[0], 0) - toNumber(bud.position?.[0], 0),
        toNumber(attractor.position?.[1], 0) - toNumber(bud.position?.[1], 0),
        0,
    ]));
    const headingContinuity = clamp01(
        ((toNumber(desiredHeading?.[0], 0) * toNumber(bud.heading?.[0], 0))
        + (toNumber(desiredHeading?.[1], 0) * toNumber(bud.heading?.[1], 1))
        + 1) * 0.5,
    );
    const orderFit = attractor.targetOrder === null
        ? 0.64
        : clamp01(1 - (Math.abs(budOrder - attractor.targetOrder) / 3));
    const isTrunkPathTarget = phase === 'trunk'
        && (attractor.kind === ATTRACTOR_KIND.TRUNK_GUIDE || attractor.kind === ATTRACTOR_KIND.APEX);
    const stepLength = clamp(
        distance * (
            isTrunkPathTarget
                ? lerp(0.76, 1.02, clamp01(toNumber(bud.energy, 0.5)))
                : lerp(0.22, 0.46, clamp01(toNumber(bud.energy, 0.5)))
        ),
        phase === 'trunk' ? 16 : 8,
        isTrunkPathTarget
            ? (attractor.kind === ATTRACTOR_KIND.TRUNK_GUIDE ? 82 : 62)
            : (phase === 'trunk' ? 42 : 28),
    );
    const probe = vecAdd(bud.position, vecScale(desiredHeading, stepLength));
    const occupancy = occupancyField?.sampleDensity(probe, phase === 'twig' ? 22 : 42) || 0;
    const light = lightField?.sampleWithPhototropism({
        position: probe,
        heading: desiredHeading,
        bounds,
        phototropismGain: runtime?.lineage?.phototropism,
    }) || { lightAlign: 0.5, openSkyGain: 0.5 };
    const style = styleField?.sample({
        position: probe,
        heading: desiredHeading,
        bounds,
    }) || { styleAlign: 0.5, massBalance: 0.5 };
    const voidPenalty = resolveNearestVoidPenalty({ attractors, probe });
    const resourceVigor = clamp01(
        (toNumber(bud.vigor, 0.5) * 0.58)
        + (toNumber(bud.energy, 0.5) * 0.42),
    );
    const kindWeights = {
        [ATTRACTOR_KIND.TRUNK_GUIDE]: phase === 'trunk' ? 1.3 : 0,
        [ATTRACTOR_KIND.APEX]: phase === 'trunk' ? 1.24 : 0.18,
        [ATTRACTOR_KIND.LIGHT]: phase === 'trunk' ? 0.46 : 0.9,
        [ATTRACTOR_KIND.SPACE]: phase === 'trunk' ? 0.4 : 0.82,
        [ATTRACTOR_KIND.STYLE]: phase === 'trunk' ? 0.52 : 0.84,
        [ATTRACTOR_KIND.PAD]: phase === 'trunk' ? 0.26 : 0.98,
    };
    const branchTargetBoost = budOrder >= 1 && attractor.targetOrder !== null
        ? clamp01(1 - (Math.abs(budOrder - attractor.targetOrder) / 2)) * 0.08
        : 0;
    const overextensionCost = clamp01(distance / Math.max(1, reach * 1.15));
    const contributions = {
        claim_kind: round((kindWeights[attractor.kind] || 0.5) * 0.16, 6),
        claim_distance: round(distanceFit * 0.22, 6),
        claim_heading: round(headingContinuity * 0.16, 6),
        claim_order_fit: round(orderFit * 0.14, 6),
        claim_branch_target: round(branchTargetBoost, 6),
        claim_light: round(clamp01(light.lightAlign) * 0.14, 6),
        claim_style: round(clamp01(style.styleAlign) * 0.12, 6),
        claim_balance: round(clamp01(style.massBalance) * 0.08, 6),
        claim_resource: round(resourceVigor * 0.12, 6),
        claim_attractor_energy: round(clamp01(attractor.energy) * 0.08, 6),
        claim_occupancy_penalty: round(-occupancy * 0.16, 6),
        claim_void_penalty: round(-voidPenalty * 0.18, 6),
        claim_overextension: round(-overextensionCost * 0.08, 6),
        claim_dormancy_penalty: round(-clamp01(toNumber(bud.dormancy, 0) / 4) * 0.08, 6),
    };
    const score = round(Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0), 6);
    if (score < 0.28) {
        return null;
    }
    return {
        bud,
        attractor,
        score,
        contributions,
        heading: desiredHeading,
        length: stepLength,
        probe,
        occupancy,
        light,
        style,
        phase,
    };
};

const sortClaims = (claims = []) => (
    [...claims].sort((left, right) => (
        Number(right?.score || 0) - Number(left?.score || 0)
        || String(left?.bud?.id || '').localeCompare(String(right?.bud?.id || ''))
        || String(left?.attractor?.id || '').localeCompare(String(right?.attractor?.id || ''))
    ))
);

const serializeClaim = (claim = {}) => ({
    budId: claim?.bud?.id || '',
    attractorId: claim?.attractor?.id || '',
    kind: claim?.attractor?.kind || '',
    score: round(toNumber(claim?.score, 0), 6),
    phase: claim?.phase || 'branch',
    position: serializePoint(claim?.probe || [0, 0, 0]),
    guideIndex: toOptionalIndex(claim?.attractor?.guideIndex),
    completed: claim?.completed === true,
});

const shouldCompleteAttractorClaim = ({
    attractor,
    probe = [0, 0, 0],
    phase = 'branch',
} = {}) => {
    if (!attractor) {
        return false;
    }
    const completionRadius = Math.max(
        phase === 'trunk' ? 18 : 12,
        toNumber(attractor.radius, 72) * (attractor.kind === ATTRACTOR_KIND.TRUNK_GUIDE ? 0.58 : (phase === 'trunk' ? 0.22 : 0.3)),
    );
    return distance2(probe, attractor.position) <= completionRadius;
};

const buildRenderSceneV1 = ({
    topology,
    attractors = [],
    claims = [],
    bounds = {},
} = {}) => {
    const nodes = Array.isArray(topology?.nodes) ? topology.nodes : [];
    const woodSegments = nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        role: node.role,
        order: Math.max(0, Math.floor(toNumber(node.order, 0))),
        p0: serializePoint(node.p0),
        p1: serializePoint(node.p1),
        radius0: round(toNumber(node.radius0, 0), 4),
        radius1: round(toNumber(node.radius1, 0), 4),
        vigor: round(clamp01(toNumber(node.vigor, 0.5)), 6),
        liveVeinRatio: round(clamp01(toNumber(node.liveVeinRatio, 1)), 6),
        tags: Array.isArray(node.tags) ? [...node.tags] : [],
    }));
    const terminalPoints = woodSegments
        .filter((segment) => (
            segment.order >= 2
            || segment.tags.some((tag) => String(tag || '').startsWith('terminal:'))
        ))
        .slice(-80)
        .map((segment) => ({
            id: `${segment.id}_terminal`,
            position: segment.p1,
            vigor: segment.vigor,
            flower: segment.tags.includes('terminal:cluster'),
        }));

    return {
        version: 1,
        bounds: {
            width: Math.max(1, toNumber(bounds?.width, 420)),
            height: Math.max(1, toNumber(bounds?.height, 420)),
        },
        woodSegments,
        terminals: terminalPoints,
        attractors: attractors.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            position: serializePoint(entry.position),
            radius: round(toNumber(entry.radius, 0), 4),
            energy: round(clamp01(toNumber(entry.energy, 0)), 6),
            guideIndex: toOptionalIndex(entry.guideIndex),
            progress: toOptionalProgress(entry.progress),
            claimedBy: entry.claimedBy || null,
        })),
        claims: claims.map((entry) => serializeClaim(entry)),
    };
};

export const runGrowthVMV3 = (input = {}) => {
    const seed = Number.isFinite(Number(input?.seed)) ? Math.floor(Number(input.seed)) : 0;
    const stage = typeof input?.stage === 'string' ? input.stage : 'mature';
    const options = resolveOptions(input?.options);
    const constraints = resolveConstraints(input?.constraints);
    const { factorVector, runtime } = resolveVNextRuntimeV2({
        factors: input?.factors || {},
        stage,
        constraints,
    });
    const tree = new TreeGraph({ seed });
    const sampleRandom = createSampleRandom(seed);
    const provenanceRecorder = new ProvenanceRecorderV1({
        seed,
        traceLevel: options.traceLevel,
        capacity: Math.max(16, Math.floor(toNumber(options.maxProvenanceEvents, 4096))),
    });
    const occupancyField = new OccupancyFieldModel({
        cellSize: lerp(18, 32, clamp01(runtime?.budField?.spaceAvoidGain)),
        queryRadius: lerp(28, 78, clamp01(runtime?.budField?.spaceAvoidGain)),
        saturationCount: Math.round(lerp(7, 18, clamp01(runtime?.lineage?.branchDensity))),
    });
    const lightField = new LightFieldModel({
        topLightDir: [0, 1],
        sideLightDir: [toNumber(runtime?.lineage?.windsweptBias, 0) * 0.54, 0.9],
        topLightWeight: clamp01(lerp(0.62, 0.92, clamp01(runtime?.budField?.phototropism))),
        sideLightWeight: clamp01(lerp(0.14, 0.42, Math.abs(toNumber(runtime?.lineage?.windsweptBias, 0)))),
    });
    const styleField = new StyleFieldModel({
        cascadeBias: clamp01(runtime?.lineage?.cascadeBias),
        windsweptBias: toNumber(runtime?.lineage?.windsweptBias, 0),
        canopyEnvelopeBias: (clamp01(runtime?.budField?.negativeSpaceTarget) * 2) - 1,
        padSeparationTarget: clamp01(runtime?.budField?.spaceAvoidGain),
        negativeSpaceTarget: clamp01(runtime?.budField?.negativeSpaceTarget),
        massBalanceGain: clamp01(runtime?.budField?.massBalanceGain),
    });
    const attractors = createVNextAttractorFieldV3({
        runtime,
        constraints,
        sampleRandom,
    });
    const pushEvent = (step, eventType, payload = {}, meta = {}) => {
        provenanceRecorder.record({
            step,
            eventType,
            nodeId: meta?.nodeId || null,
            budId: meta?.budId || null,
            seedKey: typeof meta?.seedKey === 'string' ? meta.seedKey : '',
            randomValue: Number.isFinite(Number(meta?.randomValue)) ? Number(meta.randomValue) : null,
            payload,
            contributions: meta?.contributions || null,
        });
    };

    let emittedCount = 0;
    const trunkHeading = normalizeHeading([
        toNumber(runtime?.backbone?.lean, 0) * 0.2,
        1,
        0,
    ]);
    let activeBuds = [{
        id: 'bud_trunk_0',
        parentNodeId: null,
        position: [0, 0, 0],
        heading: trunkHeading,
        order: 0,
        depth: 0,
        vigor: clamp01(runtime?.lineage?.vigor),
        energy: clamp01(0.68 + (clamp01(runtime?.lineage?.vigor) * 0.22)),
        dormancy: 0,
        splitBudget: Math.max(2, Math.round(lerp(2, 5, clamp01(runtime?.lineage?.branchDensity)))),
        sideSign: sampleRandom('v3_initial_side', 0) < 0.5 ? -1 : 1,
    }];
    const selectedClaims = [];
    const rejectedClaims = [];
    const actionCounts = {
        claim: 0,
        dormant: 0,
        prune: 0,
        split: 0,
        deadwood: 0,
    };

    pushEvent(0, 'STEP_START', {
        activeBudCount: activeBuds.length,
        nodeCount: 0,
    });

    for (
        let step = 0;
        step < constraints.maxSteps && activeBuds.length && tree.nodeCount() < constraints.maxNodes;
        step += 1
    ) {
        const candidates = [];
        activeBuds.forEach((bud) => {
            attractors.forEach((attractor) => {
                const claim = scoreVNextClaimCandidate({
                    bud,
                    attractor,
                    attractors,
                    occupancyField,
                    lightField,
                    styleField,
                    runtime,
                    constraints,
                });
                if (claim) {
                    candidates.push(claim);
                }
            });
        });

        const claimedBudIds = new Set();
        const claimedAttractorIds = new Set();
        const winners = [];
        sortClaims(candidates).forEach((claim) => {
            if (claimedBudIds.has(claim.bud.id) || claimedAttractorIds.has(claim.attractor.id)) {
                rejectedClaims.push(claim);
                return;
            }
            claimedBudIds.add(claim.bud.id);
            claimedAttractorIds.add(claim.attractor.id);
            winners.push(claim);
        });

        const nextBuds = [];
        const loserBuds = activeBuds.filter((bud) => !claimedBudIds.has(bud.id));
        loserBuds.forEach((bud) => {
            const nextDormancy = toNumber(bud.dormancy, 0) + 1;
            if (nextDormancy <= 2 && toNumber(bud.energy, 0) > 0.38) {
                actionCounts.dormant += 1;
                nextBuds.push({
                    ...bud,
                    dormancy: nextDormancy,
                    energy: clamp01(toNumber(bud.energy, 0.5) - 0.08),
                });
                pushEvent(step, 'STALL_GUARD_TRIGGERED', {
                    threshold: 0.28,
                    selectedScore: 0,
                    nextDormancy,
                }, {
                    budId: bud.id,
                });
            } else {
                actionCounts.prune += 1;
            }
        });

        winners.forEach((claim) => {
            if (tree.nodeCount() >= constraints.maxNodes) {
                return;
            }
            const bud = claim.bud;
            const phase = claim.phase;
            const childOrder = Math.max(0, Math.floor(toNumber(bud.order, 0)));
            const nodeRole = resolveNodeRole(childOrder);
            const parentNode = bud.parentNodeId ? tree.getNode(bud.parentNodeId) : null;
            const parentRadius = parentNode
                ? Math.max(0.12, toNumber(parentNode.radius1, parentNode.radius0 || 1))
                : lerp(7.8, 11.2, clamp01(runtime?.backbone?.taperStrength));
            const radius0 = childOrder === 0
                ? Math.max(0.34, parentRadius * lerp(0.82, 0.94, clamp01(runtime?.backbone?.taperStrength)))
                : Math.max(0.1, parentRadius * lerp(0.46, 0.72, 1 - clamp01(runtime?.lineage?.branchRadiusDecay)));
            const radius1 = Math.max(0.08, radius0 * (childOrder === 0 ? 0.9 : lerp(0.66, 0.84, clamp01(runtime?.lineage?.apicalDominance))));
            const p0 = serializePoint(bud.position);
            const p1 = serializePoint(claim.probe);
            const nodeId = buildStructuralNodeId({
                parentNodeId: bud.parentNodeId || 'root',
                depth: Math.max(0, Math.floor(toNumber(bud.depth, 0))),
                nodeRole,
                nodeSlot: emittedCount,
                decisionType: `v3_${claim.attractor.kind}_${step}`,
            });
            emittedCount += 1;
            const terminalChance = clamp01(
                (claim.attractor.terminalBias * 0.48)
                + (clamp01(runtime?.sakura?.flowerChance) * 0.28)
                + ((childOrder >= 2 || phase === 'twig') ? 0.2 : 0),
            );
            const shouldFlower = childOrder >= 2 && terminalChance >= 0.5;
            const shouldDeadwood = options.enableDeadwood !== false
                && childOrder >= 2
                && toNumber(bud.energy, 0.5) < 0.38
                && clamp01(runtime?.lineage?.deadwoodRate) > 0.02;
            const node = tree.addNode({
                id: nodeId,
                parentId: bud.parentNodeId,
                depth: bud.parentNodeId ? (toNumber(parentNode?.depth, 0) + 1) : 0,
                order: childOrder,
                role: shouldDeadwood ? 'deadwood' : nodeRole,
                p0,
                p1,
                dir: claim.heading,
                length: Math.max(1, distance2(p0, p1)),
                radius0,
                radius1,
                age: step,
                vigor: clamp01(toNumber(bud.vigor, 0.5) * lerp(0.84, 1.02, clamp01(claim.light.openSkyGain))),
                lightBudget: clamp01(claim.light.lightAlign),
                resourceBudget: clamp01(toNumber(bud.energy, 0.5) * 0.88),
                liveVeinRatio: shouldDeadwood ? 0.34 : clamp01(0.74 + (toNumber(bud.vigor, 0.5) * 0.2)),
                sapFlow: clamp01(toNumber(bud.energy, 0.5) * (shouldDeadwood ? 0.48 : 0.84)),
                tags: [
                    'engine:v3',
                    `phase:${phase}`,
                    `claim:${claim.attractor.kind}`,
                    `attractor:${claim.attractor.id}`,
                    ...(shouldFlower ? ['terminal:cluster'] : []),
                    ...(shouldDeadwood ? ['deadwood:claim_starved'] : []),
                    'species:sakura',
                ],
            });
            if (!node) {
                return;
            }
            occupancyField.addSegment(p0, p1, {
                nodeId,
                phase,
            });
            const completed = shouldCompleteAttractorClaim({
                attractor: claim.attractor,
                probe: p1,
                phase,
            });
            if (completed) {
                claim.attractor.claimedBy = nodeId;
            }
            selectedClaims.push({
                ...claim,
                completed,
                nodeId,
            });
            actionCounts.claim += 1;
            if (shouldDeadwood) {
                actionCounts.deadwood += 1;
                pushEvent(step, 'DEADWOOD_APPLIED', {
                    action: 'v3_deadwoodize',
                    phase,
                    nodeId,
                }, {
                    nodeId,
                    budId: bud.id,
                });
            }
            pushEvent(step, 'ACTION_SELECTED', {
                action: `v3_claim_${claim.attractor.kind}`,
                phase,
                candidateCount: Math.max(1, candidates.length),
                scoreTotal: round(claim.score, 6),
                topPositive: buildTopContributions(claim.contributions, { positive: true }),
                topNegative: buildTopContributions(claim.contributions, { positive: false }),
            }, {
                nodeId,
                budId: bud.id,
                contributions: claim.contributions,
            });
            pushEvent(step, 'SEGMENT_EMITTED', {
                action: `v3_claim_${claim.attractor.kind}`,
                phase,
                nodeId,
                parentId: bud.parentNodeId,
                length: round(distance2(p0, p1), 4),
                order: childOrder,
            }, {
                nodeId,
                budId: bud.id,
            });

            const depthRemaining = constraints.maxDepth - Math.max(0, Math.floor(toNumber(bud.depth, 0)));
            const nextEnergy = clamp01(toNumber(bud.energy, 0.5) - lerp(0.08, 0.18, childOrder / 4) + (claim.attractor.energy * 0.08));
            if (depthRemaining > 0 && nextEnergy > 0.24 && !shouldDeadwood) {
                const continuationHeading = normalizeHeading(vecLerp(claim.heading, bud.heading, phase === 'trunk' ? 0.18 : 0.34));
                nextBuds.push({
                    id: `${bud.id}_c${step}`,
                    parentNodeId: nodeId,
                    position: p1,
                    heading: continuationHeading,
                    order: childOrder,
                    depth: Math.max(0, Math.floor(toNumber(bud.depth, 0))) + 1,
                    vigor: clamp01(toNumber(node.vigor, 0.5) * 0.96),
                    energy: nextEnergy,
                    dormancy: 0,
                    splitBudget: Math.max(0, Math.floor(toNumber(bud.splitBudget, 0))),
                    sideSign: bud.sideSign,
                });
            }

            const trunkProgress = clamp01(toNumber(p1?.[1], 0) / Math.max(1, constraints.bounds.height));
            const canSplit = (
                depthRemaining > 1
                && Math.max(0, Math.floor(toNumber(bud.splitBudget, 0))) > 0
                && tree.nodeCount() < constraints.maxNodes
                && (
                    (childOrder === 0 && trunkProgress >= lerp(0.22, 0.5, clamp01(runtime?.backbone?.firstSplitHeightRatio)))
                    || (childOrder > 0 && childOrder < 3 && nextEnergy > 0.32)
                )
            );
            const splitRoll = sampleRandom(`v3_split_${nodeId}`, step);
            const splitThreshold = childOrder === 0
                ? clamp01(0.28 + (clamp01(runtime?.lineage?.branchDensity) * 0.46))
                : clamp01(
                    0.36
                    + (clamp01(runtime?.lineage?.splitBias) * 0.34)
                    + (clamp01(runtime?.lineage?.branchDensity) * 0.18)
                    + (terminalChance * 0.08),
                );
            if (canSplit && splitRoll < splitThreshold) {
                const splitSign = (Math.sign(toNumber(bud.sideSign, 1)) || 1) * (sampleRandom(`v3_split_side_${nodeId}`, step) < 0.5 ? -1 : 1);
                const splitAngle = (splitSign * lerp(28, 58, clamp01(runtime?.lineage?.branchRhythm))) * Math.PI / 180;
                nextBuds.push({
                    id: `${bud.id}_s${step}`,
                    parentNodeId: nodeId,
                    position: p1,
                    heading: normalizeHeading(rotate2D(claim.heading, splitAngle)),
                    order: Math.min(4, childOrder + 1),
                    depth: Math.max(0, Math.floor(toNumber(bud.depth, 0))) + 1,
                    vigor: clamp01(toNumber(node.vigor, 0.5) * 0.84),
                    energy: clamp01(nextEnergy * lerp(0.62, 0.84, clamp01(runtime?.lineage?.splitBias))),
                    dormancy: 0,
                    splitBudget: Math.max(0, Math.floor(toNumber(bud.splitBudget, 0)) - 1),
                    sideSign: splitSign,
                });
                actionCounts.split += 1;
            }
        });

        activeBuds = nextBuds
            .filter((bud) => (
                tree.nodeCount() < constraints.maxNodes
                && toNumber(bud.energy, 0) > 0.18
                && toNumber(bud.depth, 0) <= constraints.maxDepth
            ))
            .slice(0, Math.max(4, Math.round(lerp(8, 22, clamp01(runtime?.lineage?.branchDensity)))));

        pushEvent(step, 'STEP_END', {
            activeBudCount: activeBuds.length,
            nodeCount: tree.nodeCount(),
        });
    }

    const topology = tree.toSerializable();
    const features = resolveVNextMorphologyFeatures(topology);
    const diagnostics = {
        engineVersion: 3,
        nodeCount: tree.nodeCount(),
        stepCount: Math.max(1, Math.min(constraints.maxSteps, selectedClaims.length + rejectedClaims.length)),
        attractorCount: attractors.length,
        claimedAttractorCount: attractors.filter((entry) => entry.claimedBy).length,
        selectedClaimCount: selectedClaims.length,
        rejectedClaimCount: rejectedClaims.length,
        activeBudCount: activeBuds.length,
        actionCounts,
        warnings: [],
    };
    pushEvent(constraints.maxSteps, 'RUN_END', {
        diagnostics,
    });

    const renderScene = buildRenderSceneV1({
        topology,
        attractors,
        claims: selectedClaims,
        bounds: constraints.bounds,
    });

    return {
        topology,
        provenance: provenanceRecorder.toSerializable(),
        features,
        diagnostics,
        factorVector,
        renderScene,
        runtime: {
            version: 3,
            descriptors: runtime?.descriptors || {},
            attractorField: {
                debug: {
                    attractorCount: diagnostics.attractorCount,
                    claimedAttractorCount: diagnostics.claimedAttractorCount,
                    topAttractors: renderScene.attractors.slice(0, 10),
                },
            },
            claimCompetition: {
                debug: {
                    selectedClaims: renderScene.claims.slice(0, 18),
                    rejectedClaimCount: diagnostics.rejectedClaimCount,
                    actionCounts,
                },
            },
        },
    };
};
