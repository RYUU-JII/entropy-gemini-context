import {
    createStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    createSakuraMacroSpineGuideV1,
    requireSakuraMacroSpineGuideV1,
    SAKURA_MACRO_SPINE_ANCHOR_MAX,
    SAKURA_MACRO_SPINE_ANCHOR_MIN,
    SAKURA_MACRO_SPINE_MAX_ARC_NORM,
    SAKURA_MACRO_SPINE_MIN_ANCHOR_GAP_NORM,
} from './sakuraMacroSpineGuide';

export const SAKURA_SPINE_REFERENCE_FAMILY_VERSION = 1;
export const SAKURA_SPINE_REFERENCE_FAMILY_CONTRACT =
    'zen_sakura_spine_reference_family_v1';
export const SAKURA_SPINE_REFERENCE_SAMPLE_VERSION = 1;
export const SAKURA_SPINE_REFERENCE_SAMPLE_CONTRACT =
    'zen_sakura_spine_reference_sample_v1';
export const SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS = 0.72;
export const SAKURA_SPINE_REFERENCE_VARIATION_POLICY_ID =
    'sakura_spine_reference_low_frequency_field_v1';

const FAMILY_ID_NAMESPACE = 'sakura_spine_reference_family_v1';
const EPSILON = 1e-9;
const NORMAL_VARIATION_LIMIT_NORM = 0.16;
const TANGENT_VARIATION_LIMIT_NORM = 0.075;
const PROJECTION_STEPS = 36;

const isObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const distance = (left, right) => Math.hypot(
    right.x - left.x,
    right.y - left.y,
);

const createFamilyId = ({ referenceGuideId, variationPolicyId }) => (
    createStructuralPlanIdV1(FAMILY_ID_NAMESPACE, [
        referenceGuideId,
        variationPolicyId,
    ])
);

const requireLikeness = (value) => {
    if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || value < 0
        || value > 1
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_LIKENESS_INVALID');
    }
    return value;
};

export const createSakuraSpineReferenceFamilyV1 = ({
    referenceGuide,
    likeness = SAKURA_SPINE_REFERENCE_DEFAULT_LIKENESS,
} = {}) => {
    const resolvedGuide = requireSakuraMacroSpineGuideV1(referenceGuide);
    const resolvedLikeness = requireLikeness(likeness);
    const familyId = createFamilyId({
        referenceGuideId: resolvedGuide.guideId,
        variationPolicyId: SAKURA_SPINE_REFERENCE_VARIATION_POLICY_ID,
    });
    return Object.freeze({
        version: SAKURA_SPINE_REFERENCE_FAMILY_VERSION,
        contract: SAKURA_SPINE_REFERENCE_FAMILY_CONTRACT,
        coordinateSpace: resolvedGuide.coordinateSpace,
        familyId,
        referenceGuideId: resolvedGuide.guideId,
        likeness: resolvedLikeness,
        variationPolicyId: SAKURA_SPINE_REFERENCE_VARIATION_POLICY_ID,
        referenceGuide: resolvedGuide,
    });
};

export const requireSakuraSpineReferenceFamilyV1 = (family) => {
    if (!isObject(family)) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_REQUIRED');
    }
    if (
        family.version !== SAKURA_SPINE_REFERENCE_FAMILY_VERSION
        || family.contract !== SAKURA_SPINE_REFERENCE_FAMILY_CONTRACT
        || family.variationPolicyId !== SAKURA_SPINE_REFERENCE_VARIATION_POLICY_ID
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_CONTRACT_INVALID');
    }
    const normalized = createSakuraSpineReferenceFamilyV1({
        referenceGuide: family.referenceGuide,
        likeness: family.likeness,
    });
    if (
        family.coordinateSpace !== normalized.coordinateSpace
        || family.referenceGuideId !== normalized.referenceGuideId
        || family.familyId !== normalized.familyId
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_ID_INVALID');
    }
    return family;
};

const requireStructuralRandom = (structuralRandom) => {
    if (
        typeof structuralRandom?.fork !== 'function'
        || typeof structuralRandom?.sample !== 'function'
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_STRUCTURAL_RANDOM_REQUIRED');
    }
    return structuralRandom;
};

const createAnchorStations = (anchors) => {
    const stationArcs = [0];
    let totalArc = 0;
    for (let index = 1; index < anchors.length; index += 1) {
        totalArc += distance(anchors[index - 1], anchors[index]);
        stationArcs.push(totalArc);
    }
    return stationArcs.map((arc) => arc / Math.max(EPSILON, totalArc));
};

