import { projectZenBonsaiPlumeInitialForm, resolveZenBonsaiPlumePreBloom } from './ZenBonsaiPlumeInitialForm.js';
import { projectZenBonsaiPlumeBloomTransition } from './ZenBonsaiPlumeBloomTransition.js';
import { requireZenBonsaiPlumeBranchEstablishment } from './ZenBonsaiPlumeBranchEstablishment.js';
import { ZEN_BONSAI_PLUME_PRODUCT_TARGET, resolveZenBonsaiPlumeLifeAppearance } from './ZenBonsaiPlumeLifeAppearance.js';
export { ZEN_BONSAI_PLUME_SEED_CONTRACT, resolveZenBonsaiPlumeSourceSeed } from './ZenBonsaiPlumeIdentity.js';
export { ZEN_BONSAI_PLUME_PRODUCT_TARGET, resolveZenBonsaiPlumeLifeState } from './ZenBonsaiPlumeLifeAppearance.js';

export function applyZenBonsaiPlumeLifePresentation(snapshot, lifeState, branchEstablishment) {
    requireZenBonsaiPlumeBranchEstablishment(snapshot, branchEstablishment);
    const initial = projectZenBonsaiPlumeInitialForm(snapshot, lifeState.growth);
    const flowering = projectZenBonsaiPlumeBloomTransition(initial.snapshot, lifeState.growth, ZEN_BONSAI_PLUME_PRODUCT_TARGET);
    snapshot = flowering.snapshot;
    const { bloom, health, ...appearance } = resolveZenBonsaiPlumeLifeAppearance(lifeState);
    return {
        ...snapshot,
        live: {
            ...snapshot.live,
            presentation: {
                ...snapshot.live.presentation,
                ...appearance,
            },
            productLife: {
                contract: 'zen_plume_product_life_v1', growth: lifeState.growth,
                bloom, health, target: ZEN_BONSAI_PLUME_PRODUCT_TARGET,
                form: initial.form, bloomTransition: flowering.transition, branchEstablishment,
                preBloom: resolveZenBonsaiPlumePreBloom(snapshot, lifeState.growth, flowering.transition, branchEstablishment),
            },
        },
    };
}
