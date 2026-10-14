import {
    normalizeSakuraBranchWindState,
    resolveSakuraLifeWindResponse,
} from '../../sakura/sakuraBranchMotionModel.js';

/**
 * Wind motion for the G15 bonsai rig.
 *
 * The scene is a frozen, signed command stream: it describes a tree, not a
 * moment. Motion therefore lives here, at paint time, as a rigid rotation of
 * each limb about its own pivot — the same trunk-core / limb / cluster split
 * the Pixi baker partitions on. Keeping it rigid is the point: a baked texture
 * can be rotated, so nothing done here has to be redone when this moves to
 * Pixi. A per-vertex field would look softer and would not survive the port.
 *
 * This module owns the kinematics, not just the per-limb angle. Each limb's
 * swing is a *relative* deflection about its own joint, and the world transform
 * it hands back is that deflection composed with every ancestor's — the same
 * forward walk the classic Sakura rig does from the root down. That belongs
 * here rather than in a renderer because there are two renderers: a limb that
 * inherited its parent's lean under Pixi and not under canvas2d would be two
 * different trees. Composing once means a branch cannot leave the branch it
 * grows on under either backend, whatever the wind is doing.
 *
 * The trunk is a rig like any other, but the wood decides what that is worth:
 * it is the thickest section in the specimen by a wide margin, so it answers
 * the wind by a fraction of a degree. That fraction is not decoration. Every
 * other part inherits it, so it is what carries the whole tree as one object
 * rather than as parts moving in front of a photograph.
 *
 * Wind values come from the Sakura branch motion model's normalizer, so both
 * trees answer the same weather in the same idiom.
 */

// Radians. How far a limb may swing — the ceiling the weather is allowed to
// reach, not a constant.
//
// A single fixed ceiling was the reason the tree barely answered the wind: the
// drive saturates it at even moderate intensity, so a still afternoon and a
// gale both came out at the same few degrees and the only visible difference
// was how fast it got there. Letting the ceiling itself follow the wind is
// what restores the range — calm air barely stirs the crown, a strong wind
// visibly leans it — while still keeping a hard bound, because a limb that
// swings past it reads as rubber rather than wood.
// Radians. How far a limb may swing — dignified, bounded Zen range.
const CALM_LIMB_ANGLE = 0.052;
const GALE_LIMB_ANGLE = 0.130;
const STIFF_LIMB_ANGLE_SHARE = 0.18;
const resolveMaximumLimbAngle = (intensity) => {
    const eased = intensity * intensity * (3 - (2 * intensity));
    return CALM_LIMB_ANGLE + ((GALE_LIMB_ANGLE - CALM_LIMB_ANGLE) * eased);
};
// Wind is sampled every few frames; motion is not, or the tree would step.
const SECONDS_PER_FRAME = 1 / 60;

// How long the wind takes to cross the whole tree, foot to furthest tip.
const WIND_CROSSING_SECONDS = 0.5;

// How far apart the crown's own rings start out, in turns. The limbs drift
// apart on their own once they are ringing at their own rates, but a tree that
// begins every calm in perfect unison announces that one clock drives it.
const LIMB_PHASE_JITTER_TURNS = 0.34;

// Radians. Each limb sits in its own patch of air: sheltered behind the trunk,
// spilled off a bough above it, or out in the open. A fixed per-limb bearing
// offset is the cheapest honest way to say so, and it is what keeps the crown
// from turning as one plate when the flow swings.
const LOCAL_FLOW_TILT_RAD = 0.22;

// What a limb pointing straight down the wind answers with. Its lever arm is
// zero, so the flow cannot turn it — but real air is not planar and no branch
// is symmetric, so it buffets to whichever side its own asymmetry favours
// rather than standing perfectly still. Hashing the side keeps that stable
// across frames instead of flickering as the bearing wanders through it.
const DOWNWIND_BUFFET_SHARE = 0.3;

