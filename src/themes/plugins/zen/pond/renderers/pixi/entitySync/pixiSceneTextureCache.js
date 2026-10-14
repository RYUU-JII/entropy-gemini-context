import { Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    flushPixiTextureDisposalQueue,
    queuePixiTextureDisposal,
} from '../../../../shared/pixiDeferredTextureDisposal.js';
import { resolveFlowerPhaseBucket } from '../pixiSceneTextureBuckets.js';
import { buildZenRockShapeSeedKey } from '../../../world/decor/decorHeroRock.js';
import { ZEN_ROCK_MINERAL_MATERIAL_VERSION } from '../zenRockMineralMaterial.js';

const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};

const signatureNumber = (value, scale = 1000) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * scale);
};

const signatureText = (value) => {
    if (value === undefined || value === null) return '';
    return String(value);
};

export const TEXTURE_SIGNATURE_VERSION = 'v2';

const resolveCachedTextureSignature = (entity, cacheKey, buildSignature) => {
    if (!entity || typeof entity !== 'object') {
        return buildSignature(entity);
    }
    const signatureProp = `__pixi_${cacheKey}_signature`;
    const versionProp = `__pixi_${cacheKey}_signature_ver`;
    const cached = entity[signatureProp];
    if (entity[versionProp] === TEXTURE_SIGNATURE_VERSION && typeof cached === 'string') {
        return cached;
    }
    const next = buildSignature(entity);
    entity[signatureProp] = next;
    entity[versionProp] = TEXTURE_SIGNATURE_VERSION;
    return next;
};

const buildLilyPadTextureSignature = (lilyPad = null) => {
    const pad = lilyPad || {};
    return [
        TEXTURE_SIGNATURE_VERSION,
        signatureNumber(pad.size, 100),
        pad.hasFlower ? 1 : 0,
        signatureNumber(pad.notchAngle, 1000),
        signatureText(pad.colorCore),
        signatureText(pad.flowerColor),
        signatureText(pad.flowerStage),
        resolveFlowerPhaseBucket(pad.flowerPhase),
        signatureNumber(pad.flowerOffsetAngle, 1000),
        signatureNumber(pad.flowerOffsetRadius, 1000),
        signatureNumber(pad.edgeRippleSeed, 1000),
        signatureNumber(pad.edgeLobeA, 1000),
        signatureNumber(pad.edgeLobeB, 1000),
        signatureNumber(pad.edgeLobeC, 1000),
        signatureNumber(pad.edgeAmpA, 100000),
        signatureNumber(pad.edgeAmpB, 100000),
        signatureNumber(pad.edgeAmpC, 100000),
        signatureNumber(pad.microRuffleAmp, 100000),
        signatureNumber(pad.veinsCount, 1),
        signatureNumber(pad.wrinkleBands, 1),
        signatureNumber(pad.rimLiftBias, 1000),
    ].join('|');
};

const buildWaterLilyBloomTextureSignature = (waterLily = null) => {
    const bloom = waterLily || {};
    return [
        TEXTURE_SIGNATURE_VERSION,
        signatureNumber(bloom.size, 100),
        signatureText(bloom.flowerColor),
        signatureText(bloom.flowerStage),
        signatureNumber(bloom.stemAngle, 1000),
        signatureNumber(bloom.stemLength, 100),
        signatureNumber(bloom.stemCurve, 1000),
        resolveFlowerPhaseBucket(bloom.flowerPhase),
    ].join('|');
};

const buildZenIrisClusterTextureSignature = (irisCluster = null) => {
    const iris = irisCluster || {};
    const blades = Array.isArray(iris.blades) ? iris.blades : [];
    const bladeSignature = blades.map((blade) => [
        signatureNumber(blade?.angleOffset, 1000),
        signatureNumber(blade?.rootAdvance, 1000),
        signatureNumber(blade?.rootLateral, 1000),
        signatureNumber(blade?.lengthScale, 1000),
        signatureNumber(blade?.widthScale, 1000),
        signatureNumber(blade?.curve, 1000),
        signatureNumber(blade?.taper, 1000),
        signatureNumber(blade?.edgeAsymmetry, 1000),
        signatureNumber(blade?.veinOffset, 1000),
        signatureNumber(blade?.colorIndex, 1),
        signatureNumber(blade?.depth, 1000),
    ].join(':')).join(',');
    return [
        TEXTURE_SIGNATURE_VERSION,
        signatureNumber(iris.size, 100),
        signatureNumber(iris.growthAngle, 1000),
        signatureNumber(iris.bladeCount, 1),
        signatureText(iris.hasBloom ? 1 : 0),
        signatureText(iris.bloomColor),
        signatureNumber(iris.bloomAngleOffset, 1000),
        signatureNumber(iris.bloomRadius, 1000),
        signatureNumber(iris.crownOffset, 1000),
        bladeSignature,
    ].join('|');
};

