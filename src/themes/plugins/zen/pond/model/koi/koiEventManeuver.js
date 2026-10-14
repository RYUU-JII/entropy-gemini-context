import { clamp } from './koiMotion.js';

const smooth = (x) => {
    const u = clamp(x, 0, 1);
    return u * u * (3 - 2 * u);
};

export const createEventKoiManeuver = () => ({
    active: false, kind: 'cruise', time: 0, duration: 52, progress: 1,
    sign: 0, amplitude: 0, yawVelocity: 0, exitThrust: 0,
    headVelocity: 0, midVelocity: 0, tailVelocity: 0,
    biasVelocity: 0, sweepBias: 0, sweepPower: 0, gaitGain: 1,
    forwardPerLength: 0.008, glideKick: false, glideReady: false, wasGliding: false,
    carrierYield: 0, strokePower: 0, serial: 0,
    pendingTurn: 0, pendingKind: 'none', pendingSign: 0, pendingStrength: 0,
    powered: true, lastEvent: 'none',
});

function beginManeuver(frame) {
    const motor = frame.maneuver;
    motor.active = true;
    motor.kind = motor.pendingKind;
    motor.sign = motor.pendingSign;
    motor.amplitude = (motor.kind === 'sharp' ? 2.85 : 1.2) * motor.pendingStrength;
    motor.duration = (motor.kind === 'sharp' ? 42 : 52) * Math.sqrt(frame.inertia);
    motor.time = motor.progress = 0;
    motor.pendingKind = 'none';
    motor.serial += 1;
    // Curvature, curvature rate and angular momentum belong to the body, not
    // the request. Admission never resets them, including an emergency turn.
}

// Intent admission is separate from integration, so throttle, fins and forces
// see the executing stroke rather than the short behavioral event's timer.
export function prepareEventKoiStroke(frame, event, sign, strength, desiredTurn, powered, urgent, autonomousGlide = false) {
    const motor = frame.maneuver;
    if (autonomousGlide && !motor.wasGliding) motor.glideReady = true;
    motor.wasGliding = autonomousGlide;
    if (!autonomousGlide) motor.glideKick = false;
    // An autonomous coast may spend one stroke on steering. Manual release,
    // braking and sleep never enter this admission path.
    if (autonomousGlide && motor.glideReady && Math.abs(desiredTurn) > 0.006) {
        motor.glideKick = true;
        motor.glideReady = false;
        motor.progress = 1;
    }
    motor.powered = powered || motor.glideKick;
    motor.pendingTurn = motor.powered ? clamp(desiredTurn * 24, -0.95, 0.95) : 0;
    if (event !== motor.lastEvent && (event === 'turn' || event === 'c_turn')) {
        motor.pendingKind = event === 'c_turn' ? 'sharp' : 'routine';
        motor.pendingSign = sign;
        motor.pendingStrength = clamp(strength, 0.25, 1.08);
    }
    motor.lastEvent = event;
    if (!motor.powered) {
        motor.pendingKind = 'none';
        motor.active = false;
        motor.amplitude = 0;
        // Releasing input removes muscle work, not the body's follow-through.
    } else if (motor.pendingKind !== 'none'
        && (urgent || motor.progress >= 0.72 || motor.amplitude === 0)) {
        beginManeuver(frame);
    } else if (urgent && Math.sign(motor.pendingTurn) !== motor.sign) {
        // A collision threat may unload a committed stroke early. The next
        // stroke still starts from the current body state, never a pose reset.
        motor.amplitude = 0;
        motor.active = false;
    }
    return motor;
}

// One broad loading sweep, followed by a longer feathered recovery. No terminal
// recoil lobe: that formerly produced a second small kick while settling.
function strokePulse(u) {
    if (u <= 0 || u >= 1) return 0;
    return smooth(u / 0.3) * (1 - smooth((u - 0.3) / 0.7));
}

