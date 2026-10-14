import { resolveSakuraSpeciesProfile } from './SakuraSpeciesProfiles';

export const compileSakuraPhenotypeFromLatent = (
    latent = null,
    _basePhenotype = null,
    options = {},
) => {
    const profileId = options?.profileId || options?.speciesId || 'sakura';
    const profile = resolveSakuraSpeciesProfile(profileId);
    const canonicalLatent = profile.validateLatent(latent, {
        code: 'SAKURA_COMPILER_LATENT_INVALID',
        label: 'Sakura compiler latent',
        details: {
            profileId: profile.id,
        },
    });
    return profile.compileCanonicalPhenotype(canonicalLatent);
};

export const compileSakuraCandidateFromLatent = ({
    latent = null,
    _basePhenotype = null,
    profileId = 'sakura',
} = {}) => {
    const profile = resolveSakuraSpeciesProfile(profileId);
    const canonicalLatent = profile.validateLatent(latent, {
        code: 'SAKURA_COMPILER_LATENT_INVALID',
        label: 'Sakura compiler latent',
        details: {
            profileId: profile.id,
        },
    });
    const phenotype = profile.compileCanonicalPhenotype(canonicalLatent);
    return {
        profileId: profile.id,
        treeType: profile.treeType,
        latentSpace: profile.latentSpace,
        compilerVersion: profile.compilerVersion,
        latent: canonicalLatent,
        phenotype,
    };
};