// A limb's ring is not a pure tone. A second component just off the fundamental
// is what stops each limb repeating its own gesture on a visible cycle; the
// ratio is irrational for the same reason the weather's bands are.
const OVERTONE_RATIO = 1.618;
const OVERTONE_SHARE = 0.17;

// The band a limb may ring in. The wood decides where in it each limb sits;
// this only bounds the range.
const SLOWEST_RING_HZ = 0.24;
const FASTEST_RING_HZ = 1.32;

// How much of a major limb's drive a sub-limb adds on top of its parent's.
const SUB_LIMB_DRIVE_SHARE = 0.52;

// Gains from wind pressure to radians, before compliance and exposure.
const POSTURE_GAIN = 8.6;
const RUSTLE_GAIN = 8.6;

const clamp = (value, min, max) => Math.min(
    max,
    Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min),
);
const clamp01 = (value) => clamp(value, 0, 1);

const hashUnit = (value) => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const EMPTY_MOTION = Object.freeze({
    signature: 'rig-motion:still',
    moving: false,
    transformFor: () => null,
});

const TRUNK_RIG_ID = 'rig_trunk_core';

// A rigid planar motion, `p -> (cos*x - sin*y + tx, sin*x + cos*y + ty)`.
// Rotations about a joint compose into one of these and stay one of these, so
// an arbitrarily deep chain of limbs still costs a renderer a single transform.
const IDENTITY_TRANSFORM = Object.freeze({
    angle: 0, cos: 1, sin: 0, tx: 0, ty: 0,
});

const rotationAboutPivot = (pivotX, pivotY, angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        angle,
        cos,
        sin,
        tx: pivotX - ((cos * pivotX) - (sin * pivotY)),
        ty: pivotY - ((sin * pivotX) + (cos * pivotY)),
    };
};

// `outer` applied after `inner`.
const composeTransforms = (outer, inner) => ({
    angle: outer.angle + inner.angle,
    cos: (outer.cos * inner.cos) - (outer.sin * inner.sin),
    sin: (outer.sin * inner.cos) + (outer.cos * inner.sin),
    tx: (outer.cos * inner.tx) - (outer.sin * inner.ty) + outer.tx,
    ty: (outer.sin * inner.tx) + (outer.cos * inner.ty) + outer.ty,
});

/**
 * Resolves one frame of rig motion.
 *
 * @param rigParts  limb descriptors published by the scene
 * @param wind      canonical wind state (or a scalar)
 * @param lifeState drives how much the tree answers at all — a strained tree
 *                  moves less, which is the one place motion carries meaning
 *                  rather than just life
 * @param frameCount monotonic frame counter from the render loop
 */
