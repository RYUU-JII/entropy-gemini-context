import { clamp, lerp } from './sakuraMath';

// Geometry-only bend intent: no node identity, RNG draw, or scaffold station is
// created here. Callers may integrate the heading field into their owned path.
export const SAKURA_ARTICULATED_BEND_EVENT_VERSION = 1;
export const SAKURA_ARTICULATED_BEND_EVENT_CONTRACT = 'zen_sakura_articulated_bend_event_v1';
export const SAKURA_ARTICULATED_BEND_KINDS = Object.freeze({
    SWEEP: 'sweep',
    KNUCKLE: 'knuckle',
    COMPOUND: 'compound',
});
export const SAKURA_ARTICULATED_BEND_SAMPLE_POLICY = Object.freeze({
    minByKind: Object.freeze({
        sweep: 3,
        knuckle: 5,
        compound: 9,
    }),
    defaultByKind: Object.freeze({
        sweep: 5,
        knuckle: 7,
        compound: 11,
    }),
    hard: 64,
});

const EPSILON = 1e-10;
const KINDS = new Set(Object.values(SAKURA_ARTICULATED_BEND_KINDS));

const finiteNumber = (value, field) => {
    const resolved = Number(value);
    if (!Number.isFinite(resolved)) {
        throw new Error(`ZEN_SAKURA_ARTICULATED_BEND_NUMBER_INVALID:${field}`);
    }
    return resolved;
};

const rangedNumber = (value, min, max, field) => {
    const resolved = finiteNumber(value, field);
    if (resolved < min || resolved > max) {
        throw new Error(`ZEN_SAKURA_ARTICULATED_BEND_RANGE_INVALID:${field}`);
    }
    return resolved;
};

const smoothstepCdf = (t) => {
    const u = clamp(t, 0, 1);
    return u * u * (3 - (2 * u));
};

// A convex blend of beta CDFs shifts the bend without introducing a point
// impulse. Each component has zero turn density at both support boundaries.
const sweepCdf = (t, skew) => {
    const u = clamp(t, 0, 1);
    const centered = smoothstepCdf(u);
    const early = (6 * (u ** 2)) - (8 * (u ** 3)) + (3 * (u ** 4));
    const late = (4 * (u ** 3)) - (3 * (u ** 4));
    const shifted = skew < 0 ? early : late;
    return lerp(centered, shifted, Math.abs(skew) * 0.78);
};

const freezeZone = ({ role, startArcNorm, endArcNorm, angleRad, kernel = 'smoothstep' }) => (
    Object.freeze({
        role,
        startArcNorm,
        endArcNorm,
        angleRad,
        kernel,
    })
);

const createKnuckleZones = ({
    startArcNorm,
    endArcNorm,
    angleRad,
    skew,
    core,
    rolePrefix = '',
}) => {
    const span = endArcNorm - startArcNorm;
    const coreWidthShare = lerp(0.4, 0.18, core);
    const shoulderWidthShare = 1 - coreWidthShare;
    const incomingWidthShare = shoulderWidthShare * (0.5 + (skew * 0.18));
    const outgoingWidthShare = shoulderWidthShare - incomingWidthShare;
    const incomingEnd = startArcNorm + (span * incomingWidthShare);
    const coreEnd = incomingEnd + (span * coreWidthShare);

    const coreAngleShare = lerp(0.44, 0.78, core);
    const shoulderAngleShare = 1 - coreAngleShare;
    const incomingAngle = angleRad * shoulderAngleShare * (0.5 + (skew * 0.16));
    const coreAngle = angleRad * coreAngleShare;
    const outgoingAngle = angleRad - incomingAngle - coreAngle;

    return [
        freezeZone({
            role: `${rolePrefix}shoulder_in`,
            startArcNorm,
            endArcNorm: incomingEnd,
            angleRad: incomingAngle,
        }),
        freezeZone({
            role: `${rolePrefix}core`,
            startArcNorm: incomingEnd,
            endArcNorm: coreEnd,
            angleRad: coreAngle,
        }),
        freezeZone({
            role: `${rolePrefix}shoulder_out`,
            startArcNorm: coreEnd,
            endArcNorm,
            angleRad: outgoingAngle,
        }),
    ];
};

