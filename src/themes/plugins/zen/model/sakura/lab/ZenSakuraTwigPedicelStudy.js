import {
    paintProjectedSakuraBlossom,
    resolveProjectedBlossomAtlasDescriptor,
} from './ZenSakuraProjectedBlossom.js';

// The standalone morphology labs consume the same projected-blossom owner as
// this study. Re-export the narrow paint seam so generated lab runtimes do not
// have to copy the atlas projection or petal-depth rules.
export {
    paintProjectedSakuraBlossom,
    resolveProjectedBlossomAtlasDescriptor,
};

const STUDY_WIDTH = 540;
const STUDY_HEIGHT = 388;
const TAU = Math.PI * 2;

export const SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT =
    'zen_sakura_terminal_morphology_plan_v2';
export const SAKURA_TERMINAL_MORPHOLOGY_PLAN_VERSION = 2;
export const SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT =
    'zen_sakura_terminal_keyed_random_v1';
export const SAKURA_TERMINAL_ORGAN_POSE_CONTRACT =
    'zen_sakura_terminal_organ_pose_v1';
export const SAKURA_TERMINAL_BRANCHING_DEFAULTS = Object.freeze({
    forkFrequency: 0.62,
    forkSpread: 0.58,
    lateralVigor: 0.62,
});
export const SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT = 0.72;

export const SAKURA_CLUSTER_COMPOSITION_TEMPLATES = Object.freeze([
    Object.freeze({
        id: 'tip-pair',
        roles: Object.freeze(['tip', 'fork']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.22,
                pedicelLength: 17,
                pedicelBend: -1.6,
                scale: 0.51,
                openness: 0.96,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.25,
                pedicelLength: 22,
                pedicelBend: 1.8,
                scale: 0.47,
                openness: 0.68,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'tip-fan-three',
        roles: Object.freeze(['tip', 'edge']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.38,
                pedicelLength: 20,
                pedicelBend: -2.2,
                scale: 0.47,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0,
                pedicelLength: 25,
                pedicelBend: 0.8,
                scale: 0.53,
                openness: 0.96,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.42,
                pedicelLength: 18,
                pedicelBend: 2.4,
                scale: 0.44,
                openness: 0.42,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'fork-crown',
        roles: Object.freeze(['fork']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: 0,
                pedicelLength: 10,
                pedicelBend: 0.4,
                scale: 0.43,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.3,
                pedicelLength: 13,
                pedicelBend: 1.4,
                scale: 0.37,
                openness: 0.42,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'side-spur-pair',
        roles: Object.freeze(['middle', 'edge']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.18,
                pedicelLength: 17,
                pedicelBend: -1.8,
                scale: 0.46,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.3,
                pedicelLength: 23,
                pedicelBend: 2.2,
                scale: 0.5,
                openness: 0.96,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'asymmetric-three',
        roles: Object.freeze(['middle', 'edge']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.42,
                pedicelLength: 21,
                pedicelBend: -2.5,
                scale: 0.43,
                openness: 0.42,
                budAllowed: true,
            }),
            Object.freeze({
                pedicelAngleOffset: -0.04,
                pedicelLength: 26,
                pedicelBend: 0.7,
                scale: 0.52,
                openness: 0.96,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.3,
                pedicelLength: 17,
                pedicelBend: 2.1,
                scale: 0.46,
                openness: 0.68,
            }),
        ]),
    }),
    Object.freeze({
        id: 'pendant-three',
        roles: Object.freeze(['edge']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.34,
                pedicelLength: 24,
                pedicelBend: -3.1,
                scale: 0.44,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.04,
                pedicelLength: 28,
                pedicelBend: -1.2,
                scale: 0.5,
                openness: 0.96,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.35,
                pedicelLength: 20,
                pedicelBend: 2.3,
                scale: 0.4,
                openness: 0.42,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'inner-fill-four',
        roles: Object.freeze(['inner']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.48,
                pedicelLength: 16,
                pedicelBend: -2.3,
                scale: 0.41,
                openness: 0.42,
                budAllowed: true,
            }),
            Object.freeze({
                pedicelAngleOffset: -0.14,
                pedicelLength: 22,
                pedicelBend: -0.8,
                scale: 0.48,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.18,
                pedicelLength: 19,
                pedicelBend: 1.1,
                scale: 0.46,
                openness: 0.96,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.49,
                pedicelLength: 15,
                pedicelBend: 2.5,
                scale: 0.39,
                openness: 0.68,
                budAllowed: true,
            }),
        ]),
    }),
    Object.freeze({
        id: 'bud-mix-three',
        roles: Object.freeze(['inner', 'middle']),
        slots: Object.freeze([
            Object.freeze({
                pedicelAngleOffset: -0.3,
                pedicelLength: 17,
                pedicelBend: -1.9,
                scale: 0.4,
                openness: 0.42,
                budAllowed: true,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.02,
                pedicelLength: 23,
                pedicelBend: 0.5,
                scale: 0.48,
                openness: 0.68,
            }),
            Object.freeze({
                pedicelAngleOffset: 0.37,
                pedicelLength: 15,
                pedicelBend: 2,
                scale: 0.37,
                openness: 0.42,
                budAllowed: true,
            }),
        ]),
    }),
]);

export const SAKURA_TERMINAL_SOCKET_FIXTURES = Object.freeze([
    Object.freeze({
        id: 'pad-interior',
        label: 'Pad 내부',
        description: '완만한 carrier에서 양쪽으로 퍼지는 중간 수관 socket',
        terminalId: 'fixture-pad-interior-01',
        parentAxisId: 'fixture-carrier-pad-04',
        point: Object.freeze([48, 302]),
        tangent: Object.freeze([0.91, -0.42]),
        normal: Object.freeze([0.42, 0.91]),
        sideSign: 1,
        terminalRadius: 5.8,
        order: 4,
        depth: 3,
        terminalRegion: Object.freeze({ length: 440, halfWidth: 126 }),
        budget: Object.freeze({ twig: 18, spur: 22, cluster: 18 }),
        crownMassId: 'fixture-crown-mid',
        padId: 'fixture-pad-mid-a',
        seed: 17041,
    }),
    Object.freeze({
        id: 'outer-edge',
        label: '수관 외곽',
        description: '외곽 실루엣을 따라 흐르며 안쪽을 다시 채우는 socket',
        terminalId: 'fixture-outer-edge-01',
        parentAxisId: 'fixture-carrier-edge-02',
        point: Object.freeze([54, 166]),
        tangent: Object.freeze([0.98, 0.18]),
        normal: Object.freeze([-0.18, 0.98]),
        sideSign: -1,
        terminalRadius: 4.7,
        order: 4,
        depth: 4,
        terminalRegion: Object.freeze({ length: 430, halfWidth: 112 }),
        budget: Object.freeze({ twig: 17, spur: 20, cluster: 16 }),
        crownMassId: 'fixture-crown-right',
        padId: 'fixture-pad-edge-b',
        seed: 29417,
    }),
    Object.freeze({
        id: 'apex-rise',
        label: 'Apex 인접',
        description: '상향 carrier 끝에서 좁게 솟고 옆으로 풀리는 socket',
        terminalId: 'fixture-apex-rise-01',
        parentAxisId: 'fixture-carrier-apex-01',
        point: Object.freeze([136, 346]),
        tangent: Object.freeze([0.48, -0.88]),
        normal: Object.freeze([0.88, 0.48]),
        sideSign: 1,
        terminalRadius: 4.1,
        order: 5,
        depth: 4,
        terminalRegion: Object.freeze({ length: 330, halfWidth: 140 }),
        budget: Object.freeze({ twig: 16, spur: 18, cluster: 14 }),
        crownMassId: 'fixture-crown-apex',
        padId: 'fixture-pad-apex',
        seed: 38129,
    }),
]);

