import { createDefaultSignalTuning } from '@/themes/core/data/signalTuning.js';

export const ZEN_POND_TUNING_CONTRACT_VERSION = 1;

const isPlainObject = (value) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const ZEN_POND_RUNTIME_CAUSE_KEYS = Object.freeze([
    'sceneBonsaiBloomRatio',
    'sceneBonsaiBudSignal',
    'sceneBonsaiLeafBudSignal',
    'sceneBonsaiPetalCapacity',
    'sceneBonsaiPetalFallLimit',
    'sceneBonsaiPreviewPetalRate',
    'sceneBonsaiRippleVitality',
]);

export const projectZenPondTuningV1 = (candidate = null, baseState = null) => {
    const fallback = createDefaultSignalTuning();
    const base = isPlainObject(baseState) ? baseState : fallback;
    const source = isPlainObject(candidate) ? candidate : {};
    const sourcePhysics = isPlainObject(source.physics) ? source.physics : {};
    const basePhysics = isPlainObject(base.physics) ? base.physics : fallback.physics;
    const projected = Object.keys(fallback).reduce((acc, key) => {
        if (key === 'physics') return acc;
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            acc[key] = source[key];
        } else if (Object.prototype.hasOwnProperty.call(base, key)) {
            acc[key] = base[key];
        } else {
            acc[key] = fallback[key];
        }
        return acc;
    }, {});
    ZEN_POND_RUNTIME_CAUSE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            projected[key] = source[key];
        }
    });
    return {
        ...projected,
        physics: {
            ...fallback.physics,
            ...basePhysics,
            ...sourcePhysics,
        },
        waterSurfaceContractVersion: ZEN_POND_TUNING_CONTRACT_VERSION,
    };
};

export const requireZenPondTuningV1 = (candidate) => {
    if (!isPlainObject(candidate)) {
        throw new Error('ZEN_POND_TUNING_STATE_INVALID');
    }
    if (candidate.waterSurfaceContractVersion !== ZEN_POND_TUNING_CONTRACT_VERSION) {
        throw new Error(
            `ZEN_POND_TUNING_CONTRACT_VERSION_INVALID:${candidate.waterSurfaceContractVersion ?? 'missing'}`,
        );
    }
    if (!isPlainObject(candidate.physics)) {
        throw new Error('ZEN_POND_TUNING_PHYSICS_STATE_INVALID');
    }
    return candidate;
};
