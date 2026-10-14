const DEFAULT_TEXTURE_DESTROY_BUDGET = 3;

const pendingTextureDisposals = [];
const queuedTextures = new Set();
let disposalFlushScheduled = false;

const requestDeferredFlush = (callback) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 250 });
        return;
    }
    if (typeof setTimeout === 'function') {
        setTimeout(callback, 0);
        return;
    }
    callback();
};

const destroyTextureNow = (texture, destroyBase = true) => {
    if (!texture || texture.destroyed || typeof texture.destroy !== 'function') {
        return false;
    }
    texture.destroy(destroyBase);
    return true;
};

const schedulePixiTextureDisposalFlush = () => {
    if (disposalFlushScheduled || pendingTextureDisposals.length === 0) {
        return;
    }
    disposalFlushScheduled = true;
    requestDeferredFlush(() => {
        disposalFlushScheduled = false;
        flushPixiTextureDisposalQueue(DEFAULT_TEXTURE_DESTROY_BUDGET);
        if (pendingTextureDisposals.length > 0) {
            schedulePixiTextureDisposalFlush();
        }
    });
};

const queuePixiTextureDisposal = (
    texture,
    {
        destroyBase = true,
        immediate = false,
    } = {},
) => {
    if (!texture || texture.destroyed || typeof texture.destroy !== 'function') {
        return false;
    }
    if (immediate) {
        queuedTextures.delete(texture);
        return destroyTextureNow(texture, destroyBase);
    }
    if (queuedTextures.has(texture)) {
        return false;
    }
    queuedTextures.add(texture);
    pendingTextureDisposals.push({ texture, destroyBase });
    schedulePixiTextureDisposalFlush();
    return true;
};

const flushPixiTextureDisposalQueue = (maxTextures = DEFAULT_TEXTURE_DESTROY_BUDGET) => {
    const budget = Math.max(1, Math.floor(Number(maxTextures) || DEFAULT_TEXTURE_DESTROY_BUDGET));
    let destroyed = 0;
    while (pendingTextureDisposals.length > 0 && destroyed < budget) {
        const entry = pendingTextureDisposals.shift();
        const texture = entry?.texture;
        queuedTextures.delete(texture);
        if (destroyTextureNow(texture, entry?.destroyBase !== false)) {
            destroyed += 1;
        }
    }
    return destroyed;
};

const flushAllPixiTextureDisposals = () => {
    while (pendingTextureDisposals.length > 0) {
        flushPixiTextureDisposalQueue(Number.MAX_SAFE_INTEGER);
    }
};

const getPendingPixiTextureDisposalCount = () => pendingTextureDisposals.length;

export {
    flushAllPixiTextureDisposals,
    flushPixiTextureDisposalQueue,
    getPendingPixiTextureDisposalCount,
    queuePixiTextureDisposal,
};
