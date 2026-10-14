import {
    Matrix,
    RenderTexture,
    Sprite,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

const roundSignatureValue = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(fallback);
    return numeric.toFixed(digits);
};

const resolveTextureSignature = (texture = null) => {
    if (!texture) return 'none';
    if (texture.textureCacheIds?.length) return texture.textureCacheIds.join(',');
    if (texture.baseTexture?.uid !== undefined) return `base:${texture.baseTexture.uid}`;
    if (texture.uid !== undefined) return `texture:${texture.uid}`;
    return texture === true ? 'true' : String(texture);
};

const readPointSignature = (point = null) => (
    point && typeof point === 'object'
        ? `${roundSignatureValue(point.x, 3)}:${roundSignatureValue(point.y, 3)}`
        : '0:0'
);

const readNodeSignature = (node = null, visibleOverride = null) => {
    if (!node || typeof node !== 'object') return 'missing';
    const visible = visibleOverride === null || visibleOverride === undefined
        ? node.visible !== false
        : visibleOverride === true;
    const parts = [
        visible ? 1 : 0,
        roundSignatureValue(node.alpha, 2, 1),
        roundSignatureValue(node.x, 2, 0),
        roundSignatureValue(node.y, 2, 0),
        roundSignatureValue(node.width, 2, 0),
        roundSignatureValue(node.height, 2, 0),
        String(node.tint ?? ''),
        String(node.blendMode ?? ''),
        resolveTextureSignature(node.texture),
        readPointSignature(node.scale),
        roundSignatureValue(node.rotation, 4),
        readPointSignature(node.skew),
        readPointSignature(node.anchor),
        readPointSignature(node.tileScale),
        readPointSignature(node.tilePosition),
        roundSignatureValue(node.tileTransform?.rotation, 4),
        readPointSignature(node.tileTransform?.skew),
        node.uvRespectAnchor === true ? 1 : 0,
        String(node.texture?.baseTexture?.alphaMode ?? ''),
    ];
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i += 1) {
        parts.push(readNodeSignature(children[i]));
    }
    return parts.join(',');
};

export const buildSurfaceSourceBakeSignature = ({
    width = 1,
    height = 1,
    sourceStates = [],
} = {}) => [
    roundSignatureValue(width, 2, 1),
    roundSignatureValue(height, 2, 1),
    ...sourceStates.map((state) => readNodeSignature(state.node, state.visible)),
].join('|');

