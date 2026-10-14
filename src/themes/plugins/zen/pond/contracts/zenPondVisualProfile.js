export const ZEN_POND_VISUAL_PROFILE_CONTRACT =
    'entropy.zen.pond-visual-profile';
export const ZEN_POND_VISUAL_PROFILE_VERSION = 1;

export const ZEN_POND_VISUAL_PROFILE_AXES = Object.freeze({
    FLOOR: 'floor',
    PLANTS: 'plants',
    ROCKS: 'rocks',
    SUNLIGHT: 'sunlight',
});

export const ZEN_POND_FLOOR_PROFILES = Object.freeze({
    PRODUCT: 'product',
    MINERAL_AIRY: 'mineral_airy',
    NEUTRAL_DEPTH: 'neutral_depth',
});

export const ZEN_POND_PLANT_PROFILES = Object.freeze({
    PRODUCT: 'product',
    BOTANICAL: 'botanical',
});

export const ZEN_POND_ROCK_PROFILES = Object.freeze({
    PRODUCT: 'product',
    NATURAL: 'natural',
    GROUNDED: 'grounded',
    ISHIGUMI: 'ishigumi',
});

export const ZEN_POND_SUNLIGHT_PROFILES = Object.freeze({
    PRODUCT: 'product',
    LACY_CONNECTED: 'lacy_connected',
});

const PROFILE_OPTIONS = Object.freeze({
    [ZEN_POND_VISUAL_PROFILE_AXES.FLOOR]: Object.freeze(
        Object.values(ZEN_POND_FLOOR_PROFILES),
    ),
    [ZEN_POND_VISUAL_PROFILE_AXES.PLANTS]: Object.freeze(
        Object.values(ZEN_POND_PLANT_PROFILES),
    ),
    [ZEN_POND_VISUAL_PROFILE_AXES.ROCKS]: Object.freeze(
        Object.values(ZEN_POND_ROCK_PROFILES),
    ),
    [ZEN_POND_VISUAL_PROFILE_AXES.SUNLIGHT]: Object.freeze(
        Object.values(ZEN_POND_SUNLIGHT_PROFILES),
    ),
});

const PROFILE_AXIS_IDS = Object.freeze(
    Object.values(ZEN_POND_VISUAL_PROFILE_AXES),
);

export const DEFAULT_ZEN_POND_VISUAL_PROFILE = Object.freeze({
    floor: ZEN_POND_FLOOR_PROFILES.PRODUCT,
    plants: ZEN_POND_PLANT_PROFILES.PRODUCT,
    rocks: ZEN_POND_ROCK_PROFILES.PRODUCT,
    sunlight: ZEN_POND_SUNLIGHT_PROFILES.PRODUCT,
});

const fail = (detail) => {
    throw new Error(`ZEN_POND_VISUAL_PROFILE_INVALID:${detail}`);
};

export const listZenPondVisualProfileAxes = () => PROFILE_AXIS_IDS.map(
    (id) => Object.freeze({
        id,
        options: PROFILE_OPTIONS[id],
    }),
);

export const requireZenPondVisualProfile = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        fail('record_required');
    }
    const keys = Object.keys(candidate);
    if (
        keys.length !== PROFILE_AXIS_IDS.length
        || keys.some((key) => !PROFILE_AXIS_IDS.includes(key))
    ) {
        fail('axes_exact');
    }
    const profile = {};
    PROFILE_AXIS_IDS.forEach((axisId) => {
        const optionId = candidate[axisId];
        if (!PROFILE_OPTIONS[axisId].includes(optionId)) {
            fail(`${axisId}:${String(optionId)}`);
        }
        profile[axisId] = optionId;
    });
    return Object.freeze(profile);
};

export const patchZenPondVisualProfile = (current, patch) => {
    const baseline = requireZenPondVisualProfile(current);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        fail('patch_record_required');
    }
    const patchKeys = Object.keys(patch);
    if (
        patchKeys.length < 1
        || patchKeys.some((key) => !PROFILE_AXIS_IDS.includes(key))
    ) {
        fail('patch_axes');
    }
    return requireZenPondVisualProfile({
        ...baseline,
        ...patch,
    });
};

export const buildZenPondVisualProfileSignature = (candidate) => {
    const profile = requireZenPondVisualProfile(candidate);
    return [
        ZEN_POND_VISUAL_PROFILE_CONTRACT,
        ZEN_POND_VISUAL_PROFILE_VERSION,
        ...PROFILE_AXIS_IDS.map((axisId) => `${axisId}:${profile[axisId]}`),
    ].join('|');
};

export const buildZenPondVisualProfileSnapshot = (candidate) => Object.freeze({
    contract: ZEN_POND_VISUAL_PROFILE_CONTRACT,
    version: ZEN_POND_VISUAL_PROFILE_VERSION,
    profile: requireZenPondVisualProfile(candidate),
});

export const requireZenPondVisualProfileSnapshot = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        fail('snapshot_record_required');
    }
    const keys = Object.keys(candidate);
    if (
        keys.length !== 3
        || !keys.includes('contract')
        || !keys.includes('version')
        || !keys.includes('profile')
    ) {
        fail('snapshot_shape');
    }
    if (candidate.contract !== ZEN_POND_VISUAL_PROFILE_CONTRACT) {
        fail(`snapshot_contract:${String(candidate.contract)}`);
    }
    if (candidate.version !== ZEN_POND_VISUAL_PROFILE_VERSION) {
        fail(`snapshot_version:${String(candidate.version)}`);
    }
    return buildZenPondVisualProfileSnapshot(candidate.profile);
};
