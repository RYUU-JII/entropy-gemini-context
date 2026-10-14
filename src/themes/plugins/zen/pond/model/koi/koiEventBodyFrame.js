import { clamp } from './koiMotion.js';
import { createEventKoiManeuver } from './koiEventManeuver.js';
import { KOI_EVENT_MOTION_LIMITS } from './koiEventMotionLimits.js';

export const resolveEventKoiPhaseTravel = (wavelengthScale) => (
    4 / Math.sqrt(clamp(wavelengthScale,
        KOI_EVENT_MOTION_LIMITS.wavelengthScale.min, KOI_EVENT_MOTION_LIMITS.wavelengthScale.max))
);

const QUADRATURE_POINTS = [-0.8611363116, -0.3399810436, 0.3399810436, 0.8611363116];
const QUADRATURE_WEIGHTS = [0.3478548451, 0.6521451549, 0.6521451549, 0.3478548451];

// Integrate a continuous curvature field over normalized arc length. These
// integrals are cached: joints sample one curve, rather than each chasing and
// clipping an independent angle. Resolution therefore does not change the gait.
function integrateCurvature(out, from, to, core, phaseTravel) {
    const half = (to - from) * 0.5;
    const midpoint = (from + to) * 0.5;
    for (let k = 0; k < QUADRATURE_POINTS.length; k += 1) {
        const s = midpoint + half * QUADRATURE_POINTS[k];
        const neck = clamp((s - 0.05) / 0.14, 0, 1);
        const compliance = neck * neck * (3 - 2 * neck) * (0.7 + (0.48 - core) * 0.8 + s * 0.5);
        const weight = compliance * half * QUADRATURE_WEIGHTS[k];
        out.waveWeight += weight;
        out.waveSin += Math.cos(s * phaseTravel) * weight;
        out.waveCos += Math.sin(s * phaseTravel) * weight;
        // A broad muscular flexion centred behind the chest, rather than
        // distributing the turn evenly all the way to the caudal tip.
        const trunk = (s - 0.46) / 0.23;
        const muscleWeight = weight * (0.04 + 1.8 * Math.exp(-trunk * trunk));
        out.turnHead += (1 - s) * (1 - s) * muscleWeight;
        out.turnMid += 2 * s * (1 - s) * muscleWeight;
        out.turnTail += s * s * muscleWeight;
    }
}

const emptyIntegral = () => ({
    waveWeight: 0, waveSin: 0, waveCos: 0, turnHead: 0, turnMid: 0, turnTail: 0,
});

function addTransportBasis(joint, s) {
    const along = clamp((s - 0.3) / 0.7, 0, 1);
    const u = along * along * (3 - 2 * along);
    joint.transportMid = 2 * u * (1 - u);
    joint.transportTail = u * u;
}

// Retain low-frequency course changes in the water-relative backbone. These
// two lags are advected by forward travel, not by elapsed animation phase, and
// never sample displayed joints or the cruise sine. A small passive relaxation
// also lets a stopped fish straighten instead of keeping an old path forever.
export function advanceEventKoiTurnTransport(frame, yaw, forwardTravel, stepScale) {
    if (yaw === 0 && frame.transportMid === 0 && frame.transportTail === 0) return;
    const length = frame.spacing * (frame.count - 1);
    const travel = forwardTravel / (length * 0.24);
    // Recovery muscle work unloads the course while forward travel still
    // carries it through the rear. Strong maneuvers keep their follow-through.
    const recovery = frame.maneuver.powered && frame.maneuver.kind === 'cruise'
        ? (1 - frame.maneuver.sweepPower) * 0.026 : 0;
    const amount = travel + stepScale * (0.018 + recovery);
    const decay = Math.exp(-amount);
    const mid = frame.transportMid + yaw;
    const tail = frame.transportTail + yaw;
    frame.transportMid = mid * decay;
    frame.transportTail = (tail + amount * mid) * decay;
    if (Math.abs(frame.transportMid) + Math.abs(frame.transportTail) < 1e-10) {
        frame.transportMid = frame.transportTail = 0;
    }
}

