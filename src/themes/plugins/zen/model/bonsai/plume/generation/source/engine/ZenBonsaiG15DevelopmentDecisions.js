// Detached decision diagnostics. They never enter graph/organ/paint identity.
export function resolveZenG15Consolidation(value = 'baseline') {
    if (!['baseline','random','candidate'].includes(value)) throw new Error('ZEN_G15_CONSOLIDATION_INVALID');
    return Object.freeze({ treatment:value, random:value!=='baseline', horizon:value==='candidate' });
}
export function recordZenG15Decision(context, decision) {
    if (context.onDevelopmentDecision) context.onDevelopmentDecision(Object.freeze(decision));
}
export function zenG15ExtensionDemand(base, factors) {
    // Preserve original left-to-right multiplication, including unit factors.
    return factors.reduce((value, [,factor]) => value * factor, base);
}