// Exact critically damped response for a held target. Keeping both position
// and velocity preserves the handoff; bounded substeps sample the moving target.
function followRegion(frame, positionKey, velocityKey, target, omega, dt, positions = frame) {
    const motor = frame.maneuver;
    if (target === 0 && Math.abs(positions[positionKey]) + Math.abs(motor[velocityKey]) < 1e-10) {
        positions[positionKey] = motor[velocityKey] = 0;
        return;
    }
    const offset = positions[positionKey] - target;
    const velocity = motor[velocityKey];
    const b = velocity + omega * offset;
    const decay = Math.exp(-omega * dt);
    positions[positionKey] = target + (offset + b * dt) * decay;
    motor[velocityKey] = (velocity - omega * b * dt) * decay;
}

export function advanceEventKoiStroke(frame, phase, stepScale, speedNorm, turnCap, sharpCap) {
    const motor = frame.maneuver;
    const phaseAdvance = Math.max(0, phase - frame.strokePhase);
    const steps = Math.max(1, Math.ceil(stepScale));
    const dt = stepScale / steps;
    const phaseStep = phaseAdvance / steps;
    let yaw = 0;
    let departure = 0;
    for (let i = 0; i < steps; i += 1) {
        frame.strokePhase += phaseStep;
        if (motor.active) {
            motor.time += dt;
            motor.progress = Math.min(1, motor.time / motor.duration);
        } else {
            // Commit a steering bias for one half-stroke, including a short tap.
            // This clock only admits intention: force and shape below use the
            // existing swimming phase, never an independent correction pulse.
            if (motor.progress >= 1 || motor.amplitude === 0) {
                motor.amplitude = motor.pendingTurn;
                motor.sign = Math.sign(motor.amplitude);
                motor.kind = 'cruise';
                motor.progress = motor.amplitude === 0 ? 1 : 0;
                if (motor.amplitude !== 0) motor.serial += 1;
            }
            // Build useful force as a press develops, without restarting the
            // phase or reversing a sweep already in progress. Recovery cannot
            // recruit another contraction through this path.
            if (motor.progress < 0.65 && Math.sign(motor.pendingTurn) === motor.sign
                && Math.abs(motor.pendingTurn) > Math.abs(motor.amplitude)) {
                motor.amplitude = motor.pendingTurn;
            }
            motor.progress = Math.min(1, motor.progress + phaseStep / Math.PI);
        }
        const amplitude = motor.powered ? (motor.active ? motor.sign * motor.amplitude : motor.amplitude) : 0;
        const oldHead = frame.maneuverHead, oldMid = frame.maneuverMid, oldTail = frame.maneuverTail;
        // Turn muscle groups contract together around the trunk. Delaying the
        // tail's command like a travelling sine let rigid yaw carry it toward
        // the head before it could make its opposing power sweep.
        const tailPhase = frame.strokePhase - frame.strokePhaseLag;
        const sweep = Math.cos(tailPhase);
        const phaseRate = phaseAdvance / stepScale;
        const pace = clamp(motor.forwardPerLength * Math.PI * 2 / Math.max(0.025, phaseRate), 0.25, 1);
        // A stronger power sweep on one side, with the opposite sweep kept as
        // an easy recovery. Small course changes do not recruit the whole trunk.
        followRegion(frame, 'sweepBias', 'biasVelocity', motor.active ? 0 : amplitude, 0.45, dt, motor);
        const bias = motor.sweepBias;
        const favorable = Math.max(0, -Math.sign(bias) * sweep);
        motor.sweepPower = favorable * favorable;
        const recruitment = smooth((Math.abs(bias) - 0.32) / 0.63);
        const contraction = motor.active
            ? amplitude * strokePulse(motor.progress)
            : Math.sign(bias) * 0.38 * recruitment * motor.sweepPower * Math.sqrt(pace);
        motor.gaitGain = 1 - bias * Math.sin(tailPhase) * 0.24;
        const headTarget = contraction;
        const midTarget = contraction;
        const tailTarget = contraction;
        // Recovery is slower posteriorly, but forward flow helps the body slip
        // out of the bend. It does not hold the tail in a delayed static pose.
        const release = motor.active ? 0.32 + speedNorm * 0.14 : 0.65 + speedNorm * 0.18;
        followRegion(frame, 'maneuverHead', 'headVelocity', headTarget,
            Math.abs(headTarget) > Math.abs(oldHead) ? 1.1 : release * 1.15, dt);
        followRegion(frame, 'maneuverMid', 'midVelocity', midTarget,
            Math.abs(midTarget) > Math.abs(oldMid) ? 0.95 : release, dt);
        followRegion(frame, 'maneuverTail', 'tailVelocity', tailTarget,
            Math.abs(tailTarget) > Math.abs(oldTail) ? 0.85 : release * 0.85, dt);

        const sweepDelta = (frame.maneuverHead - oldHead) * 0.2
            + (frame.maneuverMid - oldMid) * 0.32 + (frame.maneuverTail - oldTail) * 0.48;
        const sweepLoad = frame.maneuverHead * 0.2 + frame.maneuverMid * 0.32 + frame.maneuverTail * 0.48;
        const loading = Math.max(0, motor.sign * sweepDelta);
        const returning = Math.max(0, -motor.sign * sweepDelta);
        const previousYaw = motor.yawVelocity;
        const sharp = motor.kind === 'sharp';
        motor.yawVelocity *= Math.exp(-(sharp ? 0.09 : motor.active ? 0.12 : 0.16) * dt - returning * 0.38);
        // Finite contraction uses its own execution progress; cruise can only
        // do muscle work while its carrier advances. Frozen shape is no motor.
        const doingWork = motor.powered && (motor.active || phaseAdvance > 0) && amplitude !== 0;
        if (doingWork) {
            if (motor.active) {
                const engagement = sharp ? smooth(Math.abs(sweepLoad) / 0.9) : 1;
                motor.yawVelocity += motor.sign * loading * engagement * (sharp ? 0.3 : 0.21) / Math.sqrt(frame.inertia);
            } else {
                // The same lateral sweep that deforms the fish supplies its
                // steering work. Forward distance bounds ordinary agility;
                // an emergency contraction has its separate finite impulse.
                const work = sweep * sweep * (0.18 + favorable * 0.82);
                const rateGain = clamp(phaseRate / 0.055, 0, 2);
                motor.yawVelocity += (bias * work * 0.0052 * rateGain * pace * dt
                    + motor.sign * loading * 0.045) / Math.sqrt(frame.inertia);
            }
            departure += Math.max(0, motor.sign * (oldTail - frame.maneuverTail));
        }
        const cap = sharp ? sharpCap : turnCap;
        motor.yawVelocity = clamp(motor.yawVelocity, -cap, cap);
        yaw += (previousYaw + motor.yawVelocity) * 0.5 * dt;
        const yieldTarget = motor.active ? 0.58 * smooth(Math.abs(contraction) / 0.8) : 0;
        if (yieldTarget !== motor.carrierYield) {
            motor.carrierYield += (yieldTarget - motor.carrierYield) * (1 - Math.exp(-dt * 0.3));
            if (motor.carrierYield < 1e-10) motor.carrierYield = 0;
        }
        if (motor.active && motor.progress >= 1) {
            motor.active = false;
            motor.amplitude = 0;
        }
        if (motor.glideKick && motor.progress >= 1) {
            motor.glideKick = false;
            motor.powered = false;
            motor.pendingTurn = motor.amplitude = 0;
        }
    }
    frame.strokePhase = phase;
    frame.maneuverBend = frame.maneuverHead;
    motor.exitThrust = departure / stepScale;
    const sweep = Math.cos(phase - frame.strokePhaseLag);
    motor.strokePower = sweep * sweep * clamp(phaseAdvance / (stepScale * 0.055), 0, 2);
    return yaw;
}
