import { BranchGeometryModel } from '../geometry/branchGeometryModel';
import { SAKURA_BRANCH_ORDER } from '../generation/shapePriorModel';

export const BONSAI_STRUCTURAL_DESCRIPTOR_VERSION = 1;

export const BONSAI_STRUCTURAL_VECTOR_KEYS = Object.freeze([
    'signedLean',
    'leanMagnitude',
    'endpointLateral',
    'tortuosity',
    'turnRate',
    'inflectionDensity',
    'descendingPath',
    'firstScaffoldAttach',
    'lowestPointBelowRim',
    'silhouetteAspect',
    'crownWidth',
    'crownHeight',
    'crownTriangularity',
    'downwardScaffold',
    'droopingTips',
    'lateralMassBalance',
    'scaffoldReach',
    'sparseScaffold',
    'trunkTaperRetention',
    'scaffoldTaperRetention',
]);

const EPS = 1e-8;
const SAMPLE_COUNT = 9;
const MIN_TURN_RAD = (2.5 * Math.PI) / 180;
const TRUNK_ARC_GRID_INTERVALS = 64;
const TRUNK_TURN_GRID_INTERVALS = 8;
const SEGMENT_ARC_LOOKUP_INTERVALS = 12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const distance = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
const mean = (values = []) => (
    values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0
);
const normalizeAngle = (value) => {
    let angle = Number(value) || 0;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
};
const span = (points, key) => {
    if (!points.length) return 0;
    const values = points.map((point) => Number(point[key]));
    return Math.max(...values) - Math.min(...values);
};

const requireFinitePositive = (value, errorCode) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(errorCode);
    }
    return numeric;
};

const requireBranchNode = (node) => {
    if (!node || node.type !== 'branch') {
        throw new Error('ZEN_BONSAI_STRUCTURAL_TOPOLOGY_BRANCH_REQUIRED');
    }
    requireFinitePositive(node.length, 'ZEN_BONSAI_STRUCTURAL_BRANCH_LENGTH_INVALID');
    requireFinitePositive(node.width, 'ZEN_BONSAI_STRUCTURAL_BRANCH_WIDTH_INVALID');
    if (!Number.isInteger(Number(node.branchOrder))) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_BRANCH_ORDER_INVALID');
    }
};

const collectStructuralSegments = (topology) => {
    requireBranchNode(topology);
    const segments = [];
    let nextId = 0;

    const visit = ({
        node,
        startX,
        startY,
        angle,
        parentId = null,
        attachT = 0,
        depth = 1,
    }) => {
        requireBranchNode(node);
        const order = Number(node.branchOrder);
        if (order > SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
            return;
        }
        const geometry = BranchGeometryModel.createSegment({
            startX,
            startY,
            angle,
            length: Number(node.length),
            curve: Number(node.curve) || 0,
            curveIn: node.curveIn,
            curveOut: node.curveOut,
            exactCubicControl: node.exactCubicControl,
        });
        const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => (
            BranchGeometryModel.pointAt(geometry, index / (SAMPLE_COUNT - 1))
        ));
        const record = {
            id: nextId,
            parentId,
            order,
            depth,
            attachT,
            length: Number(node.length),
            width: Number(node.width),
            angle,
            start: { x: startX, y: startY },
            end: { x: geometry.endX, y: geometry.endY },
            geometry,
            samples,
        };
        nextId += 1;
        segments.push(record);

        const children = Array.isArray(node.branches) ? node.branches : [];
        children.forEach((child) => {
            if (!child?.obj || Number(child.obj.branchOrder) > SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
                return;
            }
            const childAttachT = Number.isFinite(Number(child.t))
                ? clamp(Number(child.t), 0, 1)
                : 1;
            const attachment = BranchGeometryModel.pointAndAngleAt(geometry, childAttachT);
            visit({
                node: child.obj,
                startX: attachment.x,
                startY: attachment.y,
                angle: attachment.angle + (Number(child.angleOffset) || 0),
                parentId: record.id,
                attachT: childAttachT,
                depth: depth + 1,
            });
        });
    };

    visit({
        node: topology,
        startX: 0,
        startY: 0,
        angle: Number.isFinite(Number(topology.initialAngle))
            ? Number(topology.initialAngle)
            : -Math.PI / 2,
    });
    return segments;
};

