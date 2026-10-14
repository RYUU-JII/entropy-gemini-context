import { ShapePriorModel } from '../../bonsai/generation/shapePriorModel';
import { StructuralNodeRandom } from '../../bonsai/random/StructuralHashRandom';
import { TerminalGenerationPolicyModel } from '../../bonsai/generation/terminalGenerationPolicyModel';
import { resolveVNextRuntimeV2 } from '../core/v2/resolveVNextRuntimeV2';
import { lerp } from '../core/v2/VNextGrowthMath';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const nextRandom = (rng, decisionType) => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return 0.5;
};
const mixHex = (left = '#FFFFFF', right = '#FFFFFF', t = 0.5) => {
    const safeT = clamp01(t);
    const parse = (hex) => {
        const normalized = String(hex || '').replace('#', '');
        if (normalized.length !== 6) {
            return [255, 255, 255];
        }
        return [
            Number.parseInt(normalized.slice(0, 2), 16),
            Number.parseInt(normalized.slice(2, 4), 16),
            Number.parseInt(normalized.slice(4, 6), 16),
        ];
    };
    const [lr, lg, lb] = parse(left);
    const [rr, rg, rb] = parse(right);
    const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');
    return `#${toHex(lerp(lr, rr, safeT))}${toHex(lerp(lg, rg, safeT))}${toHex(lerp(lb, rb, safeT))}`;
};

const normalizeAngle = (radians = 0) => {
    let value = toNumber(radians, 0);
    while (value > Math.PI) {
        value -= Math.PI * 2;
    }
    while (value < -Math.PI) {
        value += Math.PI * 2;
    }
    return value;
};

const toPoint2 = (vec3 = [0, 0, 0], origin = [0, 0, 0]) => ({
    x: toNumber(vec3?.[0], 0) - toNumber(origin?.[0], 0),
    y: -(toNumber(vec3?.[1], 0) - toNumber(origin?.[1], 0)),
});

const segmentAngle = (start = { x: 0, y: 0 }, end = { x: 0, y: -1 }) => (
    Math.atan2(toNumber(end?.y, -1) - toNumber(start?.y, 0), toNumber(end?.x, 0) - toNumber(start?.x, 0))
);

const segmentLength = (start = { x: 0, y: 0 }, end = { x: 0, y: -1 }) => {
    const dx = toNumber(end?.x, 0) - toNumber(start?.x, 0);
    const dy = toNumber(end?.y, 0) - toNumber(start?.y, 0);
    return Math.sqrt((dx * dx) + (dy * dy));
};

const averageAngles = (angles = []) => {
    if (!angles.length) {
        return null;
    }
    const vector = angles.reduce((acc, angle) => ({
        x: acc.x + Math.cos(toNumber(angle, 0)),
        y: acc.y + Math.sin(toNumber(angle, 0)),
    }), { x: 0, y: 0 });
    if (Math.abs(vector.x) < 1e-6 && Math.abs(vector.y) < 1e-6) {
        return null;
    }
    return Math.atan2(vector.y, vector.x);
};

const resolveBranchCurvature = ({
    geo = null,
    parentGeo = null,
    childGeos = [],
    order = 0,
} = {}) => {
    const length = Math.max(0.2, toNumber(geo?.length, 1));
    const currentAngle = toNumber(geo?.angle, -Math.PI / 2);
    const parentAngle = parentGeo ? toNumber(parentGeo?.angle, currentAngle) : null;
    const childMeanAngle = averageAngles(childGeos.map((entry) => entry?.angle).filter(Number.isFinite));
    const inboundTurn = parentAngle === null ? 0 : normalizeAngle(currentAngle - parentAngle);
    const outboundTurn = childMeanAngle === null ? (inboundTurn * 0.55) : normalizeAngle(childMeanAngle - currentAngle);
    const flowWeight = order <= 0 ? 1.05 : order === 1 ? 0.82 : order === 2 ? 0.54 : 0.28;
    const maxCurve = Math.max(0.45, length * (order <= 0 ? 0.24 : order === 1 ? 0.18 : 0.11));
    let curveIn = clamp(Math.sin(inboundTurn) * length * 0.34 * flowWeight, -maxCurve, maxCurve);
    let curveOut = clamp(Math.sin(outboundTurn) * length * 0.3 * flowWeight, -maxCurve, maxCurve);

    if (parentAngle === null && childMeanAngle !== null) {
        curveIn = curveOut * 0.72;
    }
    if (childMeanAngle === null) {
        curveOut = curveIn * 0.58;
    }
    if (order >= 2) {
        curveIn *= 0.74;
        curveOut *= 0.74;
    }

    return {
        curveIn,
        curveOut,
        curve: (curveIn + curveOut) * 0.5,
    };
};

