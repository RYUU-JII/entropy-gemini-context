import {
    SAKURA_BRANCH_ORDER,
} from '../bonsai/generation/shapePriorModel.js';
import {
    clamp,
    lerp,
} from './sakuraMath.js';
import {
    ZEN_BONSAI_WIND_STATE_ENVELOPE,
} from '../zenBonsaiSceneEnvironment.js';

const TWO_PI = Math.PI * 2;
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const easeSignedUnit = (value) => {
    const x = clamp(toNumber(value, 0), -1, 1);
    const sign = x < 0 ? -1 : 1;
    return sign * smoothstep01(Math.abs(x));
};

export const SAKURA_BRANCH_RUNTIME_MOTION = Object.freeze({
    windFlutterBase: 0.105,
    windFlutterTorque: 0.16,
    branchFlutterFreqScale: 1.31,
    curveShiftScale: 0.052,
    terminalFlowerFlutter: 0.0056,
    terminalLeafFlutter: 0.0096,
    terminalWindIntensityGain: 0.4,
    terminalFlowerWindFlutter: 0.32,
    terminalLeafWindFlutter: 0.5,
});

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const nodeHashUnit = (node = {}, salt = 'default') => hashUnit([
    node?.nodeId || 'node',
    node?.branchOrderName || '',
    Number(node?.branchOrder) || 0,
    Math.round((Number(node?.length) || 0) * 100),
    Math.round((Number(node?.width) || 0) * 100),
    salt,
].join('|'));

export const resolveSakuraBranchMotionWeight = (branchOrder) => {
    if (branchOrder === SAKURA_BRANCH_ORDER.TRUNK) {
        return 0.046;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH) {
        return 0.22;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
        return 0.64;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
        return 1;
    }
    return 0.54;
};

export const resolveSakuraBranchStructuralDamping = ({
    branchOrder,
    depth = 1,
    subtreeBaked = false,
} = {}) => {
    const resolvedDepth = Math.max(1, Math.round(Number(depth) || 1));
    if (branchOrder === SAKURA_BRANCH_ORDER.TRUNK) {
        return 0.13;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH) {
        return resolvedDepth <= 2 ? 0.42 : 0.52;
    }
    if (subtreeBaked === true) {
        return 0.78;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
        return 0.9;
    }
    if (branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
        return 1;
    }
    return 0.82;
};

export const resolveSakuraBranchWindAccelerationResponse = ({
    windState = null,
    dynamics = null,
    branchOrder = SAKURA_BRANCH_ORDER.TRUNK,
} = {}) => {
    const resolvedWindState = normalizeSakuraBranchWindState(windState);
    const intensity = smoothstep01(
        toNumber(resolvedWindState.intensity, Math.abs(toNumber(resolvedWindState.scalar, 0)) / 0.02),
    );
    const gustEnvelope = smoothstep01(toNumber(resolvedWindState.gustEnvelope, intensity));
    const motionWeight = resolveSakuraBranchMotionWeight(branchOrder);
    const exposure = clamp(toNumber(dynamics?.windExposure, 0.44), 0, 1);
    const flexibility = clamp((motionWeight * 0.62) + (exposure * 0.38), 0, 1);
    const lightAir = 1 - intensity;
    const amplitudeEase = Math.pow(intensity, 0.78);

    return {
        bendAmplitudeScale: lerp(0.22, 1.08, amplitudeEase) * lerp(0.9, 1.12, gustEnvelope),
        bendFrequencyScale: lerp(1.56, 0.78, intensity) * lerp(0.94, 1.12, flexibility),
        driveAmplitudeScale: lerp(0.24, 0.96, Math.pow(intensity, 1.24)) * lerp(0.86, 1.08, gustEnvelope),
        gustAmplitudeScale: lerp(0.48, 1.12, gustEnvelope) * lerp(0.82, 1.08, amplitudeEase),
        microAmplitudeScale: lerp(0.34, 0.13, intensity) * lerp(0.38, 1, motionWeight) * lerp(0.92, 1.18, lightAir),
        microFrequencyScale: lerp(1.96, 1.04, intensity) * lerp(0.94, 1.16, flexibility),
        reboundBlend: lerp(0.14, 0.32, intensity) * lerp(0.46, 1, flexibility),
    };
};

