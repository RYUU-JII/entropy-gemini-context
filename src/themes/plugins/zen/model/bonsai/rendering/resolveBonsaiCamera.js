const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const CAMERA_PRESETS = Object.freeze({
    workspace: {
        top: { min: 22, ratio: 0.08, max: 56 },
        right: { min: 20, ratio: 0.075, max: 44 },
        bottom: { min: 22, ratio: 0.065, max: 44 },
        left: { min: 20, ratio: 0.075, max: 44 },
    },
    embedded: {
        top: { min: 20, ratio: 0.07, max: 44 },
        right: { min: 18, ratio: 0.065, max: 36 },
        bottom: { min: 16, ratio: 0.05, max: 30 },
        left: { min: 18, ratio: 0.065, max: 36 },
    },
    'home-embedded': {
        top: { min: 12, ratio: 0.045, max: 26 },
        right: { min: 12, ratio: 0.05, max: 22 },
        bottom: { min: 14, ratio: 0.045, max: 22 },
        left: { min: 12, ratio: 0.05, max: 22 },
    },
    'home-frame-garden-bed': {
        top: { min: 10, ratio: 0.038, max: 22 },
        right: { min: 8, ratio: 0.035, max: 16 },
        bottom: { min: 0, ratio: 0, max: 0 },
        left: { min: 8, ratio: 0.035, max: 16 },
    },
    preview: {
        top: { min: 18, ratio: 0.065, max: 38 },
        right: { min: 18, ratio: 0.06, max: 32 },
        bottom: { min: 16, ratio: 0.048, max: 26 },
        left: { min: 18, ratio: 0.06, max: 32 },
    },
    ab: {
        top: { min: 36, ratio: 0.1, max: 48 },
        right: { min: 18, ratio: 0.055, max: 28 },
        bottom: { min: 42, ratio: 0.12, max: 54 },
        left: { min: 18, ratio: 0.055, max: 28 },
    },
});

const FALLBACK_SCENE_BOUNDS = Object.freeze({
    minX: -160,
    maxX: 160,
    minY: -360,
    maxY: 40,
    width: 320,
    height: 400,
});

const resolveInsetSize = (viewportExtent, def) => clamp(
    Math.round(viewportExtent * def.ratio),
    def.min,
    def.max,
);

