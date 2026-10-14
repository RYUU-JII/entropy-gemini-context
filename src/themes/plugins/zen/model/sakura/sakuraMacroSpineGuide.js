import {
    createStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS,
    SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM,
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
} from '../../contracts/SakuraMacroLineageIdentityContract.js';
import { clamp, lerp } from './sakuraMath';

export {
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
} from '../../contracts/SakuraMacroLineageIdentityContract.js';

export const SAKURA_MACRO_SPINE_GUIDE_VERSION = 1;
export const SAKURA_MACRO_SPINE_GUIDE_CONTRACT = 'zen_sakura_macro_spine_guide_v1';
export const SAKURA_MACRO_SPINE_COORDINATE_SPACE = 'root_local_target_height_y_down_v1';
export const SAKURA_MACRO_SPINE_ANCHOR_MIN = 3;
export const SAKURA_MACRO_SPINE_ANCHOR_MAX = 7;
export const SAKURA_MACRO_SPINE_MAX_ARC_NORM = 1.35;
export const SAKURA_MACRO_SPINE_MIN_ANCHOR_GAP_NORM = 0.012;
export const SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE = 0.78;
export const SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY = Object.freeze({
    policyId: 'sakura_curvature_adaptive_8_12_32_48_v1',
    min: 8,
    base: 12,
    soft: 32,
    hard: 48,
    targetAdjacentArcRatio: 4,
    tangentThresholdRad: (7.5 * Math.PI) / 180,
    flatnessThresholdNorm: 0.006,
});

const GUIDE_ID_NAMESPACE = 'sakura_macro_spine_guide_v1';
const EPSILON = 1e-8;
const ARC_TABLE_STEPS_PER_SEGMENT = 36;
const FROZEN_SHAPE_ARC_TABLE_CACHE = new WeakMap();

const isObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const finitePoint = (point, field) => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_POINT_INVALID:${field}`);
    }
    return { x, y };
};

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const roundIdentityNumber = (value) => Number(
    Number(value).toFixed(SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS),
);

const createGuideId = (anchors) => createStructuralPlanIdV1(
    GUIDE_ID_NAMESPACE,
    anchors.flatMap((anchor) => [
        roundIdentityNumber(anchor.x),
        roundIdentityNumber(anchor.y),
    ]),
);

const createShapeId = (segments) => createStructuralPlanIdV1(
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
    segments.flatMap((segment) => [
        roundIdentityNumber(segment.startX),
        roundIdentityNumber(segment.startY),
        roundIdentityNumber(segment.cp1X),
        roundIdentityNumber(segment.cp1Y),
        roundIdentityNumber(segment.cp2X),
        roundIdentityNumber(segment.cp2Y),
        roundIdentityNumber(segment.endX),
        roundIdentityNumber(segment.endY),
    ]),
);

const normalizeAnchors = (anchors) => {
    if (!Array.isArray(anchors)) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ANCHORS_REQUIRED');
    }
    if (
        anchors.length < SAKURA_MACRO_SPINE_ANCHOR_MIN
        || anchors.length > SAKURA_MACRO_SPINE_ANCHOR_MAX
    ) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_ANCHOR_COUNT_INVALID:${anchors.length}`);
    }
    const normalized = anchors.map((anchor, index) => finitePoint(anchor, `anchors.${index}`));
    const root = normalized[0];
    const rootAligned = normalized.map((anchor) => ({
        x: anchor.x - root.x,
        y: anchor.y - root.y,
    }));
    rootAligned[0] = { x: 0, y: 0 };
    rootAligned.forEach((anchor, index) => {
        if (
            index > 0
            && distance(rootAligned[index - 1], anchor)
                < SAKURA_MACRO_SPINE_MIN_ANCHOR_GAP_NORM
        ) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_ANCHOR_GAP_INVALID:${index}`);
        }
    });
    const totalArc = rootAligned.slice(1).reduce((sum, anchor, index) => (
        sum + distance(rootAligned[index], anchor)
    ), 0);
    if (totalArc > SAKURA_MACRO_SPINE_MAX_ARC_NORM + EPSILON) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_ARC_LIMIT_EXCEEDED:${totalArc.toFixed(6)}`);
    }
    return rootAligned;
};

