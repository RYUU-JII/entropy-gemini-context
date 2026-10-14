import { compileSakuraPhenotypeFromLatent } from './SakuraCompiler';
import { validateSakuraLatent } from './SakuraLatentSchema';

export const SAKURA_ALIGNMENT_THRESHOLD = 0;

export const reconcileSakuraPhenotypeAndLatent = ({
    latent = null,
} = {}) => {
    const hasLatent = Boolean(latent && typeof latent === 'object');
    if (!hasLatent) {
        return {
            phenotype: null,
            latent: null,
            alignment: {
                status: 'latent_required',
                distance: 0,
                threshold: SAKURA_ALIGNMENT_THRESHOLD,
            },
        };
    }

    const safeLatent = validateSakuraLatent(latent, {
        code: 'SAKURA_STATE_RECONCILER_LATENT_INVALID',
        label: 'Sakura state reconciler latent',
    });
    const derivedPhenotype = compileSakuraPhenotypeFromLatent(safeLatent);

    return {
        phenotype: derivedPhenotype,
        latent: safeLatent,
        alignment: {
            status: 'latent_only',
            distance: 0,
            threshold: SAKURA_ALIGNMENT_THRESHOLD,
        },
    };
};
