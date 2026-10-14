import { clamp as clampValue } from '../../../../model/koi/koiMotion.js';
import {
    toRgbHex,
} from '../../../../runtime/zenColorMath.js';
import {
    wrapWithMargin,
} from '../../pixiWaterEffectsMath.js';

const DRIFTING_MIST_LAYER_ALPHA_SCALE = 0.62;

export const updateAtmospherePass = ({
    frame,
    deltaFrames,
    sharedChannels,
    veilTint,
    hazeTint,
    veilBaseAlpha,
    hazeBaseAlpha,
    hazeAntiBloom,
    veilOpacityScale,
    hazeOpacityScale,
    mirrorStrength,
    unifiedTurbidity,
    unifiedScatter,
    clearNoonSuppression,
    atmosphereOpacityScale,
    atmosphereGate,
    sunAngle,
    temporalDirectionalAngle,
    temporalDirectionalDrift,
    temporalFlowTransport,
    unifiedWindIntensity,
    atmosphereDriftState,
    mistTextureSize,
    waterAtmosphereSprite,
}) => {
    const airHaze = Number(sharedChannels.frameEnv.airHaze);
    if (!Number.isFinite(airHaze)) throw new Error('ZEN_AIR_HAZE_REQUIRED');
    const tint = sharedChannels.sceneChromaChannels;
    // Airborne haze has its own weather cause; water turbidity stays below
    // the surface and cannot create a fog layer over the whole scene.
    waterAtmosphereSprite.tint = toRgbHex(tint.r, tint.g, tint.b);
    waterAtmosphereSprite.alpha = clampValue(airHaze * 0.14, 0, 0.11)
        * atmosphereOpacityScale * atmosphereGate * DRIFTING_MIST_LAYER_ALPHA_SCALE;
    const atmosphereFlowAngle = (sunAngle * 0.18) + (temporalDirectionalAngle * 0.52) + (temporalDirectionalDrift * 1.1);
    const atmosphereFlowSpeed = 0.08 + temporalFlowTransport * 0.2 + unifiedWindIntensity * 0.1;
    const driftState = atmosphereDriftState && typeof atmosphereDriftState === 'object'
        ? atmosphereDriftState
        : null;
    let driftX = (Math.cos(atmosphereFlowAngle) * frame * atmosphereFlowSpeed);
    let driftY = (Math.sin(atmosphereFlowAngle) * frame * atmosphereFlowSpeed);
    if (driftState) {
        const nextDriftX = wrapWithMargin(
            (Number(driftState.x) || 0) + (Math.cos(atmosphereFlowAngle) * atmosphereFlowSpeed * deltaFrames),
            mistTextureSize,
            0,
        );
        const nextDriftY = wrapWithMargin(
            (Number(driftState.y) || 0) + (Math.sin(atmosphereFlowAngle) * atmosphereFlowSpeed * deltaFrames),
            mistTextureSize,
            0,
        );
        driftState.x = nextDriftX;
        driftState.y = nextDriftY;
        driftX = nextDriftX;
        driftY = nextDriftY;
    }
    waterAtmosphereSprite.tilePosition.set(
        wrapWithMargin(
            driftX
            + Math.sin(frame * 0.00023 + 1.1) * 11,
            mistTextureSize,
            0,
        ),
        wrapWithMargin(
            driftY
            + Math.cos(frame * 0.00019 + 0.3) * 9,
            mistTextureSize,
            0,
        ),
    );
    return {
        atmosphereAlpha: waterAtmosphereSprite.alpha,
    };
};