const resolveAttachT = ({
    parentStart = { x: 0, y: 0 },
    parentEnd = { x: 0, y: -1 },
    childStart = { x: 0, y: 0 },
} = {}) => {
    const vx = toNumber(parentEnd?.x, 0) - toNumber(parentStart?.x, 0);
    const vy = toNumber(parentEnd?.y, 0) - toNumber(parentStart?.y, 0);
    const wx = toNumber(childStart?.x, 0) - toNumber(parentStart?.x, 0);
    const wy = toNumber(childStart?.y, 0) - toNumber(parentStart?.y, 0);
    const denom = Math.max(1e-9, (vx * vx) + (vy * vy));
    return clamp(((wx * vx) + (wy * vy)) / denom, 0, 1);
};

const buildNodeMap = (topology = {}) => {
    const list = Array.isArray(topology?.nodes) ? topology.nodes : [];
    const byId = new Map();
    const childrenByParent = new Map();
    list.forEach((node) => {
        const id = typeof node?.id === 'string' ? node.id : null;
        if (!id) {
            return;
        }
        byId.set(id, node);
        const parentId = typeof node?.parentId === 'string' ? node.parentId : null;
        if (!parentId) {
            return;
        }
        if (!childrenByParent.has(parentId)) {
            childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId).push(id);
    });
    return {
        byId,
        childrenByParent,
    };
};

const pickAnchorRootId = (rootIds = [], byId = new Map()) => {
    if (!rootIds.length) {
        return null;
    }
    return [...rootIds].sort((leftId, rightId) => {
        const left = byId.get(leftId) || {};
        const right = byId.get(rightId) || {};
        const leftWeight = (toNumber(left.radius0, 0.2) * 0.66) + (toNumber(left.length, 1) * 0.34);
        const rightWeight = (toNumber(right.radius0, 0.2) * 0.66) + (toNumber(right.length, 1) * 0.34);
        return rightWeight - leftWeight;
    })[0];
};

const buildGeoMap = ({ byId, origin }) => {
    const geoById = new Map();
    byId.forEach((node, id) => {
        const start = toPoint2(node?.p0, origin);
        const end = toPoint2(node?.p1, origin);
        geoById.set(id, {
            start,
            end,
            length: Math.max(0.2, segmentLength(start, end)),
            angle: segmentAngle(start, end),
        });
    });
    return geoById;
};

const resolveBranchOrder = (node = {}) => Math.max(0, Math.floor(toNumber(node?.order, 0)));

const DEFAULT_VNEXT_RENDER_STAGE = Object.freeze({
    depth: 6,
    flowerChance: 1,
    leafChance: 1,
});

const hasTag = (node = {}, prefix = '') => (
    Array.isArray(node?.tags) && node.tags.some((tag) => String(tag || '').startsWith(prefix))
);

const getTaggedValue = (node = {}, prefix = '') => {
    if (!Array.isArray(node?.tags)) {
        return null;
    }
    const matched = node.tags.find((tag) => String(tag || '').startsWith(prefix));
    if (!matched) {
        return null;
    }
    return String(matched).slice(prefix.length);
};

