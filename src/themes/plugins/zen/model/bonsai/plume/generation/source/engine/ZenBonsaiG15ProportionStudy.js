// Detached experiments in role proportions, before construction is committed.
// These are alternative hypotheses, not accepted product defaults.
const profiles = Object.freeze({
    baseline: Object.freeze({ scaffoldReach: 1, terminalReach: 1, distalCompression: 0, axisCountScale: 1 }),
    scaffold: Object.freeze({ scaffoldReach: 1.26, terminalReach: 1.14, distalCompression: 0, axisCountScale: 1 }),
    compact: Object.freeze({ scaffoldReach: 1, terminalReach: 1, distalCompression: .22, axisCountScale: 1 }),
    rhythm: Object.freeze({ scaffoldReach: 1, terminalReach: 1, distalCompression: 0, axisCountScale: .8 }),
    shoots: Object.freeze({ scaffoldReach: 1, terminalReach: 1, distalCompression: 0, axisCountScale: 1 }),
    symbols: Object.freeze({ scaffoldReach: 1, terminalReach: 1, distalCompression: 0, axisCountScale: 1 }),
    balanced: Object.freeze({ scaffoldReach: 1.22, terminalReach: 1.12, distalCompression: .15, axisCountScale: 1 }),
});
export const PROPORTION_TREATMENTS = Object.freeze(Object.keys(profiles));
export function resolveZenG15ProportionProfile(treatment = 'baseline') {
    if (!Object.hasOwn(profiles, treatment)) throw new Error('ZEN_G15_PROPORTION_TREATMENT_INVALID');
    return profiles[treatment];
}
export function zenG15ProportionLengthScale(profile, tier, coordinates) {
    if (!profile || ![0,1,2].includes(tier) || !Number.isFinite(coordinates.height)) {
        throw new Error('ZEN_G15_PROPORTION_CONTEXT_REQUIRED');
    }
    if (tier === 1) return profile.scaffoldReach;
    if (tier === 2) return profile.terminalReach;
    const t = Math.max(0, Math.min(1, (coordinates.height - .2) / .8));
    return 1 - profile.distalCompression * t * t * (3 - 2 * t);
}
export function zenG15ProportionCount(profile, count, tier, isRoot) {
    if (!profile || !Number.isFinite(count)) throw new Error('ZEN_G15_PROPORTION_CONTEXT_REQUIRED');
    return count * (tier === 0 && !isRoot ? profile.axisCountScale : 1);
}
export function zenG15ProportionPresentation(treatment = 'baseline') {
    resolveZenG15ProportionProfile(treatment);
    return { extendedShoots: treatment === 'shoots' || treatment === 'balanced',
        flowerScale: treatment === 'symbols' || treatment === 'balanced' ? 1.2 : 1 };
}

// A fixed family becomes a continuing axis with one staggered lateral. This
// acts on its birth plan, before age interpolation, never on a completed crown
// or a named seed. The wood-volume proxy is conserved within the family.
export function developZenG15Shoot(entries) {
    if (!Array.isArray(entries) || ![3,4].includes(entries.length)) throw new Error('ZEN_G15_SHOOT_PLAN_REQUIRED');
    const points = new Map(), result = [];
    const volume = rows => rows.reduce((sum,e)=>sum+Math.hypot(e.to.x-e.from.x,e.to.y-e.from.y,e.to.z-e.from.z)
        *(e.startRadius**2+e.startRadius*e.endRadius+e.endRadius**2),0);
    const split = entries.length === 4;
    for (const [index,entry] of entries.entries()) {
        const lateral = split && index === 3;
        const fromNodeId = lateral ? entries[0].toNodeId : entry.fromNodeId;
        if (index > 0 && !points.has(fromNodeId)) throw new Error('ZEN_G15_SHOOT_PARENT_ORDER_REQUIRED');
        const from = points.has(fromNodeId) ? points.get(fromNodeId) : entry.from;
        const oldLength = Math.hypot(entry.to.x-entry.from.x,entry.to.y-entry.from.y,entry.to.z-entry.from.z);
        if (!Number.isFinite(oldLength) || oldLength <= 0 || !Number.isFinite(entry.startRadius)
            || !Number.isFinite(entry.endRadius) || entry.startRadius <= 0 || entry.endRadius <= 0) throw new Error('ZEN_G15_SHOOT_PLAN_REQUIRED');
        const own = {x:(entry.to.x-entry.from.x)/oldLength,y:(entry.to.y-entry.from.y)/oldLength,z:(entry.to.z-entry.from.z)/oldLength};
        const stem = entries[1];
        const stemLength = Math.hypot(stem.to.x-stem.from.x,stem.to.y-stem.from.y,stem.to.z-stem.from.z);
        const retention = index === 2 ? .3 : 1;
        const direction = Object.fromEntries(['x','y','z'].map(k=>[k,own[k]*retention+(stem.to[k]-stem.from[k])/stemLength*(1-retention)]));
        const norm = Math.hypot(direction.x,direction.y,direction.z);
        const length = oldLength * (index === 0 ? 1.42 : index === 1 ? 1.28 : lateral ? 1.05 : 1.48);
        const to = Object.fromEntries(['x','y','z'].map(k=>[k,from[k]+direction[k]/norm*length]));
        result.push({...entry,fromNodeId,from,to,branchRole:lateral?'axillary_depth_shoot':'continuing_depth_shoot'});
        points.set(entry.toNodeId,to);
    }
    const radiusScale = Math.sqrt(volume(entries)/volume(result));
    return result.map(e=>Object.freeze({...e,from:Object.freeze(e.from),to:Object.freeze(e.to),
        startRadius:e.startRadius*radiusScale,endRadius:e.endRadius*radiusScale}));
}
