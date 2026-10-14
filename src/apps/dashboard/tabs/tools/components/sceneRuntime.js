import { DEFAULT_TOOLS_SCENE_SPEC } from '../../../../../themes/core/sceneSpecs/default.js';

const DEFAULT_SCENE_SPEC = DEFAULT_TOOLS_SCENE_SPEC;
const ALLOWED_WORLD_UNITS = new Set(['normalized_min_dim', 'normalized_max_dim', 'px']);
const ALLOWED_FIT_MODES = new Set(['contain', 'cover']);
// Horizon sits this far above the ground top so the plane never reaches
// infinite depth inside the painted ground.
const GROUND_HORIZON_LEAD_PX = 6;
const REQUIRED_ANCHOR_KEYS = Object.freeze(['scene_origin', 'ground_center', 'artifact_origin', 'karesansui_center']);
const WARNED_SCENE_SPEC_KEYS = new Set();
let activeSceneSpecDiagnostics = null;

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function warnSceneSpecOnce(path, reason, received) {
    const key = `${path}:${reason}`;
    if (Array.isArray(activeSceneSpecDiagnostics)) {
        activeSceneSpecDiagnostics.push(Object.freeze({
            path,
            reason,
            received,
        }));
    }
    if (WARNED_SCENE_SPEC_KEYS.has(key)) return;
    WARNED_SCENE_SPEC_KEYS.add(key);
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    console.warn(`[sceneRuntime] Invalid sceneSpec at "${path}": ${reason}. Fallback applied.`, { received });
}

function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function mergeDeep(base, override) {
    if (!isPlainObject(override)) return { ...base };
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value === undefined) continue;
        const baseValue = out[key];
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            out[key] = mergeDeep(baseValue, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function readFiniteNumber(value, fallback, path, { min = -Infinity, max = Infinity, integer = false } = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        if (value !== undefined) {
            warnSceneSpecOnce(path, 'expected finite number', value);
        }
        return fallback;
    }
    let next = parsed;
    if (integer) next = Math.round(next);
    if (next < min || next > max) {
        warnSceneSpecOnce(path, `out of range [${min}, ${max}]`, value);
        next = clamp(next, min, max);
    }
    return next;
}

function readLowerEnum(value, fallback, path, allowedSet) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (allowedSet.has(normalized)) return normalized;
    if (value !== undefined) {
        warnSceneSpecOnce(path, `expected one of ${Array.from(allowedSet).join(', ')}`, value);
    }
    return fallback;
}

function normalizeWorldPoint(value, fallbackPoint, path) {
    const source = isPlainObject(value) ? value : {};
    if (value !== undefined && !isPlainObject(value)) {
        warnSceneSpecOnce(path, 'expected object {x,y,z}', value);
    }
    return {
        x: readFiniteNumber(source.x, fallbackPoint.x, `${path}.x`, { min: -50, max: 50 }),
        y: readFiniteNumber(source.y, fallbackPoint.y, `${path}.y`, { min: -50, max: 50 }),
        z: readFiniteNumber(source.z, fallbackPoint.z, `${path}.z`, { min: -50, max: 50 }),
    };
}

function normalizeCameraSpec(camera) {
    const fallback = DEFAULT_SCENE_SPEC.camera;
    const source = isPlainObject(camera) ? camera : {};
    if (camera !== undefined && !isPlainObject(camera)) {
        warnSceneSpecOnce('camera', 'expected object', camera);
    }
    return {
        perspective: readFiniteNumber(source.perspective, fallback.perspective, 'camera.perspective', { min: 1, max: 5000 }),
        center: {
            x: readFiniteNumber(source?.center?.x, fallback.center.x, 'camera.center.x', { min: 0, max: 1 }),
            y: readFiniteNumber(source?.center?.y, fallback.center.y, 'camera.center.y', { min: 0, max: 1 }),
        },
    };
}

