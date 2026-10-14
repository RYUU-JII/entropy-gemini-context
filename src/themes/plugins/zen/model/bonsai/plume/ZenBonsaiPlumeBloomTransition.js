import { resolveZenCherryPlumeFlowerDevelopment } from './live/flower-development.js';

export const ZEN_PLUME_PRODUCT_BLOOM_TRANSITION = 'zen_plume_product_bloom_transition_v1';
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;
const clamp = value => Math.max(0, Math.min(1, value));
const OPENING_START = 0.955;

// The source clock still owns anatomical seasons. Product petals unfold only
// on the target crown near full growth, so earlier annual passes cannot bloom
// and disappear again during the five-qualified-day introduction.
export function projectZenBonsaiPlumeBloomTransition(snapshot, growth, target) {
    if (!unit(growth) || growth < 0.5) throw Error('ZEN_PLUME_PRODUCT_BLOOM_GROWTH');
    const clock = snapshot.live.clock;
    if (target.phase !== 'spring' || clock.target.year !== target.year ||
        clock.target.phase !== target.phase || clock.target.stage !== target.stage) {
        throw Error('ZEN_PLUME_PRODUCT_BLOOM_TARGET');
    }
    const targetCrown = clock.observedYear === target.year && clock.observedPhase === 'spring';
    const progress = targetCrown ? clamp((growth - OPENING_START) / (1 - OPENING_START)) : 0;
    // At full growth retain the exact original receipt and selected observation.
    const development = growth === 1 ? snapshot.live.development.flower :
        resolveZenCherryPlumeFlowerDevelopment(snapshot.flowers, {
            seed: snapshot.live.seed, budbreakProgress: progress, seasonalAlpha: targetCrown ? 1 : 0,
        });
    // Handoff follows real bud emergence, not a fixed early growth threshold.
    // Swelling is monotone; bud/petal opacity alone dips during their crossfade.
    const coverage = growth === 1 ? 1 : development.flowers.length === 0 ? 0 :
        development.flowers.reduce((sum, flower) => sum + flower.alpha * flower.swelling, 0) / development.flowers.length;
    return {
        transition: {
            contract: ZEN_PLUME_PRODUCT_BLOOM_TRANSITION, targetYear: target.year,
            progress, coverage, stage: growth === 1 ? 'full' : targetCrown ? 'opening' : 'anticipation',
        },
        snapshot: growth === 1 ? snapshot : {
            ...snapshot,
            live: {
                ...snapshot.live,
                visibility: { ...snapshot.live.visibility, flowers: development.flowers.map(({ id, alpha }) => ({ id, alpha })) },
                development: { ...snapshot.live.development, flower: development },
            },
        },
    };
}
