import { SAKURA_BRANCH_ORDER } from '../generation/shapePriorModel.js';
import { BranchGeometryModel } from '../geometry/branchGeometryModel.js';
import {
    collectBonsaiStructuralPreviewSegments,
} from './renderBonsaiStructuralPreview.js';
import { resolveBonsaiCamera } from './resolveBonsaiCamera.js';
import {
    BONSAI_AB_MIN_SUPPORTED_CARD_VIEWPORT,
} from './BonsaiABViewportContract.js';

export const BONSAI_STRUCTURAL_COMPARISON_PLAN_VERSION = 1;
export const BONSAI_STRUCTURAL_COMPARISON_PLAN_CONTRACT = (
    'bonsai_structural_comparison_plan_v1'
);
export const BONSAI_STRUCTURAL_COMPARISON_SAMPLING_POLICY_ID = (
    'structural_preview_centerline_even_reservoir_v1'
);
export const BONSAI_STRUCTURAL_COMPARISON_SCREEN_SPACE = (
    'minimum_supported_css_px_240x240_ab_camera_v1'
);
export const BONSAI_STRUCTURAL_COMPARISON_VIEWPORT = (
    BONSAI_AB_MIN_SUPPORTED_CARD_VIEWPORT
);
export const BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX = 7.5;

const SEGMENT_SAMPLE_COUNT = 7;
const MAX_TRUNK_POINT_COUNT = 112;
const MAX_SCAFFOLD_POINT_COUNT = 160;
const EPSILON = 2e-5;
const PLAN_KEYS = Object.freeze([
    'contract',
    'version',
    'sourceProfile',
    'samplingPolicyId',
    'sceneBounds',
    'trunkPoints',
    'scaffoldPoints',
    'sourceCounts',
]);
const BOUNDS_KEYS = Object.freeze(['minX', 'maxX', 'minY', 'maxY', 'width', 'height']);
const POINT_KEYS = Object.freeze(['x', 'y']);
const SOURCE_COUNT_KEYS = Object.freeze([
    'segmentCount',
    'trunkSegmentCount',
    'scaffoldSegmentCount',
    'trunkPointCountBeforeSampling',
    'scaffoldPointCountBeforeSampling',
]);

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const hasExactKeys = (value, keys) => {
    if (!isPlainObject(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const round = (value, digits = 5) => Number(Number(value).toFixed(digits));
const toFinite = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const requireFinite = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_COMPARISON_NUMBER_INVALID:${field}`);
    }
    return value;
};

const requirePositiveInteger = (value, field, { allowZero = false } = {}) => {
    if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_COMPARISON_COUNT_INVALID:${field}`);
    }
    return value;
};

const requireBounds = (value) => {
    if (!hasExactKeys(value, BOUNDS_KEYS)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_BOUNDS_KEYS_INVALID');
    }
    const bounds = Object.fromEntries(BOUNDS_KEYS.map((key) => [
        key,
        requireFinite(value[key], `sceneBounds.${key}`),
    ]));
    if (
        bounds.maxX <= bounds.minX
        || bounds.maxY <= bounds.minY
        || bounds.width <= 0
        || bounds.height <= 0
        || Math.abs(bounds.width - (bounds.maxX - bounds.minX)) > EPSILON
        || Math.abs(bounds.height - (bounds.maxY - bounds.minY)) > EPSILON
    ) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_BOUNDS_INVALID');
    }
    return Object.freeze(bounds);
};