function normalizeGroundLayout(layout) {
    const fallback = DEFAULT_SCENE_SPEC.groundLayout;
    const source = isPlainObject(layout) ? layout : {};
    if (layout !== undefined && !isPlainObject(layout)) {
        warnSceneSpecOnce('groundLayout', 'expected object', layout);
    }
    return {
        topOffsetWorld: readFiniteNumber(source.topOffsetWorld, fallback.topOffsetWorld, 'groundLayout.topOffsetWorld', { min: -4, max: 4 }),
        concentricMask: {
            rxPercent: readFiniteNumber(source?.concentricMask?.rxPercent, fallback.concentricMask.rxPercent, 'groundLayout.concentricMask.rxPercent', { min: 0.1, max: 200 }),
            ryPercent: readFiniteNumber(source?.concentricMask?.ryPercent, fallback.concentricMask.ryPercent, 'groundLayout.concentricMask.ryPercent', { min: 0.1, max: 200 }),
        },
        ring: {
            count: readFiniteNumber(source?.ring?.count, fallback.ring.count, 'groundLayout.ring.count', { min: 1, max: 64, integer: true }),
            baseRxPercent: readFiniteNumber(source?.ring?.baseRxPercent, fallback.ring.baseRxPercent, 'groundLayout.ring.baseRxPercent', { min: 0.1, max: 200 }),
            // A fixed inner ring radius in CSS px. When declared it is the ring
            // size, so the garden keeps its scale and a larger viewport shows
            // more sand instead of zooming the rings away from fixed-size
            // artifacts. `null` keeps the viewport-relative `baseRxPercent`.
            baseRxPx: source?.ring?.baseRxPx === null || source?.ring?.baseRxPx === undefined
                ? null
                : readFiniteNumber(source.ring.baseRxPx, null, 'groundLayout.ring.baseRxPx', { min: 1, max: 2000 }),
            baseRyPercent: readFiniteNumber(source?.ring?.baseRyPercent, fallback.ring.baseRyPercent, 'groundLayout.ring.baseRyPercent', { min: 0.1, max: 200 }),
            stepScale: readFiniteNumber(source?.ring?.stepScale, fallback.ring.stepScale, 'groundLayout.ring.stepScale', { min: 0, max: 10 }),
            tiltDeg: readFiniteNumber(source?.ring?.tiltDeg, fallback.ring.tiltDeg, 'groundLayout.ring.tiltDeg', { min: -45, max: 45 }),
            grooveShadowStrokeWidth: readFiniteNumber(source?.ring?.grooveShadowStrokeWidth, fallback.ring.grooveShadowStrokeWidth, 'groundLayout.ring.grooveShadowStrokeWidth', { min: 0.1, max: 20 }),
            grooveHighlightStrokeWidth: readFiniteNumber(source?.ring?.grooveHighlightStrokeWidth, fallback.ring.grooveHighlightStrokeWidth, 'groundLayout.ring.grooveHighlightStrokeWidth', { min: 0.1, max: 20 }),
            grooveHighlightYOffsetPercent: readFiniteNumber(source?.ring?.grooveHighlightYOffsetPercent, fallback.ring.grooveHighlightYOffsetPercent, 'groundLayout.ring.grooveHighlightYOffsetPercent', { min: -50, max: 50 }),
        },
        focus: {
            rxPercent: readFiniteNumber(source?.focus?.rxPercent, fallback.focus.rxPercent, 'groundLayout.focus.rxPercent', { min: 0.1, max: 200 }),
            ryPercent: readFiniteNumber(source?.focus?.ryPercent, fallback.focus.ryPercent, 'groundLayout.focus.ryPercent', { min: 0.1, max: 200 }),
            pulseScaleMax: readFiniteNumber(source?.focus?.pulseScaleMax, fallback.focus.pulseScaleMax, 'groundLayout.focus.pulseScaleMax', { min: 0.1, max: 5 }),
        },
        debugMarker: {
            outerRadiusPx: readFiniteNumber(source?.debugMarker?.outerRadiusPx, fallback.debugMarker.outerRadiusPx, 'groundLayout.debugMarker.outerRadiusPx', { min: 0.1, max: 128 }),
            innerRadiusPx: readFiniteNumber(source?.debugMarker?.innerRadiusPx, fallback.debugMarker.innerRadiusPx, 'groundLayout.debugMarker.innerRadiusPx', { min: 0.1, max: 128 }),
        },
    };
}

function normalizeAnchors(anchors) {
    const fallbackAnchors = DEFAULT_SCENE_SPEC.anchors;
    const source = isPlainObject(anchors) ? anchors : {};
    if (anchors !== undefined && !isPlainObject(anchors)) {
        warnSceneSpecOnce('anchors', 'expected object map', anchors);
    }

    const out = {};
    for (const [key, value] of Object.entries(source)) {
        out[key] = normalizeWorldPoint(value, { x: 0, y: 0, z: 0 }, `anchors.${key}`);
    }

    for (const key of REQUIRED_ANCHOR_KEYS) {
        if (!isPlainObject(out[key])) {
            if (source[key] === undefined) {
                warnSceneSpecOnce(`anchors.${key}`, 'missing required anchor', source[key]);
            }
            out[key] = normalizeWorldPoint(fallbackAnchors[key], fallbackAnchors[key], `anchors.${key}`);
        }
    }

    return out;
}