const buildVNextSakuraGene = ({
    factorVector = {},
    currentStage = DEFAULT_VNEXT_RENDER_STAGE,
} = {}) => {
    const resolved = resolveVNextRuntimeV2({
        factors: factorVector,
        stage: currentStage?.flowerChance > 0.8 ? 'display' : 'mature',
    });
    const profile = resolved?.runtime?.sakura || {};
    const lineageRuntime = resolved?.runtime?.lineage || {};
    const backboneRuntime = resolved?.runtime?.backbone || {};
    const descriptors = resolved?.runtime?.descriptors || {};
    const branchDensity = clamp01(toNumber(resolved?.runtime?.lineage?.branchDensity, 0.52));
    return {
        branchingProb: clamp01(branchDensity * 1.02),
        branchChaos: profile.branchChaos,
        speciesCharacter: profile.speciesCharacter,
        foliageMin: profile.foliageMin,
        foliageVar: profile.foliageVar,
        flowerChance: profile.flowerChance,
        bloomPeak: profile.bloomPeak,
        leafSuppressionAtPeak: profile.leafSuppressionAtPeak,
        petalWarmth: profile.petalWarmth,
        leafFreshness: profile.leafFreshness,
        petalFallDensity: profile.petalFallDensity,
        bloomOuterAdvance: profile.bloomOuterAdvance,
        bloomInnerDelay: profile.bloomInnerDelay,
        bloomPhaseGradient: profile.bloomPhaseGradient,
        bloomWaveAmplitude: profile.bloomWaveAmplitude,
        bloomWaveApexDelay: profile.bloomWaveApexDelay,
        bloomWaveLateralAdvance: profile.bloomWaveLateralAdvance,
        bloomWaveLineageVariance: profile.bloomWaveLineageVariance,
        petalFallWaveAmplitude: profile.petalFallWaveAmplitude,
        petalFallOuterDrift: profile.petalFallOuterDrift,
        petalFallShelterDelay: profile.petalFallShelterDelay,
        petalFallLineageVariance: profile.petalFallLineageVariance,
        flowerDominance: profile.flowerDominance,
        flowerOuterBias: profile.flowerOuterBias,
        flowerClusterTightness: profile.flowerClusterTightness,
        flowerClusterCountBias: profile.flowerClusterCountBias,
        seasonalBloomBias: profile.seasonalBloomBias,
        lengthBase: profile.lengthBase,
        bloomClusterBias: profile.bloomClusterBias,
        twigNodeBloomChance: profile.twigNodeBloomChance,
        canopyBloomDensity: profile.canopyBloomDensity,
        crownOpenness: profile.crownOpenness,
        spurTendency: profile.spurTendency,
        lightSeeking: clamp01(toNumber(descriptors?.lightSeeking, lineageRuntime?.phototropism ?? 0.5)),
        windsweptBias: toNumber(lineageRuntime?.windsweptBias, backboneRuntime?.windsweptBias ?? 0),
        droopTendency: clamp01(toNumber(profile?.droopTendency, lineageRuntime?.cascadeBias ?? 0.2)),
    };
};

const resolveSeasonalFlowerPalette = (gene = {}) => {
    const warmth = clamp01(toNumber(gene?.petalWarmth, 0.5));
    const bloomPeak = clamp01(toNumber(gene?.bloomPeak, 0.5));
    return [
        mixHex('#FFF8FB', '#FFE3EB', warmth * 0.55),
        mixHex('#FFE7EF', '#FFC4D1', (warmth * 0.72) + (bloomPeak * 0.08)),
        mixHex('#FFD0DE', '#F3A8BD', (warmth * 0.82) + (bloomPeak * 0.12)),
    ];
};

const resolveSeasonalLeafPalette = (gene = {}) => {
    const freshness = clamp01(toNumber(gene?.leafFreshness, 0.5));
    const bloomPeak = clamp01(toNumber(gene?.bloomPeak, 0.5));
    return [
        mixHex('#A7D88A', '#7FBF5C', freshness * 0.74),
        mixHex('#8BC56D', '#5F9D42', (freshness * 0.48) + ((1 - bloomPeak) * 0.18)),
        mixHex('#6DA44F', '#436F2E', (freshness * 0.22) + ((1 - bloomPeak) * 0.52)),
    ];
};

const resolveSeasonalStage = (currentStage = DEFAULT_VNEXT_RENDER_STAGE, gene = {}) => {
    const bloomPeak = clamp01(toNumber(gene?.bloomPeak, 0.5));
    const flowerLift = lerp(0.94, 1.12, bloomPeak);
    const leafSuppression = clamp01(
        toNumber(gene?.leafSuppressionAtPeak, 0.24)
        * clamp01((toNumber(currentStage?.flowerChance, 1) * 0.7) + (bloomPeak * 0.3)),
    );
    return {
        ...currentStage,
        flowerChance: clamp01(toNumber(currentStage?.flowerChance, 1) * flowerLift),
        leafChance: clamp01(Math.max(0.08, toNumber(currentStage?.leafChance, 1) * (1 - leafSuppression))),
        phenology: {
            bloomPeak,
            leafSuppression,
            petalWarmth: clamp01(toNumber(gene?.petalWarmth, 0.5)),
            leafFreshness: clamp01(toNumber(gene?.leafFreshness, 0.5)),
            petalFallDensity: clamp01(toNumber(gene?.petalFallDensity, 0.2)),
        },
    };
};

