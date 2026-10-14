import {
    ZEN_ROCK_LAYOUT_KEY_PROP as PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP,
    buildZenRockLayout as buildProductZenRockLayout,
    buildZenRockLayoutKey as buildProductZenRockLayoutKey,
} from '../zenRockLayoutSync.js';
import {
    resolveZenPondRockNaturalismPhenotype,
} from '../../renderers/pixi/visualProfiles/zenPondRockNaturalism.js';
import {
    createZenSeededRandom,
} from '../../../shared/zenSeededRandom.js';

const ISHIGUMI_LAYOUT_VERSION = 'zen-pond-rock-ishigumi-v4';
const ISHIGUMI_LAYOUT_KEY_PREFIX =
    `${ISHIGUMI_LAYOUT_VERSION}::`;
const DEG_TO_RAD = Math.PI / 180;
const STRUCTURAL_AXIS_LIMIT = 16 * DEG_TO_RAD;
const STRUCTURAL_ROTATION_LIMIT = 28 * DEG_TO_RAD;
const STRUCTURAL_COHERENCE_LIMIT = 12 * DEG_TO_RAD;
const ANGLE_EPSILON = 1e-9;
const BODY_EDGE_PADDING_PX = 12;
const BODY_SUPPORT_PADDING_PX = 1.5;
const COMPACT_SIZE_REFERENCE_PX = 520;
const MINIMUM_ROCK_SIZE_PX = 32;
const CLEARANCE_EPSILON_PX = 1e-6;
const SUPPORT_CLEARANCE_BUFFER_PX = 0.5;
const SUPPORT_GRID_COLUMNS = 17;
const SUPPORT_GRID_ROWS = 13;

const ROCK_VARIANT_PROFILES = Object.freeze({
    hero: Object.freeze({
        widthGain: 0.82,
        heightGain: 1.18,
    }),
    slab: Object.freeze({
        widthGain: 1.18,
        heightGain: 0.82,
    }),
    flat: Object.freeze({
        widthGain: 1.16,
        heightGain: 0.68,
    }),
    ridge: Object.freeze({
        widthGain: 0.92,
        heightGain: 1.24,
    }),
    cluster: Object.freeze({
        widthGain: 0.98,
        heightGain: 1.04,
    }),
});

const REQUIRED_FINITE_ROCK_FIELDS = Object.freeze([
    'x',
    'y',
    'size',
    'rotation',
    'tilt',
    'noiseSeed',
    'shadowOffset',
    'highlightBias',
    'roughness',
    'ridgeStrength',
    'edgeChip',
    'patternStrength',
    'angularity',
    'chunkiness',
    'asymmetry',
    'profileAxis',
    'tone',
]);

const ROCK_ROTATION_OFFSETS = Object.freeze([
    0,
    -7 * DEG_TO_RAD,
    9 * DEG_TO_RAD,
    -11 * DEG_TO_RAD,
    6 * DEG_TO_RAD,
]);

const SUPPORT_ANCHORS = Object.freeze([
    Object.freeze({ x: 0.34, y: 0.31 }),
    Object.freeze({ x: 0.72, y: 0.72 }),
    Object.freeze({ x: 0.82, y: 0.61 }),
]);

const fail = (detail) => {
    throw new Error(`ZEN_POND_ROCK_ISHIGUMI_LAYOUT_INVALID:${detail}`);
};

const requireRecord = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(`${label}_record`);
    }
    return value;
};