function normalizeArtifactPlacements(artifacts, anchors) {
    const fallbackArtifacts = DEFAULT_SCENE_SPEC.artifacts;
    const source = isPlainObject(artifacts) ? artifacts : {};
    if (artifacts !== undefined && !isPlainObject(artifacts)) {
        warnSceneSpecOnce('artifacts', 'expected object map', artifacts);
    }

    const out = {};
    for (const [key, value] of Object.entries(source)) {
        if (!isPlainObject(value)) {
            warnSceneSpecOnce(`artifacts.${key}`, 'expected object', value);
            continue;
        }
        const rawAnchorId = typeof value.anchorId === 'string' ? value.anchorId.trim() : '';
        const anchorId = rawAnchorId || 'artifact_origin';
        if (!anchors[anchorId]) {
            warnSceneSpecOnce(`artifacts.${key}.anchorId`, 'unknown anchorId', rawAnchorId);
        }
        out[key] = {
            anchorId: anchors[anchorId] ? anchorId : 'artifact_origin',
            offset: normalizeWorldPoint(value.offset, { x: 0, y: 0, z: 0 }, `artifacts.${key}.offset`),
        };
    }

    const fallbackKeys = Object.keys(fallbackArtifacts);
    for (const key of fallbackKeys) {
        if (!isPlainObject(out[key])) {
            const fallbackPlacement = fallbackArtifacts[key];
            out[key] = {
                anchorId: fallbackPlacement.anchorId,
                offset: normalizeWorldPoint(
                    fallbackPlacement.offset,
                    { x: 0, y: 0, z: 0 },
                    `artifacts.${key}.offset`,
                ),
            };
        }
    }

    return out;
}

function normalizeSceneSpec(spec) {
    const source = isPlainObject(spec) ? spec : {};
    if (spec !== undefined && !isPlainObject(spec)) {
        warnSceneSpecOnce('sceneSpec', 'expected object', spec);
    }

    const normalizedAnchors = normalizeAnchors(source.anchors);

    return {
        version: readFiniteNumber(source.version, 1, 'version', { min: 1, max: 1, integer: true }),
        worldUnit: readLowerEnum(source.worldUnit, DEFAULT_SCENE_SPEC.worldUnit, 'worldUnit', ALLOWED_WORLD_UNITS),
        fitMode: readLowerEnum(source.fitMode, DEFAULT_SCENE_SPEC.fitMode, 'fitMode', ALLOWED_FIT_MODES),
        camera: normalizeCameraSpec(source.camera),
        groundLayout: normalizeGroundLayout(source.groundLayout),
        anchors: normalizedAnchors,
        artifacts: normalizeArtifactPlacements(source.artifacts, normalizedAnchors),
    };
}

function resolveWorldUnitPx(worldUnit, fitMode, width, height) {
    const safeWidth = Math.max(0, toFiniteNumber(width, 0));
    const safeHeight = Math.max(0, toFiniteNumber(height, 0));
    if (safeWidth <= 0 || safeHeight <= 0) return 1;

    const mode = String(fitMode || 'contain').trim().toLowerCase();
    const minDim = Math.min(safeWidth, safeHeight);
    const maxDim = Math.max(safeWidth, safeHeight);

    if (worldUnit === 'normalized_max_dim') {
        return mode === 'cover' ? maxDim : minDim;
    }
    if (worldUnit === 'px') {
        return 1;
    }
    return mode === 'cover' ? maxDim : minDim;
}

function resolveAnchorWorld(anchors, anchorId) {
    const key = typeof anchorId === 'string' && anchorId.trim()
        ? anchorId.trim()
        : 'scene_origin';
    const value = isPlainObject(anchors?.[key])
        ? anchors[key]
        : anchors.scene_origin;
    return {
        x: toFiniteNumber(value.x, 0),
        y: toFiniteNumber(value.y, 0),
        z: toFiniteNumber(value.z, 0),
    };
}

function resolveCamera(cameraSpec, width, height) {
    const centerXRatio = clamp(toFiniteNumber(cameraSpec?.center?.x, 0.5), 0, 1);
    const centerYRatio = clamp(toFiniteNumber(cameraSpec?.center?.y, 0.7), 0, 1);
    return {
        perspective: Math.max(1, toFiniteNumber(cameraSpec?.perspective, 980)),
        centerRatio: {
            x: centerXRatio,
            y: centerYRatio,
        },
        screenCenter: {
            x: width * centerXRatio,
            y: height * centerYRatio,
        },
    };
}

