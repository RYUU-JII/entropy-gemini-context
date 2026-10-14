import { clamp as clampValue } from '../../model/koi/koiMotion.js';

const FRAME_MS_BASE = 16.6667;

const toFinite = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp01 = (value, fallback = 0) => clampValue(toFinite(value, fallback), 0, 1);

const expSmooth = (current, target, dtSec, tauSec) => {
    const safeCurrent = toFinite(current, target);
    const safeTarget = toFinite(target, safeCurrent);
    const safeDt = clampValue(toFinite(dtSec, FRAME_MS_BASE * 0.001), 0.001, 0.25);
    const safeTau = Math.max(0.001, toFinite(tauSec, 1));
    const alpha = 1 - Math.exp(-safeDt / safeTau);
    return safeCurrent + ((safeTarget - safeCurrent) * alpha);
};

const resolveTemporalInputs = ({
    frameState = null,
    frameChannels = null,
} = {}) => {
    const safeFrameState = frameState && typeof frameState === 'object' ? frameState : null;
    const safeChannels = frameChannels && typeof frameChannels === 'object' ? frameChannels : null;
    if (!safeChannels) return null;
    const derivedChannels = safeFrameState?.channels || null;
    const unifiedSurface = derivedChannels?.surface || null;
    const unifiedIllumination = derivedChannels?.lighting || null;
    const atmosphereChannel = derivedChannels?.atmosphere || null;

    const cloudiness = clamp01(
        atmosphereChannel?.cloudiness ?? safeChannels.cloudiness,
        0.5,
    );
    const windIntensity = clampValue(
        toFinite(
            atmosphereChannel?.windIntensity ?? safeChannels.windIntensity,
            0.4,
        ),
        0.08,
        1,
    );
    const gustEnvelope = clamp01(
        atmosphereChannel?.gustEnvelope ?? safeChannels.gustEnvelope,
        0.3 + windIntensity * 0.4,
    );
    const waveEnergy = clamp01(unifiedSurface?.waveEnergy, 0.5);
    const roughness = clamp01(unifiedSurface?.roughness, 0.5);
    const specularResponse = clamp01(
        unifiedSurface?.specularResponse ?? unifiedIllumination?.specularResponse,
        0.5,
    );
    const daylight = clamp01(
        unifiedIllumination?.diurnalPhase ?? safeChannels.diurnalPhase,
        0.5,
    );

    return {
        cloudiness,
        windIntensity,
        gustEnvelope,
        waveEnergy,
        roughness,
        specularResponse,
        daylight,
    };
};