const resolveBranchBloomWaveOffset = ({
    node = {},
    geo = {},
    gene = {},
    terminalHint = null,
    seed = 0,
} = {}) => {
    const angle = normalizeAngle(toNumber(geo?.angle, -Math.PI / 2));
    const verticalAffinity = clamp01(
        1 - (Math.abs(normalizeAngle(angle - (-Math.PI / 2))) / (Math.PI / 2)),
    );
    const lateralAffinity = clamp01(Math.abs(Math.cos(angle)));
    const outwardness = clamp01(
        Math.abs(toNumber(geo?.end?.x, 0))
        / Math.max(
            1.2,
            Math.abs(toNumber(geo?.end?.x, 0)) + (Math.abs(toNumber(geo?.end?.y, 0)) * 0.8),
        ),
    );
    const apexAffinity = clamp01(
        (verticalAffinity * 0.7)
        + ((terminalHint === 'spur') ? 0.18 : 0)
        + ((1 - outwardness) * 0.12),
    );
    const lateralCanopyAffinity = clamp01(
        (lateralAffinity * 0.56)
        + (outwardness * 0.28)
        + ((terminalHint === 'cluster') ? 0.12 : 0)
        + ((terminalHint === null) ? 0.04 : 0),
    );
    const amplitude = clamp01(toNumber(gene?.bloomWaveAmplitude, 0.5));
    const apexDelay = clamp01(toNumber(gene?.bloomWaveApexDelay, 0.5));
    const lateralAdvance = clamp01(toNumber(gene?.bloomWaveLateralAdvance, 0.5));
    const lineageVariance = clamp01(toNumber(gene?.bloomWaveLineageVariance, 0.3));
    const lineageRng = new StructuralNodeRandom({
        seed,
        nodeId: `${String(node?.id || 'node')}:bloom_wave`,
    });
    const lineageJitter = (nextRandom(lineageRng, 'branch_wave_phase') - 0.5)
        * lerp(0.04, 0.18, lineageVariance);

    return clamp(
        (
            (lateralCanopyAffinity * lerp(0.04, 0.18, lateralAdvance))
            - (apexAffinity * lerp(0.04, 0.16, apexDelay))
            + lineageJitter
        ) * lerp(0.46, 1, amplitude),
        -0.26,
        0.26,
    );
};

const resolveBranchPetalFallOffset = ({
    node = {},
    geo = {},
    gene = {},
    terminalHint = null,
    lineageBloomOffset = 0,
    seed = 0,
} = {}) => {
    const angle = normalizeAngle(toNumber(geo?.angle, -Math.PI / 2));
    const verticalAffinity = clamp01(
        1 - (Math.abs(normalizeAngle(angle - (-Math.PI / 2))) / (Math.PI / 2)),
    );
    const lateralAffinity = clamp01(Math.abs(Math.cos(angle)));
    const outwardness = clamp01(
        Math.abs(toNumber(geo?.end?.x, 0))
        / Math.max(
            1.2,
            Math.abs(toNumber(geo?.end?.x, 0)) + (Math.abs(toNumber(geo?.end?.y, 0)) * 0.8),
        ),
    );
    const exposedCanopy = clamp01(
        (outwardness * 0.48)
        + (lateralAffinity * 0.32)
        + ((terminalHint === 'cluster') ? 0.14 : 0)
        + ((terminalHint === null) ? 0.06 : 0),
    );
    const shelteredCanopy = clamp01(
        (verticalAffinity * 0.36)
        + ((terminalHint === 'spur') ? 0.16 : 0)
        + ((1 - outwardness) * 0.18),
    );
    const amplitude = clamp01(toNumber(gene?.petalFallWaveAmplitude, 0.5));
    const outerDrift = clamp01(toNumber(gene?.petalFallOuterDrift, 0.5));
    const shelterDelay = clamp01(toNumber(gene?.petalFallShelterDelay, 0.5));
    const lineageVariance = clamp01(toNumber(gene?.petalFallLineageVariance, 0.3));
    const lineageRng = new StructuralNodeRandom({
        seed,
        nodeId: `${String(node?.id || 'node')}:petal_fall_wave`,
    });
    const jitter = (nextRandom(lineageRng, 'petal_fall_phase') - 0.5)
        * lerp(0.04, 0.16, lineageVariance);

    return clamp(
        (
            clamp(toNumber(lineageBloomOffset, 0), -0.24, 0.24) * 0.76
            + (exposedCanopy * lerp(0.04, 0.2, outerDrift))
            - (shelteredCanopy * lerp(0.04, 0.16, shelterDelay))
            + jitter
        ) * lerp(0.42, 1, amplitude),
        -0.28,
        0.32,
    );
};