const requireFiniteNumber = (value, label) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${label}_finite_number`);
    }
    return value;
};

const requirePositiveFiniteNumber = (value, label) => {
    const numeric = requireFiniteNumber(value, label);
    if (numeric <= 0) {
        fail(`${label}_positive`);
    }
    return numeric;
};

const requireLayoutKey = (value, label = 'layout_key') => {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.trim() !== value
    ) {
        fail(label);
    }
    return value;
};

const clamp = (value, min, max) => (
    Math.max(min, Math.min(max, value))
);

const validateRock = (rock, label) => {
    requireRecord(rock, label);
    if (!ROCK_VARIANT_PROFILES[rock.variant]) {
        fail(`${label}_variant:${String(rock.variant)}`);
    }
    if (typeof rock.draw !== 'function') {
        fail(`${label}_draw_contract`);
    }
    for (let index = 0; index < REQUIRED_FINITE_ROCK_FIELDS.length; index += 1) {
        const field = REQUIRED_FINITE_ROCK_FIELDS[index];
        requireFiniteNumber(rock[field], `${label}_${field}`);
    }
    if (rock.size < MINIMUM_ROCK_SIZE_PX) {
        fail(`${label}_size_minimum:${rock.size}`);
    }
    if (rock.tilt <= 0) {
        fail(`${label}_tilt_positive:${rock.tilt}`);
    }
    return rock;
};

const captureRockState = (rock) => Object.freeze({
    prototype: Object.getPrototypeOf(rock),
    draw: rock.draw,
    variant: rock.variant,
    fields: Object.freeze(
        Object.fromEntries(
            REQUIRED_FINITE_ROCK_FIELDS.map((field) => [
                field,
                rock[field],
            ]),
        ),
    ),
});

const assertRockStateUnchanged = (rock, snapshot, label) => {
    if (
        Object.getPrototypeOf(rock) !== snapshot.prototype
        || rock.draw !== snapshot.draw
        || rock.variant !== snapshot.variant
    ) {
        fail(`${label}_source_identity_mutated`);
    }
    for (let index = 0; index < REQUIRED_FINITE_ROCK_FIELDS.length; index += 1) {
        const field = REQUIRED_FINITE_ROCK_FIELDS[index];
        if (!Object.is(rock[field], snapshot.fields[field])) {
            fail(`${label}_source_${field}_mutated`);
        }
    }
};

const cloneRockWithProjection = (rock, projection, label) => {
    const clone = Object.create(
        Object.getPrototypeOf(rock),
        Object.getOwnPropertyDescriptors(rock),
    );
    clone.x = projection.x;
    clone.y = projection.y;
    clone.size = projection.size;
    clone.rotation = projection.rotation;
    if (
        clone === rock
        || Object.getPrototypeOf(clone) !== Object.getPrototypeOf(rock)
    ) {
        fail(`${label}_clone_contract`);
    }
    return validateRock(clone, label);
};

const parseIshigumiLayoutKey = (candidateLayoutKey) => {
    const key = requireLayoutKey(candidateLayoutKey);
    if (!key.startsWith(ISHIGUMI_LAYOUT_KEY_PREFIX)) {
        fail(`layout_key_namespace:${key}`);
    }
    const productLayoutKey = key.slice(
        ISHIGUMI_LAYOUT_KEY_PREFIX.length,
    );
    requireLayoutKey(productLayoutKey, 'product_layout_key');
    if (productLayoutKey.startsWith(ISHIGUMI_LAYOUT_KEY_PREFIX)) {
        fail('layout_key_nested_namespace');
    }
    return productLayoutKey;
};

const resolveEffectiveRockDensity = (tuning) => {
    const rawDensity = Number(tuning?.rockDensity ?? 1);
    if (!Number.isFinite(rawDensity)) {
        fail('rock_density_finite');
    }
    return clamp(rawDensity, 0, 2);
};

const selectHierarchySources = (layout) => {
    if (layout.length < 1) {
        fail('positive_density_product_rock_count:0');
    }
    const sorted = layout
        .map((rock, index) => ({
            rock: validateRock(rock, `product_rock_${index}`),
            index,
        }))
        .sort((left, right) => (
            right.rock.size - left.rock.size
            || left.index - right.index
        ));
    const outputCount = sorted.length >= 5 ? 5 : 3;
    if (sorted.length === 1) {
        return [sorted[0], sorted[0], sorted[0]];
    }
    if (sorted.length === 2) {
        return [sorted[0], sorted[1], sorted[1]];
    }
    return sorted.slice(0, outputCount);
};

const resolveFullScaleHierarchySizes = (selected) => {
    const mainSize = clamp(selected[0].rock.size, 118, 148);
    const secondMaximum = Math.min(92, mainSize * 0.72);
    const secondSize = clamp(
        selected[1].rock.size,
        78,
        secondMaximum,
    );
    const thirdSize = clamp(
        selected[2].rock.size,
        52,
        Math.min(76, secondSize - 8),
    );
    if (selected.length === 3) {
        return [mainSize, secondSize, thirdSize];
    }
    const fourthSize = clamp(
        selected[3].rock.size,
        42,
        Math.min(62, thirdSize - 6),
    );
    const fifthSize = clamp(
        selected[4].rock.size,
        34,
        Math.min(52, fourthSize - 5),
    );
    return [
        mainSize,
        secondSize,
        thirdSize,
        fourthSize,
        fifthSize,
    ];
};

const resolveCompactHierarchySizes = ({
    selected,
    width,
    height,
}) => {
    const minimumDimension = Math.min(width, height);
    const compactScale = Math.min(
        1,
        minimumDimension / COMPACT_SIZE_REFERENCE_PX,
    );
    const strictGap = Math.max(2, compactScale * 3);
    const sizes = resolveFullScaleHierarchySizes(selected).map(
        (size) => Math.max(
            MINIMUM_ROCK_SIZE_PX,
            size * compactScale,
        ),
    );
    for (let index = sizes.length - 2; index >= 0; index -= 1) {
        sizes[index] = Math.max(
            sizes[index],
            sizes[index + 1] + strictGap,
        );
    }
    return {
        compactScale,
        sizes,
        strictGap,
    };
};

const resolveBodySupportRadius = (rock, direction) => {
    validateRock(rock, 'body_support_rock');
    const phenotype = resolveZenPondRockNaturalismPhenotype(rock);
    const localDirection = direction - rock.rotation;
    const directionX = Math.cos(localDirection);
    const directionY = Math.sin(localDirection);
    const support = phenotype.points.reduce(
        (maximum, point) => Math.max(
            maximum,
            point.x * directionX + point.y * directionY,
        ),
        Number.NEGATIVE_INFINITY,
    );
    if (!Number.isFinite(support) || support <= 0) {
        fail(`body_support_contract:${support}`);
    }
    return support + BODY_SUPPORT_PADDING_PX;
};

const resolveExpectedBodyExtents = (rock) => ({
    x: resolveBodySupportRadius(rock, 0),
    y: resolveBodySupportRadius(rock, Math.PI * 0.5),
});

export const resolveZenPondIshigumiCoverBounds = (width, height) => {
    requirePositiveFiniteNumber(width, 'width');
    requirePositiveFiniteNumber(height, 'height');
    return { left: 0, top: 0, right: width, bottom: height };
};

const resolveBodyCenterBounds = (rock, coverBounds, label) => {
    const extents = resolveExpectedBodyExtents(rock);
    const bounds = {
        maxX:
            coverBounds.right
            - BODY_EDGE_PADDING_PX
            - extents.x,
        maxY:
            coverBounds.bottom
            - BODY_EDGE_PADDING_PX
            - extents.y,
        minX:
            coverBounds.left
            + BODY_EDGE_PADDING_PX
            + extents.x,
        minY:
            coverBounds.top
            + BODY_EDGE_PADDING_PX
            + extents.y,
    };
    if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
        fail(`${label}_cover_capacity`);
    }
    return bounds;
};

const resolvePairEdgeClearance = (left, right) => {
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const centerDistance = Math.hypot(dx, dy);
    if (!Number.isFinite(centerDistance) || centerDistance <= 0) {
        fail(`pair_center_distance:${left.index}-${right.index}`);
    }
    const direction = Math.atan2(dy, dx);
    return (
        centerDistance
        - resolveBodySupportRadius(left.rock, direction)
        - resolveBodySupportRadius(right.rock, direction + Math.PI)
    );
};

const resolvePairPlacement = ({
    shapes,
    coverBounds,
    structuralAxis,
    width,
    height,
    closePairGap,
}) => {
    const main = shapes[0];
    const companion = shapes[1];
    const pairDistance = (
        resolveBodySupportRadius(main, structuralAxis)
        + resolveBodySupportRadius(companion, structuralAxis + Math.PI)
        + closePairGap
    );
    const dx = Math.cos(structuralAxis) * pairDistance;
    const dy = Math.sin(structuralAxis) * pairDistance;
    const mainBounds = resolveBodyCenterBounds(
        main,
        coverBounds,
        'rock_0',
    );
    const companionBounds = resolveBodyCenterBounds(
        companion,
        coverBounds,
        'rock_1',
    );
    const baseBounds = {
        maxX: Math.min(
            mainBounds.maxX,
            companionBounds.maxX - dx,
        ),
        maxY: Math.min(
            mainBounds.maxY,
            companionBounds.maxY - dy,
        ),
        minX: Math.max(
            mainBounds.minX,
            companionBounds.minX - dx,
        ),
        minY: Math.max(
            mainBounds.minY,
            companionBounds.minY - dy,
        ),
    };
    if (
        baseBounds.minX > baseBounds.maxX
        || baseBounds.minY > baseBounds.maxY
    ) {
        fail('close_pair_cover_capacity');
    }
    const coverWidth = coverBounds.right - coverBounds.left;
    const coverHeight = coverBounds.bottom - coverBounds.top;
    const mainX = clamp(
        coverBounds.left + coverWidth * 0.54,
        baseBounds.minX,
        baseBounds.maxX,
    );
    const mainY = clamp(
        coverBounds.top + coverHeight * 0.48,
        baseBounds.minY,
        baseBounds.maxY,
    );
    return [
        {
            index: 0,
            rock: main,
            x: mainX,
            y: mainY,
        },
        {
            index: 1,
            rock: companion,
            x: mainX + dx,
            y: mainY + dy,
        },
    ];
};

const appendUniquePosition = (positions, seen, x, y) => {
    const key = `${x.toFixed(6)}:${y.toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    positions.push({ x, y });
};