function projectWorldToScreen(worldPoint, cameraCenterPx, worldUnitPx) {
    return {
        x: cameraCenterPx.x + (worldPoint.x * worldUnitPx),
        y: cameraCenterPx.y + (worldPoint.y * worldUnitPx),
        z: worldPoint.z * worldUnitPx,
    };
}

export function normalizeArtifactGallerySceneSpec(sceneSpec) {
    const diagnostics = [];
    activeSceneSpecDiagnostics = diagnostics;
    let spec = DEFAULT_SCENE_SPEC;
    try {
        const mergedSpec = mergeDeep(DEFAULT_SCENE_SPEC, sceneSpec);
        spec = normalizeSceneSpec(mergedSpec);
    } finally {
        activeSceneSpecDiagnostics = null;
    }

    return Object.freeze({
        spec,
        diagnostics: Object.freeze([...diagnostics]),
    });
}

export function resolveArtifactGallerySceneRuntime({
    sceneSpec,
    normalizedSceneSpec = null,
    artifactKey,
    width,
    height,
    paintBleedBottomPx = 0,
} = {}) {
    const safeWidth = Math.max(0, toFiniteNumber(width, 0));
    const safeHeight = Math.max(0, toFiniteNumber(height, 0));
    // `height` is the layout box the stage is composed in. The painted scene may
    // run further down (under an in-scene index); only the ground's paint extent
    // follows it — camera, anchors and ground metrics stay on the layout box.
    const bleedBottomPx = Math.max(0, toFiniteNumber(paintBleedBottomPx, 0));
    const hasViewport = safeWidth > 0 && safeHeight > 0;
    const normalizedRecord = normalizedSceneSpec?.spec
        ? normalizedSceneSpec
        : normalizeArtifactGallerySceneSpec(sceneSpec);
    const spec = normalizedRecord.spec;
    const diagnostics = Array.isArray(normalizedRecord.diagnostics)
        ? [...normalizedRecord.diagnostics]
        : [];

    const worldUnitPx = resolveWorldUnitPx(spec.worldUnit, spec.fitMode, safeWidth, safeHeight);
    const camera = resolveCamera(spec.camera, safeWidth, safeHeight);
    const anchors = spec.anchors;
    const artifactPlacements = spec.artifacts;

    const sceneOriginWorld = resolveAnchorWorld(anchors, 'scene_origin');
    const groundCenterWorld = resolveAnchorWorld(anchors, 'ground_center');
    const karesansuiCenterWorld = resolveAnchorWorld(anchors, 'karesansui_center');

    const resolvedArtifactKey = typeof artifactKey === 'string' && artifactKey.trim()
        ? artifactKey.trim()
        : 'default';

    const artifactPlacement = isPlainObject(artifactPlacements?.[resolvedArtifactKey])
        ? artifactPlacements[resolvedArtifactKey]
        : artifactPlacements.default;
    if (!isPlainObject(artifactPlacements?.[resolvedArtifactKey]) && resolvedArtifactKey !== 'default') {
        activeSceneSpecDiagnostics = diagnostics;
        warnSceneSpecOnce(`artifacts.${resolvedArtifactKey}`, 'missing artifact placement; using default', artifactKey);
        activeSceneSpecDiagnostics = null;
    }

    const artifactAnchorWorld = resolveAnchorWorld(anchors, artifactPlacement.anchorId);
    const artifactOffsetWorld = {
        x: toFiniteNumber(artifactPlacement?.offset?.x, 0),
        y: toFiniteNumber(artifactPlacement?.offset?.y, 0),
        z: toFiniteNumber(artifactPlacement?.offset?.z, 0),
    };
    const artifactWorld = {
        x: artifactAnchorWorld.x + artifactOffsetWorld.x,
        y: artifactAnchorWorld.y + artifactOffsetWorld.y,
        z: artifactAnchorWorld.z + artifactOffsetWorld.z,
    };

    const sceneOriginScreen = projectWorldToScreen(sceneOriginWorld, camera.screenCenter, worldUnitPx);
    const groundCenterScreen = projectWorldToScreen(groundCenterWorld, camera.screenCenter, worldUnitPx);
    const karesansuiCenterScreen = projectWorldToScreen(karesansuiCenterWorld, camera.screenCenter, worldUnitPx);
    const artifactAnchorScreen = projectWorldToScreen(artifactAnchorWorld, camera.screenCenter, worldUnitPx);
    const artifactScreen = projectWorldToScreen(artifactWorld, camera.screenCenter, worldUnitPx);

    const groundTopPx = clamp(
        groundCenterScreen.y + (spec.groundLayout.topOffsetWorld * worldUnitPx),
        0,
        Math.max(0, safeHeight - 1),
    );
    const groundHeightPx = Math.max(1, safeHeight - groundTopPx);
    const karesansuiCenterPercent = {
        x: clamp((karesansuiCenterScreen.x / Math.max(1, safeWidth)) * 100, 0, 100),
        y: clamp(((karesansuiCenterScreen.y - groundTopPx) / groundHeightPx) * 100, 0, 100),
    };
    const karesansuiCenterGroundPx = {
        x: clamp(karesansuiCenterScreen.x, 0, Math.max(1, safeWidth)),
        y: clamp(karesansuiCenterScreen.y - groundTopPx, 0, groundHeightPx),
    };
    // The ground is a plane seen through a pinhole camera: its horizon sits a
    // hair above the ground top and its focal length is the scene's declared
    // perspective. Units are chosen so the karesansui centre lies at depth 1;
    // the eye height is then the screen drop from horizon to centre over focal.
    // Every consumer of ground foreshortening (the raked heightfield, the gate's
    // ripples) reads this one camera, so rings and ripples share one ellipse.
    const groundFocalPx = camera.perspective;
    const groundCentreDropPx = karesansuiCenterGroundPx.y + GROUND_HORIZON_LEAD_PX;
    const groundCamera = {
        horizonPx: -GROUND_HORIZON_LEAD_PX,
        focalPx: groundFocalPx,
        eyeHeight: groundCentreDropPx / groundFocalPx,
        centerPx: karesansuiCenterGroundPx,
    };
    const baseRxPx = spec.groundLayout.ring.baseRxPx !== null
        ? spec.groundLayout.ring.baseRxPx
        : Math.max(0.001, (toFiniteNumber(spec.groundLayout?.ring?.baseRxPercent, 5.5) / 100) * safeWidth);
    // A small circle at depth 1 foreshortens by eyeHeight / depth = eyeHeight.
    const ellipseAspect = clamp(groundCamera.eyeHeight, 0.05, 4);
    const rippleProjection = {
        tiltDeg: toFiniteNumber(spec.groundLayout?.ring?.tiltDeg, 0),
        ellipseAspect,
        baseRxPx,
        baseRyPx: baseRxPx * ellipseAspect,
    };

    return {
        hasViewport,
        viewport: {
            width: safeWidth,
            height: safeHeight,
        },
        fitMode: spec.fitMode,
        worldUnitPx,
        camera,
        spec,
        ground: {
            layout: spec.groundLayout,
            viewport: {
                topPx: groundTopPx,
                heightPx: groundHeightPx,
                widthPx: safeWidth,
                bleedBottomPx,
                paintHeightPx: groundHeightPx + bleedBottomPx,
            },
            coordinateSpace: {
                origin: 'ground_viewport',
                viewBox: {
                    x: 0,
                    y: 0,
                    width: Math.max(1, safeWidth),
                    height: groundHeightPx + bleedBottomPx,
                },
            },
            camera: groundCamera,
            rippleProjection,
            karesansuiCenterPx: karesansuiCenterGroundPx,
            karesansuiCenterPercent,
        },
        anchors: {
            sceneOrigin: {
                world: sceneOriginWorld,
                screen: sceneOriginScreen,
            },
            groundCenter: {
                world: groundCenterWorld,
                screen: groundCenterScreen,
            },
            karesansuiCenter: {
                world: karesansuiCenterWorld,
                screen: karesansuiCenterScreen,
            },
            artifactAnchor: {
                world: artifactAnchorWorld,
                screen: artifactAnchorScreen,
            },
        },
        artifact: {
            key: resolvedArtifactKey,
            world: artifactWorld,
            screen: artifactScreen,
            offsetWorld: artifactOffsetWorld,
        },
        diagnostics: Object.freeze({
            sceneSpecFallbackApplied: diagnostics.length > 0,
            sceneSpecWarnings: Object.freeze([...diagnostics]),
        }),
    };
}

export const DEFAULT_ARTIFACT_GALLERY_SCENE_SPEC = DEFAULT_SCENE_SPEC;
