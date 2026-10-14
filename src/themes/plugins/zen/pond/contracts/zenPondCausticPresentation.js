export const ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS = Object.freeze({
    DAYLIGHT_HYSTERESIS: 'daylight_hysteresis_v1',
    CONNECTED_SUNWEB: 'connected_sunweb_v1',
});

export const ZEN_POND_CAUSTIC_RECEIVER_MODEL_IDS = Object.freeze({
    BATHYMETRY_DEPTH_NORMAL:
        'bathymetry_depth_normal_receiver_v1',
});

export const ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID =
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS.DAYLIGHT_HYSTERESIS;

const ZEN_POND_CAUSTIC_PRESENTATION_SUPPORTED_MODEL_IDS = Object.freeze(
    Object.values(ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS),
);
const ZEN_POND_CAUSTIC_RECEIVER_SUPPORTED_MODEL_IDS = Object.freeze(
    Object.values(ZEN_POND_CAUSTIC_RECEIVER_MODEL_IDS),
);

// Presentation strength is 1.4x the original projection, and the gates carry
// the identical factor so the light level at which caustics appear is
// unchanged. The original ceiling was set against a focus term that measured
// zero over the whole ambient field; now that the ramp sits in the real
// curvature range, the separate core response owns the local contrast lift.
// Keep this submitted-strength calibration and its admission thresholds stable.
export const ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_SCALE =
    0.105;
export const ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_CAP =
    0.119;
export const ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF =
    0.0154;
export const ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON =
    0.0196;

// The cheap product projection reads curvature encoded with field-texel².
// Its focus response is calibrated at the original 384 x 216 field, so a
// responsive square or another explicit quality must undo that metric first.
export const ZEN_POND_CAUSTIC_FOCUS_RESPONSE = Object.freeze({
    referenceFieldHeight: 216,
    ridgeStart: 0.006,
    ridgeEnd: 0.024,
    coreStart: 0.32,
    coreEnd: 0.82,
    coreWeight: 1.364,
    haloWeight: 0.12,
});

export const resolveZenPondCausticCurvatureScale = (fieldHeight) => {
    if (!Number.isFinite(fieldHeight) || fieldHeight <= 0) {
        throw new Error('ZEN_BENTHIC_CAUSTIC_FIELD_HEIGHT_INVALID');
    }
    const metricScale = fieldHeight / ZEN_POND_CAUSTIC_FOCUS_RESPONSE.referenceFieldHeight;
    return metricScale * metricScale;
};

export const resolveZenPondCausticPresentationGate = ({
    previousVisible = null,
    requestedStrength = 0,
} = {}) => {
    if (
        previousVisible !== null
        && previousVisible !== true
        && previousVisible !== false
    ) {
        throw new Error(
            'ZEN_POND_CAUSTIC_PRESENTATION_GATE_STATE_INVALID',
        );
    }
    const strength = Number(requestedStrength);
    if (!Number.isFinite(strength) || strength < 0) {
        throw new Error(
            'ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_INVALID',
        );
    }
    let visible = previousVisible;
    if (visible === null) {
        visible =
            strength >= ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON;
    } else if (
        visible === true
        && strength < ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF
    ) {
        visible = false;
    } else if (
        visible === false
        && strength >= ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON
    ) {
        visible = true;
    }
    return Object.freeze({
        visible,
        suppressed: visible !== true,
        transitioned: (
            previousVisible !== null
            && previousVisible !== visible
        ),
    });
};

export const readZenPondCausticPresentationModelId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error(
                'ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID_MISSING',
            );
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error(
            'ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID_TYPE_INVALID',
        );
    }
    if (!ZEN_POND_CAUSTIC_PRESENTATION_SUPPORTED_MODEL_IDS.includes(value)) {
        throw new Error(
            'ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID_UNSUPPORTED:'
            + value,
        );
    }
    return value;
};

export const readZenPondCausticReceiverModelId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error(
                'ZEN_POND_CAUSTIC_RECEIVER_MODEL_ID_MISSING',
            );
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error(
            'ZEN_POND_CAUSTIC_RECEIVER_MODEL_ID_TYPE_INVALID',
        );
    }
    if (!ZEN_POND_CAUSTIC_RECEIVER_SUPPORTED_MODEL_IDS.includes(value)) {
        throw new Error(
            'ZEN_POND_CAUSTIC_RECEIVER_MODEL_ID_UNSUPPORTED:'
            + value,
        );
    }
    return value;
};