const buildSupportPositionCandidates = ({
    bounds,
    preferredX,
    preferredY,
    width,
    height,
}) => {
    const positions = [];
    const seen = new Set();
    appendUniquePosition(
        positions,
        seen,
        clamp(preferredX, bounds.minX, bounds.maxX),
        clamp(preferredY, bounds.minY, bounds.maxY),
    );
    for (
        let row = 0;
        row < SUPPORT_GRID_ROWS;
        row += 1
    ) {
        const y = (
            bounds.minY
            + (
                (bounds.maxY - bounds.minY)
                * row
                / (SUPPORT_GRID_ROWS - 1)
            )
        );
        for (
            let column = 0;
            column < SUPPORT_GRID_COLUMNS;
            column += 1
        ) {
            const x = (
                bounds.minX
                + (
                    (bounds.maxX - bounds.minX)
                    * column
                    / (SUPPORT_GRID_COLUMNS - 1)
                )
            );
            appendUniquePosition(positions, seen, x, y);
        }
    }
    return positions
        .map((position, order) => ({
            ...position,
            order,
            score: (
                ((position.x - preferredX) / width) ** 2
                + ((position.y - preferredY) / height) ** 2
            ),
        }))
        .sort((left, right) => (
            left.score - right.score
            || left.order - right.order
        ));
};