const FIXTURE_BY_ID = new Map(
    SAKURA_TERMINAL_SOCKET_FIXTURES.map((fixture) => [fixture.id, fixture]),
);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function resolveGrowthPhase(growthWindow, growthProgress) {
    if (!growthWindow) return 1;
    const progress = clamp(Number(growthProgress), 0, 1);
    if (progress <= growthWindow.birth) return 0;
    if (progress >= growthWindow.mature) return 1;
    const linear = (progress - growthWindow.birth)
        / (growthWindow.mature - growthWindow.birth);
    return linear * linear * (3 - (2 * linear));
}

function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function hashRandomKey(seed, key) {
    const source = `${seed >>> 0}:${key}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createKeyedRandomFactory(seed) {
    return (...keyParts) => mulberry32(
        hashRandomKey(seed, keyParts.join(':')),
    );
}

function requireUnitInterval(value, errorCode) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
        throw new Error(errorCode);
    }
    return numeric;
}

function requireBranchingPolicy(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_SAKURA_TERMINAL_BRANCHING_POLICY_INVALID');
    }
    const expectedKeys = ['forkFrequency', 'forkSpread', 'lateralVigor'];
    const actualKeys = Object.keys(value).sort();
    if (
        actualKeys.length !== expectedKeys.length
        || actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
        throw new Error('ZEN_SAKURA_TERMINAL_BRANCHING_POLICY_SHAPE_INVALID');
    }
    return Object.freeze({
        forkFrequency: requireUnitInterval(
            value.forkFrequency,
            'ZEN_SAKURA_TERMINAL_FORK_FREQUENCY_INVALID',
        ),
        forkSpread: requireUnitInterval(
            value.forkSpread,
            'ZEN_SAKURA_TERMINAL_FORK_SPREAD_INVALID',
        ),
        lateralVigor: requireUnitInterval(
            value.lateralVigor,
            'ZEN_SAKURA_TERMINAL_LATERAL_VIGOR_INVALID',
        ),
    });
}

function rotateVector(vector, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
        x: (vector.x * cosine) - (vector.y * sine),
        y: (vector.x * sine) + (vector.y * cosine),
    };
}

function normalizeVector(x, y) {
    const length = Math.hypot(x, y);
    if (length <= 0.00001) {
        throw new Error('ZEN_SAKURA_LAB_TERMINAL_VECTOR_INVALID');
    }
    return { x: x / length, y: y / length };
}

function cubicPoint(segment, t) {
    const inverse = 1 - t;
    const inverse2 = inverse * inverse;
    const t2 = t * t;
    return {
        x: (inverse2 * inverse * segment.p0[0])
            + (3 * inverse2 * t * segment.p1[0])
            + (3 * inverse * t2 * segment.p2[0])
            + (t2 * t * segment.p3[0]),
        y: (inverse2 * inverse * segment.p0[1])
            + (3 * inverse2 * t * segment.p1[1])
            + (3 * inverse * t2 * segment.p2[1])
            + (t2 * t * segment.p3[1]),
    };
}

function cubicTangent(segment, t) {
    const inverse = 1 - t;
    return normalizeVector(
        (3 * inverse * inverse * (segment.p1[0] - segment.p0[0]))
            + (6 * inverse * t * (segment.p2[0] - segment.p1[0]))
            + (3 * t * t * (segment.p3[0] - segment.p2[0])),
        (3 * inverse * inverse * (segment.p1[1] - segment.p0[1]))
            + (6 * inverse * t * (segment.p2[1] - segment.p1[1]))
            + (3 * t * t * (segment.p3[1] - segment.p2[1])),
    );
}

function createSegmentFromPose({
    id,
    role,
    point,
    tangent,
    length,
    turn,
    bend,
    startWidth,
    endWidth,
}) {
    const endDirection = rotateVector(tangent, turn);
    const normal = { x: -tangent.y, y: tangent.x };
    return {
        id,
        role,
        p0: [point.x, point.y],
        p1: [
            point.x + (tangent.x * length * 0.3) + (normal.x * bend),
            point.y + (tangent.y * length * 0.3) + (normal.y * bend),
        ],
        p2: [
            point.x + (endDirection.x * length * 0.68) + (normal.x * bend * 0.35),
            point.y + (endDirection.y * length * 0.68) + (normal.y * bend * 0.35),
        ],
        p3: [
            point.x + (endDirection.x * length),
            point.y + (endDirection.y * length),
        ],
        startWidth,
        endWidth,
    };
}

function createIncomingCarrier(socket) {
    const tangent = normalizeVector(socket.tangent[0], socket.tangent[1]);
    const point = { x: socket.point[0], y: socket.point[1] };
    const length = 82;
    return {
        id: `${socket.parentAxisId}-context`,
        role: 'skeleton-context',
        p0: [point.x - (tangent.x * length), point.y - (tangent.y * length)],
        p1: [point.x - (tangent.x * length * 0.66), point.y - (tangent.y * length * 0.66)],
        p2: [point.x - (tangent.x * length * 0.28), point.y - (tangent.y * length * 0.28)],
        p3: [point.x, point.y],
        startWidth: socket.terminalRadius * 2.75,
        endWidth: socket.terminalRadius * 2,
    };
}

function isInsideTerminalRegion(socket, point) {
    const tangent = normalizeVector(socket.tangent[0], socket.tangent[1]);
    const normal = normalizeVector(socket.normal[0], socket.normal[1]);
    const deltaX = point[0] - socket.point[0];
    const deltaY = point[1] - socket.point[1];
    const localForward = (deltaX * tangent.x) + (deltaY * tangent.y);
    const localLateral = (deltaX * normal.x) + (deltaY * normal.y);
    return localForward >= -4
        && localForward <= socket.terminalRegion.length * 0.93
        && Math.abs(localLateral) <= socket.terminalRegion.halfWidth * 0.92;
}

function createBoundedGrowthSegment(socket, descriptor) {
    let length = descriptor.length;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const segment = createSegmentFromPose({ ...descriptor, length });
        if (isInsideTerminalRegion(socket, segment.p3)) {
            return { ...segment, growthLength: length };
        }
        length *= 0.78;
    }
    return null;
}

function createTerminalAxes(socket, budgetUse, branching, randomFor) {
    const point = { x: socket.point[0], y: socket.point[1] };
    const tangent = normalizeVector(socket.tangent[0], socket.tangent[1]);
    const requestedTwigCount = clamp(
        Math.round(6 + ((socket.budget.twig - 6) * budgetUse)),
        6,
        socket.budget.twig,
    );
    const rootRandom = randomFor('axis', 'root');
    const root = createBoundedGrowthSegment(socket, {
        id: `${socket.terminalId}:axis:root`,
        role: 'terminal-root',
        point,
        tangent,
        length: socket.terminalRegion.length * 0.24,
        turn: (rootRandom() - 0.5) * 0.1,
        bend: (rootRandom() - 0.5) * 7,
        startWidth: socket.terminalRadius * 1.82,
        endWidth: socket.terminalRadius * 1.28,
    });
    if (!root) {
        throw new Error(`ZEN_SAKURA_LAB_TERMINAL_ROOT_OUTSIDE_REGION:${socket.terminalId}`);
    }
    root.parentAxisId = socket.parentAxisId;
    root.growthDepth = 0;
    root.growthRole = 'root';

    const axes = [root];
    const growthQueue = [{
        axis: root,
        depth: 0,
        side: socket.sideSign,
        vigor: 1,
        inheritedTurn: 0,
    }];
    const maximumDepth = budgetUse > 0.78 ? 4 : 3;

    while (growthQueue.length > 0 && axes.length < requestedTwigCount) {
        const tip = growthQueue.shift();
        if (tip.depth >= maximumDepth || tip.axis.growthLength < 27) continue;

        const parentTangent = cubicTangent(tip.axis, 0.98);
        const childPoint = { x: tip.axis.p3[0], y: tip.axis.p3[1] };
        const nextDepth = tip.depth + 1;
        const continuationRandom = randomFor(
            'axis',
            tip.axis.id,
            'continuation',
        );
        const continuationTurn = (tip.inheritedTurn * 0.42)
            - (tip.side * 0.2)
            + ((continuationRandom() - 0.5) * 0.12);
        const continuationLength = tip.axis.growthLength
            * (0.7 + (continuationRandom() * 0.08) - (nextDepth * 0.018));
        const continuationStartWidth = tip.axis.endWidth * 0.96;
        const continuation = createBoundedGrowthSegment(socket, {
            id: `${tip.axis.id}:continuation`,
            role: 'terminal-continuation',
            point: childPoint,
            tangent: parentTangent,
            length: continuationLength,
            turn: continuationTurn,
            bend: (continuationRandom() - 0.5) * Math.max(3, 8 - nextDepth),
            startWidth: continuationStartWidth,
            endWidth: Math.max(
                0.62,
                continuationStartWidth * (0.7 + (continuationRandom() * 0.08)),
            ),
        });
        if (continuation) {
            continuation.parentAxisId = tip.axis.id;
            continuation.growthDepth = nextDepth;
            continuation.growthRole = 'continuation';
            axes.push(continuation);
            growthQueue.push({
                axis: continuation,
                depth: nextDepth,
                side: -tip.side,
                vigor: tip.vigor * 0.76,
                inheritedTurn: continuationTurn,
            });
        }

        const remainingSlots = requestedTwigCount - axes.length;
        const lateralRandom = randomFor('axis', tip.axis.id, 'lateral');
        const forkProbability = 0.24
            + (branching.forkFrequency * 0.68)
            - (tip.depth * 0.04);
        if (remainingSlots <= 0 || lateralRandom() > forkProbability) continue;

        const lateralTurn = tip.side * (
            0.42
            + (branching.forkSpread * 0.32)
            + (lateralRandom() * 0.16)
        );
        const lateralLength = continuationLength
            * (0.5 + (branching.lateralVigor * 0.38))
            * (0.9 + (lateralRandom() * 0.16));
        const lateralStartWidth = tip.axis.endWidth
            * (0.5 + (branching.lateralVigor * 0.25));
        const lateral = createBoundedGrowthSegment(socket, {
            id: `${tip.axis.id}:lateral`,
            role: 'terminal-lateral',
            point: childPoint,
            tangent: parentTangent,
            length: lateralLength,
            turn: lateralTurn,
            bend: tip.side * ((lateralRandom() - 0.25) * Math.max(4, 9 - nextDepth)),
            startWidth: lateralStartWidth,
            endWidth: Math.max(
                0.58,
                lateralStartWidth * (0.62 + (lateralRandom() * 0.09)),
            ),
        });
        if (lateral) {
            lateral.parentAxisId = tip.axis.id;
            lateral.growthDepth = nextDepth;
            lateral.growthRole = 'lateral';
            axes.push(lateral);
            growthQueue.push({
                axis: lateral,
                depth: nextDepth,
                side: tip.side,
                vigor: tip.vigor * (0.48 + (branching.lateralVigor * 0.26)),
                inheritedTurn: lateralTurn * 0.36,
            });
        }
    }
    return axes;
}

function resolveTerminalLocalPosition(socket, point) {
    const tangent = normalizeVector(socket.tangent[0], socket.tangent[1]);
    const normal = normalizeVector(socket.normal[0], socket.normal[1]);
    const deltaX = point.x - socket.point[0];
    const deltaY = point.y - socket.point[1];
    return {
        forward: (deltaX * tangent.x) + (deltaY * tangent.y),
        lateral: (deltaX * normal.x) + (deltaY * normal.y),
    };
}

function resolvePlacementZone(socket, axis, point, isTipContinuation) {
    const local = resolveTerminalLocalPosition(socket, point);
    const forwardRatio = clamp(
        local.forward / (socket.terminalRegion.length * 0.82),
        0,
        1,
    );
    const lateralRatio = clamp(
        Math.abs(local.lateral) / socket.terminalRegion.halfWidth,
        0,
        1,
    );
    if (
        isTipContinuation
        || forwardRatio > 0.72
        || lateralRatio > 0.66
        || axis.growthDepth >= 4
    ) {
        return 'edge';
    }
    if (forwardRatio < 0.58 && lateralRatio < 0.54 && axis.growthDepth <= 2) {
        return 'inner';
    }
    return 'middle';
}

function resolveDepthLane(zone, random) {
    const roll = random();
    if (zone === 'inner') {
        if (roll < 0.56) return 'back';
        if (roll < 0.9) return 'middle';
        return 'front';
    }
    if (zone === 'edge') {
        if (roll < 0.16) return 'back';
        if (roll < 0.48) return 'middle';
        return 'front';
    }
    if (roll < 0.3) return 'back';
    if (roll < 0.72) return 'middle';
    return 'front';
}

function resolveDepthValue(depthLane, random) {
    if (depthLane === 'back') return -2.4 + (random() * 0.9);
    if (depthLane === 'front') return 0.9 + (random() * 1.1);
    return -0.4 + (random() * 0.8);
}

function resolveZoneTargets(total, interiorFill) {
    const boundedFill = clamp(interiorFill, 0, 1);
    const inner = Math.round(total * (0.18 + (boundedFill * 0.22)));
    const edge = Math.round(total * (0.42 - (boundedFill * 0.2)));
    return {
        inner,
        middle: Math.max(0, total - inner - edge),
        edge,
    };
}

function selectZoneBalancedCandidates(
    candidates,
    requestedCount,
    interiorFill,
    randomFor,
    randomScope,
    requiredPredicate = () => false,
) {
    const decoratedCandidates = candidates.map((candidate) => ({
        ...candidate,
        placementNoise: randomFor(
            randomScope,
            candidate.selectionKey,
            'placement',
        )(),
    }));
    const required = decoratedCandidates.filter(requiredPredicate);
    if (required.length > requestedCount) {
        throw new Error(
            `ZEN_SAKURA_LAB_REQUIRED_ATTACHMENT_BUDGET_EXCEEDED:${required.length}:${requestedCount}`,
        );
    }
    const available = decoratedCandidates.filter((candidate) => !requiredPredicate(candidate));
    const selected = [...required];
    const zoneTargets = resolveZoneTargets(requestedCount, interiorFill);
    const zoneCounts = { inner: 0, middle: 0, edge: 0 };
    const occupiedCells = new Map();
    const cellSize = 32;

    selected.forEach((candidate) => {
        zoneCounts[candidate.zone] += 1;
        const cellKey = `${Math.round(candidate.point.x / cellSize)}:${Math.round(candidate.point.y / cellSize)}`;
        const occupiedLanes = occupiedCells.get(cellKey) || new Set();
        occupiedLanes.add(candidate.depthLane);
        occupiedCells.set(cellKey, occupiedLanes);
    });

    while (available.length > 0 && selected.length < requestedCount) {
        let bestIndex = 0;
        let bestScore = Number.POSITIVE_INFINITY;
        available.forEach((candidate, index) => {
            const cellKey = `${Math.round(candidate.point.x / cellSize)}:${Math.round(candidate.point.y / cellSize)}`;
            const occupiedLanes = occupiedCells.get(cellKey);
            const sameLanePenalty = occupiedLanes?.has(candidate.depthLane) ? 2.6 : 0;
            const crossLanePenalty = occupiedLanes && !occupiedLanes.has(candidate.depthLane) ? 0.18 : 0;
            const remainingZoneNeed = zoneTargets[candidate.zone] - zoneCounts[candidate.zone];
            const zoneScore = remainingZoneNeed > 0
                ? -2.4 - (remainingZoneNeed * 0.08)
                : (1 + Math.abs(remainingZoneNeed)) * 1.35;
            const tipScore = candidate.isTipContinuation && remainingZoneNeed > 0 ? -0.12 : 0;
            const forkBloomScore = candidate.isForkBloom && remainingZoneNeed > 0 ? -0.26 : 0;
            const score = zoneScore
                + sameLanePenalty
                + crossLanePenalty
                + tipScore
                + forkBloomScore
                + (candidate.placementNoise * 0.42);
            if (score < bestScore) {
                bestIndex = index;
                bestScore = score;
            }
        });
        const [winner] = available.splice(bestIndex, 1);
        selected.push(winner);
        zoneCounts[winner.zone] += 1;
        const cellKey = `${Math.round(winner.point.x / cellSize)}:${Math.round(winner.point.y / cellSize)}`;
        const occupiedLanes = occupiedCells.get(cellKey) || new Set();
        occupiedLanes.add(winner.depthLane);
        occupiedCells.set(cellKey, occupiedLanes);
    }
    return selected;
}

function createSpurCandidates(socket, axes, randomFor) {
    const parentAxisIds = new Set(axes.map((axis) => axis.parentAxisId));
    const axisIndexById = new Map(axes.map((axis, index) => [axis.id, index]));
    const childrenByParentId = new Map();
    axes.forEach((axis) => {
        if (!axisIndexById.has(axis.parentAxisId)) return;
        const siblings = childrenByParentId.get(axis.parentAxisId) || [];
        siblings.push(axis);
        childrenByParentId.set(axis.parentAxisId, siblings);
    });
    const stationCandidates = axes.flatMap((axis, axisIndex) => {
        const isTerminalAxis = !parentAxisIds.has(axis.id);
        const stations = isTerminalAxis
            ? [
                { station: 0.36, isTipContinuation: false },
                { station: 0.66, isTipContinuation: false },
                { station: 0.96, isTipContinuation: true },
            ]
            : [
                { station: 0.34, isTipContinuation: false },
                { station: 0.68, isTipContinuation: false },
            ];
        return stations.map(({ station, isTipContinuation }, stationIndex) => {
            const point = cubicPoint(axis, station);
            const zone = resolvePlacementZone(socket, axis, point, isTipContinuation);
            const selectionKey = `${axis.id}:station:${station.toFixed(2)}`;
            return {
                axis,
                axisIndex,
                selectionKey,
                station,
                stationIndex,
                isTipContinuation,
                isForkBloom: false,
                tangent: cubicTangent(axis, station),
                point,
                zone,
                depthLane: resolveDepthLane(
                    zone,
                    randomFor('spur-candidate', selectionKey, 'depth-lane'),
                ),
            };
        });
    });
    const forkCandidates = axes.flatMap((axis) => {
        const children = childrenByParentId.get(axis.id) || [];
        if (children.length < 2 || axis.growthDepth > 2) return [];
        const forkChance = 0.58 - (axis.growthDepth * 0.13);
        if (randomFor('fork-bloom', axis.id, 'admission')() > forkChance) return [];
        const firstTangent = cubicTangent(children[0], 0.02);
        const secondTangent = cubicTangent(children[1], 0.02);
        const bisector = normalizeVector(
            firstTangent.x + secondTangent.x,
            firstTangent.y + secondTangent.y,
        );
        const point = { x: axis.p3[0], y: axis.p3[1] };
        const zone = resolvePlacementZone(socket, axis, point, false);
        const selectionKey = `${axis.id}:fork-junction`;
        return [{
            axis,
            axisIndex: axisIndexById.get(axis.id),
            selectionKey,
            station: 1,
            stationIndex: 2,
            isTipContinuation: false,
            isForkBloom: true,
            tangent: bisector,
            point,
            zone,
            depthLane: resolveDepthLane(
                zone,
                randomFor('spur-candidate', selectionKey, 'depth-lane'),
            ),
        }];
    });
    return [...stationCandidates, ...forkCandidates];
}

function createTerminalSpurs(socket, axes, budgetUse, interiorFill, randomFor) {
    const requestedCount = clamp(
        Math.round(6 + ((socket.budget.spur - 6) * budgetUse)),
        6,
        socket.budget.spur,
    );
    const candidates = selectZoneBalancedCandidates(
        createSpurCandidates(socket, axes, randomFor),
        requestedCount,
        interiorFill,
        randomFor,
        'spur-selection',
        (candidate) => candidate.isTipContinuation,
    )
        .sort((left, right) => (
            (left.axisIndex - right.axisIndex) || (left.station - right.station)
        ));

    return candidates.map((candidate) => {
        const point = candidate.point;
        const tangent = candidate.tangent;
        const random = randomFor('spur-shape', candidate.selectionKey);
        const side = ((candidate.stationIndex + candidate.axisIndex) % 2 === 0) ? 1 : -1;
        const spurRole = candidate.isTipContinuation
            ? 'terminal-tip-spur'
            : (candidate.isForkBloom ? 'fork-junction-spur' : 'short-spur');
        const segment = createSegmentFromPose({
            id: `${candidate.axis.id}:spur:${spurRole}:${candidate.station.toFixed(2)}`,
            role: spurRole,
            point,
            tangent,
            length: candidate.isTipContinuation
                ? 8 + (random() * 6)
                : (candidate.isForkBloom ? 8 + (random() * 6) : 12 + (random() * 12)),
            turn: candidate.isTipContinuation
                ? (random() - 0.5) * 0.28
                : (
                    candidate.isForkBloom
                        ? (random() - 0.5) * 0.22
                        : side * (0.66 + (random() * 0.42))
                ),
            bend: candidate.isTipContinuation
                ? (random() - 0.5) * 1.5
                : (
                    candidate.isForkBloom
                        ? (random() - 0.5) * 1.4
                        : (random() - 0.5) * 3.5
                ),
            startWidth: candidate.isTipContinuation
                ? Math.max(0.72, candidate.axis.endWidth * 0.86)
                : (candidate.isForkBloom ? 1.05 + (random() * 0.28) : 1.45 + (random() * 0.4)),
            endWidth: candidate.isTipContinuation
                ? Math.max(0.5, candidate.axis.endWidth * 0.58)
                : (candidate.isForkBloom ? 0.52 + (random() * 0.16) : 0.68 + (random() * 0.24)),
        });
        return {
            ...segment,
            sourceAxisId: candidate.axis.id,
            sourceStation: candidate.station,
            selectionKey: candidate.selectionKey,
            isTipContinuation: candidate.isTipContinuation,
            isForkBloom: candidate.isForkBloom,
            zone: candidate.zone,
            depthLane: candidate.depthLane,
            depth: resolveDepthValue(candidate.depthLane, random),
        };
    });
}

function resolveClusterRole(spur) {
    if (spur.isTipContinuation) return 'tip';
    if (spur.isForkBloom) return 'fork';
    return spur.zone;
}

function selectClusterTemplate(role, random) {
    const candidates = SAKURA_CLUSTER_COMPOSITION_TEMPLATES
        .filter((template) => template.roles.includes(role));
    if (candidates.length === 0) {
        throw new Error(`ZEN_SAKURA_LAB_CLUSTER_TEMPLATE_ROLE_UNOWNED:${role}`);
    }
    return candidates[Math.floor(random() * candidates.length)];
}

function resolvePedicelAttachmentAngle({
    emergenceAngle,
    length,
    bend,
}) {
    const tangentX = Math.cos(emergenceAngle);
    const tangentY = Math.sin(emergenceAngle);
    const normalX = -tangentY;
    const normalY = tangentX;
    return Math.atan2(
        (tangentY * length * 0.48) - (normalY * bend),
        (tangentX * length * 0.48) - (normalX * bend),
    );
}

export function createSakuraBlossomPose(attachmentAngle, random) {
    const viewPhase = random();
    const viewSign = random() < 0.5 ? -1 : 1;
    const facingYaw = viewPhase < 0.12
        ? viewSign * (2.25 + (random() * 0.5))
        : (
            viewPhase < 0.42
                ? viewSign * (1.02 + (random() * 0.32))
                : viewSign * (random() * 0.88)
        );
    return Object.freeze({
        contract: SAKURA_TERMINAL_ORGAN_POSE_CONTRACT,
        attachmentAngle,
        facingYaw,
        facingPitch: (random() - 0.5) * 0.9,
        screenRoll: attachmentAngle + ((random() - 0.5) * 0.9),
    });
}

function createTerminalClusters(
    socket,
    spurs,
    budgetUse,
    interiorFill,
    clusterCoverage,
    randomFor,
) {
    const maximumCount = clamp(
        Math.round(5 + ((socket.budget.cluster - 5) * budgetUse)),
        5,
        Math.min(socket.budget.cluster, spurs.length),
    );
    const eligibleCandidates = spurs
        .map((spur) => ({
            spur,
            selectionKey: spur.id,
            point: { x: spur.p3[0], y: spur.p3[1] },
            zone: spur.zone,
            depthLane: spur.depthLane,
            isTipContinuation: spur.isTipContinuation,
            isForkBloom: spur.isForkBloom,
        }))
        .filter(({ spur }) => (
            randomFor('cluster-admission', spur.id)() < clusterCoverage
        ));
    const requestedCount = Math.min(maximumCount, eligibleCandidates.length);
    if (requestedCount === 0) return [];

    return selectZoneBalancedCandidates(
        eligibleCandidates,
        requestedCount,
        interiorFill,
        randomFor,
        'cluster-selection',
    ).map(({ spur }) => {
            const base = spur.p3;
            const spurTangent = cubicTangent(spur, 0.96);
            const baseAngle = Math.atan2(spurTangent.y, spurTangent.x);
            const innerRichness = spur.zone === 'inner' ? clamp(interiorFill, 0, 1) : 0;
            const role = resolveClusterRole(spur);
            const clusterId = `${spur.id}:cluster`;
            const template = selectClusterTemplate(
                role,
                randomFor('cluster-template', clusterId),
            );
            const zoneScale = spur.isForkBloom
                ? 0.82
                : (spur.zone === 'inner' ? 0.94 : (spur.zone === 'middle' ? 0.97 : 1));
            const pedicelLengthScale = spur.isForkBloom
                ? 0.72
                : 1 - (innerRichness * 0.16);
            const clusterRandom = randomFor('cluster-shape', clusterId);
            const templateMirror = clusterRandom() < 0.5 ? -1 : 1;
            const templateTurn = (clusterRandom() - 0.5) * 0.18;
            const organs = template.slots.map((slot, slotIndex) => {
                const random = randomFor('cluster-organ', clusterId, String(slotIndex));
                const kind = slot.budAllowed && random() < (
                    role === 'inner' ? 0.4 : (role === 'tip' ? 0.24 : 0.3)
                )
                    ? 'bud'
                    : 'flower';
                const pedicelEmergenceAngle = baseAngle
                    + (slot.pedicelAngleOffset * templateMirror)
                    + templateTurn
                    + ((random() - 0.5) * 0.08);
                const pedicel = {
                    emergenceAngle: pedicelEmergenceAngle,
                    length: slot.pedicelLength
                        * pedicelLengthScale
                        * (0.94 + (random() * 0.12)),
                    bend: slot.pedicelBend
                        * templateMirror
                        * (0.88 + (random() * 0.24)),
                };
                pedicel.attachmentAngle = resolvePedicelAttachmentAngle(pedicel);
                return {
                    kind,
                    pedicel: Object.freeze(pedicel),
                    scale: slot.scale * zoneScale * (0.94 + (random() * 0.12)),
                    openness: slot.openness,
                    blossomPose: kind === 'flower'
                        ? createSakuraBlossomPose(pedicel.attachmentAngle, random)
                        : null,
                    depth: spur.depth + ((random() - 0.5) * 2.4),
                };
            });
            return {
                id: clusterId,
                sourceSpurId: spur.id,
                templateId: template.id,
                templateRole: role,
                base,
                zone: spur.zone,
                depthLane: spur.depthLane,
                isTipContinuation: spur.isTipContinuation,
                isForkBloom: spur.isForkBloom,
                organs,
            };
        });
}

function countClusterZones(clusters) {
    return Object.freeze(clusters.reduce((counts, cluster) => {
        counts[cluster.zone] += 1;
        return counts;
    }, { inner: 0, middle: 0, edge: 0 }));
}

function countClusterTemplates(clusters) {
    return Object.freeze(clusters.reduce((counts, cluster) => {
        counts[cluster.templateId] = (counts[cluster.templateId] || 0) + 1;
        return counts;
    }, {}));
}

function createTerminalLeaves(spurs, floweringSpurIds, randomFor) {
    return spurs
        .filter((spur, index) => (
            !floweringSpurIds.has(spur.id) || index % 4 === 1
        ))
        .map((spur) => {
            const random = randomFor('leaf', spur.id);
            const point = cubicPoint(spur, 0.54);
            const tangent = cubicTangent(spur, 0.54);
            return {
                id: `${spur.id}:leaf`,
                sourceSpurId: spur.id,
                x: point.x,
                y: point.y,
                angle: Math.atan2(tangent.y, tangent.x) + ((random() - 0.5) * 0.7),
                scale: 0.16 + (random() * 0.07),
                depth: spur.depth,
            };
        });
}

export function createSakuraTerminalMorphologyPlan({
    socket,
    density = 1,
    branching = SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    interiorFill = 0.65,
    clusterCoverage = SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    ...unknownOptions
}) {
    const unknownOptionKeys = Object.keys(unknownOptions);
    if (unknownOptionKeys.length > 0) {
        throw new Error(
            `ZEN_SAKURA_TERMINAL_MORPHOLOGY_OPTIONS_UNKNOWN:${unknownOptionKeys.sort().join(',')}`,
        );
    }
    if (
        !socket
        || !Number.isSafeInteger(socket.seed)
        || !socket.terminalRegion
        || !socket.budget
    ) {
        throw new Error('ZEN_SAKURA_TERMINAL_MORPHOLOGY_SOCKET_INVALID');
    }
    const resolvedBranching = requireBranchingPolicy(branching);
    const resolvedClusterCoverage = requireUnitInterval(
        clusterCoverage,
        'ZEN_SAKURA_TERMINAL_CLUSTER_COVERAGE_INVALID',
    );
    const budgetUse = clamp(density, 0.35, 1);
    const randomFor = createKeyedRandomFactory(socket.seed);
    const axes = createTerminalAxes(
        socket,
        budgetUse,
        resolvedBranching,
        randomFor,
    );
    const spurs = createTerminalSpurs(
        socket,
        axes,
        budgetUse,
        interiorFill,
        randomFor,
    );
    const clusters = createTerminalClusters(
        socket,
        spurs,
        budgetUse,
        interiorFill,
        resolvedClusterCoverage,
        randomFor,
    );
    const floweringSpurIds = new Set(
        clusters.map((cluster) => cluster.sourceSpurId),
    );
    const leaves = createTerminalLeaves(spurs, floweringSpurIds, randomFor);
    const parentAxisIds = new Set(axes.map((axis) => axis.parentAxisId));
    const terminalAxes = axes.filter((axis) => !parentAxisIds.has(axis.id));
    const spurById = new Map(spurs.map((spur) => [spur.id, spur]));
    const tipClusterAxisIds = new Set(
        clusters
            .filter((cluster) => cluster.isTipContinuation)
            .map((cluster) => spurById.get(cluster.sourceSpurId)?.sourceAxisId)
            .filter(Boolean),
    );
    const terminalAxisCount = terminalAxes.length;
    const tipClusterCount = clusters.filter((cluster) => cluster.isTipContinuation).length;
    const forkBloomCount = clusters.filter((cluster) => cluster.isForkBloom).length;
    return {
        contract: SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT,
        version: SAKURA_TERMINAL_MORPHOLOGY_PLAN_VERSION,
        randomContract: SAKURA_TERMINAL_KEYED_RANDOM_CONTRACT,
        socket,
        budgetUse,
        branching: resolvedBranching,
        interiorFill: clamp(interiorFill, 0, 1),
        clusterCoverage: resolvedClusterCoverage,
        incomingCarrier: createIncomingCarrier(socket),
        axes,
        spurs,
        clusters,
        clusterZoneUsage: countClusterZones(clusters),
        clusterTemplateUsage: countClusterTemplates(clusters),
        attachmentUsage: Object.freeze({
            terminalAxisCount,
            tipClusterCount,
            vegetativeTipCount: terminalAxisCount - tipClusterAxisIds.size,
            forkBloomCount,
            floweringSpurCount: floweringSpurIds.size,
            vegetativeSpurCount: spurs.length - floweringSpurIds.size,
        }),
        leaves,
        usage: Object.freeze({
            twig: axes.length,
            spur: spurs.length,
            cluster: clusters.length,
        }),
    };
}

export function createSakuraTerminalSocketStudyPlan({
    fixtureId,
    density = 1,
    branching = SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    interiorFill = 0.65,
    clusterCoverage = SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    ...unknownOptions
}) {
    const unknownOptionKeys = Object.keys(unknownOptions);
    if (unknownOptionKeys.length > 0) {
        throw new Error(
            `ZEN_SAKURA_LAB_TERMINAL_STUDY_OPTIONS_UNKNOWN:${unknownOptionKeys.sort().join(',')}`,
        );
    }
    const socket = FIXTURE_BY_ID.get(fixtureId);
    if (!socket) {
        throw new Error(`ZEN_SAKURA_LAB_TERMINAL_FIXTURE_UNKNOWN:${fixtureId}`);
    }
    return createSakuraTerminalMorphologyPlan({
        socket,
        density,
        branching,
        interiorFill,
        clusterCoverage,
    });
}

function sampleTaperedSegment(segment, sampleCount = 32, reveal = 1) {
    const centers = [];
    for (let index = 0; index <= sampleCount; index += 1) {
        const t = (index / sampleCount) * reveal;
        centers.push({
            ...cubicPoint(segment, t),
            radius: (
                (segment.startWidth + ((segment.endWidth - segment.startWidth) * t))
                * (0.34 + (reveal * 0.66))
            ) / 2,
        });
    }
    const left = [];
    const right = [];
    centers.forEach((point, index) => {
        const previous = centers[Math.max(0, index - 1)];
        const next = centers[Math.min(centers.length - 1, index + 1)];
        const tangent = normalizeVector(next.x - previous.x, next.y - previous.y);
        left.push([point.x - (tangent.y * point.radius), point.y + (tangent.x * point.radius)]);
        right.push([point.x + (tangent.y * point.radius), point.y - (tangent.x * point.radius)]);
    });
    return { centers, left, right };
}

function drawWoodSegment(ctx, segment, structureOnly, growthProgress = 1) {
    const growthPhase = resolveGrowthPhase(segment.growth, growthProgress);
    if (growthPhase <= 0.001) return;
    const samples = sampleTaperedSegment(segment, 32, growthPhase);
    const isSkeletonContext = segment.role === 'skeleton-context';
    const gradient = ctx.createLinearGradient(
        segment.p0[0],
        segment.p0[1],
        segment.p3[0],
        segment.p3[1],
    );
    if (isSkeletonContext) {
        gradient.addColorStop(0, structureOnly ? '#66717A' : '#2E2928');
        gradient.addColorStop(1, structureOnly ? '#8E9BA4' : '#4A3630');
    } else {
        gradient.addColorStop(0, structureOnly ? '#8B6B52' : '#3A2925');
        gradient.addColorStop(0.5, structureOnly ? '#A98465' : '#5B4035');
        gradient.addColorStop(1, structureOnly ? '#C19A78' : '#6D4A3B');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(samples.left[0][0], samples.left[0][1]);
    samples.left.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    [...samples.right].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = structureOnly ? 'rgba(248,221,184,0.34)' : 'rgba(225,177,137,0.14)';
    ctx.lineWidth = Math.max(0.4, (segment.startWidth + segment.endWidth) * 0.07);
    ctx.beginPath();
    samples.centers.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
}

function resolveOrganGeometry(cluster, organ) {
    const [baseX, baseY] = cluster.base;
    const tangentX = Math.cos(organ.pedicel.emergenceAngle);
    const tangentY = Math.sin(organ.pedicel.emergenceAngle);
    const normalX = -tangentY;
    const normalY = tangentX;
    return {
        baseX,
        baseY,
        controlX: baseX
            + (tangentX * organ.pedicel.length * 0.52)
            + (normalX * organ.pedicel.bend),
        controlY: baseY
            + (tangentY * organ.pedicel.length * 0.52)
            + (normalY * organ.pedicel.bend),
        endX: baseX + (tangentX * organ.pedicel.length),
        endY: baseY + (tangentY * organ.pedicel.length),
    };
}

function drawNodeCollar(ctx, cluster, structureOnly) {
    ctx.save();
    ctx.translate(cluster.base[0], cluster.base[1]);
    ctx.fillStyle = structureOnly ? '#E0B184' : '#4D302A';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.8, 2.45, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
}

function quadraticPointAt(geometry, t) {
    const inverse = 1 - t;
    return {
        x: (inverse * inverse * geometry.baseX)
            + (2 * inverse * t * geometry.controlX)
            + (t * t * geometry.endX),
        y: (inverse * inverse * geometry.baseY)
            + (2 * inverse * t * geometry.controlY)
            + (t * t * geometry.endY),
    };
}

function drawPedicel(ctx, geometry, organ, structureOnly, reveal = 1) {
    ctx.strokeStyle = structureOnly
        ? (organ.depth < 0 ? 'rgba(87,196,255,0.72)' : 'rgba(104,230,174,0.92)')
        : (organ.kind === 'bud' ? '#6F4C35' : '#735039');
    ctx.lineWidth = organ.kind === 'bud' ? 1.45 : 1.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let index = 0; index <= 12; index += 1) {
        const point = quadraticPointAt(geometry, (index / 12) * reveal);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
}

function resolvePedicelEndAngle(geometry) {
    return Math.atan2(
        geometry.endY - geometry.controlY,
        geometry.endX - geometry.controlX,
    );
}

function drawCalyx(ctx, geometry, organ, structureOnly) {
    ctx.save();
    ctx.translate(geometry.endX, geometry.endY);
    ctx.rotate(resolvePedicelEndAngle(geometry));
    ctx.fillStyle = structureOnly ? '#F6B36C' : '#7A3F3D';
    for (let index = 0; index < 4; index += 1) {
        ctx.save();
        ctx.rotate((index / 4) * TAU);
        ctx.beginPath();
        ctx.moveTo(-1, 0);
        ctx.lineTo(-5, -1.4);
        ctx.lineTo(-4.1, 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

function drawBud(ctx, geometry, organ, structureOnly, appearanceScale = 1) {
    const size = 8.5 * organ.scale * appearanceScale;
    ctx.save();
    ctx.globalAlpha *= appearanceScale;
    ctx.translate(geometry.endX, geometry.endY);
    ctx.rotate(resolvePedicelEndAngle(geometry));
    ctx.fillStyle = structureOnly ? 'rgba(255,176,205,0.3)' : '#D56C91';
    ctx.strokeStyle = structureOnly ? '#FF9CC0' : '#9B3F66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(size * 0.55, 0, size, size * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawFlower(
    ctx,
    geometry,
    organ,
    resolveFlowerSprite,
    spriteDisplaySize,
    structureOnly,
    appearanceScale = 1,
) {
    const drawSize = spriteDisplaySize * organ.scale * appearanceScale;
    const pose = organ.blossomPose;
    if (
        !pose
        || pose.contract !== SAKURA_TERMINAL_ORGAN_POSE_CONTRACT
        || !Number.isFinite(pose.attachmentAngle)
        || !Number.isFinite(pose.facingYaw)
        || !Number.isFinite(pose.facingPitch)
        || !Number.isFinite(pose.screenRoll)
    ) {
        throw new Error('ZEN_SAKURA_LAB_FLOWER_POSE_INVALID');
    }
    const atlasDescriptor = resolveProjectedBlossomAtlasDescriptor({
        openness: organ.openness,
        facingYaw: pose.facingYaw,
        facingPitch: pose.facingPitch,
    });
    ctx.save();
    ctx.globalAlpha *= appearanceScale;
    ctx.translate(geometry.endX, geometry.endY);
    ctx.rotate(pose.screenRoll);
    ctx.scale(atlasDescriptor.mirrorX ? -1 : 1, 1);
    if (structureOnly) {
        const flowerRadius = drawSize * 0.16;
        const viewCompression = 0.2 + (
            Math.abs(Math.cos(pose.facingYaw) * Math.cos(pose.facingPitch)) * 0.8
        );
        ctx.fillStyle = 'rgba(255,161,199,0.12)';
        ctx.strokeStyle = organ.depth < 0 ? '#63C5FF' : '#FF9FC5';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.ellipse(0, 0, flowerRadius, flowerRadius * viewCompression, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,230,153,0.9)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(flowerRadius * 0.9, 0);
        ctx.stroke();
    } else {
        const flowerSprite = resolveFlowerSprite?.(organ);
        if (!flowerSprite) {
            throw new Error('ZEN_SAKURA_LAB_PROJECTED_FLOWER_SPRITE_REQUIRED');
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = organ.depth < -1 ? 0.82 : 1;
        ctx.drawImage(flowerSprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    }
    ctx.restore();
}

function drawLeaf(
    ctx,
    leaf,
    leafSprite,
    spriteDisplaySize,
    structureOnly,
    growthProgress,
) {
    const growthPhase = resolveGrowthPhase(leaf.growth, growthProgress);
    if (growthPhase <= 0.001) return;
    const size = spriteDisplaySize * leaf.scale * growthPhase;
    ctx.save();
    ctx.globalAlpha *= growthPhase;
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.angle);
    if (structureOnly || !leafSprite) {
        ctx.fillStyle = 'rgba(130,177,91,0.45)';
        ctx.strokeStyle = '#91B96D';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.22, size * 0.1, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.drawImage(leafSprite, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
}

function flattenOrgans(clusters) {
    return clusters.flatMap((cluster) => (
        cluster.organs.map((organ) => ({
            cluster,
            organ,
            geometry: resolveOrganGeometry(cluster, organ),
        }))
    )).sort((left, right) => left.organ.depth - right.organ.depth);
}

function drawOrgans(
    ctx,
    organs,
    resolveFlowerSprite,
    spriteDisplaySize,
    structureOnly,
    growthProgress,
) {
    organs.forEach(({ organ, geometry }) => {
        const growthPhase = resolveGrowthPhase(organ.growth, growthProgress);
        if (growthPhase <= 0.001) return;
        const pedicelReveal = clamp(growthPhase / 0.58, 0, 1);
        const appearanceScale = clamp((growthPhase - 0.28) / 0.72, 0, 1);
        const currentEnd = quadraticPointAt(geometry, pedicelReveal);
        const growthGeometry = {
            ...geometry,
            endX: currentEnd.x,
            endY: currentEnd.y,
        };
        drawPedicel(ctx, geometry, organ, structureOnly, pedicelReveal);
        if (appearanceScale <= 0.001) return;
        if (organ.kind === 'bud') {
            drawCalyx(ctx, growthGeometry, organ, structureOnly);
            drawBud(ctx, growthGeometry, organ, structureOnly, appearanceScale);
        } else {
            if (structureOnly) drawCalyx(ctx, growthGeometry, organ, true);
            drawFlower(
                ctx,
                growthGeometry,
                organ,
                resolveFlowerSprite,
                spriteDisplaySize,
                structureOnly,
                appearanceScale,
            );
        }
    });
}

function drawSocketDiagnostic(ctx, plan) {
    const { socket } = plan;
    const tangent = normalizeVector(socket.tangent[0], socket.tangent[1]);
    ctx.save();
    ctx.strokeStyle = 'rgba(111,177,255,0.34)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(
        socket.point[0] + (tangent.x * socket.terminalRegion.length * 0.42),
        socket.point[1] + (tangent.y * socket.terminalRegion.length * 0.42),
        socket.terminalRegion.length * 0.46,
        socket.terminalRegion.halfWidth,
        Math.atan2(tangent.y, tangent.x),
        0,
        TAU,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6FB1FF';
    ctx.beginPath();
    ctx.arc(socket.point[0], socket.point[1], 5.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#B9DBFF';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(socket.point[0], socket.point[1]);
    ctx.lineTo(
        socket.point[0] + (tangent.x * 34),
        socket.point[1] + (tangent.y * 34),
    );
    ctx.stroke();
    ctx.restore();
}

export function drawSakuraTwigPedicelStudy({
    ctx,
    width,
    height,
    resolveFlowerSprite,
    leafSprite,
    spriteDisplaySize,
    fixtureId = 'pad-interior',
    density = 1,
    branching = SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    interiorFill = 0.65,
    clusterCoverage = SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    structureOnly = false,
    retainedGraph = null,
    growthProgress = 1,
}) {
    const plan = retainedGraph || createSakuraTerminalSocketStudyPlan({
        fixtureId,
        density,
        branching,
        interiorFill,
        clusterCoverage,
    });
    if (
        !plan
        || !Array.isArray(plan.axes)
        || !Array.isArray(plan.spurs)
        || !Array.isArray(plan.clusters)
        || !Array.isArray(plan.leaves)
    ) {
        throw new Error('ZEN_SAKURA_LAB_RETAINED_GRAPH_INVALID');
    }
    ctx.save();
    ctx.scale(width / STUDY_WIDTH, height / STUDY_HEIGHT);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const organs = flattenOrgans(plan.clusters);
    const backOrgans = organs.filter(({ organ }) => organ.depth < 0);
    const frontOrgans = organs.filter(({ organ }) => organ.depth >= 0);

    if (structureOnly) drawSocketDiagnostic(ctx, plan);
    drawOrgans(
        ctx,
        backOrgans,
        resolveFlowerSprite,
        spriteDisplaySize,
        structureOnly,
        growthProgress,
    );
    drawWoodSegment(ctx, plan.incomingCarrier, structureOnly);
    plan.axes.forEach(
        (segment) => drawWoodSegment(ctx, segment, structureOnly, growthProgress),
    );
    plan.spurs.forEach(
        (segment) => drawWoodSegment(ctx, segment, structureOnly, growthProgress),
    );
    plan.clusters
        .filter((cluster) => resolveGrowthPhase(cluster.growth, growthProgress) > 0)
        .forEach((cluster) => drawNodeCollar(ctx, cluster, structureOnly));
    plan.leaves
        .filter((leaf) => leaf.depth < 0)
        .forEach((leaf) => drawLeaf(
            ctx,
            leaf,
            leafSprite,
            spriteDisplaySize,
            structureOnly,
            growthProgress,
        ));
    drawOrgans(
        ctx,
        frontOrgans,
        resolveFlowerSprite,
        spriteDisplaySize,
        structureOnly,
        growthProgress,
    );
    plan.leaves
        .filter((leaf) => leaf.depth >= 0)
        .forEach((leaf) => drawLeaf(
            ctx,
            leaf,
            leafSprite,
            spriteDisplaySize,
            structureOnly,
            growthProgress,
        ));
    ctx.restore();
    return plan;
}
