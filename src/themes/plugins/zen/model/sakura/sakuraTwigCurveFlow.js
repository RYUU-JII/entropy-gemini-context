import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';
import { nextRandom } from './sakuraRandomUtils';
import { sampleCenteredNoise } from './sakuraBranchDynamics';

const TWO_PI = Math.PI * 2;

export const createHarmonicCurveFlow = ({
    rng,
    gene,
    morphologyProfile,
    tier = 'twig',
    depthLimit = 6,
    lastDir = 1,
}) => {
    const tierIsTwig = tier === 'twig';
    const chaos = clamp(gene.branchChaos ?? 0.5, 0, 1);
    const straightness = clamp(morphologyProfile?.branchStraightness ?? 0.5, 0, 1);
    const depthSpan = Math.max(2, Math.round(Number(depthLimit) || 2));
    const freqScale = tierIsTwig
        ? lerp(1.02, 2.28, chaos)
        : lerp(0.84, 1.76, chaos);

    const fundamentalAmpDeg = tierIsTwig
        ? lerp(6, 22, chaos) * lerp(1.12, 0.72, straightness)
        : lerp(5, 14, chaos) * lerp(1.05, 0.76, straightness);
    const harmonic2AmpDeg = tierIsTwig
        ? lerp(3, 14, chaos)
        : lerp(2, 10, chaos);
    const harmonic3AmpDeg = tierIsTwig
        ? lerp(2, 10, chaos)
        : lerp(1.2, 7, chaos);
    const driftAmpDeg = tierIsTwig
        ? lerp(0.6, 4.2, chaos)
        : lerp(0.4, 2.8, chaos);
    const biasJitterDeg = tierIsTwig ? 2.8 : 1.8;
    const envelopeDecay = tierIsTwig
        ? lerp(0.64, 1.26, 1 - clamp(gene.twigTierLengthDecay ?? 0.64, 0, 1))
        : lerp(0.42, 0.94, 1 - clamp(gene.scaffoldTierLengthDecay ?? 0.74, 0, 1));
    const response = tierIsTwig
        ? lerp(0.34, 0.56, chaos * lerp(0.92, 1.12, 1 - straightness))
        : lerp(0.28, 0.48, chaos * lerp(0.9, 1.08, 1 - straightness));
    const inertia = tierIsTwig
        ? lerp(0.78, 0.56, chaos)
        : lerp(0.82, 0.6, chaos);
    const slewCap = degToRad(
        tierIsTwig
            ? lerp(2.8, 7.8, chaos) * lerp(0.86, 1.18, 1 - straightness)
            : lerp(2.2, 6.4, chaos) * lerp(0.9, 1.14, 1 - straightness),
    );
    const offsetCap = degToRad(
        tierIsTwig
            ? lerp(12, 30, chaos) * lerp(0.9, 1.12, 1 - straightness)
            : lerp(10, 24, chaos) * lerp(0.92, 1.08, 1 - straightness),
    );

    return {
        tier,
        step: 0,
        depthLimit: depthSpan,
        direction: Math.sign(lastDir || 1) || 1,
        envelopeDecay,
        driftAmp: degToRad(driftAmpDeg),
        bias: sampleCenteredNoise(rng, degToRad(biasJitterDeg) * 2, `${tier}_flow_bias`),
        response,
        inertia,
        slewCap,
        offsetCap,
        prevOffset: 0,
        prevVelocity: 0,
        components: [
            {
                amp: degToRad(fundamentalAmpDeg) * (0.88 + nextRandom(rng, `${tier}_flow_a0`) * 0.34),
                freq: lerp(0.42, 1.34, nextRandom(rng, `${tier}_flow_f0`)) * freqScale,
                phase: nextRandom(rng, `${tier}_flow_p0`) * TWO_PI,
            },
            {
                amp: degToRad(harmonic2AmpDeg) * (0.84 + nextRandom(rng, `${tier}_flow_a1`) * 0.42),
                freq: lerp(1.6, 4.2, nextRandom(rng, `${tier}_flow_f1`)) * freqScale,
                phase: nextRandom(rng, `${tier}_flow_p1`) * TWO_PI,
            },
            {
                amp: degToRad(harmonic3AmpDeg) * (0.72 + nextRandom(rng, `${tier}_flow_a2`) * 0.54),
                freq: lerp(3.6, 8.2, nextRandom(rng, `${tier}_flow_f2`)) * freqScale,
                phase: nextRandom(rng, `${tier}_flow_p2`) * TWO_PI,
            },
        ],
    };
};

export const advanceHarmonicCurveFlow = (flow, { lastDir = 1 } = {}) => {
    if (!flow) return null;
    return {
        ...flow,
        step: flow.step + 1,
        direction: Math.sign(lastDir || flow.direction || 1) || 1,
    };
};