export const resolveZenBonsaiRigMotion = ({
    rigParts = null,
    wind = null,
    lifeState = null,
    frameCount = 0,
} = {}) => {
    if (!Array.isArray(rigParts) || rigParts.length === 0) {
        return EMPTY_MOTION;
    }
    const windState = normalizeSakuraBranchWindState(wind);
    const lifeResponse = resolveSakuraLifeWindResponse(lifeState);
    const intensity = clamp01(windState.intensity);

    // Two different things move a tree, and the old model only had one of them.
    //
    // The mean flow holds the specimen leaning and then lets it up. It is slow,
    // it is one-signed, and it is very nearly the same over the whole tree,
    // because a gust front crosses a bonsai in milliseconds. That is posture.
    //
    // The turbulence riding on that flow is what each limb *rings* to, and for
    // that the tree is not one object at all: every limb is its own cantilever
    // with its own period, so they answer the same air at different rates and
    // slide in and out of step with each other. That is rustle.
    //
    // Collapsing both into a single zero-mean scalar applied to every part at
    // one frequency is precisely what a fan being switched on and off looks
    // like: everything starts together, everything reverses together, and the
    // whole specimen crosses through neutral twice a cycle.
    const lean = Math.max(0, windState.steady);
    const breath = (windState.sway * 0.5) + (windState.gust * 0.42);
    const posture = lean + breath;
    const turbulence = Math.abs(windState.gust)
        + (Math.abs(windState.flutter) * 1.6)
        + (Math.abs(windState.sway) * 0.35);
    if ((lean + Math.abs(breath) + turbulence) < 1e-5 || lifeResponse <= 0.02) {
        return EMPTY_MOTION;
    }

    const seconds = Math.max(0, Number(frameCount) || 0) * SECONDS_PER_FRAME;
    const maximumLimbAngle = resolveMaximumLimbAngle(intensity);
    // Each limb's own deflection about its own joint, before inheritance.
    const localAngle = new Map();
    const partMap = new Map();
    rigParts.forEach((part) => {
        if (part?.id) partMap.set(part.id, part);
    });

    // The mean bearing of the weather, in the same plane the rig is drawn, and
    // how far the flow has currently wandered off it.
    const meanWindAngle = Math.atan2(windState.dirY, windState.dirX);
    const flowAngle = meanWindAngle + (Number(windState.swirl) || 0);
    const cosWind = Math.cos(flowAngle);
    const sinWind = Math.sin(flowAngle);

    rigParts.forEach((part) => {
        if (!part?.pivot) return;
        const isSubLimb = Boolean(
            part.tier === 2
            || (part.parentLimbId && part.parentLimbId !== TRUNK_RIG_ID)
        );
        const parentPart = isSubLimb ? partMap.get(part.parentLimbId) : null;

        const stiffness = clamp(part.stiffness ?? 0.6, 0.1, 1);
        const compliance = 1 - stiffness;
        const parentStiffness = parentPart ? clamp(parentPart.stiffness ?? 0.6, 0.1, 1) : 0.8;
        const parentCompliance = 1 - parentStiffness;
        const drivenCompliance = isSubLimb
            ? Math.max(0.03, compliance - (parentCompliance * 0.5))
            : compliance;

        // Spatial traveling wave: wind glides smoothly across the canopy from windward to leeward.
        const spatialWave = ((part.pivot.x * cosWind) + (part.pivot.y * sinWind)) * 0.0018;
        const arrival = seconds
            - (clamp01(part.pathFraction ?? 0) * WIND_CROSSING_SECONDS)
            - (spatialWave * 0.28);
        const jitter = (hashUnit(`${part.id}|jitter`) - 0.5)
            * LIMB_PHASE_JITTER_TURNS * Math.PI * 2;

        // Which way this limb is turned, and how hard.
        //
        // The wind's torque about a joint is its lever arm crossed into the
        // flow, so it goes as the *signed* sine of the angle between them, not
        // its magnitude. Taking the magnitude — which is what this did — throws
        // away the only thing that distinguishes a tree leaning downwind from a
        // pinwheel: with the sign discarded every limb turns the same way at
        // once, so the branch on the windward side swings downwind while the one
        // opposite it swings upwind, and the crown scissors instead of leaning.
        // With the sign kept, a limb pointing up and a limb pointing down rotate
        // in opposite senses and both tips travel downwind, which is what a tree
        // in air actually does.
        const localTilt = (hashUnit(`${part.id}|tilt`) - 0.5) * LOCAL_FLOW_TILT_RAD;
        const across = Math.sin(flowAngle + localTilt - (part.baseAngleRad ?? 0));
        const buffetSign = hashUnit(`${part.id}|buffet`) < 0.5 ? -1 : 1;
        const exposure = across
            + (buffetSign * DOWNWIND_BUFFET_SHARE * (1 - Math.abs(across)));

        // This limb's own resonance. The wood chose the frequency; two limbs of
        // different weight answering the same gust at their own rates is the
        // whole difference between a crown that rustles and a crown that pulses.
        const ringHz = clamp(part.naturalFrequencyHz ?? 0.6, SLOWEST_RING_HZ, FASTEST_RING_HZ);
        const ringPhase = (arrival * ringHz * Math.PI * 2) + jitter;
        const rawRing = (
            Math.sin(ringPhase)
            + (OVERTONE_SHARE * Math.sin((ringPhase * OVERTONE_RATIO) + (jitter * 1.7)))
        ) / (1 + OVERTONE_SHARE);
        // Cubic soft turnaround easing at peak deflections.
        const ring = rawRing * (1 - (0.15 * rawRing * rawRing));

        const share = isSubLimb ? SUB_LIMB_DRIVE_SHARE : 1;
        const ceiling = maximumLimbAngle
            * (isSubLimb ? 0.4 : 1)
            * (STIFF_LIMB_ANGLE_SHARE + ((1 - STIFF_LIMB_ANGLE_SHARE) * compliance));
        const angle = clamp(
            (
                (posture * POSTURE_GAIN * share * drivenCompliance * lifeResponse)
                + (ring * turbulence * RUSTLE_GAIN * share * drivenCompliance * lifeResponse)
            ) * exposure,
            -ceiling,
            ceiling,
        );
        localAngle.set(part.id, angle);
    });

    if (localAngle.size === 0) return EMPTY_MOTION;

    // Forward kinematics, parents before children.
    //
    // A limb's deflection is stated about its own joint, but that joint is a
    // point on its parent and has already moved. Composing down the chain is
    // what makes the joint hold: without it every part turns about where its
    // joint *used* to be, and the crown comes apart at exactly the places it
    // should be strongest.
    const worldTransforms = new Map();
    const resolveWorld = (rigId, guard) => {
        if (worldTransforms.has(rigId)) return worldTransforms.get(rigId);
        const part = partMap.get(rigId);
        if (!part?.pivot || guard.has(rigId)) return IDENTITY_TRANSFORM;
        guard.add(rigId);
        const parentId = part.parentLimbId;
        // The trunk is a rig like any other now, so a major limb inherits it
        // the same way a twig inherits its bough. Skipping it here — which was
        // right while the trunk was a hard zero — leaves every limb hinging
        // about where its joint sat before the stem leaned, and the whole crown
        // separates from the trunk by exactly the trunk's own motion.
        const parentWorld = (parentId && partMap.has(parentId))
            ? resolveWorld(parentId, guard)
            : IDENTITY_TRANSFORM;
        const local = rotationAboutPivot(
            part.pivot.x,
            part.pivot.y,
            localAngle.get(rigId) || 0,
        );
        const world = composeTransforms(parentWorld, local);
        worldTransforms.set(rigId, world);
        return world;
    };
    rigParts.forEach((part) => {
        if (part?.id) resolveWorld(part.id, new Set());
    });

    const transforms = new Map();
    worldTransforms.forEach((world, rigId) => {
        // A part whose whole chain came out still costs a transform for nothing.
        if (Math.abs(world.angle) < 1e-5
            && Math.abs(world.tx) < 1e-4
            && Math.abs(world.ty) < 1e-4) {
            return;
        }
        const part = partMap.get(rigId);
        transforms.set(rigId, Object.freeze({
            pivotX: part.pivot.x,
            pivotY: part.pivot.y,
            // The limb's own deflection, for anything that wants to reason
            // about this joint rather than paint through it.
            localAngle: localAngle.get(rigId) || 0,
            // ...and the composed world motion, which is what a renderer applies.
            angle: world.angle,
            cos: world.cos,
            sin: world.sin,
            tx: world.tx,
            ty: world.ty,
        }));
    });

    if (transforms.size === 0) return EMPTY_MOTION;

    return Object.freeze({
        signature: `rig-motion:${Math.round(seconds * 60)}:${Math.round(intensity * 100)}`,
        moving: true,
        transformFor: (rigId) => (rigId ? transforms.get(rigId) || null : null),
    });
};

export default resolveZenBonsaiRigMotion;
