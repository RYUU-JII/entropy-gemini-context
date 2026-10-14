import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { resolvePixiSceneMaterialRenderPlan } from './pixiSceneWorldPolicy.js';

const NOOP_ARRAY = Object.freeze([]);

const resolveArray = (refLike) => {
    const value = refLike?.current;
    return Array.isArray(value) ? value : NOOP_ARRAY;
};

const resolveFishShadowProfile = (qualityProfile, optimizationProfile = null, worldPolicy = null) => {
    const optimizedShadow = optimizationProfile?.fish?.shadow;
    const materialPlan = resolvePixiSceneMaterialRenderPlan(worldPolicy);
    return {
        enabled: materialPlan.fishShadow && (optimizedShadow?.enabled ?? (qualityProfile?.fishShadowEnabled !== false)),
        blur: Math.max(0, Number(optimizedShadow?.blur ?? qualityProfile?.fishShadowBlur) || 0),
        cadence: Math.max(0, Math.floor(Number(optimizedShadow?.cadence ?? qualityProfile?.fishShadowCadence) || 0)),
        includeFins: optimizedShadow?.includeFins ?? true,
        opacity: (() => {
            const value = Number(optimizedShadow?.opacity ?? qualityProfile?.fishShadowOpacity);
            return clampValue(Number.isFinite(value) ? value : 0.2, 0, 0.35);
        })(),
        scale: (() => {
            const value = Number(optimizedShadow?.scale ?? qualityProfile?.fishShadowScale);
            return clampValue(Number.isFinite(value) ? value : 0.88, 0.8, 0.95);
        })(),
    };
};

const removeMissingFromPool = (pool, aliveSet, destroyEntry) => {
    for (const [entity, entry] of pool.entries()) {
        if (aliveSet.has(entity)) continue;
        destroyEntry(entry);
        pool.delete(entity);
    }
};

export {
    resolveArray,
    resolveFishShadowProfile,
    removeMissingFromPool,
};