const buildChildrenIndex = (segments) => {
    const children = new Map();
    segments.forEach((segment) => {
        if (segment.parentId === null) return;
        if (!children.has(segment.parentId)) children.set(segment.parentId, []);
        children.get(segment.parentId).push(segment);
    });
    return children;
};

const selectTrunkChain = (segments, childrenByParent) => {
    const roots = segments.filter((segment) => (
        segment.parentId === null
        && segment.order === SAKURA_BRANCH_ORDER.TRUNK
    ));
    if (roots.length !== 1) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_TRUNK_ROOT_COUNT_INVALID:${roots.length}`);
    }
    const chain = [roots[0]];
    let current = roots[0];
    while (current) {
        const candidates = (childrenByParent.get(current.id) || [])
            .filter((segment) => segment.order === SAKURA_BRANCH_ORDER.TRUNK);
        if (!candidates.length) break;
        const next = [...candidates].sort((left, right) => {
            const score = (candidate) => (
                (candidate.width / Math.max(EPS, current.width)) * 0.48
                + (candidate.length / Math.max(EPS, current.length)) * 0.3
                + (1 - clamp01(distance(candidate.start, current.end) / Math.max(1, current.length))) * 0.22
            );
            return score(right) - score(left);
        })[0];
        chain.push(next);
        current = next;
    }
    return chain;
};

const sampleTrunkChainOnStableArcGrid = (segments) => {
    if (!segments.length) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_TRUNK_CHAIN_REQUIRED');
    }
    const first = BranchGeometryModel.pointAt(segments[0].geometry, 0);
    const lookup = [{ arc: 0, point: first }];
    let totalArc = 0;
    let previous = first;
    segments.forEach((segment) => {
        for (let index = 1; index <= SEGMENT_ARC_LOOKUP_INTERVALS; index += 1) {
            const point = BranchGeometryModel.pointAt(
                segment.geometry,
                index / SEGMENT_ARC_LOOKUP_INTERVALS,
            );
            totalArc += distance(previous, point);
            lookup.push({ arc: totalArc, point });
            previous = point;
        }
    });
    if (totalArc <= EPS) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_TRUNK_ARC_INVALID');
    }

    let cursor = 1;
    return Array.from({ length: TRUNK_ARC_GRID_INTERVALS + 1 }, (_, index) => {
        const targetArc = totalArc * (index / TRUNK_ARC_GRID_INTERVALS);
        while (cursor < lookup.length - 1 && lookup[cursor].arc < targetArc) {
            cursor += 1;
        }
        const right = lookup[cursor];
        const left = lookup[Math.max(0, cursor - 1)];
        const ratio = clamp(
            (targetArc - left.arc) / Math.max(EPS, right.arc - left.arc),
            0,
            1,
        );
        return {
            x: left.point.x + ((right.point.x - left.point.x) * ratio),
            y: left.point.y + ((right.point.y - left.point.y) * ratio),
        };
    });
};

const describePolyline = (points) => {
    const edges = [];
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const length = distance(previous, current);
        if (length <= EPS) continue;
        edges.push({
            length,
            angle: Math.atan2(current.y - previous.y, current.x - previous.x),
            dy: current.y - previous.y,
        });
    }
    const pathLength = edges.reduce((sum, edge) => sum + edge.length, 0);
    const chordLength = points.length > 1 ? distance(points[0], points[points.length - 1]) : 0;
    const turnPoints = Array.from(
        { length: TRUNK_TURN_GRID_INTERVALS + 1 },
        (_, index) => points[Math.round(
            ((points.length - 1) * index) / TRUNK_TURN_GRID_INTERVALS,
        )],
    );
    const turnEdges = [];
    for (let index = 1; index < turnPoints.length; index += 1) {
        const previous = turnPoints[index - 1];
        const current = turnPoints[index];
        if (distance(previous, current) <= EPS) continue;
        turnEdges.push({
            angle: Math.atan2(current.y - previous.y, current.x - previous.x),
        });
    }
    const turns = [];
    for (let index = 1; index < turnEdges.length; index += 1) {
        const turn = normalizeAngle(turnEdges[index].angle - turnEdges[index - 1].angle);
        if (Math.abs(turn) >= MIN_TURN_RAD) turns.push(turn);
    }
    let inflectionCount = 0;
    let previousSign = 0;
    turns.forEach((turn) => {
        const sign = Math.sign(turn);
        if (previousSign && sign !== previousSign) inflectionCount += 1;
        previousSign = sign;
    });
    const absoluteTurn = turns.reduce((sum, turn) => sum + Math.abs(turn), 0);
    const signedTurn = turns.reduce((sum, turn) => sum + turn, 0);
    const descendingLength = edges.reduce(
        (sum, edge) => sum + (edge.dy > 0 ? edge.length : 0),
        0,
    );
    return {
        pathLength,
        chordLength,
        pathToChordRatio: pathLength / Math.max(EPS, chordLength),
        absoluteTurn,
        signedTurn,
        meanTurn: turns.length ? absoluteTurn / turns.length : 0,
        inflectionCount,
        inflectionOpportunityCount: Math.max(1, turnEdges.length - 2),
        dominantTurnRatio: absoluteTurn > EPS ? Math.abs(signedTurn) / absoluteTurn : 1,
        descendingPathRatio: descendingLength / Math.max(EPS, pathLength),
    };
};

const widthForBand = (points, minY, height, lower, upper) => {
    if (!points.length || height <= EPS) return 0;
    const selected = points.filter((point) => {
        const fromBottom = (minY + height - point.y) / height;
        return fromBottom >= lower && fromBottom <= upper;
    });
    return span(selected, 'x');
};

const resolveFirstScaffoldPathRatio = ({ trunkChain, scaffoldRoots }) => {
    if (!scaffoldRoots.length) return 1;
    const trunkIndex = new Map(trunkChain.map((segment, index) => [segment.id, index]));
    const cumulative = [];
    let total = 0;
    trunkChain.forEach((segment) => {
        cumulative.push(total);
        total += segment.length;
    });
    const ratios = scaffoldRoots
        .map((segment) => {
            const parentIndex = trunkIndex.get(segment.parentId);
            if (!Number.isInteger(parentIndex)) return null;
            const parent = trunkChain[parentIndex];
            return (
                cumulative[parentIndex]
                + (parent.length * clamp01(segment.attachT))
            ) / Math.max(EPS, total);
        })
        .filter((value) => Number.isFinite(value));
    return ratios.length ? Math.min(...ratios) : 1;
};

export class BonsaiStructuralDescriptorModel {
    static vectorize(descriptor) {
        if (!descriptor || descriptor.version !== BONSAI_STRUCTURAL_DESCRIPTOR_VERSION) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_DESCRIPTOR_VERSION_INVALID');
        }
        const aspect = descriptor.bounds.height / Math.max(EPS, descriptor.bounds.width);
        return {
            signedLean: round(clamp(descriptor.trunk.signedNetLeanDeg / 90, -1, 1)),
            leanMagnitude: round(clamp01(descriptor.trunk.netLeanDeg / 90)),
            endpointLateral: round(clamp(
                descriptor.trunk.signedEndpointLateralRatio / 1.25,
                -1,
                1,
            )),
            tortuosity: round(clamp01((descriptor.trunk.pathToChordRatio - 1) / 0.42)),
            turnRate: round(clamp01(descriptor.trunk.meanTurnDeg / 14)),
            inflectionDensity: round(clamp01(descriptor.trunk.inflectionDensity)),
            descendingPath: round(clamp01(descriptor.trunk.descendingPathRatio)),
            firstScaffoldAttach: round(clamp01(descriptor.trunk.firstScaffoldPathRatio)),
            lowestPointBelowRim: round(clamp01(descriptor.trunk.lowestPointPotRatio / 1.5)),
            silhouetteAspect: round(clamp01(aspect / 4)),
            crownWidth: round(clamp01(descriptor.crown.widthToTreeHeight / 1.5)),
            crownHeight: round(clamp01(descriptor.crown.heightToTreeHeight)),
            crownTriangularity: round(clamp01(descriptor.crown.triangularity)),
            downwardScaffold: round(clamp01(descriptor.crown.downwardScaffoldRatio)),
            droopingTips: round(clamp01(descriptor.crown.droopingTipRatio)),
            lateralMassBalance: round(clamp01(descriptor.crown.lateralMassBalance)),
            scaffoldReach: round(clamp01(
                descriptor.structure.scaffoldToTrunkLengthRatio / 3,
            )),
            sparseScaffold: round(clamp01(descriptor.structure.sparseScaffoldRatio)),
            trunkTaperRetention: round(clamp01(descriptor.trunk.taperRetention)),
            scaffoldTaperRetention: round(clamp01(
                descriptor.structure.scaffoldTaperRetention,
            )),
        };
    }

    static distance(left, right) {
        const leftVector = BonsaiStructuralDescriptorModel.vectorize(left);
        const rightVector = BonsaiStructuralDescriptorModel.vectorize(right);
        const squared = BONSAI_STRUCTURAL_VECTOR_KEYS.reduce((sum, key) => (
            sum + ((Number(leftVector[key]) - Number(rightVector[key])) ** 2)
        ), 0);
        return round(Math.sqrt(squared / BONSAI_STRUCTURAL_VECTOR_KEYS.length));
    }

    static analyze(topology, { potHeight } = {}) {
        const resolvedPotHeight = requireFinitePositive(
            potHeight,
            'ZEN_BONSAI_STRUCTURAL_POT_HEIGHT_REQUIRED',
        );
        const segments = collectStructuralSegments(topology);
        const childrenByParent = buildChildrenIndex(segments);
        const trunkChain = selectTrunkChain(segments, childrenByParent);
        const trunkIds = new Set(trunkChain.map((segment) => segment.id));
        const trunkPoints = sampleTrunkChainOnStableArcGrid(trunkChain);
        const scaffoldSegments = segments.filter((segment) => !trunkIds.has(segment.id));
        const scaffoldPoints = scaffoldSegments.flatMap((segment) => segment.samples);
        const allPoints = [...trunkPoints, ...scaffoldPoints];
        const trunkLine = describePolyline(trunkPoints);
        const root = trunkPoints[0];
        const apex = trunkPoints[trunkPoints.length - 1];
        const minX = Math.min(...allPoints.map((point) => point.x));
        const maxX = Math.max(...allPoints.map((point) => point.x));
        const minY = Math.min(...allPoints.map((point) => point.y));
        const maxY = Math.max(...allPoints.map((point) => point.y));
        const treeWidth = Math.max(EPS, maxX - minX);
        const treeHeight = Math.max(EPS, maxY - minY);
        const upwardRise = root.y - apex.y;
        const signedNetLeanDeg = Math.atan2(
            apex.x - root.x,
            Math.max(EPS, upwardRise),
        ) * (180 / Math.PI);
        const netLeanDeg = Math.abs(signedNetLeanDeg);
        const maximumTrunkDrop = Math.max(
            0,
            ...trunkPoints.map((point) => point.y - root.y),
        );
        const trunkLateralExcursion = Math.max(
            0,
            ...trunkPoints.map((point) => Math.abs(point.x - root.x)),
        );

        const crownMinY = scaffoldPoints.length
            ? Math.min(...scaffoldPoints.map((point) => point.y))
            : apex.y;
        const crownMaxY = scaffoldPoints.length
            ? Math.max(...scaffoldPoints.map((point) => point.y))
            : apex.y;
        const crownHeight = Math.max(EPS, crownMaxY - crownMinY);
        const crownWidth = Math.max(EPS, span(scaffoldPoints, 'x'));
        const lowerBandWidth = widthForBand(scaffoldPoints, crownMinY, crownHeight, 0, 1 / 3);
        const middleBandWidth = widthForBand(scaffoldPoints, crownMinY, crownHeight, 1 / 3, 2 / 3);
        const upperBandWidth = widthForBand(scaffoldPoints, crownMinY, crownHeight, 2 / 3, 1);
        const lowerOverMiddle = clamp01(
            0.5 + ((lowerBandWidth - middleBandWidth) / Math.max(EPS, crownWidth * 2)),
        );
        const middleOverUpper = clamp01(
            0.5 + ((middleBandWidth - upperBandWidth) / Math.max(EPS, crownWidth * 2)),
        );
        const triangularity = clamp01(
            lowerOverMiddle * 0.42
            + middleOverUpper * 0.42
            + clamp01(lowerBandWidth / Math.max(EPS, crownWidth)) * 0.16,
        );

        const scaffoldRoots = scaffoldSegments.filter((segment) => trunkIds.has(segment.parentId));
        const firstScaffoldPathRatio = resolveFirstScaffoldPathRatio({
            trunkChain,
            scaffoldRoots,
        });
        const scaffoldLength = scaffoldSegments.reduce((sum, segment) => sum + segment.length, 0);
        const trunkLength = trunkChain.reduce((sum, segment) => sum + segment.length, 0);
        const downwardScaffoldWeight = scaffoldSegments.reduce((sum, segment) => {
            const dyRatio = (segment.end.y - segment.start.y) / Math.max(EPS, segment.length);
            return sum + segment.length * clamp01((dyRatio + 0.08) / 0.92);
        }, 0);
        const structuralTips = scaffoldSegments.filter((segment) => (
            !(childrenByParent.get(segment.id) || []).some((child) => (
                child.order <= SAKURA_BRANCH_ORDER.SECONDARY_BRANCH
            ))
        ));
        const droopingTips = structuralTips.filter((segment) => (
            segment.end.y - segment.start.y > segment.length * 0.06
        ));

        let crownMass = 0;
        let crownMassX = 0;
        let leftMass = 0;
        let rightMass = 0;
        scaffoldSegments.forEach((segment) => {
            const mass = segment.length * Math.max(0.2, segment.width);
            const centerX = (segment.start.x + segment.end.x) * 0.5;
            crownMass += mass;
            crownMassX += centerX * mass;
            if (centerX < root.x) leftMass += mass;
            else rightMass += mass;
        });
        const crownCentroidX = crownMass > EPS ? crownMassX / crownMass : apex.x;
        const crownCentroidY = scaffoldPoints.length
            ? mean(scaffoldPoints.map((point) => point.y))
            : apex.y;
        const lateralMassBalance = crownMass > EPS
            ? 1 - (Math.abs(leftMass - rightMass) / crownMass)
            : 1;
        const apexDirection = Math.sign(apex.x - root.x);
        const crownDirection = Math.sign(crownCentroidX - root.x);
        const counterBalance = apexDirection === 0 || crownDirection === 0
            ? 0.5
            : (apexDirection === crownDirection ? 0 : 1);
        const rootWidth = trunkChain[0]?.width || 1;
        const trunkTipWidth = trunkChain[trunkChain.length - 1]?.width || rootWidth;
        const scaffoldRootMeanWidth = mean(scaffoldRoots.map((segment) => segment.width));
        const scaffoldTipMeanWidth = mean(structuralTips.map((segment) => segment.width));

        const descriptor = {
            version: BONSAI_STRUCTURAL_DESCRIPTOR_VERSION,
            coordinateFrame: {
                origin: 'trunk_root_at_pot_rim',
                yAxis: 'down',
                potRimY: 0,
                potBottomY: round(resolvedPotHeight, 3),
            },
            topology: {
                trunkCount: segments.filter((segment) => (
                    segment.parentId === null
                    && segment.order === SAKURA_BRANCH_ORDER.TRUNK
                )).length,
                trunkSegmentCount: trunkChain.length,
                primaryScaffoldCount: scaffoldRoots.filter((segment) => (
                    segment.order === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
                )).length,
                scaffoldSegmentCount: scaffoldSegments.length,
                structuralTipCount: structuralTips.length,
            },
            bounds: {
                width: round(treeWidth, 3),
                height: round(treeHeight, 3),
                minX: round(minX, 3),
                maxX: round(maxX, 3),
                minY: round(minY, 3),
                maxY: round(maxY, 3),
            },
            trunk: {
                netLeanDeg: round(netLeanDeg, 3),
                signedNetLeanDeg: round(signedNetLeanDeg, 3),
                endpointLateralRatio: round(
                    Math.abs(apex.x - root.x) / Math.max(EPS, treeHeight),
                ),
                signedEndpointLateralRatio: round(
                    (apex.x - root.x) / Math.max(EPS, treeHeight),
                ),
                lateralExcursionRatio: round(trunkLateralExcursion / Math.max(EPS, treeHeight)),
                upwardRiseRatio: round(upwardRise / Math.max(EPS, trunkLine.pathLength)),
                descendingPathRatio: round(trunkLine.descendingPathRatio),
                pathToChordRatio: round(trunkLine.pathToChordRatio),
                totalTurnDeg: round(trunkLine.absoluteTurn * (180 / Math.PI), 3),
                meanTurnDeg: round(trunkLine.meanTurn * (180 / Math.PI), 3),
                signedTurnDeg: round(trunkLine.signedTurn * (180 / Math.PI), 3),
                inflectionCount: trunkLine.inflectionCount,
                inflectionDensity: round(
                    trunkLine.inflectionCount / trunkLine.inflectionOpportunityCount,
                ),
                dominantTurnRatio: round(trunkLine.dominantTurnRatio),
                firstScaffoldPathRatio: round(firstScaffoldPathRatio),
                branchlessLowerRatio: round(firstScaffoldPathRatio),
                slenderness: round(treeHeight / Math.max(EPS, rootWidth)),
                taperRetention: round(trunkTipWidth / Math.max(EPS, rootWidth)),
                lowestPointPotRatio: round(maximumTrunkDrop / resolvedPotHeight),
                endpointPotRatio: round(Math.max(0, apex.y - root.y) / resolvedPotHeight),
                apexReturnRatio: round(clamp01(
                    1 - (Math.abs(apex.x - root.x) / Math.max(EPS, treeWidth * 0.6)),
                )),
            },
            crown: {
                widthToTreeHeight: round(crownWidth / Math.max(EPS, treeHeight)),
                heightToTreeHeight: round(crownHeight / Math.max(EPS, treeHeight)),
                centroidHeightRatio: round((maxY - crownCentroidY) / Math.max(EPS, treeHeight)),
                centroidLateralRatio: round((crownCentroidX - root.x) / Math.max(EPS, treeWidth * 0.5)),
                firstAttachPathRatio: round(firstScaffoldPathRatio),
                lowerBandWidthRatio: round(lowerBandWidth / Math.max(EPS, crownWidth)),
                middleBandWidthRatio: round(middleBandWidth / Math.max(EPS, crownWidth)),
                upperBandWidthRatio: round(upperBandWidth / Math.max(EPS, crownWidth)),
                triangularity: round(triangularity),
                downwardScaffoldRatio: round(
                    downwardScaffoldWeight / Math.max(EPS, scaffoldLength),
                ),
                droopingTipRatio: round(
                    droopingTips.length / Math.max(1, structuralTips.length),
                ),
                lateralMassBalance: round(clamp01(lateralMassBalance)),
                counterBalance: round(counterBalance),
            },
            structure: {
                trunkLength: round(trunkLength, 3),
                scaffoldLength: round(scaffoldLength, 3),
                scaffoldToTrunkLengthRatio: round(scaffoldLength / Math.max(EPS, trunkLength)),
                sparseScaffoldRatio: round(clamp01(
                    1 - (scaffoldLength / Math.max(EPS, trunkLength * 2.2)),
                )),
                scaffoldTaperRetention: round(
                    scaffoldTipMeanWidth / Math.max(EPS, scaffoldRootMeanWidth),
                ),
                samplePointCount: allPoints.length,
            },
        };
        descriptor.vector = BonsaiStructuralDescriptorModel.vectorize(descriptor);
        return descriptor;
    }
}