const resolveBranchRenderDynamics = ({
    node = {},
    geo = {},
    gene = {},
    order = 0,
    seed = 0,
} = {}) => {
    const angle = normalizeAngle(toNumber(geo?.angle, -Math.PI / 2));
    const upness = clamp01(-Math.sin(angle));
    const lateralness = clamp01(Math.abs(Math.cos(angle)));
    const outwardness = clamp01(
        Math.abs(toNumber(geo?.end?.x, 0))
        / Math.max(
            1.2,
            Math.abs(toNumber(geo?.end?.x, 0)) + (Math.abs(toNumber(geo?.end?.y, 0)) * 0.82),
        ),
    );
    const depth = Math.max(0, Math.floor(toNumber(node?.depth, order)));
    const depthGain = clamp01(depth / 5);
    const branchiness = order <= 0
        ? 0.08
        : (order === 1 ? 0.3 : (order === 2 ? 0.62 : 0.82));
    const nodeWidth = Math.max(0.08, toNumber(node?.radius0, 0.22) * 2);
    const widthFlex = clamp01(1 - (nodeWidth / 2.4));
    const flexibility = clamp01(
        0.08
        + (branchiness * 0.38)
        + (lateralness * 0.22)
        + (outwardness * 0.18)
        + (depthGain * 0.1)
        + (widthFlex * 0.16),
    );
    const lightSeeking = clamp01(toNumber(gene?.lightSeeking, 0.5));
    const windBias = toNumber(gene?.windsweptBias, 0);
    const droopTendency = clamp01(toNumber(gene?.droopTendency, 0.22));
    const dynamicsRng = new StructuralNodeRandom({
        seed,
        nodeId: `${String(node?.id || 'node')}:render_dynamics`,
    });
    return {
        windExposure: clamp01((lateralness * 0.56) + (outwardness * 0.28) + (depthGain * 0.16)),
        lightExposure: clamp01((upness * 0.42) + (outwardness * 0.24) + ((1 - lateralness) * 0.12) + (depthGain * 0.22)),
        swayPhase: nextRandom(dynamicsRng, 'sway_phase') * Math.PI * 2,
        swayFreq: lerp(0.016, 0.032, clamp01((flexibility * 0.68) + (lightSeeking * 0.16) + (Math.abs(windBias) * 0.16))),
        swayAmplitude: lerp(0.0015, 0.028, clamp01((flexibility * 0.72) + (Math.abs(windBias) * 0.18) + (depthGain * 0.1))),
        gustGain: lerp(0.002, 0.026, clamp01((flexibility * 0.62) + (Math.abs(windBias) * 0.26) + (outwardness * 0.12))),
        breathingAmp: lerp(0.001, 0.012, clamp01((flexibility * 0.66) + (lightSeeking * 0.18) + (depthGain * 0.16))),
        lightLift: -lerp(0.001, 0.02, clamp01((lightSeeking * 0.56) + (upness * 0.16) + (outwardness * 0.18) + (branchiness * 0.1))),
        windMemoryTilt: windBias * lerp(0.001, 0.018, clamp01((flexibility * 0.58) + (outwardness * 0.22) + (depthGain * 0.2))),
        droopTilt: lerp(0.0005, 0.02, clamp01((droopTendency * 0.62) + (branchiness * 0.24) + (lateralness * 0.14))),
        tipFlutter: lerp(0.0005, 0.01, clamp01((flexibility * 0.64) + (lightSeeking * 0.12) + (Math.abs(windBias) * 0.16) + (depthGain * 0.08))),
    };
};