const placeSupportRock = ({
    anchor,
    coverBounds,
    height,
    index,
    minimumClearance,
    placed,
    rock,
    width,
}) => {
    const bounds = resolveBodyCenterBounds(
        rock,
        coverBounds,
        `rock_${index}`,
    );
    const visibleWidth = coverBounds.right - coverBounds.left;
    const visibleHeight = coverBounds.bottom - coverBounds.top;
    const candidates = buildSupportPositionCandidates({
        bounds,
        preferredX: coverBounds.left + visibleWidth * anchor.x,
        preferredY: coverBounds.top + visibleHeight * anchor.y,
        width: visibleWidth,
        height: visibleHeight,
    });
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        const candidate = {
            index,
            rock,
            x: candidates[candidateIndex].x,
            y: candidates[candidateIndex].y,
        };
        let valid = true;
        for (let placedIndex = 0; placedIndex < placed.length; placedIndex += 1) {
            const clearance = resolvePairEdgeClearance(
                placed[placedIndex],
                candidate,
            );
            if (clearance < minimumClearance) {
                valid = false;
                break;
            }
        }
        if (valid) return candidate;
    }
    fail(`rock_${index}_support_placement`);
};

const resolveIshigumiPlacements = ({
    shapes,
    structuralAxis,
    width,
    height,
}) => {
    const minimumDimension = Math.min(width, height);
    const closePairGap = Math.max(
        3,
        minimumDimension * 0.006,
    );
    const runnerUpMargin = Math.max(
        6,
        minimumDimension * 0.012,
    );
    const coverBounds = resolveZenPondIshigumiCoverBounds(
        width,
        height,
    );
    const placed = resolvePairPlacement({
        shapes,
        coverBounds,
        structuralAxis,
        width,
        height,
        closePairGap,
    });
    const supportMinimumClearance = (
        closePairGap
        + runnerUpMargin
        + SUPPORT_CLEARANCE_BUFFER_PX
    );
    for (let index = 2; index < shapes.length; index += 1) {
        placed.push(placeSupportRock({
            anchor: SUPPORT_ANCHORS[index - 2],
            coverBounds,
            height,
            index,
            minimumClearance: supportMinimumClearance,
            placed,
            rock: shapes[index],
            width,
        }));
    }
    return {
        closePairGap,
        coverBounds,
        placements: placed,
        runnerUpMargin,
    };
};

