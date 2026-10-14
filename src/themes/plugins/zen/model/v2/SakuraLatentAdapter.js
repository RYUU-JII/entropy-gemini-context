import {
    Phenotype_FACTOR_DEFS,
    DEFAULT_SAKURA_Phenotype,
    clampPhenotype,
} from '../BonsaiGenetics';
import { validateSakuraLatent } from './SakuraLatentSchema';
import {
    compileTrunkTierPhenotypeOverrides,
    compileScaffoldTierPhenotypeOverrides,
    compileTwigTierPhenotypeOverrides,
    compileCanopyTierPhenotypeOverrides,
} from './SakuraLatentTierCompilers';
import { createSakuraLatentCompileContext } from './SakuraLatentCompileContext';

const clampByPhenotypeKey = (key, value) => {
    const def = Phenotype_FACTOR_DEFS[key];
    if (!def) {
        return value;
    }
    const clamped = Math.min(def.max, Math.max(def.min, value));
    return def.integer ? Math.round(clamped) : Number(clamped);
};

export const compileCanonicalSakuraPhenotype = (
    latent,
    _basePhenotype = DEFAULT_SAKURA_Phenotype,
) => {
    const base = clampPhenotype(DEFAULT_SAKURA_Phenotype);
    const adapterContext = createSakuraLatentCompileContext({
        latent,
        clampByPhenotypeKey,
    });
    const overrides = {
        ...compileTrunkTierPhenotypeOverrides(adapterContext),
        ...compileScaffoldTierPhenotypeOverrides(adapterContext),
        ...compileTwigTierPhenotypeOverrides(adapterContext),
        ...compileCanopyTierPhenotypeOverrides(adapterContext),
    };

    return clampPhenotype({
        ...base,
        ...overrides,
    });
};

export const latentToSakuraPhenotype = (
    latentInput,
    _basePhenotype = DEFAULT_SAKURA_Phenotype,
    {
        validationCode = 'SAKURA_LATENT_ADAPTER_LATENT_INVALID',
        validationLabel = 'Sakura latent adapter latent',
        validationDetails = null,
    } = {},
) => {
    const latent = validateSakuraLatent(latentInput, {
        code: validationCode,
        label: validationLabel,
        details: validationDetails,
    });
    return compileCanonicalSakuraPhenotype(latent, _basePhenotype);
};