const resolveNodeTerminals = ({
    node = {},
    geo = {},
    childIds = [],
    seed = 0,
    factorVector = {},
    currentStage = DEFAULT_VNEXT_RENDER_STAGE,
    resolvedGene = null,
} = {}) => {
    const order = resolveBranchOrder(node);
    if (childIds.length && order <= 1 && !hasTag(node, 'terminal:')) {
        return [];
    }
    const gene = resolvedGene || buildVNextSakuraGene({
        factorVector,
        currentStage,
    });
    const terminalHint = getTaggedValue(node, 'terminal:') || null;
    const padTerminal = getTaggedValue(node, 'pad_terminal:') || null;
    const padProfile = getTaggedValue(node, 'pad_profile:') || null;
    const padCompactness = getTaggedValue(node, 'pad_compactness:') || 'balanced';
    const rng = new StructuralNodeRandom({
        seed,
        nodeId: `${String(node?.id || 'node')}:terminal`,
    });
    const width = Math.max(0.08, toNumber(node?.radius0, 0.2) * 2);
    const length = Math.max(0.4, toNumber(geo?.length, toNumber(node?.length, 1)));
    const seasonalStage = resolveSeasonalStage(currentStage, gene);
    const seasonalFlowerColors = resolveSeasonalFlowerPalette(gene);
    const seasonalLeafColors = resolveSeasonalLeafPalette(gene);
    const clusterCountBias = clamp01(toNumber(gene.flowerClusterCountBias, gene.bloomClusterBias));
    const clusterTightness = clamp01(toNumber(gene.flowerClusterTightness, gene.bloomClusterBias));
    const outerBias = clamp01(toNumber(gene.flowerOuterBias, gene.bloomClusterBias));
    const flowerDominance = clamp01(toNumber(gene.flowerDominance, gene.flowerChance));
    const padCompactnessShift = padCompactness === 'compact'
        ? 0.1
        : (padCompactness === 'open' ? -0.08 : 0);
    const padWidthGain = padCompactness === 'compact'
        ? 0.9
        : (padCompactness === 'open' ? 1.14 : 1);
    const padClusterTightness = clamp01(
        clusterTightness
        + padCompactnessShift
        + (padTerminal === 'cluster' ? -0.04 : 0)
        + (padProfile === 'flower_pad' ? -0.06 : 0),
    );
    const padOuterBias = clamp01(
        outerBias
        + (padProfile === 'sweep_pad' || padProfile === 'counter_pad' ? 0.08 : 0)
        + (padProfile === 'apex_pad' ? -0.06 : 0),
    );
    const padClusterCountBias = clamp01(
        clusterCountBias
        + (padTerminal === 'cluster' ? 0.08 : 0)
        + (padProfile === 'flower_pad' ? 0.06 : 0),
    );
    const lineageBloomOffset = resolveBranchBloomWaveOffset({
        node,
        geo,
        gene,
        terminalHint,
        seed,
    });
    const lineagePetalFallOffset = resolveBranchPetalFallOffset({
        node,
        geo,
        gene,
        terminalHint,
        lineageBloomOffset,
        seed,
    });
    if (terminalHint === 'spur') {
        return TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
            rng,
            gene,
            clusterCount: Math.max(2, Math.round(2 + gene.spurTendency * 2 + padClusterCountBias)),
            canopyBloomRadius: lerp(0.18, 0.34, 1 - padClusterTightness),
            canopyWidth: clamp((length * 0.42 + width * 1.08) * padWidthGain, 1.4, 5.9),
            apexWeight: 0.4,
            centerBias: 0,
            flowerBias: clamp01(gene.flowerChance * lerp(0.96, 1.18, flowerDominance)),
            flowerVisualGate: clamp01(seasonalStage?.flowerChance ?? 1),
            leafVisualGate: clamp01(seasonalStage?.leafChance ?? 1),
            clusterTightness: padClusterTightness,
            outerBias: padOuterBias,
            flowerDominance,
            flowerColors: seasonalFlowerColors,
            leafColors: seasonalLeafColors,
            lineageBloomOffset,
            lineagePetalFallOffset,
        });
    }
    if (terminalHint === 'cluster' && order >= 2) {
        return TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
            rng,
            gene,
            clusterCount: Math.max(2, Math.round(2 + (padClusterCountBias * 3))),
            canopyBloomRadius: lerp(0.16, 0.32, 1 - padClusterTightness),
            canopyWidth: clamp((length * lerp(0.28, 0.42, padOuterBias) + width * 1.18) * padWidthGain, 1.4, 5.8),
            apexWeight: lerp(0.18, 0.38, padOuterBias),
            centerBias: (nextRandom(rng, 'cluster_center_bias') - 0.5) * lerp(0.2, 0.58, 1 - padClusterTightness),
            flowerBias: clamp01(gene.flowerChance * lerp(0.94, 1.22, flowerDominance)),
            flowerVisualGate: clamp01(seasonalStage?.flowerChance ?? 1),
            leafVisualGate: clamp01(seasonalStage?.leafChance ?? 1),
            clusterTightness: padClusterTightness,
            outerBias: padOuterBias,
            flowerDominance,
            flowerColors: seasonalFlowerColors,
            leafColors: seasonalLeafColors,
            lineageBloomOffset,
            lineagePetalFallOffset,
        });
    }
    if (!childIds.length && order >= 2) {
        return TerminalGenerationPolicyModel.resolveSakuraTerminalSet({
            rng,
            gene,
            currentStage: seasonalStage,
            length,
            width,
            flowerColors: seasonalFlowerColors,
            leafColors: seasonalLeafColors,
            lineageBloomOffset,
            lineagePetalFallOffset,
        });
    }
    if (order >= 2) {
        return TerminalGenerationPolicyModel.resolveSakuraTwigNodeBloomSet({
            rng,
            gene,
            currentStage: seasonalStage,
            length,
            flowerColors: seasonalFlowerColors,
            leafColors: seasonalLeafColors,
            lineageBloomOffset,
            lineagePetalFallOffset,
        });
    }
    return [];
};

