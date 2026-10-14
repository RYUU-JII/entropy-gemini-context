import {
    DEFAULT_ZEN_WORLD_ID,
} from '../../../runtime/environment/zenWorldEnvironmentAuthority.js';

export const ZEN_POND_WORLD_IDS = Object.freeze({
    ZEN_POND: DEFAULT_ZEN_WORLD_ID,
    COSMIC_KOI: 'cosmic_koi',
});

export const DEFAULT_ZEN_POND_WORLD_ID = ZEN_POND_WORLD_IDS.ZEN_POND;

const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
    return value;
};

const WORLD_PROFILE_DEFINITIONS = [
    {
        id: ZEN_POND_WORLD_IDS.ZEN_POND,
        label: 'Zen Pond',
        background: {
            driver: 'pond_water',
        },
        render: {
            entities: {
                fish: 'enabled',
                rocks: 'enabled',
                lilyPads: 'enabled',
                waterLilies: 'enabled',
                irises: 'enabled',
                particles: 'enabled',
                ripples: 'enabled',
                petals: 'enabled',
                glimmers: 'enabled',
            },
            effects: {
                waterBase: 'enabled',
                waterDepth: 'enabled',
                waterRefraction: 'enabled',
                waterSurface: 'enabled',
                waterCaustics: 'enabled',
                waterHighlights: 'enabled',
                topShadow: 'enabled',
                benthicAo: 'enabled',
            },
            materials: {
                fishLighting: 'pond',
                fishShadow: 'enabled',
            },
        },
        simulation: {
            fish: 'enabled',
            ambientEntities: 'enabled',
            plantMotion: 'enabled',
            waterMotion: 'enabled',
            particles: 'enabled',
        },
    },
    {
        id: ZEN_POND_WORLD_IDS.COSMIC_KOI,
        label: 'Cosmic Koi',
        background: {
            driver: 'cosmic_space',
        },
        render: {
            entities: {
                fish: 'enabled',
                rocks: 'disabled',
                lilyPads: 'disabled',
                waterLilies: 'disabled',
                irises: 'disabled',
                particles: 'disabled',
                ripples: 'disabled',
                petals: 'disabled',
                glimmers: 'stars',
            },
            effects: {
                waterBase: 'disabled',
                waterDepth: 'disabled',
                waterRefraction: 'disabled',
                waterSurface: 'disabled',
                waterCaustics: 'disabled',
                waterHighlights: 'disabled',
                topShadow: 'disabled',
                benthicAo: 'disabled',
            },
            materials: {
                fishLighting: 'cosmic',
                fishShadow: 'disabled',
            },
        },
        simulation: {
            fish: 'enabled',
            ambientEntities: 'disabled',
            plantMotion: 'disabled',
            waterMotion: 'disabled',
            particles: 'stars',
        },
    },
].map((profile) => deepFreeze(profile));

const WORLD_PROFILE_MAP = new Map(
    WORLD_PROFILE_DEFINITIONS.map((profile) => [profile.id, profile]),
);
const WORLD_POLICY_MAP = new Map();

const normalizeWorldIdToken = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

export const normalizeZenPondWorldId = (
    value,
    fallback = DEFAULT_ZEN_POND_WORLD_ID,
) => {
    const raw = normalizeWorldIdToken(value);
    if (!raw) return fallback;
    if (WORLD_PROFILE_MAP.has(raw)) return raw;
    throw new Error(`Unknown zen pond world profile: ${raw}`);
};

export const resolveZenPondWorldProfile = (
    worldId = DEFAULT_ZEN_POND_WORLD_ID,
) => {
    const normalizedWorldId = normalizeZenPondWorldId(worldId);
    return WORLD_PROFILE_MAP.get(normalizedWorldId);
};

const resolveWorldProfileInput = (profileOrId = DEFAULT_ZEN_POND_WORLD_ID) => {
    if (profileOrId && typeof profileOrId === 'object') {
        return resolveZenPondWorldProfile(profileOrId.id);
    }
    return resolveZenPondWorldProfile(profileOrId);
};

const isEnabled = (value) => value !== false && value !== 'disabled';

const normalizeStateMap = (source = null) => {
    const safeSource = source && typeof source === 'object' ? source : {};
    return Object.freeze(
        Object.fromEntries(
            Object.entries(safeSource).map(([key, value]) => [key, isEnabled(value)]),
        ),
    );
};

export const resolveZenPondWorldPolicy = (
    profileOrId = DEFAULT_ZEN_POND_WORLD_ID,
) => {
    const profile = resolveWorldProfileInput(profileOrId);
    const cached = WORLD_POLICY_MAP.get(profile.id);
    if (cached) return cached;
    const policy = {
        id: profile.id,
        backgroundDriver: profile.background.driver,
        render: {
            entities: normalizeStateMap(profile.render.entities),
            effects: normalizeStateMap(profile.render.effects),
            materials: Object.freeze({
                fishLighting: profile.render.materials.fishLighting,
                fishShadow: isEnabled(profile.render.materials.fishShadow),
            }),
        },
        simulation: normalizeStateMap(profile.simulation),
    };
    const frozenPolicy = deepFreeze(policy);
    WORLD_POLICY_MAP.set(profile.id, frozenPolicy);
    return frozenPolicy;
};

export const isZenPondWorldEntityEnabled = (
    policyOrProfileOrId = DEFAULT_ZEN_POND_WORLD_ID,
    entityKey = '',
) => {
    const policy = resolveZenPondWorldPolicy(policyOrProfileOrId);
    return policy?.render?.entities?.[entityKey] !== false;
};

export const isZenPondWorldSimulationEnabled = (
    policyOrProfileOrId = DEFAULT_ZEN_POND_WORLD_ID,
    simulationKey = '',
) => {
    const policy = resolveZenPondWorldPolicy(policyOrProfileOrId);
    return policy?.simulation?.[simulationKey] !== false;
};

export const ZEN_POND_WORLD_PROFILES = Object.freeze(
    WORLD_PROFILE_DEFINITIONS.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {}),
);