export const createSakuraMacroSpineGuideV1 = ({
    anchors,
    adherence = SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE,
    source = 'procedural',
} = {}) => {
    const normalizedAnchors = normalizeAnchors(anchors);
    const resolvedAdherence = Number(adherence);
    if (!Number.isFinite(resolvedAdherence) || resolvedAdherence < 0 || resolvedAdherence > 1) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ADHERENCE_INVALID');
    }
    if (source !== 'procedural' && source !== 'authored' && source !== 'blended') {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_SOURCE_INVALID:${String(source)}`);
    }
    return Object.freeze({
        version: SAKURA_MACRO_SPINE_GUIDE_VERSION,
        contract: SAKURA_MACRO_SPINE_GUIDE_CONTRACT,
        coordinateSpace: SAKURA_MACRO_SPINE_COORDINATE_SPACE,
        guideId: createGuideId(normalizedAnchors),
        source,
        adherence: resolvedAdherence,
        anchors: Object.freeze(normalizedAnchors.map((anchor, index) => Object.freeze({
            id: index === 0 ? 'root' : `anchor_${index}`,
            x: anchor.x,
            y: anchor.y,
        }))),
    });
};

export const requireSakuraMacroSpineGuideV1 = (guide) => {
    if (!isObject(guide)) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_REQUIRED');
    }
    if (
        guide.version !== SAKURA_MACRO_SPINE_GUIDE_VERSION
        || guide.contract !== SAKURA_MACRO_SPINE_GUIDE_CONTRACT
        || guide.coordinateSpace !== SAKURA_MACRO_SPINE_COORDINATE_SPACE
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_CONTRACT_INVALID');
    }
    const normalized = createSakuraMacroSpineGuideV1({
        anchors: guide.anchors,
        adherence: guide.adherence,
        source: guide.source,
    });
    if (normalized.guideId !== guide.guideId) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_ID_INVALID');
    }
    return guide;
};

const trimPolylineAtArcLength = (points, maxArcLength) => {
    const output = [points[0]];
    let consumed = 0;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const point = points[index];
        const span = distance(previous, point);
        if (span <= EPSILON) continue;
        if (consumed + span <= maxArcLength + EPSILON) {
            output.push(point);
            consumed += span;
            continue;
        }
        const remaining = maxArcLength - consumed;
        if (remaining > EPSILON) {
            const t = clamp(remaining / span, 0, 1);
            output.push({
                x: lerp(previous.x, point.x, t),
                y: lerp(previous.y, point.y, t),
            });
        }
        break;
    }
    return output;
};

const polylineArcTable = (points) => {
    const entries = [{ index: 0, arc: 0 }];
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
        total += distance(points[index - 1], points[index]);
        entries.push({ index, arc: total });
    }
    return { entries, total };
};

const samplePolylineAtArc = (points, table, targetArc) => {
    const target = clamp(targetArc, 0, table.total);
    for (let index = 1; index < table.entries.length; index += 1) {
        const right = table.entries[index];
        if (right.arc + EPSILON < target) continue;
        const left = table.entries[index - 1];
        const span = Math.max(EPSILON, right.arc - left.arc);
        const t = clamp((target - left.arc) / span, 0, 1);
        return {
            x: lerp(points[left.index].x, points[right.index].x, t),
            y: lerp(points[left.index].y, points[right.index].y, t),
        };
    }
    return { ...points.at(-1) };
};

const resolvePolylineTurn = (points) => {
    let totalTurn = 0;
    for (let index = 1; index < points.length - 1; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        const c = points[index + 1];
        const angleA = Math.atan2(b.y - a.y, b.x - a.x);
        const angleB = Math.atan2(c.y - b.y, c.x - b.x);
        let delta = angleB - angleA;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        totalTurn += Math.abs(delta);
    }
    return totalTurn;
};

const resolveMacroAnchorCount = ({ totalArc, totalTurn }) => clamp(
    Math.round(3 + (Math.min(1, totalArc / 1.05) * 2.2) + (Math.min(1, totalTurn / Math.PI) * 1.8)),
    SAKURA_MACRO_SPINE_ANCHOR_MIN,
    SAKURA_MACRO_SPINE_ANCHOR_MAX,
);

const createDecayingStations = (count, decay = 0.82) => {
    const intervalCount = count - 1;
    const weights = Array.from({ length: intervalCount }, (_, index) => decay ** index);
    const total = weights.reduce((sum, value) => sum + value, 0);
    const stations = [0];
    let cumulative = 0;
    weights.forEach((weight) => {
        cumulative += weight;
        stations.push(cumulative / total);
    });
    stations[stations.length - 1] = 1;
    return stations;
};

const resolvePolylineTurnSamples = (points, table) => points.slice(1, -1).map(
    (point, offset) => {
        const index = offset + 1;
        const previous = points[index - 1];
        const next = points[index + 1];
        const incoming = Math.atan2(point.y - previous.y, point.x - previous.x);
        const outgoing = Math.atan2(next.y - point.y, next.x - point.x);
        let turn = outgoing - incoming;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        return {
            index,
            arcNorm: table.entries[index].arc / Math.max(EPSILON, table.total),
            turn,
            absTurn: Math.abs(turn),
        };
    },
);

const resolveFiniteTurnRegions = (turnSamples) => {
    const regions = [];
    turnSamples.forEach((sample) => {
        if (sample.absTurn < 0.025) return;
        const sign = Math.sign(sample.turn);
        const previous = regions.at(-1);
        if (
            previous
            && previous.sign === sign
            && sample.index <= previous.lastIndex + 2
        ) {
            previous.samples.push(sample);
            previous.lastIndex = sample.index;
            return;
        }
        regions.push({
            sign,
            firstIndex: sample.index,
            lastIndex: sample.index,
            samples: [sample],
        });
    });
    return regions.map((region) => {
        const totalTurn = region.samples.reduce((sum, sample) => sum + sample.absTurn, 0);
        const weightedArc = region.samples.reduce(
            (sum, sample) => sum + (sample.arcNorm * sample.absTurn),
            0,
        ) / Math.max(EPSILON, totalTurn);
        const startArcNorm = region.samples[0].arcNorm;
        const endArcNorm = region.samples.at(-1).arcNorm;
        return {
            ...region,
            totalTurn,
            startArcNorm,
            endArcNorm,
            coreArcNorm: weightedArc,
            supportArcNorm: Math.max(0, endArcNorm - startArcNorm),
        };
    }).filter((region) => region.totalTurn >= 0.14);
};

const createArticulatedStationCandidateGroups = (turnSamples) => resolveFiniteTurnRegions(
    turnSamples,
)
    .map((region) => {
        const shoulderPad = clamp(0.018 + (region.supportArcNorm * 0.16), 0.018, 0.055);
        const score = region.totalTurn * (1 + Math.min(0.24, region.supportArcNorm));
        return {
            score,
            startArcNorm: region.startArcNorm,
            endArcNorm: region.endArcNorm,
            candidates: [
                {
                    arcNorm: Math.max(0.06, region.startArcNorm - shoulderPad),
                    role: 'shoulder_in',
                },
                { arcNorm: region.coreArcNorm, role: 'core' },
                {
                    arcNorm: Math.min(0.96, region.endArcNorm + shoulderPad),
                    role: 'shoulder_out',
                },
            ].filter((candidate) => (
                candidate.arcNorm > 0.05 && candidate.arcNorm < 0.97
            )),
        };
    })
    .filter((group) => group.candidates.length > 0)
    .sort((left, right) => (
        right.score - left.score
        || left.candidates[0].arcNorm - right.candidates[0].arcNorm
    ));

const selectArticulatedStationGroups = ({ groups, selected, count }) => {
    groups
        .flatMap((group) => group.candidates.map((candidate) => ({
            ...candidate,
            score: group.score * (candidate.role === 'core' ? 1.35 : 0.72),
        })))
        .sort((left, right) => (
            right.score - left.score
            || left.arcNorm - right.arcNorm
            || left.role.localeCompare(right.role)
        ))
        .forEach((candidate) => {
            if (selected.length >= count) return;
            if (selected.every((station) => Math.abs(station - candidate.arcNorm) >= 0.045)) {
                selected.push(candidate.arcNorm);
            }
        });
};

const createCurvatureAwareStations = (
    points,
    table,
    count,
    articulatedSupports = null,
) => {
    const turnSamples = resolvePolylineTurnSamples(points, table);
    const totalTurn = turnSamples.reduce((sum, sample) => sum + sample.absTurn, 0);
    const peakBudget = clamp(
        totalTurn >= 0.12 ? Math.ceil(totalTurn / (Math.PI * 0.3)) : 0,
        0,
        count - 2,
    );
    const selected = [0, 1];
    const articulatedGroups = createArticulatedStationCandidateGroups(turnSamples)
        .filter((group) => (
            articulatedSupports === null
            || articulatedSupports.some((support) => (
                group.endArcNorm >= support.startArcNorm - EPSILON
                && group.startArcNorm <= support.endArcNorm + EPSILON
            ))
        ));
    selectArticulatedStationGroups({
        groups: articulatedGroups,
        selected,
        count,
    });
    turnSamples
        .filter((sample) => (
            sample.arcNorm > 0.06
            && sample.arcNorm < 0.96
            && sample.absTurn >= 0.08
        ))
        .map((sample) => ({
            arcNorm: sample.arcNorm,
            score: sample.absTurn * Math.min(
                distance(points[sample.index - 1], points[sample.index]),
                distance(points[sample.index], points[sample.index + 1]),
            ),
        }))
        .sort((left, right) => right.score - left.score || left.arcNorm - right.arcNorm)
        .forEach((peak) => {
            if (selected.length >= peakBudget + 2) return;
            if (selected.every((station) => Math.abs(station - peak.arcNorm) >= 0.05)) {
                selected.push(peak.arcNorm);
            }
        });
    createDecayingStations(count).slice(1, -1).forEach((station) => {
        if (selected.length >= count) return;
        if (selected.every((existing) => Math.abs(existing - station) >= 0.055)) {
            selected.push(station);
        }
    });
    while (selected.length < count) {
        selected.sort((left, right) => left - right);
        let widestIndex = 0;
        let widestGap = 0;
        for (let index = 0; index < selected.length - 1; index += 1) {
            const gap = selected[index + 1] - selected[index];
            if (gap > widestGap) {
                widestGap = gap;
                widestIndex = index;
            }
        }
        selected.push((selected[widestIndex] + selected[widestIndex + 1]) * 0.5);
    }
    return selected.sort((left, right) => left - right);
};

export const simplifySakuraSpineStrokeToMacroGuideV1 = ({
    points,
    adherence = SAKURA_MACRO_SPINE_DEFAULT_ADHERENCE,
    maxArcNorm = SAKURA_MACRO_SPINE_MAX_ARC_NORM,
    articulatedSupports = null,
} = {}) => {
    if (!Array.isArray(points) || points.length < 2) {
        throw new Error('ZEN_SAKURA_SPINE_STROKE_REQUIRED');
    }
    const raw = points.map((point, index) => finitePoint(point, `stroke.${index}`));
    const root = raw[0];
    const rootLocal = raw
        .map((point) => ({ x: point.x - root.x, y: point.y - root.y }))
        .filter((point, index, values) => index === 0 || distance(values[index - 1], point) >= 0.002);
    if (rootLocal.length < 2) {
        throw new Error('ZEN_SAKURA_SPINE_STROKE_TOO_SHORT');
    }
    const resolvedMaxArc = Number(maxArcNorm);
    if (!Number.isFinite(resolvedMaxArc) || resolvedMaxArc <= 0) {
        throw new Error('ZEN_SAKURA_SPINE_MAX_ARC_INVALID');
    }
    if (articulatedSupports !== null && !Array.isArray(articulatedSupports)) {
        throw new Error('ZEN_SAKURA_SPINE_ARTICULATED_SUPPORTS_INVALID');
    }
    const resolvedArticulatedSupports = articulatedSupports === null
        ? null
        : articulatedSupports.map((support, index) => {
            const startArcNorm = Number(support?.startArcNorm);
            const endArcNorm = Number(support?.endArcNorm);
            if (
                !Number.isFinite(startArcNorm)
                || !Number.isFinite(endArcNorm)
                || startArcNorm < 0
                || endArcNorm > 1
                || endArcNorm <= startArcNorm
            ) {
                throw new Error(`ZEN_SAKURA_SPINE_ARTICULATED_SUPPORT_INVALID:${index}`);
            }
            return { startArcNorm, endArcNorm };
        });
    const trimmed = trimPolylineAtArcLength(rootLocal, resolvedMaxArc);
    const table = polylineArcTable(trimmed);
    if (table.total < 0.18) {
        throw new Error('ZEN_SAKURA_SPINE_STROKE_TOO_SHORT');
    }
    const anchorCount = resolveMacroAnchorCount({
        totalArc: table.total,
        totalTurn: resolvePolylineTurn(trimmed),
    });
    const anchors = createCurvatureAwareStations(
        trimmed,
        table,
        anchorCount,
        resolvedArticulatedSupports,
    ).map((station) => samplePolylineAtArc(trimmed, table, station * table.total));
    anchors[0] = { x: 0, y: 0 };
    return createSakuraMacroSpineGuideV1({
        anchors,
        adherence,
        source: 'authored',
    });
};

const resolveAnchorHandle = (anchors, index) => {
    const anchor = anchors[index];
    if (index === 0) {
        return {
            x: (anchors[1].x - anchor.x) / 3,
            y: (anchors[1].y - anchor.y) / 3,
        };
    }
    if (index === anchors.length - 1) {
        return {
            x: (anchor.x - anchors[index - 1].x) / 3,
            y: (anchor.y - anchors[index - 1].y) / 3,
        };
    }
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    const directionX = next.x - previous.x;
    const directionY = next.y - previous.y;
    const directionLength = Math.hypot(directionX, directionY) || 1;
    const adjacentLimit = Math.min(distance(previous, anchor), distance(anchor, next)) * 0.42;
    const handleLength = Math.min(directionLength / 6, adjacentLimit);
    return {
        x: (directionX / directionLength) * handleLength,
        y: (directionY / directionLength) * handleLength,
    };
};

// A terminal handle that simply follows the first/last chord forces a cubic to
// bow to the opposite side before it can meet a different interior tangent.
// Reflecting the adjacent C1 handle across that chord keeps the two endpoint
// tangents symmetric around the observed span direction. Their normal parts
// cancel, so the boundary span carries one finite turn instead of a false
// root/apex S-hook.
const reflectHandleAcrossChord = (handle, start, end) => {
    const chordX = end.x - start.x;
    const chordY = end.y - start.y;
    const chordLength = Math.hypot(chordX, chordY);
    if (chordLength <= EPSILON) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_BOUNDARY_CHORD_INVALID');
    }
    const axisX = chordX / chordLength;
    const axisY = chordY / chordLength;
    const along = (handle.x * axisX) + (handle.y * axisY);
    return {
        x: (2 * along * axisX) - handle.x,
        y: (2 * along * axisY) - handle.y,
    };
};

const stabilizeBoundaryHandles = (anchors, handles) => {
    if (anchors.length < 3) return handles;
    const stabilized = handles.map((handle) => ({ ...handle }));
    stabilized[0] = reflectHandleAcrossChord(
        stabilized[1],
        anchors[0],
        anchors[1],
    );
    const lastIndex = anchors.length - 1;
    stabilized[lastIndex] = reflectHandleAcrossChord(
        stabilized[lastIndex - 1],
        anchors[lastIndex - 1],
        anchors[lastIndex],
    );
    return stabilized;
};

export const fitSakuraMacroSpineGuideC1V1 = (guide) => {
    const resolvedGuide = requireSakuraMacroSpineGuideV1(guide);
    const anchors = resolvedGuide.anchors;
    const handles = stabilizeBoundaryHandles(
        anchors,
        anchors.map((_, index) => resolveAnchorHandle(anchors, index)),
    );
    const segments = anchors.slice(0, -1).map((anchor, index) => {
        const next = anchors[index + 1];
        const segment = {
            index,
            startX: anchor.x,
            startY: anchor.y,
            cp1X: anchor.x + handles[index].x,
            cp1Y: anchor.y + handles[index].y,
            cp2X: next.x - handles[index + 1].x,
            cp2Y: next.y - handles[index + 1].y,
            endX: next.x,
            endY: next.y,
        };
        return Object.freeze(segment);
    });
    return Object.freeze({
        version: 1,
        representation: 'c1_piecewise_cubic_bezier_v1',
        coordinateSpace: resolvedGuide.coordinateSpace,
        guideId: resolvedGuide.guideId,
        shapeId: createShapeId(segments),
        segments: Object.freeze(segments),
    });
};

const cubicPoint = (segment, t) => {
    const u = 1 - t;
    return {
        x: (u ** 3 * segment.startX)
            + (3 * u * u * t * segment.cp1X)
            + (3 * u * t * t * segment.cp2X)
            + (t ** 3 * segment.endX),
        y: (u ** 3 * segment.startY)
            + (3 * u * u * t * segment.cp1Y)
            + (3 * u * t * t * segment.cp2Y)
            + (t ** 3 * segment.endY),
    };
};

const cubicTangent = (segment, t) => {
    const u = 1 - t;
    return {
        x: (3 * u * u * (segment.cp1X - segment.startX))
            + (6 * u * t * (segment.cp2X - segment.cp1X))
            + (3 * t * t * (segment.endX - segment.cp2X)),
        y: (3 * u * u * (segment.cp1Y - segment.startY))
            + (6 * u * t * (segment.cp2Y - segment.cp1Y))
            + (3 * t * t * (segment.endY - segment.cp2Y)),
    };
};

const buildShapeArcTable = (shape) => {
    const entries = [];
    let total = 0;
    shape.segments.forEach((segment, segmentIndex) => {
        let previous = cubicPoint(segment, 0);
        if (segmentIndex === 0) {
            entries.push({ segmentIndex, t: 0, arc: 0, point: previous });
        }
        for (let step = 1; step <= ARC_TABLE_STEPS_PER_SEGMENT; step += 1) {
            const t = step / ARC_TABLE_STEPS_PER_SEGMENT;
            const point = cubicPoint(segment, t);
            total += distance(previous, point);
            entries.push({ segmentIndex, t, arc: total, point });
            previous = point;
        }
    });
    return { entries, total };
};

const resolveShapeArcTable = (shape) => {
    if (!Object.isFrozen(shape)) {
        return buildShapeArcTable(shape);
    }
    const cached = FROZEN_SHAPE_ARC_TABLE_CACHE.get(shape);
    if (cached) return cached;
    const table = buildShapeArcTable(shape);
    FROZEN_SHAPE_ARC_TABLE_CACHE.set(shape, table);
    return table;
};

const resolveShapeArcLocation = (shape, table, arcNorm) => {
    const target = clamp(arcNorm, 0, 1) * table.total;
    for (let index = 1; index < table.entries.length; index += 1) {
        const right = table.entries[index];
        if (right.arc + EPSILON < target) continue;
        const left = table.entries[index - 1];
        if (left.segmentIndex !== right.segmentIndex) {
            return target <= left.arc ? left : right;
        }
        const span = Math.max(EPSILON, right.arc - left.arc);
        const ratio = clamp((target - left.arc) / span, 0, 1);
        const t = lerp(left.t, right.t, ratio);
        return {
            segmentIndex: right.segmentIndex,
            t,
            arc: target,
            point: cubicPoint(shape.segments[right.segmentIndex], t),
        };
    }
    const segmentIndex = shape.segments.length - 1;
    return {
        segmentIndex,
        t: 1,
        arc: table.total,
        point: cubicPoint(shape.segments[segmentIndex], 1),
    };
};

export const sampleSakuraMacroSpineShapeAtArcNorm = (shape, arcNorm) => {
    if (!isObject(shape) || !Array.isArray(shape.segments) || !shape.segments.length) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_SHAPE_REQUIRED');
    }
    const table = resolveShapeArcTable(shape);
    const location = resolveShapeArcLocation(shape, table, arcNorm);
    const tangent = cubicTangent(shape.segments[location.segmentIndex], location.t);
    return {
        ...location.point,
        angle: Math.atan2(tangent.y, tangent.x),
        segmentIndex: location.segmentIndex,
        t: location.t,
        arcNorm: clamp(Number(arcNorm) || 0, 0, 1),
    };
};

export const blendSakuraMacroSpineGuidesV1 = ({ proceduralGuide, authoredGuide }) => {
    const procedural = requireSakuraMacroSpineGuideV1(proceduralGuide);
    const authored = requireSakuraMacroSpineGuideV1(authoredGuide);
    const proceduralShape = fitSakuraMacroSpineGuideC1V1(procedural);
    const authoredTable = polylineArcTable(authored.anchors);
    const adherence = authored.adherence;
    const anchors = authored.anchors.map((anchor, index) => {
        const authoredArcNorm = index === 0
            ? 0
            : authoredTable.entries[index].arc / Math.max(EPSILON, authoredTable.total);
        const proceduralPoint = sampleSakuraMacroSpineShapeAtArcNorm(
            proceduralShape,
            authoredArcNorm,
        );
        return {
            x: lerp(proceduralPoint.x, anchor.x, adherence),
            y: lerp(proceduralPoint.y, anchor.y, adherence),
        };
    });
    anchors[0] = { x: 0, y: 0 };
    return createSakuraMacroSpineGuideV1({
        anchors,
        adherence,
        source: 'blended',
    });
};

const splitCubic = (segment, t) => {
    const p0 = { x: segment.startX, y: segment.startY };
    const p1 = { x: segment.cp1X, y: segment.cp1Y };
    const p2 = { x: segment.cp2X, y: segment.cp2Y };
    const p3 = { x: segment.endX, y: segment.endY };
    const q0 = { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
    const q1 = { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) };
    const q2 = { x: lerp(p2.x, p3.x, t), y: lerp(p2.y, p3.y, t) };
    const r0 = { x: lerp(q0.x, q1.x, t), y: lerp(q0.y, q1.y, t) };
    const r1 = { x: lerp(q1.x, q2.x, t), y: lerp(q1.y, q2.y, t) };
    const s = { x: lerp(r0.x, r1.x, t), y: lerp(r0.y, r1.y, t) };
    return [
        {
            startX: p0.x, startY: p0.y,
            cp1X: q0.x, cp1Y: q0.y,
            cp2X: r0.x, cp2Y: r0.y,
            endX: s.x, endY: s.y,
        },
        {
            startX: s.x, startY: s.y,
            cp1X: r1.x, cp1Y: r1.y,
            cp2X: q2.x, cp2Y: q2.y,
            endX: p3.x, endY: p3.y,
        },
    ];
};

const subCubic = (segment, t0, t1) => {
    if (t0 <= EPSILON && t1 >= 1 - EPSILON) return { ...segment };
    const [, right] = splitCubic(segment, clamp(t0, 0, 1));
    const localT = (clamp(t1, 0, 1) - clamp(t0, 0, 1)) / Math.max(EPSILON, 1 - clamp(t0, 0, 1));
    const [middle] = splitCubic(right, clamp(localT, 0, 1));
    return middle;
};

const angleDelta = (left, right) => {
    let delta = right - left;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return Math.abs(delta);
};

const flatnessError = (segment) => {
    const mid = cubicPoint(segment, 0.5);
    const chordMid = {
        x: (segment.startX + segment.endX) * 0.5,
        y: (segment.startY + segment.endY) * 0.5,
    };
    return distance(mid, chordMid);
};

const scoreInterval = (shape, interval, policy) => {
    const source = shape.segments[interval.segmentIndex];
    const segment = subCubic(source, interval.t0, interval.t1);
    const startTangent = cubicTangent(segment, 0);
    const endTangent = cubicTangent(segment, 1);
    const tangentError = angleDelta(
        Math.atan2(startTangent.y, startTangent.x),
        Math.atan2(endTangent.y, endTangent.x),
    );
    const flatness = flatnessError(segment);
    return {
        ...interval,
        score: Math.max(
            tangentError / policy.tangentThresholdRad,
            flatness / policy.flatnessThresholdNorm,
        ),
        tangentError,
        flatness,
        segment,
    };
};

const buildInitialIntervals = (shape, table, policy) => {
    const lengthNorm = clamp(table.total, 0.62, 1);
    const target = clamp(Math.round(policy.base * lengthNorm), policy.min, policy.base);
    const segmentRanges = shape.segments.map((_, segmentIndex) => {
        const entries = table.entries.filter((entry) => entry.segmentIndex === segmentIndex);
        const previousEnd = segmentIndex === 0
            ? 0
            : table.entries.find((entry) => (
                entry.segmentIndex === segmentIndex - 1 && entry.t === 1
            ))?.arc;
        const startArc = Number.isFinite(previousEnd) ? previousEnd : 0;
        const endArc = entries.at(-1)?.arc;
        if (!Number.isFinite(endArc) || endArc <= startArc) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_ARC_TABLE_INVALID:${segmentIndex}`);
        }
        return {
            segmentIndex,
            startArc,
            endArc,
            length: endArc - startArc,
        };
    });
    const allocations = segmentRanges.map((range) => Math.max(
        1,
        Math.round(target * (range.length / table.total)),
    ));
    while (allocations.reduce((sum, value) => sum + value, 0) < target) {
        let bestIndex = 0;
        let bestLoad = Number.POSITIVE_INFINITY;
        segmentRanges.forEach((range, index) => {
            const load = allocations[index] / range.length;
            if (load < bestLoad) {
                bestLoad = load;
                bestIndex = index;
            }
        });
        allocations[bestIndex] += 1;
    }
    while (allocations.reduce((sum, value) => sum + value, 0) > target) {
        let bestIndex = -1;
        let bestLoad = Number.NEGATIVE_INFINITY;
        segmentRanges.forEach((range, index) => {
            if (allocations[index] <= 1) return;
            const load = allocations[index] / range.length;
            if (load > bestLoad) {
                bestLoad = load;
                bestIndex = index;
            }
        });
        if (bestIndex < 0) break;
        allocations[bestIndex] -= 1;
    }
    const intervals = [];
    const entriesBySegment = segmentRanges.map((_, segmentIndex) => (
        table.entries.filter((entry) => entry.segmentIndex === segmentIndex)
    ));
    const resolveTAtArc = (segmentIndex, arc) => {
        const range = segmentRanges[segmentIndex];
        if (arc <= range.startArc) return 0;
        if (arc >= range.endArc) return 1;
        const entries = entriesBySegment[segmentIndex];
        let left = { t: 0, arc: range.startArc };
        for (let index = 0; index < entries.length; index += 1) {
            const right = entries[index];
            if (right.arc + EPSILON < arc) {
                left = right;
                continue;
            }
            const ratio = (arc - left.arc) / Math.max(EPSILON, right.arc - left.arc);
            return lerp(left.t, right.t, clamp(ratio, 0, 1));
        }
        return 1;
    };
    segmentRanges.forEach((range, segmentIndex) => {
        const count = allocations[segmentIndex];
        for (let index = 0; index < count; index += 1) {
            const arcStart = lerp(range.startArc, range.endArc, index / count);
            const arcEnd = lerp(range.startArc, range.endArc, (index + 1) / count);
            intervals.push({
                segmentIndex,
                t0: resolveTAtArc(segmentIndex, arcStart),
                t1: resolveTAtArc(segmentIndex, arcEnd),
                arcStartNorm: arcStart / table.total,
                arcEndNorm: arcEnd / table.total,
            });
        }
    });
    return {
        intervals: intervals.filter((interval) => interval.t1 - interval.t0 > EPSILON),
        resolveTAtArc,
    };
};