const requirePoints = (value, field, { allowEmpty = false } = {}) => {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_COMPARISON_POINTS_INVALID:${field}`);
    }
    return Object.freeze(value.map((point, index) => {
        if (!hasExactKeys(point, POINT_KEYS)) {
            throw new Error(
                `ZEN_BONSAI_STRUCTURAL_COMPARISON_POINT_KEYS_INVALID:${field}.${index}`,
            );
        }
        return Object.freeze({
            x: requireFinite(point.x, `${field}.${index}.x`),
            y: requireFinite(point.y, `${field}.${index}.y`),
        });
    }));
};

const requireSourceCounts = (value) => {
    if (!hasExactKeys(value, SOURCE_COUNT_KEYS)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_SOURCE_COUNTS_INVALID');
    }
    const counts = {};
    SOURCE_COUNT_KEYS.forEach((key) => {
        counts[key] = requirePositiveInteger(value[key], key, {
            allowZero: key !== 'segmentCount' && key !== 'trunkSegmentCount',
        });
    });
    if (counts.segmentCount !== counts.trunkSegmentCount + counts.scaffoldSegmentCount) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_SEGMENT_COUNT_MISMATCH');
    }
    return Object.freeze(counts);
};

const sampleSegmentPoints = (segment) => Array.from(
    { length: SEGMENT_SAMPLE_COUNT },
    (_, index) => {
        const point = BranchGeometryModel.pointAt(
            segment.geometry,
            index / (SEGMENT_SAMPLE_COUNT - 1),
        );
        return { x: point.x, y: point.y };
    },
);

const resampleEvenly = (points, maximumCount) => {
    if (points.length <= maximumCount) {
        return points;
    }
    if (maximumCount === 1) {
        return [points[0]];
    }
    return Array.from({ length: maximumCount }, (_, index) => (
        points[Math.round((index / (maximumCount - 1)) * (points.length - 1))]
    ));
};

const canonicalizeBounds = (sceneBounds) => {
    const minX = requireFinite(Number(sceneBounds?.minX), 'sceneBounds.minX');
    const maxX = requireFinite(Number(sceneBounds?.maxX), 'sceneBounds.maxX');
    const minY = requireFinite(Number(sceneBounds?.minY), 'sceneBounds.minY');
    const maxY = requireFinite(Number(sceneBounds?.maxY), 'sceneBounds.maxY');
    return {
        minX: round(minX),
        maxX: round(maxX),
        minY: round(minY),
        maxY: round(maxY),
        width: round(maxX - minX),
        height: round(maxY - minY),
    };
};

export const measureBonsaiStructuralComparisonSceneBoundsV1 = ({
    topology,
    species,
    strictStructural = true,
} = {}) => {
    if (!topology || topology.type !== 'branch') {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_TOPOLOGY_REQUIRED');
    }
    const rawPotDimensions = species?.getPotDimensions?.(topology.visualPhenotype);
    const potWidth = Number(rawPotDimensions?.width);
    const potHeight = Number(rawPotDimensions?.height);
    if (
        !Number.isFinite(potWidth)
        || potWidth <= 0
        || !Number.isFinite(potHeight)
        || potHeight <= 0
    ) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_POT_DIMENSIONS_REQUIRED');
    }
    const sceneAnchor = {
        trunkOffsetX: toFinite(topology?.visualPhenotype?.trunkOffsetX, 0)
            * potWidth
            * 0.12,
        trunkBaseY: (-potHeight) - 1.5,
        potDims: {
            width: potWidth,
            height: potHeight,
        },
    };
    const segments = collectBonsaiStructuralPreviewSegments(
        topology,
        sceneAnchor,
        strictStructural,
    );
    if (!segments.length) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_SEGMENTS_REQUIRED');
    }

    let minX = -potWidth * 0.5;
    let maxX = potWidth * 0.5;
    let minY = -potHeight;
    let maxY = 0;
    segments.forEach(({ geometry, width }) => {
        const bounds = BranchGeometryModel.getBounds(geometry);
        const strokeRadius = Math.max(0.275, Number(width) * 0.5);
        minX = Math.min(minX, bounds.minX - strokeRadius);
        maxX = Math.max(maxX, bounds.maxX + strokeRadius);
        minY = Math.min(minY, bounds.minY - strokeRadius);
        maxY = Math.max(maxY, bounds.maxY + strokeRadius);
    });

    return Object.freeze({
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        trunkOffsetX: sceneAnchor.trunkOffsetX,
        trunkBaseY: sceneAnchor.trunkBaseY,
        potDims: Object.freeze(sceneAnchor.potDims),
    });
};

export const requireBonsaiStructuralComparisonPlanV1 = (value) => {
    if (!hasExactKeys(value, PLAN_KEYS)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_PLAN_KEYS_INVALID');
    }
    if (
        value.contract !== BONSAI_STRUCTURAL_COMPARISON_PLAN_CONTRACT
        || value.version !== BONSAI_STRUCTURAL_COMPARISON_PLAN_VERSION
        || value.sourceProfile !== 'structural_line_preview_v1'
        || value.samplingPolicyId !== BONSAI_STRUCTURAL_COMPARISON_SAMPLING_POLICY_ID
    ) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_PLAN_CONTRACT_INVALID');
    }
    const sceneBounds = requireBounds(value.sceneBounds);
    const trunkPoints = requirePoints(value.trunkPoints, 'trunkPoints');
    const scaffoldPoints = requirePoints(value.scaffoldPoints, 'scaffoldPoints', {
        allowEmpty: true,
    });
    const sourceCounts = requireSourceCounts(value.sourceCounts);
    if (
        trunkPoints.length > MAX_TRUNK_POINT_COUNT
        || scaffoldPoints.length > MAX_SCAFFOLD_POINT_COUNT
        || sourceCounts.trunkPointCountBeforeSampling < trunkPoints.length
        || sourceCounts.scaffoldPointCountBeforeSampling < scaffoldPoints.length
    ) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_SAMPLING_INVALID');
    }
    return Object.freeze({
        contract: BONSAI_STRUCTURAL_COMPARISON_PLAN_CONTRACT,
        version: BONSAI_STRUCTURAL_COMPARISON_PLAN_VERSION,
        sourceProfile: 'structural_line_preview_v1',
        samplingPolicyId: BONSAI_STRUCTURAL_COMPARISON_SAMPLING_POLICY_ID,
        sceneBounds,
        trunkPoints,
        scaffoldPoints,
        sourceCounts,
    });
};

export const createBonsaiStructuralComparisonPlanV1 = ({
    topology,
    sceneBounds,
    strictStructural = true,
} = {}) => {
    const segments = collectBonsaiStructuralPreviewSegments(
        topology,
        sceneBounds,
        strictStructural,
    );
    const trunkSegments = segments.filter((segment) => (
        segment.branchOrder === SAKURA_BRANCH_ORDER.TRUNK
    ));
    const scaffoldSegments = segments.filter((segment) => (
        segment.branchOrder !== SAKURA_BRANCH_ORDER.TRUNK
    ));
    const trunkPoints = trunkSegments.flatMap(sampleSegmentPoints);
    const scaffoldPoints = scaffoldSegments.flatMap(sampleSegmentPoints);
    return requireBonsaiStructuralComparisonPlanV1({
        contract: BONSAI_STRUCTURAL_COMPARISON_PLAN_CONTRACT,
        version: BONSAI_STRUCTURAL_COMPARISON_PLAN_VERSION,
        sourceProfile: 'structural_line_preview_v1',
        samplingPolicyId: BONSAI_STRUCTURAL_COMPARISON_SAMPLING_POLICY_ID,
        sceneBounds: canonicalizeBounds(sceneBounds),
        trunkPoints: resampleEvenly(trunkPoints, MAX_TRUNK_POINT_COUNT).map((point) => ({
            x: round(point.x),
            y: round(point.y),
        })),
        scaffoldPoints: resampleEvenly(scaffoldPoints, MAX_SCAFFOLD_POINT_COUNT).map((point) => ({
            x: round(point.x),
            y: round(point.y),
        })),
        sourceCounts: {
            segmentCount: segments.length,
            trunkSegmentCount: trunkSegments.length,
            scaffoldSegmentCount: scaffoldSegments.length,
            trunkPointCountBeforeSampling: trunkPoints.length,
            scaffoldPointCountBeforeSampling: scaffoldPoints.length,
        },
    });
};

const projectPoints = (points, camera) => points.map((point) => camera.worldToScreen(point));

const nearestDistances = (source, target) => source.map((point) => {
    let nearestSquared = Number.POSITIVE_INFINITY;
    target.forEach((candidate) => {
        const squared = ((point.x - candidate.x) ** 2) + ((point.y - candidate.y) ** 2);
        if (squared < nearestSquared) nearestSquared = squared;
    });
    return Math.sqrt(nearestSquared);
});

const summarizeSymmetricDistance = (left, right) => {
    if (!left.length && !right.length) {
        return { mean: 0, p90: 0, max: 0 };
    }
    if (!left.length || !right.length) {
        const populated = left.length ? left : right;
        const extent = populated.reduce((maximum, point) => Math.max(
            maximum,
            Math.hypot(point.x, point.y),
        ), 0);
        return { mean: extent, p90: extent, max: extent };
    }
    const distances = [
        ...nearestDistances(left, right),
        ...nearestDistances(right, left),
    ].sort((a, b) => a - b);
    const mean = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const p90 = distances[Math.min(
        distances.length - 1,
        Math.floor((distances.length - 1) * 0.9),
    )];
    return {
        mean,
        p90,
        max: distances[distances.length - 1],
    };
};

export const resolveBonsaiStructuralScreenDistanceV1 = (
    left,
    right,
    {
        minimumVisibleDistancePx = BONSAI_STRUCTURAL_MIN_VISIBLE_DISTANCE_PX,
    } = {},
) => {
    const planA = requireBonsaiStructuralComparisonPlanV1(left);
    const planB = requireBonsaiStructuralComparisonPlanV1(right);
    const threshold = requireFinite(
        minimumVisibleDistancePx,
        'minimumVisibleDistancePx',
    );
    if (threshold <= 0) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_COMPARISON_THRESHOLD_INVALID');
    }
    const fitA = resolveBonsaiCamera({
        viewportWidth: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.width,
        viewportHeight: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.height,
        sceneBounds: planA.sceneBounds,
        preset: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.preset,
    });
    const fitB = resolveBonsaiCamera({
        viewportWidth: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.width,
        viewportHeight: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.height,
        sceneBounds: planB.sceneBounds,
        preset: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.preset,
    });
    const sharedScale = Math.min(fitA.scale, fitB.scale);
    const cameraA = resolveBonsaiCamera({
        viewportWidth: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.width,
        viewportHeight: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.height,
        sceneBounds: planA.sceneBounds,
        preset: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.preset,
        scaleCap: sharedScale,
    });
    const cameraB = resolveBonsaiCamera({
        viewportWidth: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.width,
        viewportHeight: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.height,
        sceneBounds: planB.sceneBounds,
        preset: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT.preset,
        scaleCap: sharedScale,
    });
    const trunk = summarizeSymmetricDistance(
        projectPoints(planA.trunkPoints, cameraA),
        projectPoints(planB.trunkPoints, cameraB),
    );
    const scaffold = summarizeSymmetricDistance(
        projectPoints(planA.scaffoldPoints, cameraA),
        projectPoints(planB.scaffoldPoints, cameraB),
    );
    const hasScaffold = planA.scaffoldPoints.length > 0 || planB.scaffoldPoints.length > 0;
    const silhouetteExtentDistancePx = Math.hypot(
        (planA.sceneBounds.width - planB.sceneBounds.width) * sharedScale,
        (planA.sceneBounds.height - planB.sceneBounds.height) * sharedScale,
    ) / Math.SQRT2;
    const visibleDistancePx = hasScaffold
        ? (
            (trunk.mean * 0.46)
            + (trunk.p90 * 0.24)
            + (scaffold.mean * 0.16)
            + (scaffold.p90 * 0.09)
            + (silhouetteExtentDistancePx * 0.05)
        )
        : (
            (trunk.mean * 0.64)
            + (trunk.p90 * 0.31)
            + (silhouetteExtentDistancePx * 0.05)
        );
    const roundedVisibleDistance = round(visibleDistancePx, 3);
    return Object.freeze({
        version: 1,
        screenSpace: BONSAI_STRUCTURAL_COMPARISON_SCREEN_SPACE,
        viewport: BONSAI_STRUCTURAL_COMPARISON_VIEWPORT,
        sharedScale: round(sharedScale, 6),
        visibleDistancePx: roundedVisibleDistance,
        minimumVisibleDistancePx: round(threshold, 3),
        passed: roundedVisibleDistance >= threshold,
        trunk: Object.freeze({
            meanNearestPx: round(trunk.mean, 3),
            p90NearestPx: round(trunk.p90, 3),
            maxNearestPx: round(trunk.max, 3),
        }),
        scaffold: Object.freeze({
            meanNearestPx: round(scaffold.mean, 3),
            p90NearestPx: round(scaffold.p90, 3),
            maxNearestPx: round(scaffold.max, 3),
        }),
        silhouetteExtentDistancePx: round(silhouetteExtentDistancePx, 3),
    });
};