export function acquireEventKoiBodyFrame(self, coreSegment, wavelength, stiffness, inertia) {
    const h = self.history;
    const previous = self.eventBodyFrame;
    if (previous && previous.history === h && previous.count === h.length
        && previous.spacing === self.segmentSpacing && previous.core === coreSegment
        && previous.wavelength === wavelength && previous.stiffness === stiffness
        && previous.inertia === inertia && previous.neckIndex === self.neckIndex) return previous;

    const core = coreSegment;
    // Even at short Pond Lab wavelengths, use less than half a spatial cycle:
    // a broad C/S gesture, not several alternating bends packed into the fish.
    // The old phase law drove local tangent offsets. Integrating that same law
    // as curvature shortened the visible head-to-tail delay into a near-standing
    // bow. Compensate spatial transmission without speeding up the stroke clock.
    const phaseTravel = Math.min(Math.PI * 0.9, resolveEventKoiPhaseTravel(wavelength) * 1.65);
    const retainPath = previous && previous.history === h && previous.count === h.length
        && previous.spacing === self.segmentSpacing;
    const centerline = retainPath ? previous.centerline : h.map((p) => ({ ...p }));
    const integral = emptyIntegral();
    const joints = h.map((_, i) => {
        if (i > 0) integrateCurvature(integral, (i - 1) / (h.length - 1), i / (h.length - 1), core, phaseTravel);
        return { ...integral };
    });
    const turnNormalization = 1 / (integral.turnHead + integral.turnMid + integral.turnTail);
    const waveNormalization = 1 / integral.waveWeight;
    for (let i = 0; i < joints.length; i += 1) {
        const joint = joints[i];
        for (const key of Object.keys(joint)) joint[key] *= key.startsWith('turn') ? turnNormalization : waveNormalization;
        addTransportBasis(joint, i / (joints.length - 1));
    }
    const anchor = emptyIntegral();
    // Use the same short quadrature intervals for the anchor at any joint count.
    for (let i = 0; i < 12; i += 1) integrateCurvature(anchor, i * 0.025, (i + 1) * 0.025, core, phaseTravel);
    for (const key of Object.keys(anchor)) anchor[key] *= key.startsWith('turn') ? turnNormalization : waveNormalization;
    addTransportBasis(anchor, 0.3);
    let strokeSin = 0, strokeCos = 0;
    for (let i = 1; i < joints.length; i += 1) {
        strokeSin += (joints[i - 1].waveSin + joints[i].waveSin) * 0.5;
        strokeCos += (joints[i - 1].waveCos + joints[i].waveCos) * 0.5;
    }
    const frame = {
        history: h, count: h.length, spacing: self.segmentSpacing,
        core: coreSegment, wavelength, stiffness, inertia, neckIndex: self.neckIndex,
        centerline,
        joints, anchor, phaseTravel,
        waveTipMagnitude: Math.hypot(joints[h.length - 1].waveSin, joints[h.length - 1].waveCos),
        waveFlex: Math.sqrt(2.2 / stiffness) / Math.sqrt(inertia),
        strokePhaseLag: Math.atan2(strokeCos, strokeSin),
        strokePhase: retainPath ? previous.strokePhase : self.shapePhase,
        maneuver: retainPath ? previous.maneuver : createEventKoiManeuver(),
        maneuverHead: retainPath ? previous.maneuverHead : 0,
        maneuverBend: retainPath ? previous.maneuverBend : 0,
        maneuverMid: retainPath ? previous.maneuverMid : 0,
        maneuverTail: retainPath ? previous.maneuverTail : 0,
        transportMid: retainPath ? previous.transportMid : 0,
        transportTail: retainPath ? previous.transportTail : 0,
        displayedBend: h[0].angle - h[h.length - 1].angle,
    };
    self.eventBodyFrame = frame;
    return frame;
}