const validateHierarchy = ({
    compactScale,
    rocks,
    strictGap,
}) => {
    if (rocks.length !== 3 && rocks.length !== 5) {
        fail(`output_rock_count:${rocks.length}`);
    }
    const mainSize = rocks[0].size;
    const secondSize = rocks[1].size;
    const mainMinimum = Math.max(
        MINIMUM_ROCK_SIZE_PX,
        118 * compactScale,
    );
    const mainMaximum = Math.max(
        MINIMUM_ROCK_SIZE_PX,
        148 * compactScale,
    );
    if (
        mainSize < mainMinimum - ANGLE_EPSILON
        || mainSize > mainMaximum + ANGLE_EPSILON
    ) {
        fail(`main_size:${mainSize}`);
    }
    const secondMaximum = Math.min(
        Math.max(MINIMUM_ROCK_SIZE_PX, 92 * compactScale),
        mainSize * 0.72,
    );
    if (
        secondSize < MINIMUM_ROCK_SIZE_PX
        || secondSize > secondMaximum + ANGLE_EPSILON
    ) {
        fail(`second_size:${secondSize}`);
    }
    const supportMaximum = Math.max(
        MINIMUM_ROCK_SIZE_PX,
        76 * compactScale,
    );
    for (let index = 2; index < rocks.length; index += 1) {
        if (
            rocks[index].size < MINIMUM_ROCK_SIZE_PX
            || rocks[index].size
                > supportMaximum + ANGLE_EPSILON
        ) {
            fail(`support_size_${index}:${rocks[index].size}`);
        }
    }
    for (let index = 1; index < rocks.length; index += 1) {
        const hierarchyGap =
            rocks[index - 1].size - rocks[index].size;
        if (hierarchyGap < strictGap - ANGLE_EPSILON) {
            fail(`size_hierarchy_${index}:${hierarchyGap}`);
        }
    }
};

const validateStructuralAxis = (rocks, structuralAxis) => {
    if (
        Math.abs(structuralAxis)
        > STRUCTURAL_AXIS_LIMIT + ANGLE_EPSILON
    ) {
        fail(`structural_axis:${structuralAxis}`);
    }
    for (let index = 0; index < rocks.length; index += 1) {
        const rotation = rocks[index].rotation;
        if (
            Math.abs(rotation)
                > STRUCTURAL_ROTATION_LIMIT + ANGLE_EPSILON
            || Math.abs(rotation - structuralAxis)
                > STRUCTURAL_COHERENCE_LIMIT + ANGLE_EPSILON
        ) {
            fail(`rock_${index}_structural_rotation:${rotation}`);
        }
    }
};

const validateCoverBodyBounds = (
    rock,
    coverBounds,
    index,
) => {
    const extents = resolveExpectedBodyExtents(rock);
    if (
        rock.x - extents.x
            < coverBounds.left + BODY_EDGE_PADDING_PX - ANGLE_EPSILON
        || rock.x + extents.x
            > coverBounds.right - BODY_EDGE_PADDING_PX + ANGLE_EPSILON
        || rock.y - extents.y
            < coverBounds.top + BODY_EDGE_PADDING_PX - ANGLE_EPSILON
        || rock.y + extents.y
            > coverBounds.bottom - BODY_EDGE_PADDING_PX + ANGLE_EPSILON
    ) {
        fail(`rock_${index}_cover_visible_body_bounds`);
    }
};