export const createPixiSurfaceSourceBakeRuntime = ({
    renderer = null,
    width = 1,
    height = 1,
    surfaceFilterContainer = null,
    renderContainer = null,
    spriteParentContainer = null,
    spriteInsertIndex = 0,
    bakedSpriteBlendMode = null,
    requiredSourceContainer = null,
    sourceContainers = [],
    dynamicContainers = [],
    createRenderTexture = null,
    createSprite = null,
    beforeRender = null,
    afterRender = null,
    getSourceContentSignature = null,
    getSourceBounds = null,
    clearColor = null,
} = {}) => {
    for (const callback of [getSourceContentSignature, getSourceBounds]) {
        if (callback !== null && typeof callback !== 'function') {
            throw new Error('ZEN_SURFACE_BAKE_CALLBACK_INVALID');
        }
    }
    let safeWidth = Math.max(1, Math.round(Number(width) || 1));
    let safeHeight = Math.max(1, Math.round(Number(height) || 1));
    const sources = Array.isArray(sourceContainers) ? sourceContainers.filter(Boolean) : [];
    const dynamics = Array.isArray(dynamicContainers) ? dynamicContainers.filter(Boolean) : [];
    const makeRenderTexture = typeof createRenderTexture === 'function'
        ? createRenderTexture
        : ({ width, height }) => RenderTexture.create({
            width,
            height,
            resolution: 1,
        });
    const makeSprite = typeof createSprite === 'function'
        ? createSprite
        : (texture) => new Sprite(texture);
    const renderTargetContainer = renderContainer || surfaceFilterContainer;
    const bakedSpriteParent = spriteParentContainer || surfaceFilterContainer;
    const insertIndex = Math.max(0, Math.round(Number(spriteInsertIndex) || 0));
    const prepareRender = typeof beforeRender === 'function' ? beforeRender : null;
    const cleanupRender = typeof afterRender === 'function' ? afterRender : null;

    let renderTexture = null;
    let bakedSprite = null;
    let active = false;
    let lastSignature = '';
    let bakeBounds = { x: 0, y: 0, width: safeWidth, height: safeHeight };
    const bakeTransform = new Matrix();
    const intendedSourceVisibility = new Map();

    const ensureResources = () => {
        if (!renderTexture) {
            renderTexture = makeRenderTexture({
                width: bakeBounds.width,
                height: bakeBounds.height,
            });
            if (clearColor !== null) renderTexture.baseTexture.clearColor = clearColor;
        }
        if (!bakedSprite && renderTexture) {
            bakedSprite = makeSprite(renderTexture);
            bakedSprite.x = bakeBounds.x;
            bakedSprite.y = bakeBounds.y;
            bakedSprite.width = bakeBounds.width;
            bakedSprite.height = bakeBounds.height;
            bakedSprite.visible = false;
            if (bakedSpriteBlendMode !== null && bakedSpriteBlendMode !== undefined) {
                bakedSprite.blendMode = bakedSpriteBlendMode;
            }
        }
        if (
            bakedSprite
            && bakedSpriteParent
            && bakedSprite.parent !== bakedSpriteParent
        ) {
            if (typeof bakedSpriteParent.addChildAt === 'function') {
                bakedSpriteParent.addChildAt(bakedSprite, insertIndex);
            } else if (typeof bakedSpriteParent.addChild === 'function') {
                bakedSpriteParent.addChild(bakedSprite);
            }
        }
        return Boolean(renderTexture && bakedSprite);
    };

    const resolveSourceVisible = (node) => {
        if (!node) return false;
        if (active && node.visible === false && intendedSourceVisibility.has(node)) {
            return intendedSourceVisibility.get(node) === true;
        }
        return node.visible !== false;
    };

    const captureSourceStates = () => sources.map((node) => ({
        node,
        visible: resolveSourceVisible(node),
    }));

    const hideSourceContainers = (sourceStates) => {
        for (let i = 0; i < sourceStates.length; i += 1) {
            const { node, visible } = sourceStates[i];
            intendedSourceVisibility.set(node, visible === true);
            node.visible = false;
        }
    };

    const restoreSourceContainers = (sourceStates = null) => {
        const states = Array.isArray(sourceStates)
            ? sourceStates
            : sources.map((node) => ({
                node,
                visible: intendedSourceVisibility.has(node)
                    ? intendedSourceVisibility.get(node) === true
                    : node?.visible !== false,
            }));
        for (let i = 0; i < states.length; i += 1) {
            const { node, visible } = states[i];
            if (!node) continue;
            node.visible = visible === true;
        }
    };

    const disable = (reason = 'disabled', sourceStates = null) => {
        if (bakedSprite) bakedSprite.visible = false;
        restoreSourceContainers(sourceStates);
        active = false;
        lastSignature = '';
        return {
            active: false,
            refreshed: false,
            reason,
        };
    };

    const refresh = ({
        enabled = true,
        force = false,
        validateCache = true,
    } = {}) => {
        if (!enabled) return disable('disabled');
        if (
            !renderer
            || typeof renderer.render !== 'function'
            || !surfaceFilterContainer
            || !renderTargetContainer
        ) {
            return disable('renderer_unavailable');
        }

        const sourceStates = captureSourceStates();
        const requiredVisible = requiredSourceContainer
            ? sourceStates.some((state) => (
                state.node === requiredSourceContainer
                && state.visible === true
            ))
            : sourceStates.some((state) => state.visible === true);
        if (!requiredVisible) return disable('required_source_hidden', sourceStates);
        if (!force && active && validateCache === false) {
            hideSourceContainers(sourceStates);
            bakedSprite.visible = true;
            return {
                active: true,
                refreshed: false,
                reason: 'cache_trusted',
            };
        }

        const contentSignature = getSourceContentSignature === null ? '' : getSourceContentSignature();
        if (typeof contentSignature !== 'string') throw new Error('ZEN_SURFACE_BAKE_CONTENT_SIGNATURE_INVALID');
        const signature = buildSurfaceSourceBakeSignature({
            width: safeWidth,
            height: safeHeight,
            sourceStates,
        }) + '|' + contentSignature;
        if (!force && active && signature === lastSignature) {
            hideSourceContainers(sourceStates);
            bakedSprite.visible = true;
            return {
                active: true,
                refreshed: false,
                reason: 'cache_hit',
            };
        }

        if (getSourceBounds !== null) {
            const bounds = getSourceBounds();
            if (![bounds?.x, bounds?.y, bounds?.width, bounds?.height].every(Number.isFinite)) {
                throw new Error('ZEN_SURFACE_BAKE_BOUNDS_INVALID');
            }
            const x = Math.max(0, Math.floor(bounds.x));
            const y = Math.max(0, Math.floor(bounds.y));
            const right = Math.min(safeWidth, Math.ceil(bounds.x + bounds.width));
            const bottom = Math.min(safeHeight, Math.ceil(bounds.y + bounds.height));
            if (right <= x || bottom <= y) return disable('source_empty', sourceStates);
            bakeBounds = { x, y, width: right - x, height: bottom - y };
        }
        if (!ensureResources()) throw new Error('ZEN_SURFACE_BAKE_RESOURCE_UNAVAILABLE');
        if (getSourceBounds !== null) {
            if (renderTexture.width !== bakeBounds.width || renderTexture.height !== bakeBounds.height) {
                renderTexture.resize(bakeBounds.width, bakeBounds.height, true);
            }
            bakedSprite.position.set(bakeBounds.x, bakeBounds.y);
            bakedSprite.width = bakeBounds.width;
            bakedSprite.height = bakeBounds.height;
            bakeTransform.identity().translate(-bakeBounds.x, -bakeBounds.y);
        }

        const dynamicStates = dynamics.map((node) => ({
            node,
            visible: node?.visible !== false,
        }));
        const previousFilters = surfaceFilterContainer.filters || null;
        try {
            bakedSprite.visible = false;
            for (let i = 0; i < sourceStates.length; i += 1) {
                sourceStates[i].node.visible = sourceStates[i].visible === true;
            }
            for (let i = 0; i < dynamicStates.length; i += 1) {
                dynamicStates[i].node.visible = false;
            }
            surfaceFilterContainer.filters = null;
            prepareRender?.({
                renderContainer: renderTargetContainer,
                renderTexture,
                bakedSprite,
            });
            renderer.render(renderTargetContainer, {
                renderTexture,
                clear: true,
                ...(getSourceBounds !== null ? { transform: bakeTransform } : {}),
            });
        } catch (error) {
            disable('bake_failed', sourceStates);
            throw new Error('ZEN_SURFACE_BAKE_RENDER_FAILED', { cause: error });
        } finally {
            try {
                cleanupRender?.({ renderContainer: renderTargetContainer, renderTexture, bakedSprite });
            } finally {
                for (const state of dynamicStates) state.node.visible = state.visible;
                surfaceFilterContainer.filters = previousFilters;
            }
        }
        lastSignature = signature;
        active = true;
        hideSourceContainers(sourceStates);
        bakedSprite.visible = true;
        return {
            active: true,
            refreshed: true,
            reason: 'refreshed',
        };
    };

    const invalidate = ({
        restoreSources = false,
    } = {}) => {
        lastSignature = '';
        active = false;
        if (bakedSprite) bakedSprite.visible = false;
        if (restoreSources) restoreSourceContainers();
    };

    const destroy = () => {
        disable('destroyed');
        if (bakedSprite?.parent && typeof bakedSprite.parent.removeChild === 'function') {
            bakedSprite.parent.removeChild(bakedSprite);
        }
        if (typeof bakedSprite?.destroy === 'function') {
            bakedSprite.destroy({ children: true });
        }
        bakedSprite = null;
        if (renderTexture && !renderTexture.destroyed && typeof renderTexture.destroy === 'function') {
            renderTexture.destroy(true);
        }
        renderTexture = null;
        intendedSourceVisibility.clear();
    };

    return {
        refresh,
        resize: (width, height) => {
            invalidate({ restoreSources: true });
            safeWidth = width;
            safeHeight = height;
            if (getSourceBounds === null) {
                bakeBounds = { x: 0, y: 0, width, height };
                if (renderTexture) renderTexture.resize(width, height, true);
                if (bakedSprite) { bakedSprite.width = width; bakedSprite.height = height; }
            }
        },
        invalidate,
        destroy,
        get active() {
            return active;
        },
        get sprite() {
            return bakedSprite;
        },
    };
};
