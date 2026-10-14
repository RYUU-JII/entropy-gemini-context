// Identity-stable temperament. Session movement variation has a separate owner.
export function zenKoiTraitUnit(identity, trait) {
    const text = `${identity}|${trait}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    return (hash >>> 0) / 4294967296;
}

export const createZenKoiPersonality = (identity) => ({
    curiosity: 0.1 + zenKoiTraitUnit(identity, 'curiosity') * 0.9,
    energy: 0.3 + zenKoiTraitUnit(identity, 'energy') * 0.7,
    laziness: zenKoiTraitUnit(identity, 'laziness'),
    boldness: zenKoiTraitUnit(identity, 'boldness'),
    sociality: zenKoiTraitUnit(identity, 'sociality'),
});

const TRAITS = ['curiosity', 'energy', 'laziness', 'boldness', 'sociality'];
export function requireZenKoiBehaviorTemperament(fish) {
    const temperament = fish.behaviorTemperament;
    if (!temperament || TRAITS.some(key => !Number.isFinite(temperament[key]) || temperament[key] < 0 || temperament[key] > 1)) {
        throw new Error('ZEN_KOI_BEHAVIOR_TEMPERAMENT_INVALID');
    }
    return temperament;
}