const validateBodyClearances = ({
    closePairGap,
    rocks,
    runnerUpMargin,
}) => {
    const clearances = [];
    for (let left = 0; left < rocks.length; left += 1) {
        for (let right = left + 1; right < rocks.length; right += 1) {
            const clearance = resolvePairEdgeClearance(
                {
                    index: left,
                    rock: rocks[left],
                    x: rocks[left].x,
                    y: rocks[left].y,
                },
                {
                    index: right,
                    rock: rocks[right],
                    x: rocks[right].x,
                    y: rocks[right].y,
                },
            );
            if (clearance <= CLEARANCE_EPSILON_PX) {
                fail(`body_overlap_${left}-${right}:${clearance}`);
            }
            clearances.push({
                clearance,
                left,
                right,
            });
        }
    }
    clearances.sort((left, right) => (
        left.clearance - right.clearance
        || left.left - right.left
        || left.right - right.right
    ));
    const closest = clearances[0];
    const runnerUp = clearances[1];
    if (
        closest.left !== 0
        || closest.right !== 1
        || Math.abs(closest.clearance - closePairGap)
            > CLEARANCE_EPSILON_PX
    ) {
        fail(
            'close_pair_edge_clearance:'
            + `${closest.left}-${closest.right}:`
            + closest.clearance,
        );
    }
    if (
        !runnerUp
        || runnerUp.clearance - closest.clearance
            < runnerUpMargin - ANGLE_EPSILON
    ) {
        fail(
            'close_pair_runner_up_margin:'
            + String(
                runnerUp
                    ? runnerUp.clearance - closest.clearance
                    : 'missing',
            ),
        );
    }
};

const validateGroupTopology = ({
    rocks,
    coverBounds,
}) => {
    if (rocks.length !== 3 && rocks.length !== 5) {
        fail(`group_topology_rock_count:${rocks.length}`);
    }
    const visibleWidth = coverBounds.right - coverBounds.left;
    const visibleHeight = coverBounds.bottom - coverBounds.top;
    const normalized = rocks.map((rock) => ({
        x: (rock.x - coverBounds.left) / visibleWidth,
        y: (rock.y - coverBounds.top) / visibleHeight,
    }));
    const xValues = normalized.map(({ x }) => x);
    const yValues = normalized.map(({ y }) => y);
    const spanX = Math.max(...xValues) - Math.min(...xValues);
    const spanY = Math.max(...yValues) - Math.min(...yValues);
    if (spanX > 0.58 + ANGLE_EPSILON) {
        fail(`group_topology_span_x:${spanX}`);
    }
    if (spanY > 0.58 + ANGLE_EPSILON) {
        fail(`group_topology_span_y:${spanY}`);
    }
    const normalizedDistance = (left, right) => Math.hypot(
        normalized[right].x - normalized[left].x,
        normalized[right].y - normalized[left].y,
    );
    if (normalizedDistance(0, 2) > 0.34 + ANGLE_EPSILON) {
        fail(
            'group_topology_primary_trio:'
            + normalizedDistance(0, 2),
        );
    }
    if (
        rocks.length === 5
        && normalizedDistance(3, 4) > 0.24 + ANGLE_EPSILON
    ) {
        fail(
            'group_topology_secondary_pair:'
            + normalizedDistance(3, 4),
        );
    }
    for (let index = 0; index < normalized.length; index += 1) {
        let nearest = Number.POSITIVE_INFINITY;
        for (let other = 0; other < normalized.length; other += 1) {
            if (other === index) continue;
            nearest = Math.min(
                nearest,
                normalizedDistance(index, other),
            );
        }
        if (nearest > 0.3 + ANGLE_EPSILON) {
            fail(`group_topology_nearest_${index}:${nearest}`);
        }
    }
};