export const partitionSakuraMacroSpineShapeAtArcRangesV1 = (shape, ranges) => {
    if (!isObject(shape) || !Array.isArray(shape.segments) || !shape.segments.length) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_SHAPE_REQUIRED');
    }
    if (!Array.isArray(ranges) || !ranges.length) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ARC_RANGES_REQUIRED');
    }
    ranges.forEach((range, index) => {
        if (
            !isObject(range)
            || !Number.isFinite(range.startArcNorm)
            || !Number.isFinite(range.endArcNorm)
            || range.endArcNorm <= range.startArcNorm
            || (index === 0 && Math.abs(range.startArcNorm) > EPSILON)
            || (
                index > 0
                && Math.abs(range.startArcNorm - ranges[index - 1].endArcNorm) > EPSILON
            )
        ) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_ARC_RANGE_INVALID:${index}`);
        }
    });
    if (Math.abs(ranges.at(-1).endArcNorm - 1) > EPSILON) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ARC_RANGES_INCOMPLETE');
    }

    const table = buildShapeArcTable(shape);
    const segmentRanges = shape.segments.map((_, segmentIndex) => {
        const entries = table.entries.filter((entry) => entry.segmentIndex === segmentIndex);
        const previousEnd = segmentIndex === 0
            ? 0
            : table.entries.find((entry) => (
                entry.segmentIndex === segmentIndex - 1 && entry.t === 1
            ))?.arc;
        const startArc = Number.isFinite(previousEnd) ? previousEnd : 0;
        const endArc = entries.at(-1)?.arc;
        if (!Number.isFinite(endArc) || endArc <= startArc) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_ARC_TABLE_INVALID:${segmentIndex}`);
        }
        return { segmentIndex, startArc, endArc, entries };
    });
    const shapeBoundaryArcNorms = segmentRanges
        .slice(0, -1)
        .map((range) => range.endArc / table.total);
    const snapToShapeBoundary = (arcNorm) => {
        const nearest = shapeBoundaryArcNorms
            .map((boundary) => ({
                boundary,
                distance: Math.abs(boundary - arcNorm),
            }))
            .sort((left, right) => left.distance - right.distance)[0];
        return nearest?.distance <= SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
            ? nearest.boundary
            : arcNorm;
    };
    const partitionBoundaryArcNorms = [
        ranges[0].startArcNorm,
        ...ranges.map((range) => range.endArcNorm),
    ].map((boundary, index, boundaries) => (
        index === 0
            ? 0
            : index === boundaries.length - 1
                ? 1
                : snapToShapeBoundary(boundary)
    ));
    const partitionRanges = ranges.map((_, index) => ({
        startArcNorm: partitionBoundaryArcNorms[index],
        endArcNorm: partitionBoundaryArcNorms[index + 1],
    }));
    partitionRanges.forEach((range, index) => {
        if (
            range.endArcNorm - range.startArcNorm
            <= SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
        ) {
            throw new Error(
                `ZEN_SAKURA_MACRO_SPINE_IDENTITY_RANGE_COLLAPSED:${index}`,
            );
        }
    });
    const resolveTAtArc = (segmentRange, arc) => {
        if (arc <= segmentRange.startArc) return 0;
        if (arc >= segmentRange.endArc) return 1;
        let left = { t: 0, arc: segmentRange.startArc };
        for (let index = 0; index < segmentRange.entries.length; index += 1) {
            const right = segmentRange.entries[index];
            if (right.arc + EPSILON < arc) {
                left = right;
                continue;
            }
            const ratio = (arc - left.arc) / Math.max(EPSILON, right.arc - left.arc);
            return lerp(left.t, right.t, clamp(ratio, 0, 1));
        }
        return 1;
    };
    const pieces = [];
    partitionRanges.forEach((range, rangeIndex) => {
        const requestedStart = range.startArcNorm * table.total;
        const requestedEnd = range.endArcNorm * table.total;
        segmentRanges.forEach((segmentRange) => {
            const arcStart = Math.max(requestedStart, segmentRange.startArc);
            const arcEnd = Math.min(requestedEnd, segmentRange.endArc);
            if (arcEnd - arcStart <= EPSILON) return;
            pieces.push(Object.freeze({
                rangeIndex,
                sourceSegmentIndex: segmentRange.segmentIndex,
                arcStartNorm: arcStart / table.total,
                arcEndNorm: arcEnd / table.total,
                geometry: Object.freeze(subCubic(
                    shape.segments[segmentRange.segmentIndex],
                    resolveTAtArc(segmentRange, arcStart),
                    resolveTAtArc(segmentRange, arcEnd),
                )),
            }));
        });
    });
    if (!pieces.length) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ARC_RANGE_PARTITION_EMPTY');
    }
    return Object.freeze(pieces);
};