const resolveAnchorFrame = (anchors, index) => {
    const previous = anchors[Math.max(0, index - 1)];
    const next = anchors[Math.min(anchors.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(EPSILON, Math.hypot(dx, dy));
    const tangentX = dx / length;
    const tangentY = dy / length;
    return {
        tangentX,
        tangentY,
        normalX: -tangentY,
        normalY: tangentX,
    };
};

const smoothstep01 = (value) => {
    const station = Math.max(0, Math.min(1, Number(value) || 0));
    return station * station * (3 - (2 * station));
};

const centeredSample = (random, decisionType) => (
    (Number(random.sample(decisionType, 0)) * 2) - 1
);

const sampleVariationCoefficients = (random) => Object.freeze({
    normalDrift: centeredSample(random, 'normal_drift'),
    normalArc: centeredSample(random, 'normal_arc'),
    normalWave: centeredSample(random, 'normal_wave'),
    tangentDrift: centeredSample(random, 'tangent_drift'),
    tangentArc: centeredSample(random, 'tangent_arc'),
});

const evaluateLowFrequencyField = ({ station, coefficients }) => {
    const progress = smoothstep01(station);
    const firstArc = Math.sin(Math.PI * station);
    const secondArc = Math.sin(Math.PI * 2 * station);
    return {
        normal: (
            (coefficients.normalDrift * progress)
            + (coefficients.normalArc * firstArc * 0.72)
            + (coefficients.normalWave * secondArc * 0.28)
        ) / 2,
        tangent: (
            (coefficients.tangentDrift * progress)
            + (coefficients.tangentArc * firstArc * 0.58)
        ) / 1.58,
    };
};

const resolveVariedAnchors = ({ referenceGuide, likeness, coefficients }) => {
    const anchors = referenceGuide.anchors;
    const stations = createAnchorStations(anchors);
    const variationStrength = likeness >= 1
        ? 0
        : Math.pow(1 - likeness, 0.82);
    const normalAmplitude = NORMAL_VARIATION_LIMIT_NORM * variationStrength;
    const tangentAmplitude = TANGENT_VARIATION_LIMIT_NORM * variationStrength;
    const displacements = anchors.map((anchor, index) => {
        if (index === 0) return { x: 0, y: 0 };
        const frame = resolveAnchorFrame(anchors, index);
        const field = evaluateLowFrequencyField({
            station: stations[index],
            coefficients,
        });
        const tangentShift = field.tangent * tangentAmplitude;
        const normalShift = field.normal * normalAmplitude;
        return {
            x: (frame.tangentX * tangentShift) + (frame.normalX * normalShift),
            y: (frame.tangentY * tangentShift) + (frame.normalY * normalShift),
        };
    });
    return { displacements, variationStrength };
};

const applyDisplacementScale = (anchors, displacements, scale) => anchors.map(
    (anchor, index) => ({
        x: index === 0 ? 0 : anchor.x + (displacements[index].x * scale),
        y: index === 0 ? 0 : anchor.y + (displacements[index].y * scale),
    }),
);

const isValidAnchorGeometry = (anchors) => {
    if (
        anchors.length < SAKURA_MACRO_SPINE_ANCHOR_MIN
        || anchors.length > SAKURA_MACRO_SPINE_ANCHOR_MAX
    ) return false;
    let totalArc = 0;
    for (let index = 1; index < anchors.length; index += 1) {
        const gap = distance(anchors[index - 1], anchors[index]);
        if (gap < SAKURA_MACRO_SPINE_MIN_ANCHOR_GAP_NORM) return false;
        totalArc += gap;
    }
    return totalArc <= SAKURA_MACRO_SPINE_MAX_ARC_NORM + EPSILON;
};

const projectVariationAmplitude = ({ anchors, displacements }) => {
    const full = applyDisplacementScale(anchors, displacements, 1);
    if (isValidAnchorGeometry(full)) {
        return { anchors: full, amplitudeScale: 1 };
    }
    let validScale = 0;
    let invalidScale = 1;
    for (let step = 0; step < PROJECTION_STEPS; step += 1) {
        const candidateScale = (validScale + invalidScale) * 0.5;
        const candidate = applyDisplacementScale(anchors, displacements, candidateScale);
        if (isValidAnchorGeometry(candidate)) {
            validScale = candidateScale;
        } else {
            invalidScale = candidateScale;
        }
    }
    return {
        anchors: applyDisplacementScale(anchors, displacements, validScale),
        amplitudeScale: validScale,
    };
};

export const sampleSakuraSpineReferenceFamilyV1 = ({
    family,
    structuralRandom,
} = {}) => {
    const resolvedFamily = requireSakuraSpineReferenceFamilyV1(family);
    const rootRandom = requireStructuralRandom(structuralRandom);
    const sampleRandom = rootRandom.fork({
        depth: 0,
        nodeRole: 'spine_reference_family',
        nodeSlot: 0,
        decisionType: resolvedFamily.familyId,
    });
    if (typeof sampleRandom?.sample !== 'function') {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_SAMPLE_RANDOM_INVALID');
    }
    const coefficients = sampleVariationCoefficients(sampleRandom);
    const variation = resolveVariedAnchors({
        referenceGuide: resolvedFamily.referenceGuide,
        likeness: resolvedFamily.likeness,
        coefficients,
    });
    const projected = projectVariationAmplitude({
        anchors: resolvedFamily.referenceGuide.anchors,
        displacements: variation.displacements,
    });
    // The draft guide's one-off adherence is intentionally not inherited. A
    // family owns its resemblance strength, and likeness is that canonical
    // weight for blending the sampled variant with the procedural guide.
    const guide = createSakuraMacroSpineGuideV1({
        anchors: projected.anchors,
        adherence: resolvedFamily.likeness,
        source: 'authored',
    });
    return Object.freeze({
        version: SAKURA_SPINE_REFERENCE_SAMPLE_VERSION,
        contract: SAKURA_SPINE_REFERENCE_SAMPLE_CONTRACT,
        familyId: resolvedFamily.familyId,
        referenceGuideId: resolvedFamily.referenceGuideId,
        likeness: resolvedFamily.likeness,
        variationPolicyId: resolvedFamily.variationPolicyId,
        variantGuideId: guide.guideId,
        variationStrength: variation.variationStrength,
        amplitudeScale: projected.amplitudeScale,
        guide,
    });
};