const buildTreeNode = ({
    nodeId,
    byId,
    childrenByParent,
    geoById,
    factorVector,
    currentStage,
    seed,
    resolvedGene = null,
} = {}) => {
    const node = byId.get(nodeId);
    const geo = geoById.get(nodeId);
    if (!node || !geo) {
        return null;
    }
    const order = resolveBranchOrder(node);
    const childIds = childrenByParent.get(nodeId) || [];
    const childGeos = childIds
        .map((childId) => geoById.get(childId))
        .filter(Boolean);
    const parentGeo = typeof node?.parentId === 'string'
        ? geoById.get(node.parentId) || null
        : null;
    const curvature = resolveBranchCurvature({
        geo,
        parentGeo,
        childGeos,
        order,
    });
    const branch = {
        type: 'branch',
        nodeId,
        branchOrder: order,
        branchOrderName: ShapePriorModel.resolveSakuraOrderName(order),
        length: geo.length,
        width: Math.max(0.08, toNumber(node.radius0, 0.2) * 2),
        curve: curvature.curve,
        curveIn: curvature.curveIn,
        curveOut: curvature.curveOut,
        lenticels: [],
        branches: [],
        terminals: resolveNodeTerminals({
            node,
            geo,
            childIds,
            seed,
            factorVector,
            currentStage,
            resolvedGene,
        }),
        renderDynamics: resolveBranchRenderDynamics({
            node,
            geo,
            gene: resolvedGene || buildVNextSakuraGene({
                factorVector,
                currentStage,
            }),
            order,
            seed,
        }),
    };
    childIds.forEach((childId) => {
        const childGeo = geoById.get(childId);
        if (!childGeo) {
            return;
        }
        const childBranch = buildTreeNode({
            nodeId: childId,
            byId,
            childrenByParent,
            geoById,
            factorVector,
            currentStage,
            seed,
            resolvedGene,
        });
        if (!childBranch) {
            return;
        }
        branch.branches.push({
            obj: childBranch,
            angleOffset: normalizeAngle(childGeo.angle - geo.angle),
            t: resolveAttachT({
                parentStart: geo.start,
                parentEnd: geo.end,
                childStart: childGeo.start,
            }),
        });
    });
    return branch;
};