export const createPixiWaterTemporalProjection = () => {
    const state = {
        phase: 0,
        microPhase: 1.7,
        flowRate: 0.52,
        flowTransport: 0.22,
        yoonseulRate: 0.56,
        turbulencePulse: 1,
        sunlightBreathing: 1,
        highlightLowBand: 0.5,
        highlightMicroBand: 0.5,
        glintStability: 0.62,
        flickerDrive: 0.42,
        climateExcitation: 0.5,
        shimmerExcitation: 0.5,
    };

    const update = ({
        deltaMs = FRAME_MS_BASE,
        frameState = null,
        frameChannels = null,
    } = {}) => {
        const dtSec = clampValue(toFinite(deltaMs, FRAME_MS_BASE) * 0.001, 0.004, 0.0666667);
        const {
            cloudiness,
            windIntensity,
            gustEnvelope,
            waveEnergy,
            roughness,
            specularResponse,
            daylight,
        } = resolveTemporalInputs({
            frameState,
            frameChannels,
        }) || {
            cloudiness: 0.5,
            windIntensity: 0.4,
            gustEnvelope: 0.46,
            waveEnergy: 0.5,
            roughness: 0.5,
            specularResponse: 0.5,
            daylight: 0.5,
        };

        const climateExcitationTarget = clamp01(
            windIntensity * 0.32
            + gustEnvelope * 0.24
            + waveEnergy * 0.34
            + cloudiness * 0.22,
            0.5,
        );
        const shimmerExcitationTarget = clamp01(
            specularResponse * 0.42
            + (1 - roughness) * 0.28
            + waveEnergy * 0.3,
            0.5,
        );
        state.climateExcitation = expSmooth(state.climateExcitation, climateExcitationTarget, dtSec, 1.8);
        state.shimmerExcitation = expSmooth(state.shimmerExcitation, shimmerExcitationTarget, dtSec, 1.6);

        const flowRateTarget = clampValue(
            0.34 + waveEnergy * 0.42 + windIntensity * 0.1 + gustEnvelope * 0.08,
            0.2,
            1.24,
        );
        const flowTransportTarget = clampValue(
            0.12 + waveEnergy * 0.18 + windIntensity * 0.05 + gustEnvelope * 0.09,
            0.08,
            0.48,
        );
        const yoonseulRateTarget = clampValue(
            0.36 + specularResponse * 0.5 + (1 - roughness) * 0.16,
            0.28,
            1.3,
        );
        state.flowRate = expSmooth(state.flowRate, flowRateTarget, dtSec, 1.6);
        state.flowTransport = expSmooth(state.flowTransport, flowTransportTarget, dtSec, 1.7);
        state.yoonseulRate = expSmooth(state.yoonseulRate, yoonseulRateTarget, dtSec, 1.5);

        state.phase += dtSec * (0.34 + windIntensity * 0.28 + waveEnergy * 0.24);
        state.microPhase += dtSec * (0.8 + state.yoonseulRate * 0.54 + waveEnergy * 0.36);

        const turbulenceTarget = clampValue(
            0.9
            + gustEnvelope * 0.1
            + Math.sin(state.phase * 0.9) * (0.06 + windIntensity * 0.08 + gustEnvelope * 0.08),
            0.72,
            1.28,
        );
        state.turbulencePulse = expSmooth(state.turbulencePulse, turbulenceTarget, dtSec, 0.8);

        const breathingTarget = clampValue(
            1 + Math.sin(state.phase * 0.37) * (0.008 + cloudiness * 0.018) * (0.76 + daylight * 0.24),
            0.92,
            1.08,
        );
        state.sunlightBreathing = expSmooth(state.sunlightBreathing, breathingTarget, dtSec, 2.6);

        const lowBandTarget = clampValue(
            0.38
            + Math.sin(state.phase * 1.1) * 0.2
            + (1 - cloudiness) * 0.12,
            0.06,
            0.94,
        );
        const microBandTarget = clampValue(
            0.34
            + Math.sin(state.microPhase * 1.7 + 1.2) * 0.24
            + waveEnergy * 0.1,
            0.04,
            0.98,
        );
        state.highlightLowBand = expSmooth(state.highlightLowBand, lowBandTarget, dtSec, 0.6);
        state.highlightMicroBand = expSmooth(state.highlightMicroBand, microBandTarget, dtSec, 0.46);

        const glintStabilityTarget = clampValue(
            0.6
            + (1 - windIntensity) * 0.14
            + (1 - waveEnergy) * 0.08
            - gustEnvelope * 0.12
            - cloudiness * 0.08,
            0.24,
            0.96,
        );
        state.glintStability = expSmooth(state.glintStability, glintStabilityTarget, dtSec, 1.0);
        const flickerTarget = clampValue(
            0.16 + (1 - state.glintStability) * 0.4 + (1 - daylight) * 0.08,
            0.08,
            0.92,
        );
        state.flickerDrive = expSmooth(state.flickerDrive, flickerTarget, dtSec, 0.8);

        return {
            flowRate: state.flowRate,
            flowTransport: state.flowTransport,
            yoonseulRate: state.yoonseulRate,
            turbulencePulse: state.turbulencePulse,
            directionalDrift: 0,
            directionalAngle: 0,
            sunlightBreathing: state.sunlightBreathing,
            highlightLowBand: state.highlightLowBand,
            highlightMicroBand: state.highlightMicroBand,
            glintStability: state.glintStability,
            flickerDrive: state.flickerDrive,
            climateExcitation: state.climateExcitation,
            shimmerExcitation: state.shimmerExcitation,
        };
    };

    const reset = () => {
        state.phase = 0;
        state.microPhase = 1.7;
        state.flowRate = 0.52;
        state.flowTransport = 0.22;
        state.yoonseulRate = 0.56;
        state.turbulencePulse = 1;
        state.sunlightBreathing = 1;
        state.highlightLowBand = 0.5;
        state.highlightMicroBand = 0.5;
        state.glintStability = 0.62;
        state.flickerDrive = 0.42;
        state.climateExcitation = 0.5;
        state.shimmerExcitation = 0.5;
    };

    const dispose = () => { };

    return {
        update,
        reset,
        dispose,
    };
};