const resolveViewportPadding = (viewportWidth, viewportHeight, preset) => {
    const presetDef = CAMERA_PRESETS[preset] || CAMERA_PRESETS.workspace;
    return {
        top: resolveInsetSize(viewportHeight, presetDef.top),
        right: resolveInsetSize(viewportWidth, presetDef.right),
        bottom: resolveInsetSize(viewportHeight, presetDef.bottom),
        left: resolveInsetSize(viewportWidth, presetDef.left),
    };
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const resolveFiniteCameraNumber = (value, field) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_BONSAI_CAMERA_INVALID_${field}`);
    }
    return numeric;
};

const createCameraProjectors = ({ offsetX, offsetY, scale }) => {
    const numericScale = Number(scale);
    const safeScale = Number.isFinite(numericScale) && numericScale > 0
        ? numericScale
        : 1;
    const safeOffsetX = toNumber(offsetX, 0);
    const safeOffsetY = toNumber(offsetY, 0);
    return {
        worldToScreen: ({ x = 0, y = 0 } = {}) => ({
            x: safeOffsetX + (toNumber(x, 0) * safeScale),
            y: safeOffsetY + (toNumber(y, 0) * safeScale),
        }),
        screenToWorld: ({ x = 0, y = 0 } = {}) => ({
            x: (toNumber(x, 0) - safeOffsetX) / safeScale,
            y: (toNumber(y, 0) - safeOffsetY) / safeScale,
        }),
    };
};

export function serializeBonsaiCameraSnapshot(camera = null) {
    if (!isObject(camera)) {
        return null;
    }
    const scale = resolveFiniteCameraNumber(camera.scale, 'SCALE');
    const offsetX = resolveFiniteCameraNumber(camera.offsetX, 'OFFSET_X');
    const offsetY = resolveFiniteCameraNumber(camera.offsetY, 'OFFSET_Y');
    const sceneBounds = isObject(camera.sceneBounds)
        ? {
            minX: toNumber(camera.sceneBounds.minX, 0),
            maxX: toNumber(camera.sceneBounds.maxX, 0),
            minY: toNumber(camera.sceneBounds.minY, 0),
            maxY: toNumber(camera.sceneBounds.maxY, 0),
            width: Math.max(1, toNumber(camera.sceneBounds.width, 1)),
            height: Math.max(1, toNumber(camera.sceneBounds.height, 1)),
        }
        : null;
    const padding = isObject(camera.padding)
        ? {
            top: Math.max(0, toNumber(camera.padding.top, 0)),
            right: Math.max(0, toNumber(camera.padding.right, 0)),
            bottom: Math.max(0, toNumber(camera.padding.bottom, 0)),
            left: Math.max(0, toNumber(camera.padding.left, 0)),
        }
        : null;
    return {
        preset: typeof camera.preset === 'string' && camera.preset.trim()
            ? camera.preset.trim()
            : 'workspace',
        viewportWidth: Math.max(1, toNumber(camera.viewportWidth, 1)),
        viewportHeight: Math.max(1, toNumber(camera.viewportHeight, 1)),
        padding,
        contentWidth: Math.max(1, toNumber(camera.contentWidth, 1)),
        contentHeight: Math.max(1, toNumber(camera.contentHeight, 1)),
        sceneBounds,
        sceneWidth: Math.max(1, toNumber(camera.sceneWidth, sceneBounds?.width || 1)),
        sceneHeight: Math.max(1, toNumber(camera.sceneHeight, sceneBounds?.height || 1)),
        scale,
        offsetX,
        offsetY,
        originScreen: {
            x: toNumber(camera.originScreen?.x, offsetX),
            y: toNumber(camera.originScreen?.y, offsetY),
        },
    };
}

export function hydrateBonsaiCameraSnapshot(snapshot = null) {
    if (!isObject(snapshot)) {
        return null;
    }
    const serialized = serializeBonsaiCameraSnapshot(snapshot);
    const projectors = createCameraProjectors({
        offsetX: serialized.offsetX,
        offsetY: serialized.offsetY,
        scale: serialized.scale,
    });
    return {
        ...serialized,
        ...projectors,
    };
}

export function resolveBonsaiCamera({
    viewportWidth,
    viewportHeight,
    sceneBounds,
    preset = 'workspace',
    scaleCap = null,
}) {
    const safeViewportWidth = Math.max(1, Math.round(toNumber(viewportWidth, 1)));
    const safeViewportHeight = Math.max(1, Math.round(toNumber(viewportHeight, 1)));
    const safeSceneBounds = sceneBounds && Number.isFinite(Number(sceneBounds.width)) && Number.isFinite(Number(sceneBounds.height))
        ? sceneBounds
        : FALLBACK_SCENE_BOUNDS;
    const padding = resolveViewportPadding(safeViewportWidth, safeViewportHeight, preset);
    const contentWidth = Math.max(1, safeViewportWidth - padding.left - padding.right);
    const contentHeight = Math.max(1, safeViewportHeight - padding.top - padding.bottom);
    const sceneWidth = Math.max(1, toNumber(safeSceneBounds.width, FALLBACK_SCENE_BOUNDS.width));
    const sceneHeight = Math.max(1, toNumber(safeSceneBounds.height, FALLBACK_SCENE_BOUNDS.height));
    const naturalScale = Math.min(contentWidth / sceneWidth, contentHeight / sceneHeight);
    const hasScaleCap = scaleCap !== null && scaleCap !== undefined;
    const resolvedScaleCap = hasScaleCap ? Number(scaleCap) : naturalScale;
    if (!Number.isFinite(resolvedScaleCap) || resolvedScaleCap <= 0) {
        throw new Error('ZEN_BONSAI_CAMERA_SCALE_CAP_INVALID');
    }
    const scale = Math.min(naturalScale, resolvedScaleCap);
    const scaledSceneWidth = sceneWidth * scale;
    const scaledSceneHeight = sceneHeight * scale;
    const offsetX = padding.left + ((contentWidth - scaledSceneWidth) * 0.5) - (toNumber(safeSceneBounds.minX, 0) * scale);
    const offsetY = padding.top + (contentHeight - scaledSceneHeight) - (toNumber(safeSceneBounds.minY, 0) * scale);
    const projectors = createCameraProjectors({ offsetX, offsetY, scale });

    return {
        preset,
        viewportWidth: safeViewportWidth,
        viewportHeight: safeViewportHeight,
        padding,
        contentWidth,
        contentHeight,
        sceneBounds: safeSceneBounds,
        sceneWidth,
        sceneHeight,
        naturalScale,
        scale,
        offsetX,
        offsetY,
        ...projectors,
        originScreen: projectors.worldToScreen({ x: 0, y: 0 }),
    };
}

export function resolveAnchoredBonsaiCamera({
    viewportWidth,
    viewportHeight,
    sceneBounds,
    worldAnchor,
    viewportAnchor,
    preset = 'workspace',
}) {
    if (!isObject(sceneBounds)) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_SCENE_BOUNDS_REQUIRED');
    }
    if (!isObject(worldAnchor) || !isObject(viewportAnchor)) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_ANCHOR_REQUIRED');
    }

    const safeViewportWidth = Math.max(1, Math.round(toNumber(viewportWidth, 1)));
    const safeViewportHeight = Math.max(1, Math.round(toNumber(viewportHeight, 1)));
    const minX = resolveFiniteCameraNumber(sceneBounds.minX, 'SCENE_MIN_X');
    const maxX = resolveFiniteCameraNumber(sceneBounds.maxX, 'SCENE_MAX_X');
    const minY = resolveFiniteCameraNumber(sceneBounds.minY, 'SCENE_MIN_Y');
    const maxY = resolveFiniteCameraNumber(sceneBounds.maxY, 'SCENE_MAX_Y');
    if (maxX <= minX || maxY <= minY) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_SCENE_BOUNDS_INVALID');
    }

    const worldX = resolveFiniteCameraNumber(worldAnchor.x, 'WORLD_ANCHOR_X');
    const worldY = resolveFiniteCameraNumber(worldAnchor.y, 'WORLD_ANCHOR_Y');
    if (worldX < minX || worldX > maxX || worldY < minY || worldY > maxY) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_WORLD_ANCHOR_OUTSIDE_SCENE');
    }

    const screenX = resolveFiniteCameraNumber(viewportAnchor.x, 'VIEWPORT_ANCHOR_X');
    const screenY = resolveFiniteCameraNumber(viewportAnchor.y, 'VIEWPORT_ANCHOR_Y');
    const padding = resolveViewportPadding(safeViewportWidth, safeViewportHeight, preset);
    const contentLeft = padding.left;
    const contentTop = padding.top;
    const contentRight = safeViewportWidth - padding.right;
    const contentBottom = safeViewportHeight - padding.bottom;
    if (
        screenX < contentLeft
        || screenX > contentRight
        || screenY < contentTop
        || screenY > contentBottom
    ) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_VIEWPORT_ANCHOR_OUTSIDE_CONTENT');
    }

    const scaleCandidates = [
        [screenX - contentLeft, worldX - minX],
        [contentRight - screenX, maxX - worldX],
        [screenY - contentTop, worldY - minY],
        [contentBottom - screenY, maxY - worldY],
    ]
        .filter(([, worldSpan]) => worldSpan > 1e-6)
        .map(([screenSpan, worldSpan]) => screenSpan / worldSpan);
    if (
        !scaleCandidates.length
        || scaleCandidates.some((value) => !Number.isFinite(value) || value <= 0)
    ) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_SCALE_INVALID');
    }

    const scale = Math.min(...scaleCandidates);
    if (scale < 0.01) {
        throw new Error('ZEN_BONSAI_ANCHORED_CAMERA_CONTENT_TOO_LARGE');
    }
    const offsetX = screenX - (worldX * scale);
    const offsetY = screenY - (worldY * scale);
    const projectors = createCameraProjectors({ offsetX, offsetY, scale });
    const safeSceneBounds = {
        ...sceneBounds,
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };

    return {
        preset,
        viewportWidth: safeViewportWidth,
        viewportHeight: safeViewportHeight,
        padding,
        contentWidth: Math.max(1, contentRight - contentLeft),
        contentHeight: Math.max(1, contentBottom - contentTop),
        sceneBounds: safeSceneBounds,
        sceneWidth: safeSceneBounds.width,
        sceneHeight: safeSceneBounds.height,
        scale,
        offsetX,
        offsetY,
        ...projectors,
        originScreen: projectors.worldToScreen({ x: 0, y: 0 }),
    };
}
