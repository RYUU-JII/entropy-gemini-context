import {
    PERSONAL_BASELINE_REFERENCE_MODES,
    PERSONAL_BASELINE_STATUSES,
} from '../../../lib/personalBaselineContract.js';

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export function requireCLSEDetectorReference(baselineManager, grain) {
    if (!baselineManager || typeof baselineManager.getStatusSummary !== 'function') {
        throw new Error('CLSE_DETECTOR_BASELINE_MANAGER_REQUIRED');
    }
    const summary = baselineManager.getStatusSummary();
    const profile = Array.isArray(summary?.profiles)
        ? summary.profiles.find((entry) => entry?.grain === grain)
        : null;
    if (
        !profile
        || !Object.values(PERSONAL_BASELINE_STATUSES).includes(profile.status)
        || !Number.isSafeInteger(summary.resetEpoch)
        || summary.resetEpoch <= 0
    ) {
        throw new Error(`CLSE_DETECTOR_BASELINE_STATUS_INVALID:${String(grain)}`);
    }
    return {
        referenceMode: profile.status === PERSONAL_BASELINE_STATUSES.STABLE
            ? PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
            : PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY,
        baselineStatus: profile.status,
        baselineGrain: profile.grain,
        baselineResetEpoch: summary.resetEpoch,
    };
}

export function resolvePositiveZLift({
    referenceMode,
    zScores,
    zStart,
    zEnd,
    maxLift,
    evidenceCount = 1,
}) {
    if (referenceMode === PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY) {
        return { adaptiveLift: 0, positiveEvidenceCount: 0 };
    }
    if (referenceMode !== PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE) {
        throw new Error('CLSE_DETECTOR_REFERENCE_MODE_INVALID');
    }
    if (
        !Array.isArray(zScores)
        || zScores.length === 0
        || zScores.some((value) => !Number.isFinite(value))
        || !Number.isFinite(zStart)
        || !Number.isFinite(zEnd)
        || zEnd <= zStart
        || !Number.isFinite(maxLift)
        || maxLift < 0
        || !Number.isSafeInteger(evidenceCount)
        || evidenceCount < 1
        || evidenceCount > zScores.length
    ) {
        throw new Error('CLSE_DETECTOR_ADAPTIVE_LIFT_INPUT_INVALID');
    }

    const evidence = zScores
        .map((zScore) => clamp01((zScore - zStart) / (zEnd - zStart)))
        .sort((a, b) => b - a)
        .slice(0, evidenceCount);
    const adaptiveEvidence = evidence.reduce((sum, value) => sum + value, 0)
        / evidence.length;
    return {
        adaptiveLift: Math.min(maxLift, maxLift * adaptiveEvidence),
        positiveEvidenceCount: zScores.filter((zScore) => zScore > zStart).length,
    };
}