export const subdivideSakuraMacroSpineShapeV1 = (
    shape,
    policy = SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY,
) => {
    if (!isObject(shape) || !Array.isArray(shape.segments) || !shape.segments.length) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_SHAPE_REQUIRED');
    }
    if (
        !isObject(policy)
        || typeof policy.policyId !== 'string'
        || !policy.policyId.trim()
        || !Number.isSafeInteger(policy.min)
        || !Number.isSafeInteger(policy.base)
        || !Number.isSafeInteger(policy.soft)
        || !Number.isSafeInteger(policy.hard)
        || policy.min < 1
        || policy.base < policy.min
        || policy.soft < policy.base
        || policy.hard < policy.soft
        || typeof policy.tangentThresholdRad !== 'number'
        || !Number.isFinite(policy.tangentThresholdRad)
        || policy.tangentThresholdRad <= 0
        || typeof policy.flatnessThresholdNorm !== 'number'
        || !Number.isFinite(policy.flatnessThresholdNorm)
        || policy.flatnessThresholdNorm <= 0
        || typeof policy.targetAdjacentArcRatio !== 'number'
        || !Number.isFinite(policy.targetAdjacentArcRatio)
        || policy.targetAdjacentArcRatio < 1
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_ADJACENT_ARC_RATIO_POLICY_INVALID');
    }
    const table = resolveShapeArcTable(shape);
    const initial = buildInitialIntervals(shape, table, policy);
    let intervals = initial.intervals;
    const splitHighest = (limit, threshold) => {
        while (intervals.length < limit) {
            const scored = intervals.map((interval, index) => ({
                index,
                ...scoreInterval(shape, interval, policy),
            })).sort((left, right) => right.score - left.score || left.index - right.index);
            const highest = scored[0];
            if (!highest || highest.score <= threshold) break;
            const source = intervals[highest.index];
            const arcMidNorm = (source.arcStartNorm + source.arcEndNorm) * 0.5;
            const tMid = initial.resolveTAtArc(
                source.segmentIndex,
                arcMidNorm * table.total,
            );
            intervals.splice(highest.index, 1,
                {
                    ...source,
                    t1: tMid,
                    arcEndNorm: arcMidNorm,
                },
                {
                    ...source,
                    t0: tMid,
                    arcStartNorm: arcMidNorm,
                });
        }
    };
    splitHighest(policy.soft, 1);
    splitHighest(policy.hard, 2);
    const intervalArcLength = (interval) => (
        interval.arcEndNorm - interval.arcStartNorm
    );
    const splitIntervalAtArcMidpoint = (intervalIndex) => {
        const source = intervals[intervalIndex];
        const arcMidNorm = (source.arcStartNorm + source.arcEndNorm) * 0.5;
        const tMid = initial.resolveTAtArc(
            source.segmentIndex,
            arcMidNorm * table.total,
        );
        if (tMid <= source.t0 + EPSILON || tMid >= source.t1 - EPSILON) {
            throw new Error('ZEN_SAKURA_MACRO_SPINE_ARC_BALANCE_SPLIT_INVALID');
        }
        intervals.splice(intervalIndex, 1,
            {
                ...source,
                t1: tMid,
                arcEndNorm: arcMidNorm,
            },
            {
                ...source,
                t0: tMid,
                arcStartNorm: arcMidNorm,
            });
    };
    const targetAdjacentArcRatio = policy.targetAdjacentArcRatio;
    while (intervals.length < policy.hard) {
        let worst = null;
        for (let index = 0; index < intervals.length - 1; index += 1) {
            const leftLength = intervalArcLength(intervals[index]);
            const rightLength = intervalArcLength(intervals[index + 1]);
            const ratio = Math.max(leftLength, rightLength)
                / Math.max(EPSILON, Math.min(leftLength, rightLength));
            if (!worst || ratio > worst.ratio) {
                worst = {
                    ratio,
                    largerIndex: leftLength >= rightLength ? index : index + 1,
                };
            }
        }
        if (!worst || worst.ratio <= targetAdjacentArcRatio + 1e-6) break;
        splitIntervalAtArcMidpoint(worst.largerIndex);
    }
    const achievedMaxAdjacentArcRatio = intervals.slice(1).reduce((maximum, interval, index) => {
        const leftLength = intervalArcLength(intervals[index]);
        const rightLength = intervalArcLength(interval);
        return Math.max(
            maximum,
            Math.max(leftLength, rightLength)
                / Math.max(EPSILON, Math.min(leftLength, rightLength)),
        );
    }, 1);
    const arcBalanceLimitedByHardCap = (
        achievedMaxAdjacentArcRatio > targetAdjacentArcRatio + 1e-6
        && intervals.length >= policy.hard
    );
    const spans = intervals.map((interval, index) => {
        const scored = scoreInterval(shape, interval, policy);
        const sourceSegment = shape.segments[interval.segmentIndex];
        return Object.freeze({
            index,
            sourceSegmentIndex: interval.segmentIndex,
            arcStartNorm: index === 0 ? 0 : interval.arcStartNorm,
            arcEndNorm: index === intervals.length - 1 ? 1 : interval.arcEndNorm,
            t0: interval.t0,
            t1: interval.t1,
            geometry: Object.freeze(scored.segment),
            tangentError: scored.tangentError,
            flatnessError: scored.flatness,
            ...(sourceSegment.intentRole ? {
                intentPlanId: sourceSegment.intentPlanId,
                intentRole: sourceSegment.intentRole,
                intentEventIndex: sourceSegment.intentEventIndex,
                intentEventKind: sourceSegment.intentEventKind,
                intentEventZoneIndex: sourceSegment.intentEventZoneIndex,
                intentFormPostureKind: sourceSegment.intentFormPostureKind,
                intentFormPostureZoneIndex: sourceSegment.intentFormPostureZoneIndex,
                intentArcStartNorm: sourceSegment.intentArcStartNorm,
                intentArcEndNorm: sourceSegment.intentArcEndNorm,
            } : {}),
        });
    });
    if (spans.length < policy.min || spans.length > policy.hard) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_SUBDIVISION_COUNT_INVALID:${spans.length}`);
    }
    return Object.freeze({
        version: 1,
        policyId: policy.policyId,
        policy: Object.freeze({
            policyId: policy.policyId,
            min: policy.min,
            base: policy.base,
            soft: policy.soft,
            hard: policy.hard,
            targetAdjacentArcRatio: policy.targetAdjacentArcRatio,
            tangentThresholdRad: policy.tangentThresholdRad,
            flatnessThresholdNorm: policy.flatnessThresholdNorm,
        }),
        shapeId: shape.shapeId,
        totalArcNorm: table.total,
        spanCount: spans.length,
        targetAdjacentArcRatio,
        achievedMaxAdjacentArcRatio,
        arcBalanceLimitedByHardCap,
        spans: Object.freeze(spans),
    });
};