const createZones = ({
    kind,
    supportStartArcNorm,
    supportEndArcNorm,
    angleRad,
    skew,
    core,
    secondary,
    bridge,
}) => {
    if (kind === SAKURA_ARTICULATED_BEND_KINDS.SWEEP) {
        return [freezeZone({
            role: 'sweep',
            startArcNorm: supportStartArcNorm,
            endArcNorm: supportEndArcNorm,
            angleRad,
            kernel: 'sweep',
        })];
    }
    if (kind === SAKURA_ARTICULATED_BEND_KINDS.KNUCKLE) {
        return createKnuckleZones({
            startArcNorm: supportStartArcNorm,
            endArcNorm: supportEndArcNorm,
            angleRad,
            skew,
            core,
        });
    }

    const supportSpan = supportEndArcNorm - supportStartArcNorm;
    const bridgeSpan = supportSpan * bridge;
    const bendSpan = supportSpan - bridgeSpan;
    const firstSpan = bendSpan * (0.5 - (skew * 0.12));
    const firstEnd = supportStartArcNorm + firstSpan;
    const bridgeEnd = firstEnd + bridgeSpan;
    const firstAngle = angleRad * (1 - secondary);
    const secondAngle = angleRad - firstAngle;
    return [
        ...createKnuckleZones({
            startArcNorm: supportStartArcNorm,
            endArcNorm: firstEnd,
            angleRad: firstAngle,
            skew: skew * 0.35,
            core,
            rolePrefix: 'first_',
        }),
        freezeZone({
            role: 'bridge',
            startArcNorm: firstEnd,
            endArcNorm: bridgeEnd,
            angleRad: 0,
            kernel: 'flat',
        }),
        ...createKnuckleZones({
            startArcNorm: bridgeEnd,
            endArcNorm: supportEndArcNorm,
            angleRad: secondAngle,
            skew: skew * 0.35,
            core,
            rolePrefix: 'second_',
        }),
    ];
};

export const createSakuraArticulatedBendEventV1 = ({
    kind = SAKURA_ARTICULATED_BEND_KINDS.KNUCKLE,
    centerArcNorm,
    extentArcNorm,
    angleRad,
    skew = 0,
    core = 0.62,
    secondary = 0.5,
    bridge = 0.16,
} = {}) => {
    if (!KINDS.has(kind)) {
        throw new Error(`ZEN_SAKURA_ARTICULATED_BEND_KIND_INVALID:${String(kind)}`);
    }
    const center = rangedNumber(centerArcNorm, 0, 1, 'centerArcNorm');
    const extent = rangedNumber(extentArcNorm, 0.01, 1, 'extentArcNorm');
    const angle = rangedNumber(angleRad, -Math.PI, Math.PI, 'angleRad');
    const resolvedSkew = rangedNumber(skew, -1, 1, 'skew');
    const resolvedCore = rangedNumber(core, 0, 1, 'core');
    const resolvedSecondary = rangedNumber(secondary, 0.15, 0.85, 'secondary');
    const resolvedBridge = rangedNumber(bridge, 0.05, 0.4, 'bridge');
    const supportStartArcNorm = center - (extent / 2);
    const supportEndArcNorm = center + (extent / 2);
    if (supportStartArcNorm < -EPSILON || supportEndArcNorm > 1 + EPSILON) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_SUPPORT_OUT_OF_RANGE');
    }
    const start = clamp(supportStartArcNorm, 0, 1);
    const end = clamp(supportEndArcNorm, 0, 1);
    const zones = createZones({
        kind,
        supportStartArcNorm: start,
        supportEndArcNorm: end,
        angleRad: angle,
        skew: resolvedSkew,
        core: resolvedCore,
        secondary: resolvedSecondary,
        bridge: resolvedBridge,
    });
    return Object.freeze({
        version: SAKURA_ARTICULATED_BEND_EVENT_VERSION,
        contract: SAKURA_ARTICULATED_BEND_EVENT_CONTRACT,
        kind,
        centerArcNorm: center,
        extentArcNorm: extent,
        angleRad: angle,
        skew: resolvedSkew,
        core: resolvedCore,
        secondary: resolvedSecondary,
        bridge: resolvedBridge,
        supportStartArcNorm: start,
        supportEndArcNorm: end,
        zones: Object.freeze(zones),
    });
};

const sameNumber = (left, right) => Math.abs(Number(left) - Number(right)) <= EPSILON;

export const requireSakuraArticulatedBendEventV1 = (event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_EVENT_REQUIRED');
    }
    if (
        event.version !== SAKURA_ARTICULATED_BEND_EVENT_VERSION
        || event.contract !== SAKURA_ARTICULATED_BEND_EVENT_CONTRACT
    ) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_EVENT_CONTRACT_INVALID');
    }
    const canonical = createSakuraArticulatedBendEventV1(event);
    if (
        !sameNumber(event.supportStartArcNorm, canonical.supportStartArcNorm)
        || !sameNumber(event.supportEndArcNorm, canonical.supportEndArcNorm)
        || !Array.isArray(event.zones)
        || event.zones.length !== canonical.zones.length
        || event.zones.some((zone, index) => {
            const expected = canonical.zones[index];
            return zone?.role !== expected.role
                || zone?.kernel !== expected.kernel
                || !sameNumber(zone?.startArcNorm, expected.startArcNorm)
                || !sameNumber(zone?.endArcNorm, expected.endArcNorm)
                || !sameNumber(zone?.angleRad, expected.angleRad);
        })
    ) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_EVENT_GEOMETRY_INVALID');
    }
    return event;
};