export const resolveHarmonicCurveOffset = (flow) => {
    if (!flow) return 0;
    const depthSpan = Math.max(1, Number(flow.depthLimit) || 1);
    const tRaw = (Number(flow.step) || 0) / depthSpan;
    const t = clamp(tRaw, 0, 2.4);
    const envelope = Math.exp(-Math.max(0.05, Number(flow.envelopeDecay) || 0.7) * t)
        * (t > 1 ? Math.exp(-(t - 1) * 1.25) : 1);
    const wave = (Array.isArray(flow.components) ? flow.components : []).reduce((acc, component) => (
        acc + (
            (Number(component.amp) || 0)
            * Math.sin(
                (TWO_PI * (Number(component.freq) || 0) * t)
                + (Number(component.phase) || 0),
            )
        )
    ), 0);
    const directionalDrift = (Number(flow.direction) || 1)
        * (Number(flow.driftAmp) || 0)
        * (1 - clamp(t, 0, 1) * 0.72);
    return (wave + directionalDrift + (Number(flow.bias) || 0)) * envelope;
};

export const resolveSmoothedFlowOffset = ({
    flow,
    targetOffset = 0,
}) => {
    if (!flow) {
        return {
            offset: Number(targetOffset) || 0,
            flow: null,
        };
    }
    const prevOffset = Number.isFinite(Number(flow.prevOffset))
        ? Number(flow.prevOffset)
        : 0;
    const prevVelocity = Number.isFinite(Number(flow.prevVelocity))
        ? Number(flow.prevVelocity)
        : 0;
    const response = clamp(Number(flow.response) || 0.4, 0.08, 0.94);
    const inertia = clamp(Number(flow.inertia) || 0.68, 0, 0.98);
    const slewCap = Math.max(degToRad(0.2), Number(flow.slewCap) || degToRad(6));
    const offsetCap = Math.max(degToRad(0.5), Number(flow.offsetCap) || degToRad(24));
    const target = Number.isFinite(Number(targetOffset)) ? Number(targetOffset) : 0;
    const delta = (target - prevOffset) * response;
    const blendedVelocity = (prevVelocity * inertia) + (delta * (1 - inertia));
    const nextVelocity = clamp(blendedVelocity, -slewCap, slewCap);
    const nextOffset = Math.tanh((prevOffset + nextVelocity) / offsetCap) * offsetCap;
    return {
        offset: nextOffset,
        flow: {
            ...flow,
            prevOffset: nextOffset,
            prevVelocity: nextVelocity,
        },
    };
};

export const resolveCurveMemoryControls = ({
    flow,
    baseCurve = 0,
    length = 1,
    straightness = 0.5,
    memoryGain = 1,
} = {}) => {
    const safeBaseCurve = Number.isFinite(Number(baseCurve)) ? Number(baseCurve) : 0;
    if (!flow) {
        return {
            curve: safeBaseCurve,
            curveIn: safeBaseCurve,
            curveOut: safeBaseCurve,
        };
    }
    const safeLength = Math.max(1e-3, Number(length) || 0);
    const safeStraightness = clamp(Number(straightness) || 0.5, 0, 1);
    const gain = clamp(Number(memoryGain) || 1, 0, 1.4);
    const offsetCap = Math.max(degToRad(0.5), Number(flow.offsetCap) || degToRad(24));
    const slewCap = Math.max(degToRad(0.2), Number(flow.slewCap) || degToRad(6));
    const offsetSignal = clamp((Number(flow.prevOffset) || 0) / offsetCap, -1, 1);
    const velocitySignal = clamp((Number(flow.prevVelocity) || 0) / slewCap, -1, 1);
    const continuity = lerp(0.62, 0.34, safeStraightness) * gain;
    const memoryCurve = safeLength * 0.08 * offsetSignal * continuity;
    const exitCurve = safeLength * 0.05 * velocitySignal * continuity;
    const curveIn = lerp(safeBaseCurve, safeBaseCurve + memoryCurve, 0.58);
    const curveOut = lerp(safeBaseCurve, safeBaseCurve + memoryCurve + exitCurve, 0.72);

    return {
        curve: (curveIn + curveOut) * 0.5,
        curveIn,
        curveOut,
    };
};

export const syncFlowToGuardedOffset = ({
    flow,
    parentFlow = null,
    guardedOffset = 0,
}) => {
    if (!flow) return null;
    const safeOffset = Number.isFinite(Number(guardedOffset)) ? Number(guardedOffset) : 0;
    const parentOffset = Number.isFinite(Number(parentFlow?.prevOffset))
        ? Number(parentFlow.prevOffset)
        : 0;
    const slewCap = Math.max(degToRad(0.2), Number(flow.slewCap) || degToRad(6));
    return {
        ...flow,
        prevOffset: safeOffset,
        prevVelocity: clamp(safeOffset - parentOffset, -slewCap, slewCap),
    };
};