export const adaptVNextTopologyToTreeV1 = (topology = {}, {
    presetId = null,
    factorVector = {},
    currentStage = null,
} = {}) => {
    const { byId, childrenByParent } = buildNodeMap(topology);
    const rootIdsRaw = Array.isArray(topology?.roots)
        ? topology.roots.filter((id) => byId.has(id))
        : [...byId.values()]
            .filter((node) => !node?.parentId && typeof node?.id === 'string')
            .map((node) => node.id);
    if (!rootIdsRaw.length) {
        return null;
    }
    const anchorRootId = pickAnchorRootId(rootIdsRaw, byId);
    const anchorNode = byId.get(anchorRootId);
    const origin = Array.isArray(anchorNode?.p0) ? anchorNode.p0 : [0, 0, 0];
    const geoById = buildGeoMap({ byId, origin });
    const maxDepth = [...byId.values()].reduce((acc, node) => Math.max(acc, Math.floor(toNumber(node?.depth, 0))), 0) + 1;
    const maxRootWidth = rootIdsRaw.reduce((acc, id) => {
        const root = byId.get(id);
        return Math.max(acc, toNumber(root?.radius0, 0.2) * 2);
    }, 0.6);
    const resolvedGene = buildVNextSakuraGene({
        factorVector,
        currentStage: currentStage || DEFAULT_VNEXT_RENDER_STAGE,
    });

    const primaryRoot = buildTreeNode({
        nodeId: anchorRootId,
        byId,
        childrenByParent,
        geoById,
        factorVector,
        currentStage: currentStage || DEFAULT_VNEXT_RENDER_STAGE,
        seed: Math.floor(toNumber(topology?.seed, 0)),
        resolvedGene,
    });
    if (!primaryRoot) {
        return null;
    }

    const rootAngle = geoById.get(anchorRootId)?.angle ?? (-Math.PI / 2);
    let root = primaryRoot;
    if (rootIdsRaw.length > 1) {
        const synthetic = {
            type: 'branch',
            nodeId: 'vnext_synthetic_root',
            branchOrder: 0,
            branchOrderName: 'trunk',
            length: 1,
            width: Math.max(0.2, maxRootWidth * 1.05),
            curve: 0.12,
            curveIn: 0.08,
            curveOut: 0.12,
            lenticels: [],
            branches: [],
            terminals: [],
        };
        rootIdsRaw.forEach((rootId) => {
            const rootBranch = buildTreeNode({
                nodeId: rootId,
                byId,
                childrenByParent,
                geoById,
                factorVector,
                currentStage: currentStage || DEFAULT_VNEXT_RENDER_STAGE,
                seed: Math.floor(toNumber(topology?.seed, 0)),
                resolvedGene,
            });
            if (!rootBranch) {
                return;
            }
            const branchAngle = geoById.get(rootId)?.angle ?? (-Math.PI / 2);
            synthetic.branches.push({
                obj: rootBranch,
                angleOffset: normalizeAngle(branchAngle - (-Math.PI / 2)),
                t: 1,
            });
        });
        root = synthetic;
    }

    root.initialAngle = rootAngle;
    root.visualPhenotype = {
        potScale: 1,
        trunkOffsetX: 0,
        windMemory: clamp01((Math.abs(resolvedGene?.windsweptBias ?? 0) * 0.6) + 0.2),
        morphologyProfile: presetId || 'vnext',
    };
    root.speciesType = 'sakura';
    root.geneProfile = {
        silhouetteTarget: factorVector?.droop_bias ?? factorVector?.cascade_bias ?? 0.26,
        speciesCharacter: resolvedGene.speciesCharacter ?? 0.5,
        seasonalBloomBias: resolvedGene.seasonalBloomBias ?? 0.5,
        bloomPeak: resolvedGene.bloomPeak ?? 0.5,
        leafSuppressionAtPeak: resolvedGene.leafSuppressionAtPeak ?? 0.24,
        petalWarmth: resolvedGene.petalWarmth ?? 0.5,
        bloomOuterAdvance: resolvedGene.bloomOuterAdvance ?? 0.5,
        bloomInnerDelay: resolvedGene.bloomInnerDelay ?? 0.5,
        bloomPhaseGradient: resolvedGene.bloomPhaseGradient ?? 0.5,
        bloomWaveAmplitude: resolvedGene.bloomWaveAmplitude ?? 0.5,
        bloomWaveApexDelay: resolvedGene.bloomWaveApexDelay ?? 0.5,
        bloomWaveLateralAdvance: resolvedGene.bloomWaveLateralAdvance ?? 0.5,
        bloomWaveLineageVariance: resolvedGene.bloomWaveLineageVariance ?? 0.3,
        petalFallWaveAmplitude: resolvedGene.petalFallWaveAmplitude ?? 0.5,
        petalFallOuterDrift: resolvedGene.petalFallOuterDrift ?? 0.5,
        petalFallShelterDelay: resolvedGene.petalFallShelterDelay ?? 0.5,
        petalFallLineageVariance: resolvedGene.petalFallLineageVariance ?? 0.3,
        lightSeeking: resolvedGene.lightSeeking ?? 0.5,
        windsweptBias: resolvedGene.windsweptBias ?? 0,
        droopTendency: resolvedGene.droopTendency ?? 0.2,
        leafFreshness: resolvedGene.leafFreshness ?? 0.5,
        petalFallDensity: resolvedGene.petalFallDensity ?? 0.2,
    };
    root.trunkDepthModel = {
        trunkSegmentLimit: Math.max(1, maxDepth),
        scaffoldMaxDepth: Math.max(1, maxDepth - 1),
        twigMaxDepth: Math.max(1, maxDepth - 1),
    };
    return root;
};
