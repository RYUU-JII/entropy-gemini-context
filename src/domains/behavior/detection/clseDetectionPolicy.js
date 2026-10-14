import { CLSE_CONSTANTS } from '../clseSchema.js';

export const CLSE_DETECTION_POLICY_VERSION = 'clse_detection_sensitivity_v1';

const CLSE_DETECTION_POLICY_KEYS = Object.freeze([
    'policyVersion',
    'sensitivityScale',
]);

function hasExactKeys(value, expectedKeys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort();
    const expected = [...expectedKeys].sort();
    return keys.length === expected.length
        && keys.every((key, index) => key === expected[index]);
}

function requireSensitivityScale(value) {
    if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || value < CLSE_CONSTANTS.SENSITIVITY_SCALE_MIN
        || value > CLSE_CONSTANTS.SENSITIVITY_SCALE_MAX
    ) {
        throw new Error('CLSE_DETECTION_POLICY_INVALID:sensitivityScale');
    }
    return value;
}

/**
 * Build the exact prescriptive policy passed from CLSEService to detectors.
 * A larger scale always raises decision thresholds; a smaller scale lowers
 * them. Descriptive baseline evidence is deliberately absent from this DTO.
 */
export function createCLSEDetectionPolicy({ sensitivityScale } = {}) {
    return Object.freeze({
        policyVersion: CLSE_DETECTION_POLICY_VERSION,
        sensitivityScale: requireSensitivityScale(sensitivityScale),
    });
}

export function requireCanonicalCLSEDetectionPolicy(value) {
    if (!hasExactKeys(value, CLSE_DETECTION_POLICY_KEYS)) {
        throw new Error('CLSE_DETECTION_POLICY_INVALID:shape');
    }
    if (value.policyVersion !== CLSE_DETECTION_POLICY_VERSION) {
        throw new Error('CLSE_DETECTION_POLICY_INVALID:policyVersion');
    }
    requireSensitivityScale(value.sensitivityScale);
    return value;
}

export function resolveCLSEDetectionThreshold(baseThreshold, detectionPolicy) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    if (typeof baseThreshold !== 'number' || !Number.isFinite(baseThreshold) || baseThreshold <= 0) {
        throw new Error('CLSE_DETECTION_THRESHOLD_INVALID');
    }
    return baseThreshold * policy.sensitivityScale;
}

export function resolveCLSEPositiveZThresholdBand({
    zStart,
    zEnd,
    detectionPolicy,
}) {
    if (
        typeof zStart !== 'number'
        || !Number.isFinite(zStart)
        || zStart <= 0
        || typeof zEnd !== 'number'
        || !Number.isFinite(zEnd)
        || zEnd <= zStart
    ) {
        throw new Error('CLSE_DETECTION_Z_THRESHOLD_BAND_INVALID');
    }
    return {
        zStart: resolveCLSEDetectionThreshold(zStart, detectionPolicy),
        zEnd: resolveCLSEDetectionThreshold(zEnd, detectionPolicy),
    };
}