export const resolveSakuraBranchRenderDynamics = (node = {}, baseAngle = -Math.PI / 2) => {
    const branchOrder = Number.isFinite(Number(node?.branchOrder))
        ? Number(node.branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    const width = Math.max(0.08, Number(node?.width) || 0.08);
    const length = Math.max(0.08, Number(node?.length) || 0.08);
    const motionWeight = resolveSakuraBranchMotionWeight(branchOrder);
    const widthFlex = clamp(1 - (width / (branchOrder === SAKURA_BRANCH_ORDER.TRUNK ? 18 : 5.6)), 0, 1);
    const lengthFlex = clamp(length / 42, 0, 1);
    const lateralness = clamp(Math.abs(Math.cos(Number(baseAngle) || 0)), 0, 1);
    const upness = clamp(-Math.sin(Number(baseAngle) || 0), 0, 1);
    const flexibility = clamp(
        0.05
        + (motionWeight * 0.44)
        + (widthFlex * 0.34)
        + (lengthFlex * 0.1)
        + (lateralness * 0.07),
        0,
        1,
    );
    const exposure = clamp(
        (lateralness * 0.46)
        + (motionWeight * 0.34)
        + (widthFlex * 0.12)
        + (upness * 0.08),
        0,
        1,
    );

    return {
        windExposure: exposure,
        lightExposure: clamp((upness * 0.46) + (exposure * 0.24) + (motionWeight * 0.16), 0, 1),
        swayPhase: nodeHashUnit(node, 'sway_phase') * TWO_PI,
        swayFreq: lerp(0.005, 0.015, flexibility),
        swayAmplitude: lerp(0.00032, 0.014, flexibility) * motionWeight,
        gustGain: lerp(0.00028, 0.0084, flexibility) * lerp(0.3, 0.74, exposure),
        breathingAmp: lerp(0.0002, 0.0048, flexibility) * motionWeight,
        lightLift: -lerp(0.00012, 0.0038, clamp((upness * 0.52) + (motionWeight * 0.32), 0, 1)) * motionWeight,
        windMemoryTilt: 0,
        droopTilt: lerp(0.00018, 0.005, clamp((lateralness * 0.48) + (motionWeight * 0.34), 0, 1)) * motionWeight,
        tipFlutter: lerp(0.00016, 0.0042, flexibility) * motionWeight,
    };
};

/**
 * Conservative, frame-independent bound for the live branch transform.
 *
 * This intentionally lives beside `resolveSakuraBranchMotion`: camera fitting
 * must not invent a second wind/sag model. The constants below are the maxima
 * of the clamped terms in that function and of the canonical scene wind
 * generator (including the maximum life-state wind response).
 */
export const resolveSakuraBranchMotionEnvelope = ({
    node = null,
    baseAngle = -Math.PI / 2,
    lifeBranchSag = 1,
    depth = 1,
    subtreeBaked = false,
} = {}) => {
    if (!node) {
        return Object.freeze({
            angleOffset: 0,
            curveShift: 0,
        });
    }

    const branchOrder = Number.isFinite(Number(node?.branchOrder))
        ? Number(node.branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    const dynamics = node?.renderDynamics || resolveSakuraBranchRenderDynamics(node, baseAngle);
    const structuralDamping = resolveSakuraBranchStructuralDamping({
        branchOrder,
        depth,
        subtreeBaked,
    });
    const exposure = clamp(toNumber(dynamics?.windExposure, 0.44), 0, 1);
    const maximumSceneFlutter = ZEN_BONSAI_WIND_STATE_ENVELOPE.maximumFlutter;
    const maximumWindCrossGain = 0.82;
    const maximumBendAmplitudeScale = 1.08 * 1.12;
    const maximumSwayEnvelope = 1.02 * 1.12;
    const maximumGustAmplitudeScale = 1.12 * 1.08;
    const maximumDriveAmplitudeScale = 0.96 * 1.08;
    const maximumDriveEnvelope = 1.12;
    const maximumMicroAmplitudeScale = 1.12;
    const maximumFlutterEnvelope = 1.02;

    const sway = 1.18
        * Math.abs(toNumber(dynamics?.swayAmplitude, 0))
        * maximumBendAmplitudeScale
        * maximumSwayEnvelope;
    const breathing = Math.abs(toNumber(dynamics?.breathingAmp, 0)) * 0.68;
    const gust = 0.018
        * Math.abs(toNumber(dynamics?.gustGain, 0))
        * maximumWindCrossGain
        * maximumGustAmplitudeScale;
    const windDrive = 0.024
        * Math.abs(toNumber(dynamics?.gustGain, 0))
        * maximumWindCrossGain
        * 0.58
        * maximumDriveAmplitudeScale
        * maximumDriveEnvelope;
    const windFlutter = maximumSceneFlutter
        * (
            SAKURA_BRANCH_RUNTIME_MOTION.windFlutterBase
            + SAKURA_BRANCH_RUNTIME_MOTION.windFlutterTorque
        )
        * maximumMicroAmplitudeScale
        * maximumFlutterEnvelope;
    const branchFlutter = Math.abs(toNumber(dynamics?.tipFlutter, 0))
        * 1.14
        * maximumFlutterEnvelope;
    const staticBias = Math.abs(toNumber(dynamics?.lightLift, 0))
        + Math.abs(toNumber(dynamics?.windMemoryTilt, 0))
        + Math.abs(toNumber(dynamics?.droopTilt, 0));
    const sag = clamp01(lifeBranchSag) * lerp(0.004, 0.05, exposure);
    const angleOffset = (
        sway
        + breathing
        + gust
        + windDrive
        + windFlutter
        + branchFlutter
        + staticBias
        + sag
    ) * structuralDamping;

    return Object.freeze({
        angleOffset,
        curveShift: angleOffset * Math.max(
            0.03,
            Math.max(0.08, toNumber(node?.length, 0.08))
                * SAKURA_BRANCH_RUNTIME_MOTION.curveShiftScale,
        ),
    });
};

export const normalizeSakuraBranchWindState = (wind = null) => {
    if (wind && typeof wind === 'object') {
        return {
            intensity: toNumber(wind.intensity, 0),
            gustEnvelope: toNumber(wind.gustEnvelope, 0),
            direction: toNumber(wind.direction, Math.PI * 0.58),
            dirX: toNumber(wind.dirX, Math.cos(Math.PI * 0.58)),
            dirY: toNumber(wind.dirY, Math.sin(Math.PI * 0.58)),
            steady: Math.max(0, toNumber(wind.steady, 0)),
            swirl: toNumber(wind.swirl, 0),
            sway: toNumber(wind.sway, 0),
            gust: toNumber(wind.gust, 0),
            flutter: toNumber(wind.flutter, 0),
            scalar: toNumber(wind.scalar, 0),
        };
    }
    const numeric = toNumber(wind, 0);
    return {
        intensity: clamp(Math.abs(numeric) / 0.02, 0, 1),
        gustEnvelope: 0,
        direction: Math.PI * 0.58,
        dirX: Math.cos(Math.PI * 0.58),
        dirY: Math.sin(Math.PI * 0.58),
        // A bare scalar carries no mean flow and no bearing of its own; it is a
        // debug handle, not weather, and must not invent a lean it was not given.
        steady: 0,
        swirl: 0,
        sway: numeric,
        gust: numeric,
        flutter: 0,
        scalar: numeric,
    };
};

export const resolveSakuraLifeWindResponse = (lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return 1;
    }
    const lifeVitality = clamp01(lifeState.vitality ?? 0.78);
    return clamp(
        Number.isFinite(Number(lifeState.windResponse))
            ? Number(lifeState.windResponse)
            : lifeVitality,
        0.18,
        1.08,
    );
};

export const resolveSakuraBranchLifeSag = ({
    lifeState = null,
    imprintGravityBias = 0,
    activationDroop = 0,
    deferToRuntime = false,
} = {}) => {
    if (deferToRuntime) {
        return 0;
    }
    return clamp01(
        (lifeState && typeof lifeState === 'object'
            ? clamp01(lifeState.branchSag ?? 0)
            : 0)
        + (clamp01(imprintGravityBias) * 0.26)
        + (clamp01(activationDroop) * 0.46),
    );
};

export const resolveSakuraEffectiveBranchWindState = ({
    wind = null,
    lifeState = null,
    freezeBranchMotion = false,
} = {}) => {
    const windState = normalizeSakuraBranchWindState(wind);
    if (freezeBranchMotion === true) {
        return {
            ...windState,
            intensity: 0,
            sway: 0,
            gust: 0,
            flutter: 0,
            scalar: 0,
        };
    }
    const lifeWindResponse = resolveSakuraLifeWindResponse(lifeState);
    return {
        ...windState,
        intensity: toNumber(windState.intensity, 0) * lifeWindResponse,
        sway: toNumber(windState.sway, 0) * lifeWindResponse,
        gust: toNumber(windState.gust, 0) * lifeWindResponse,
        flutter: toNumber(windState.flutter, 0) * lifeWindResponse,
        scalar: toNumber(windState.scalar, 0) * lifeWindResponse,
    };
};

export const resolveSakuraBranchNaturalWindField = ({
    node = null,
    dynamics = null,
    baseAngle = -Math.PI / 2,
    frameCount = 0,
    windState = null,
    depth = 1,
} = {}) => {
    const resolvedWindState = normalizeSakuraBranchWindState(windState);
    const time = toNumber(frameCount, 0);
    const resolvedDepth = Math.max(1, Math.round(Number(depth) || 1));
    const phase = toNumber(dynamics?.swayPhase, nodeHashUnit(node, 'natural_wind_phase') * TWO_PI);
    const exposure = clamp(toNumber(dynamics?.windExposure, 0.44), 0, 1);
    const intensity = clamp01(toNumber(resolvedWindState.intensity, Math.abs(toNumber(resolvedWindState.scalar, 0)) / 0.02));
    const gustEnvelope = clamp01(toNumber(resolvedWindState.gustEnvelope, intensity));
    const intensityEase = smoothstep01(intensity);
    const direction = toNumber(resolvedWindState.direction, Math.PI * 0.58);
    const depthDelay = resolvedDepth * 0.61;
    const canopyOffset = Math.cos(baseAngle) * 0.29;
    const broadFrequencyScale = lerp(1.42, 0.82, intensityEase);
    const localFrequencyScale = lerp(1.58, 0.96, intensityEase);
    const flutterFrequencyScale = lerp(1.78, 1.06, intensityEase);
    const globalBreath = clamp(
        0.78
        + (Math.sin(time * 0.0013 * broadFrequencyScale + direction * 0.37) * 0.13)
        + (Math.sin(time * 0.00053 * broadFrequencyScale + direction * 1.91) * 0.07),
        0.56,
        1.02,
    );
    const travelingGust = Math.sin(time * 0.0039 * broadFrequencyScale + (phase * 0.43) + depthDelay + canopyOffset);
    const localEddy = Math.sin(time * 0.0087 * localFrequencyScale + (phase * 1.67) + (resolvedDepth * 0.23) - canopyOffset);
    const highEddy = Math.sin(time * 0.0151 * flutterFrequencyScale + (phase * 2.11) + direction);
    const localArrival = clamp(
        0.84
        + (travelingGust * 0.16)
        + (localEddy * 0.07),
        0.58,
        1.12,
    );
    const turbulence = (
        (travelingGust * 0.56)
        + (localEddy * 0.28)
        + (highEddy * 0.16)
    );
    const turbulenceGain = clamp(0.48 + (gustEnvelope * 0.38) + (intensity * 0.22), 0.46, 1.08);
    const directionWobble = turbulence
        * lerp(0.018, 0.12, exposure)
        * lerp(0.22, 1, intensity);

    return {
        swayEnvelope: globalBreath * localArrival,
        driveEnvelope: clamp((globalBreath * 0.74) + (localArrival * 0.28), 0.54, 1.12),
        gustTexture: turbulence * turbulenceGain,
        phaseDrift: ((travelingGust * 0.17) + (localEddy * 0.07)) * lerp(0.52, 1.08, intensity),
        flutterEnvelope: clamp(0.78 + (highEddy * 0.12) + (localEddy * 0.05), 0.62, 1.02),
        directionWobble,
    };
};

export const resolveSakuraBranchMotion = ({
    node = null,
    baseAngle = -Math.PI / 2,
    frameCount = 0,
    windState = null,
    lifeBranchSag = 0,
    depth = 1,
    subtreeBaked = false,
} = {}) => {
    if (!node) {
        return {
            angleOffset: 0,
            curveShift: 0,
        };
    }
    const branchOrder = Number.isFinite(Number(node?.branchOrder))
        ? Number(node.branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    const dynamics = node?.renderDynamics || resolveSakuraBranchRenderDynamics(node, baseAngle);
    const resolvedWindState = normalizeSakuraBranchWindState(windState);
    const time = toNumber(frameCount, 0);
    const swayPhase = toNumber(dynamics.swayPhase, 0);
    const swayFreq = toNumber(dynamics.swayFreq, 0.02);
    const swayAmplitude = toNumber(dynamics.swayAmplitude, 0);
    const gustGain = toNumber(dynamics.gustGain, 0);
    const breathingAmp = toNumber(dynamics.breathingAmp, 0);
    const lightLift = toNumber(dynamics.lightLift, 0);
    const windMemoryTilt = toNumber(dynamics.windMemoryTilt, 0);
    const droopTilt = toNumber(dynamics.droopTilt, 0);
    const tipFlutter = toNumber(dynamics.tipFlutter, 0);
    const naturalWindField = resolveSakuraBranchNaturalWindField({
        node,
        dynamics,
        baseAngle,
        frameCount: time,
        windState: resolvedWindState,
        depth,
    });
    const accelerationResponse = resolveSakuraBranchWindAccelerationResponse({
        windState: resolvedWindState,
        dynamics,
        branchOrder,
    });
    const windTorque = Math.sin(
        toNumber(resolvedWindState.direction, Math.PI * 0.58)
        + naturalWindField.directionWobble
        - baseAngle,
    );
    const windCrossGain = 0.18 + (Math.abs(windTorque) * 0.64);
    const structuralDamping = resolveSakuraBranchStructuralDamping({
        branchOrder,
        depth,
        subtreeBaked,
    });
    const signedWindForce = (
        (toNumber(resolvedWindState.sway, 0) * 0.62)
        + (toNumber(resolvedWindState.gust, 0) * 0.3)
        + (toNumber(resolvedWindState.flutter, 0) * 0.08)
    );
    const elasticWindForce = easeSignedUnit(signedWindForce / 0.024) * 0.024;
    const windDrive = elasticWindForce
        * gustGain
        * windCrossGain
        * (windTorque === 0 ? 1 : Math.sign(windTorque))
        * 0.58
        * accelerationResponse.driveAmplitudeScale
        * naturalWindField.driveEnvelope;
    const windFlutter = toNumber(resolvedWindState.flutter, 0)
        * (SAKURA_BRANCH_RUNTIME_MOTION.windFlutterBase + (Math.abs(windTorque) * SAKURA_BRANCH_RUNTIME_MOTION.windFlutterTorque))
        * lerp(0.72, 1.12, accelerationResponse.microAmplitudeScale)
        * naturalWindField.flutterEnvelope;
    const elasticSway = clamp(
        (
            Math.sin(time * swayFreq * accelerationResponse.bendFrequencyScale + swayPhase + naturalWindField.phaseDrift)
            * (1 - (accelerationResponse.reboundBlend * 0.28))
        )
        + (
            Math.sin(
                time * swayFreq * accelerationResponse.bendFrequencyScale * 0.58
                + (swayPhase * 0.81)
                + (naturalWindField.phaseDrift * 0.42)
                - 0.74,
            )
            * accelerationResponse.reboundBlend
        )
        + (
            Math.sin(
                time * swayFreq * accelerationResponse.microFrequencyScale
                + (swayPhase * 1.71)
                - (naturalWindField.phaseDrift * 0.35),
            )
            * accelerationResponse.microAmplitudeScale
        ),
        -1.18,
        1.18,
    );
    const sway = elasticSway
        * swayAmplitude
        * accelerationResponse.bendAmplitudeScale
        * naturalWindField.swayEnvelope;
    const breathing = Math.sin(time * (swayFreq * 0.41) + (swayPhase * 0.72)) * breathingAmp * 0.68;
    const gustImpulse = easeSignedUnit((toNumber(resolvedWindState.gust, 0) * naturalWindField.gustTexture) / 0.018) * 0.018;
    const gust = gustImpulse
        * gustGain
        * windCrossGain
        * accelerationResponse.gustAmplitudeScale;
    const flutter = Math.sin(
        time * (swayFreq * SAKURA_BRANCH_RUNTIME_MOTION.branchFlutterFreqScale * accelerationResponse.microFrequencyScale)
        + (swayPhase * 1.24),
    )
        * tipFlutter
        * lerp(0.78, 1.14, accelerationResponse.microAmplitudeScale)
        * naturalWindField.flutterEnvelope;
    const sagDirection = Math.sin((Math.PI / 2) - baseAngle);
    const sagTilt = sagDirection
        * clamp01(lifeBranchSag)
        * lerp(0.004, 0.05, clamp(toNumber(dynamics.windExposure, 0.4), 0, 1));
    const angleOffset = (
        sway
        + breathing
        + gust
        + windDrive
        + windFlutter
        + flutter
        + lightLift
        + windMemoryTilt
        + droopTilt
        + sagTilt
    ) * structuralDamping;

    return {
        angleOffset,
        curveShift: angleOffset * Math.max(0.03, toNumber(node?.length, 1) * SAKURA_BRANCH_RUNTIME_MOTION.curveShiftScale),
    };
};