const buildRockTextureSignature = (rock = null) => {
    const base = rock || {};
    return [
        TEXTURE_SIGNATURE_VERSION,
        ZEN_ROCK_MINERAL_MATERIAL_VERSION,
        signatureNumber(base.size, 100),
        signatureText(base.variant),
        signatureNumber(base.tilt, 1000),
        buildZenRockShapeSeedKey(base),
        signatureNumber(base.highlightBias, 1000),
        signatureNumber(base.roughness, 1000),
        signatureNumber(base.ridgeStrength, 1000),
        signatureNumber(base.edgeChip, 1000),
        signatureNumber(base.patternStrength, 1000),
        signatureNumber(base.angularity, 1000),
        signatureNumber(base.chunkiness, 1000),
        signatureNumber(base.asymmetry, 1000),
        signatureNumber(base.profileAxis, 1000),
        signatureNumber(base.tone, 1000),
    ].join('|');
};

const resolvePondTextureCachePolicy = (policy = null) => {
    const maxEntries = Number(policy?.maxEntries);
    const retentionMs = Number(policy?.retentionMs);
    return {
        maxEntries: Number.isFinite(maxEntries) ? Math.max(1, Math.floor(maxEntries)) : null,
        retentionMs: Number.isFinite(retentionMs) ? Math.max(0, retentionMs) : null,
    };
};

const shouldEvictPondTextureRecord = (record, policy, now = nowMs()) => {
    if (!record || Number(record.refCount) > 0) return false;
    const retentionMs = Number(policy?.retentionMs);
    if (!Number.isFinite(retentionMs) || retentionMs < 0) return false;
    const lastUnusedAt = Number(record.lastUnusedAt);
    if (!Number.isFinite(lastUnusedAt)) return false;
    return (now - lastUnusedAt) >= retentionMs;
};

const destroyTextureRecord = (record, ownedTextures, cacheStats = null, { immediate = false } = {}) => {
    if (!record || typeof record !== 'object') return;
    for (const texture of [record.texture, record.silhouetteTexture]) {
        if (texture && texture !== Texture.WHITE) {
            if (ownedTextures?.has?.(texture)) ownedTextures.delete(texture);
            if (!texture.destroyed) queuePixiTextureDisposal(texture, { destroyBase: true, immediate });
        }
    }
    if (cacheStats && typeof cacheStats.evictions === 'number') {
        cacheStats.evictions += 1;
    }
};

const prunePondTextureCache = (cache, cachePolicy = null, cacheStats = null, ownedTextures = null, now = nowMs()) => {
    if (!cache || typeof cache.forEach !== 'function' || typeof cache.delete !== 'function') {
        return;
    }
    flushPixiTextureDisposalQueue();
    const policy = resolvePondTextureCachePolicy(cachePolicy);
    if (!Number.isFinite(policy?.maxEntries) && !Number.isFinite(policy?.retentionMs)) {
        return;
    }

    let activeCount = 0;
    const inactiveEntries = [];
    for (const [key, record] of cache.entries()) {
        if (!record || typeof record !== 'object') {
            cache.delete(key);
            continue;
        }
        if (Number(record.refCount) > 0) {
            activeCount += 1;
            continue;
        }
        if (shouldEvictPondTextureRecord(record, policy, now)) {
            destroyTextureRecord(record, ownedTextures, cacheStats);
            cache.delete(key);
            continue;
        }
        inactiveEntries.push(record);
    }

    if (!Number.isFinite(policy?.maxEntries)) {
        return;
    }

    const maxEntries = Math.max(0, Math.floor(policy.maxEntries));
    const overCapacity = activeCount + inactiveEntries.length - maxEntries;
    if (overCapacity <= 0) {
        return;
    }

    inactiveEntries.sort((left, right) => {
        const leftUnused = Number(left.lastUnusedAt);
        const rightUnused = Number(right.lastUnusedAt);
        const leftComparable = Number.isFinite(leftUnused) ? leftUnused : now;
        const rightComparable = Number.isFinite(rightUnused) ? rightUnused : now;
        return leftComparable - rightComparable;
    });

    for (let i = 0; i < Math.min(overCapacity, inactiveEntries.length); i += 1) {
        const record = inactiveEntries[i];
        cache.delete(record?.key);
        destroyTextureRecord(record, ownedTextures, cacheStats);
    }
};