const resolveZoneHeadingDelta = (zone, arcNorm, skew) => {
    if (arcNorm <= zone.startArcNorm) return 0;
    if (arcNorm >= zone.endArcNorm) return zone.angleRad;
    if (zone.kernel === 'flat') return 0;
    const t = (arcNorm - zone.startArcNorm)
        / Math.max(EPSILON, zone.endArcNorm - zone.startArcNorm);
    const progress = zone.kernel === 'sweep'
        ? sweepCdf(t, skew)
        : smoothstepCdf(t);
    return zone.angleRad * progress;
};

const resolveHeadingDelta = (event, arcNorm) => {
    const resolved = event;
    const arc = arcNorm;
    if (arc <= resolved.supportStartArcNorm) return 0;
    if (arc >= resolved.supportEndArcNorm) return resolved.angleRad;
    return resolved.zones.reduce((sum, zone) => (
        sum + resolveZoneHeadingDelta(zone, arc, resolved.skew)
    ), 0);
};

export const resolveSakuraArticulatedBendHeadingDeltaV1 = ({ event, arcNorm } = {}) => {
    const resolved = requireSakuraArticulatedBendEventV1(event);
    const arc = rangedNumber(arcNorm, 0, 1, 'arcNorm');
    return resolveHeadingDelta(resolved, arc);
};

export const resolveSakuraArticulatedBendTurnDeltaV1 = ({
    event,
    arcStartNorm,
    arcEndNorm,
} = {}) => {
    const resolved = requireSakuraArticulatedBendEventV1(event);
    const start = rangedNumber(arcStartNorm, 0, 1, 'arcStartNorm');
    const end = rangedNumber(arcEndNorm, 0, 1, 'arcEndNorm');
    if (end < start) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_ARC_INTERVAL_INVALID');
    }
    return resolveHeadingDelta(resolved, end) - resolveHeadingDelta(resolved, start);
};

const resolveStationRole = (event, arcNorm) => (
    event.zones.find((zone) => (
        arcNorm >= zone.startArcNorm - EPSILON
        && arcNorm <= zone.endArcNorm + EPSILON
    ))?.role || 'outside'
);

export const sampleSakuraArticulatedBendMicroStationsV1 = ({
    event,
    sampleCount,
} = {}) => {
    const resolved = requireSakuraArticulatedBendEventV1(event);
    const count = sampleCount === undefined
        ? SAKURA_ARTICULATED_BEND_SAMPLE_POLICY.defaultByKind[resolved.kind]
        : Number(sampleCount);
    const minimum = SAKURA_ARTICULATED_BEND_SAMPLE_POLICY.minByKind[resolved.kind];
    if (
        !Number.isSafeInteger(count)
        || count < minimum
        || count > SAKURA_ARTICULATED_BEND_SAMPLE_POLICY.hard
    ) {
        throw new Error('ZEN_SAKURA_ARTICULATED_BEND_SAMPLE_COUNT_INVALID');
    }
    const stations = [];
    let consumedHeadingDelta = 0;
    for (let index = 0; index < count; index += 1) {
        const arcStartNorm = lerp(
            resolved.supportStartArcNorm,
            resolved.supportEndArcNorm,
            index / count,
        );
        const arcEndNorm = index === count - 1
            ? resolved.supportEndArcNorm
            : lerp(
                resolved.supportStartArcNorm,
                resolved.supportEndArcNorm,
                (index + 1) / count,
            );
        const entryHeadingDeltaRad = resolveHeadingDelta(resolved, arcStartNorm);
        const exitHeadingDeltaRad = index === count - 1
            ? resolved.angleRad
            : resolveHeadingDelta(resolved, arcEndNorm);
        const turnDeltaRad = index === count - 1
            ? resolved.angleRad - consumedHeadingDelta
            : exitHeadingDeltaRad - entryHeadingDeltaRad;
        consumedHeadingDelta += turnDeltaRad;
        stations.push(Object.freeze({
            index,
            role: resolveStationRole(resolved, (arcStartNorm + arcEndNorm) / 2),
            arcStartNorm,
            arcEndNorm,
            arcNorm: (arcStartNorm + arcEndNorm) / 2,
            entryHeadingDeltaRad,
            exitHeadingDeltaRad,
            turnDeltaRad,
        }));
    }
    return Object.freeze({
        kind: resolved.kind,
        supportStartArcNorm: resolved.supportStartArcNorm,
        supportEndArcNorm: resolved.supportEndArcNorm,
        stationCount: count,
        totalHeadingDeltaRad: resolved.angleRad,
        stations: Object.freeze(stations),
    });
};