const buildIshigumiProjection = ({
    candidateLayoutKey,
    height,
    productLayout,
    productLayoutKey,
    width,
}) => {
    const productLayoutLength = productLayout.length;
    const productLayoutKeyBefore =
        productLayout[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP];
    const productSnapshots = productLayout.map((rock, index) => {
        validateRock(rock, `product_rock_${index}`);
        return captureRockState(rock);
    });
    const selected = selectHierarchySources(productLayout);
    const projectionRandom = createZenSeededRandom(
        `${ISHIGUMI_LAYOUT_VERSION}|${productLayoutKey}`,
    );
    const structuralAxisUnit = projectionRandom() * 2 - 1;
    const structuralAxisSign = structuralAxisUnit < 0 ? -1 : 1;
    const structuralAxisMinimum = 6 * DEG_TO_RAD;
    const structuralAxis = structuralAxisSign * (
        structuralAxisMinimum
        + Math.abs(structuralAxisUnit)
        * (STRUCTURAL_AXIS_LIMIT - structuralAxisMinimum)
    );
    const {
        compactScale,
        sizes,
        strictGap,
    } = resolveCompactHierarchySizes({
        selected,
        width,
        height,
    });
    const shapes = selected.map(({ rock }, index) => (
        cloneRockWithProjection(
            rock,
            {
                rotation:
                    structuralAxis + ROCK_ROTATION_OFFSETS[index],
                size: sizes[index],
                x: rock.x,
                y: rock.y,
            },
            `placement_shape_${index}`,
        )
    ));
    const {
        closePairGap,
        coverBounds,
        placements,
        runnerUpMargin,
    } = resolveIshigumiPlacements({
        shapes,
        structuralAxis,
        width,
        height,
    });
    const projected = selected.map(({ rock }, index) => (
        cloneRockWithProjection(
            rock,
            {
                rotation: shapes[index].rotation,
                size: shapes[index].size,
                x: placements[index].x,
                y: placements[index].y,
            },
            `projected_rock_${index}`,
        )
    ));

    for (let index = 0; index < productLayout.length; index += 1) {
        assertRockStateUnchanged(
            productLayout[index],
            productSnapshots[index],
            `product_rock_${index}`,
        );
    }
    if (
        productLayout.length !== productLayoutLength
        || productLayout[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP]
            !== productLayoutKeyBefore
    ) {
        fail('product_layout_mutated');
    }
    for (let index = 0; index < projected.length; index += 1) {
        if (
            productLayout.includes(projected[index])
            || projected.indexOf(projected[index]) !== index
        ) {
            fail(`projected_rock_${index}_source_or_clone_alias`);
        }
    }

    validateHierarchy({
        compactScale,
        rocks: projected,
        strictGap,
    });
    validateStructuralAxis(projected, structuralAxis);
    validateBodyClearances({
        closePairGap,
        rocks: projected,
        runnerUpMargin,
    });
    validateGroupTopology({
        rocks: projected,
        coverBounds,
    });
    for (let index = 0; index < projected.length; index += 1) {
        validateCoverBodyBounds(
            projected[index],
            coverBounds,
            index,
        );
    }

    projected[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP] =
        candidateLayoutKey;
    return projected;
};

const buildZenRockLayoutInternal = (options) => {
    const input = requireRecord(options, 'options');
    const width = requirePositiveFiniteNumber(input.width, 'width');
    const height = requirePositiveFiniteNumber(input.height, 'height');
    const tuning = requireRecord(input.tuning, 'tuning');
    const qualityProfile =
        requireRecord(input.qualityProfile, 'quality_profile');
    const candidateLayoutKey = requireLayoutKey(input.layoutKey);
    const productLayoutKey = parseIshigumiLayoutKey(
        candidateLayoutKey,
    );
    const effectiveDensity = resolveEffectiveRockDensity(tuning);
    const productInput = {
        ...input,
        entityRandom: createZenSeededRandom(
            `zen-pond-rock-layout-v1|${productLayoutKey}`,
        ),
        layoutKey: productLayoutKey,
        qualityProfile: {
            ...qualityProfile,
        },
        tuning: {
            ...tuning,
        },
    };
    const productLayout = buildProductZenRockLayout(productInput);
    if (!Array.isArray(productLayout)) {
        fail('product_layout_array');
    }
    if (
        productLayout[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP]
        !== productLayoutKey
    ) {
        fail('product_layout_key_mismatch');
    }

    if (effectiveDensity <= 0.001) {
        if (productLayout.length !== 0) {
            fail(
                'disabled_density_product_rock_count:'
                + productLayout.length,
            );
        }
        const emptyLayout = [];
        emptyLayout[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP] =
            candidateLayoutKey;
        return emptyLayout;
    }
    if (productLayout.length < 1) {
        fail('positive_density_product_rock_count:0');
    }

    const projected = buildIshigumiProjection({
        candidateLayoutKey,
        height,
        productLayout,
        productLayoutKey,
        width,
    });
    if (
        projected === productLayout
        || projected[PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP]
            !== candidateLayoutKey
    ) {
        fail('output_immutability_or_layout_key');
    }
    return projected;
};

export const ZEN_ROCK_LAYOUT_KEY_PROP =
    PRODUCT_ZEN_ROCK_LAYOUT_KEY_PROP;

export const buildZenRockLayoutKey = (options) => {
    const input = requireRecord(options, 'layout_key_options');
    const productLayoutKey = requireLayoutKey(
        buildProductZenRockLayoutKey(input),
        'product_layout_key',
    );
    return `${ISHIGUMI_LAYOUT_KEY_PREFIX}${productLayoutKey}`;
};

export const buildZenRockLayout = (options) => {
    return buildZenRockLayoutInternal(options);
};