const createPondTextureCacheStats = () => ({
    lilyPad: {
        hits: 0,
        misses: 0,
        releases: 0,
        evictions: 0,
    },
    waterLilyBloom: {
        hits: 0,
        misses: 0,
        releases: 0,
        evictions: 0,
    },
    zenIrisCluster: {
        hits: 0,
        misses: 0,
        releases: 0,
        evictions: 0,
    },
    rock: {
        hits: 0,
        misses: 0,
        releases: 0,
        evictions: 0,
    },
});

const snapshotPondTextureCacheStats = (stats = null, cacheRefs = null) => {
    const makeSnapshot = (bucket = null, cache = null) => {
        const hits = Number(bucket?.hits) || 0;
        const misses = Number(bucket?.misses) || 0;
        const requests = hits + misses;
        const hitRatio = requests > 0 ? hits / requests : 0;
        let active = 0;
        if (cache && typeof cache.values === 'function') {
            for (const record of cache.values()) {
                if ((Number(record?.refCount) || 0) > 0) {
                    active += 1;
                }
            }
        }
        return {
            hits,
            misses,
            requests,
            hitRatio,
            releases: Number(bucket?.releases) || 0,
            evictions: Number(bucket?.evictions) || 0,
            active,
            size: Number(cache?.size) || 0,
        };
    };
    return {
        lilyPad: makeSnapshot(stats?.lilyPad, cacheRefs?.lilyPad),
        waterLilyBloom: makeSnapshot(stats?.waterLilyBloom, cacheRefs?.waterLilyBloom),
        zenIrisCluster: makeSnapshot(stats?.zenIrisCluster, cacheRefs?.zenIrisCluster),
        rock: makeSnapshot(stats?.rock, cacheRefs?.rock),
    };
};

const acquireTextureRecord = (
    cache,
    key,
    createRecord,
    ownedTextures,
    cachePolicy = null,
    cacheStats = null,
) => {
    if (!cache || typeof cache.get !== 'function' || typeof cache.set !== 'function') {
        return createRecord();
    }
    const cached = cache.get(key);
    if (cached) {
        cached.refCount += 1;
        cached.lastUnusedAt = null;
        if (cacheStats && typeof cacheStats.hits === 'number') {
            cacheStats.hits += 1;
        }
        return cached;
    }
    if (cacheStats && typeof cacheStats.misses === 'number') {
        cacheStats.misses += 1;
    }
    const created = createRecord();
    const record = {
        ...created,
        key,
        refCount: 1,
        lastUnusedAt: null,
    };
    if (record?.texture && record.texture !== Texture.WHITE && ownedTextures?.add) {
        ownedTextures.add(record.texture);
    }
    prunePondTextureCache(cache, cachePolicy, cacheStats, ownedTextures);
    cache.set(key, record);
    return record;
};

const releaseTextureRecord = (cache, record, ownedTextures, cachePolicy = null, cacheStats = null) => {
    if (!cache || typeof cache.get !== 'function' || typeof cache.delete !== 'function') {
        return;
    }
    if (!record || typeof record !== 'object') return;
    const key = record.key;
    const target = cache.get(key) || record;
    if (!target) return;
    if (cacheStats && typeof cacheStats.releases === 'number') {
        cacheStats.releases += 1;
    }
    target.refCount = Math.max(0, Number(target.refCount) - 1);
    if (target.refCount > 0) return;
    target.lastUnusedAt = nowMs();
    prunePondTextureCache(cache, cachePolicy, cacheStats, ownedTextures);
};

export {
    createPondTextureCacheStats,
    snapshotPondTextureCacheStats,
    resolveCachedTextureSignature,
    buildLilyPadTextureSignature,
    buildWaterLilyBloomTextureSignature,
    buildZenIrisClusterTextureSignature,
    buildRockTextureSignature,
    prunePondTextureCache,
    acquireTextureRecord,
    releaseTextureRecord,
};
