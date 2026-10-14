import { compileCanonicalSakuraPhenotype } from './SakuraLatentAdapter';
import {
    SAKURA_CANONICAL_LATENT_KEYS,
} from './SakuraLatentParamApi';
import {
    validateSakuraLatent,
} from './SakuraLatentSchema';
import { SAKURA_LATENT_TIER_GROUPS } from './SakuraLatentTierRegistry';

const SAKURA_PROFILE_ID = 'sakura';
const SAKURA_COMPILER_VERSION = 1;

const SAKURA_LATENT_GROUPS = SAKURA_LATENT_TIER_GROUPS;

const validateProfileLatent = (
    latent,
    {
        code = 'SAKURA_SPECIES_PROFILE_LATENT_INVALID',
        label = 'Sakura species profile latent',
        details = null,
    } = {},
) => (
    validateSakuraLatent(latent, {
        code,
        label,
        details,
    })
);

const compilePhenotypeFromLatent = (latent) => (
    compileCanonicalSakuraPhenotype(validateProfileLatent(latent))
);

export const SAKURA_SPECIES_PROFILE = Object.freeze({
    id: SAKURA_PROFILE_ID,
    treeType: 'sakura',
    latentSpace: 'canonical_v2',
    compilerVersion: SAKURA_COMPILER_VERSION,
    latentGroups: SAKURA_LATENT_GROUPS,
    latentKeyCount: SAKURA_CANONICAL_LATENT_KEYS.length,
    validateLatent: validateProfileLatent,
    compileCanonicalPhenotype: compileCanonicalSakuraPhenotype,
    compilePhenotypeFromLatent,
});

const SAKURA_PROFILE_REGISTRY = Object.freeze({
    [SAKURA_PROFILE_ID]: SAKURA_SPECIES_PROFILE,
});

export const resolveSakuraSpeciesProfile = (profileId = SAKURA_PROFILE_ID) => {
    const resolvedProfileId = typeof profileId === 'string' && profileId.trim()
        ? profileId.trim()
        : SAKURA_PROFILE_ID;
    const profile = SAKURA_PROFILE_REGISTRY[resolvedProfileId];
    if (profile) {
        return profile;
    }
    throw new Error(`Unknown Sakura species profile: ${resolvedProfileId}`);
};

export const listSakuraSpeciesProfiles = () => Object.values(SAKURA_PROFILE_REGISTRY);

export const getSakuraSpeciesProfileSummary = (profileId = SAKURA_PROFILE_ID) => {
    const profile = resolveSakuraSpeciesProfile(profileId);
    const groupSizes = Object.entries(profile.latentGroups).reduce((acc, [groupId, keys]) => {
        acc[groupId] = Array.isArray(keys) ? keys.length : 0;
        return acc;
    }, {});
    return {
        id: profile.id,
        treeType: profile.treeType,
        latentSpace: profile.latentSpace,
        compilerVersion: profile.compilerVersion,
        latentKeyCount: profile.latentKeyCount,
        groupSizes,
    };
};
