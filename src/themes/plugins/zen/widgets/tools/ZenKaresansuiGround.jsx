import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { requireZenAmbientPresentation } from '../../api/environment.js';
import {
    resolveZenAmbientPalette,
    resolveZenAmbientRoleColor,
} from '../../runtime/environment/zenWorldMaterialPalette.js';
import { loadZenArtifactGalleryClient } from '../../presentation/artifacts/engine/zenArtifactModules.js';
import {
    ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX,
    ZEN_KARESANSUI_HEIGHTFIELD_MAX_PIXELS,
    ZEN_KARESANSUI_HEIGHTFIELD_VERSION,
} from '../../presentation/artifacts/karesansui/zenKaresansuiHeightfieldContract.js';
import { useDevicePixelRatio } from '@/ui-kit/hooks/useDevicePixelRatio.js';

// Ridge height as a fraction of the raking period. Low enough that the sand
// reads as soft, high enough that a low sun still finds every crest.
const ZEN_KARESANSUI_RIDGE = 0.24;
const ZEN_KARESANSUI_MAX_PIXEL_RATIO = 2;
// Sun elevation range across the solar day, and the fixed moonlight elevation
// night blends toward. Azimuth follows the ambient light's lateral direction.
const SUN_ELEVATION_LOW_DEG = 5;
const SUN_ELEVATION_HIGH_DEG = 55;
const MOON_ELEVATION_DEG = 30;
const SUN_AZIMUTH_SPAN_DEG = 70;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round4(value) {
    return Math.round(value * 10000) / 10000;
}

function requireFiniteNumber(value, field) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_KARESANSUI_GROUND_RUNTIME_INVALID:${field}`);
    }
    return value;
}

function hexToLinear(color) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(color).trim());
    if (!match) throw new Error(`ZEN_KARESANSUI_GROUND_COLOR_INVALID:${String(color)}`);
    return [0, 2, 4].map((offset) => round4(((Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255) ** 2.2)));
}

export function resolveZenKaresansuiPalette(ambientPresentation) {
    const ambient = requireZenAmbientPresentation(ambientPresentation);
    const palette = resolveZenAmbientPalette(ambient);
    const mixSurface = (day, warm, twilight, night) => resolveZenAmbientRoleColor({
        day,
        warm,
        twilight,
        night,
    }, ambient);

    return Object.freeze({
        atmosphereTop: palette.terrain.atmosphereTop,
        atmosphereHorizon: mixSurface('#f0ede5', '#eac194', '#6f5e74', '#414b63'),
        sandRear: mixSurface('#ece8df', '#d8c1a3', '#786879', '#536079'),
        sandBase: palette.terrain.sandBase,
        sandFront: palette.terrain.sandFront,
        // Light that reaches the sand: the sun (moon at night) on lit crests, the
        // open sky in shade, and warm bounce from the bed itself. Shade staying
        // cooler than the lit flank is what gives the ridges their softness.
        sunLight: mixSurface('#fffdf7', '#ffb885', '#dba0b2', '#b4bfe6'),
        shadeAmbient: mixSurface('#eef0f2', '#b9b8c8', '#5b5276', '#2d3858'),
        bounce: mixSurface('#d8cfc1', '#b08a68', '#4a3c4c', '#1e2540'),
        sheen: mixSurface('#ffffff', '#fff2d5', '#d8bfd8', '#8599c2'),
        edge: mixSurface('#a59b8f', '#a38268', '#685a70', '#30394f'),
    });
}

// Ground placement, camera and raking field from the stage runtime. The camera
// is the stage's ground camera (sceneRuntime), whose units put the karesansui
// centre at depth 1, so ring sizes convert from screen pixels at the centre to
// world units by dividing by the focal length.
export function resolveZenKaresansuiHeightfieldModel(runtime) {
    const ground = runtime?.ground;
    if (!ground?.viewport || !ground.camera || !ground.rippleProjection || !ground.layout?.ring) {
        throw new Error('ZEN_KARESANSUI_GROUND_RUNTIME_REQUIRED');
    }
    const topPx = requireFiniteNumber(ground.viewport.topPx, 'viewport.topPx');
    const widthPx = requireFiniteNumber(ground.viewport.widthPx, 'viewport.widthPx');
    const layoutHeightPx = requireFiniteNumber(ground.viewport.heightPx, 'viewport.heightPx');
    const paintHeightPx = requireFiniteNumber(ground.viewport.paintHeightPx, 'viewport.paintHeightPx');
    const focalPx = requireFiniteNumber(ground.camera.focalPx, 'camera.focalPx');
    const baseRxPx = requireFiniteNumber(ground.rippleProjection.baseRxPx, 'rippleProjection.baseRxPx');
    const stepScale = requireFiniteNumber(ground.layout.ring.stepScale, 'layout.ring.stepScale');
    if (stepScale <= 0) throw new Error('ZEN_KARESANSUI_GROUND_RUNTIME_INVALID:layout.ring.stepScale');
    const innerRadius = baseRxPx / focalPx;

    return Object.freeze({
        topPx,
        widthPx: Math.max(1, widthPx),
        paintHeightPx: Math.max(1, paintHeightPx),
        topMaskBlackPx: clamp(layoutHeightPx * 0.18, 28, 68),
        camera: Object.freeze({
            horizonPx: requireFiniteNumber(ground.camera.horizonPx, 'camera.horizonPx'),
            focalPx,
            eyeHeight: requireFiniteNumber(ground.camera.eyeHeight, 'camera.eyeHeight'),
            centerX: requireFiniteNumber(ground.camera.centerPx?.x, 'camera.centerPx.x'),
        }),
        field: Object.freeze({
            innerRadius,
            spacing: innerRadius * stepScale,
            ringCount: requireFiniteNumber(ground.layout.ring.count, 'layout.ring.count'),
            ridge: ZEN_KARESANSUI_RIDGE,
        }),
    });
}

export function resolveZenKaresansuiLightDirection(ambientPresentation) {
    const ambient = requireZenAmbientPresentation(ambientPresentation);
    const sunElevationDeg = SUN_ELEVATION_LOW_DEG
        + ((SUN_ELEVATION_HIGH_DEG - SUN_ELEVATION_LOW_DEG) * clamp(ambient.solarElevation, 0, 1));
    const elevation = (sunElevationDeg + ((MOON_ELEVATION_DEG - sunElevationDeg) * ambient.nightDepth)) * (Math.PI / 180);
    const azimuth = clamp(ambient.lightVector.x, -1, 1) * SUN_AZIMUTH_SPAN_DEG * (Math.PI / 180);
    return [
        round4(Math.cos(elevation) * Math.sin(azimuth)),
        round4(Math.sin(elevation)),
        round4(-Math.cos(elevation) * Math.cos(azimuth)),
    ];
}

function resolveGroundPixelRatio(devicePixelRatio, widthPx, heightPx) {
    let ratio = clamp(Number(devicePixelRatio) || 1, 1, ZEN_KARESANSUI_MAX_PIXEL_RATIO);
    ratio = Math.min(ratio, ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX / widthPx, ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX / heightPx);
    const area = widthPx * heightPx * ratio * ratio;
    if (area > ZEN_KARESANSUI_HEIGHTFIELD_MAX_PIXELS) ratio *= Math.sqrt(ZEN_KARESANSUI_HEIGHTFIELD_MAX_PIXELS / area);
    return Math.max(0.25, Math.floor(ratio * 100) / 100);
}

export function buildZenKaresansuiHeightfieldRequest({ model, palette, ambientPresentation, devicePixelRatio }) {
    const ambient = requireZenAmbientPresentation(ambientPresentation);
    const pixelRatio = resolveGroundPixelRatio(devicePixelRatio, model.widthPx, model.paintHeightPx);
    const sunScale = 1 - (0.5 * ambient.nightDepth);
    const body = {
        version: ZEN_KARESANSUI_HEIGHTFIELD_VERSION,
        width: Math.max(1, Math.round(model.widthPx * pixelRatio)),
        height: Math.max(1, Math.round(model.paintHeightPx * pixelRatio)),
        pixelRatio,
        camera: {
            horizonPx: round4(model.camera.horizonPx),
            focalPx: round4(model.camera.focalPx),
            eyeHeight: round4(model.camera.eyeHeight),
            centerX: round4(model.camera.centerX),
        },
        field: {
            innerRadius: round4(model.field.innerRadius),
            spacing: round4(model.field.spacing),
            ringCount: model.field.ringCount,
            ridge: model.field.ridge,
        },
        light: { direction: resolveZenKaresansuiLightDirection(ambient) },
        colors: {
            sun: hexToLinear(palette.sunLight).map((channel) => round4(channel * sunScale)),
            shadeAmbient: hexToLinear(palette.shadeAmbient),
            bounce: hexToLinear(palette.bounce),
            horizon: hexToLinear(palette.atmosphereHorizon),
            sandRear: hexToLinear(palette.sandRear),
            sandBase: hexToLinear(palette.sandBase),
            sandFront: hexToLinear(palette.sandFront),
        },
    };
    return Object.freeze({ ...body, key: JSON.stringify(body) });
}

/**
 * ZenKaresansuiGround
 * Raked sand as a lit heightfield. The frame is rendered by the artifact
 * worker (same channel and lifetime as the gallery engine) and shown through a
 * bitmaprenderer canvas; it is static and re-rendered only when the stage
 * geometry, device resolution or ambient light changes. Until the first frame
 * lands, the container's plain sand gradient stands in.
 */
export default function ZenKaresansuiGround({
    ambientPresentation,
    isActive = true,
    runtime,
}) {
    const ambient = requireZenAmbientPresentation(ambientPresentation);
    const palette = useMemo(() => resolveZenKaresansuiPalette(ambient), [ambient]);
    const model = useMemo(() => resolveZenKaresansuiHeightfieldModel(runtime), [runtime]);
    const devicePixelRatio = useDevicePixelRatio();
    const request = useMemo(
        () => buildZenKaresansuiHeightfieldRequest({ model, palette, ambientPresentation: ambient, devicePixelRatio }),
        [model, palette, ambient, devicePixelRatio],
    );
    // Ambient presentation objects are rebuilt freely upstream; the worker only
    // renders when the resolved frame actually differs.
    const requestRef = useRef(request);
    requestRef.current = request;
    const requestKey = request.key;
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [groundHost, setGroundHost] = useState(null);
    const [failure, setFailure] = useState(null);

    useLayoutEffect(() => {
        let cancelled = false;
        let host = null;
        void loadZenArtifactGalleryClient().then(({ acquireZenKaresansuiGroundRenderer }) => {
            if (cancelled) return;
            host = acquireZenKaresansuiGroundRenderer({
                devicePixelRatio,
                onError: (error) => { if (!cancelled) setFailure(error); },
            });
            setGroundHost(host);
        }).catch((error) => { if (!cancelled) setFailure(error); });
        return () => {
            cancelled = true;
            host?.dispose();
        };
    }, [devicePixelRatio]);

    useEffect(() => {
        if (!groundHost) return undefined;
        let current = true;
        const canvas = canvasRef.current;
        canvas.dataset.zenKaresansuiGroundStatus = 'rendering';
        groundHost.render(requestRef.current).then((result) => {
            if (result.status !== 'rendered') return;
            if (!current) { result.bitmap.close(); return; }
            if (!contextRef.current) {
                contextRef.current = canvas.getContext('bitmaprenderer');
                if (!contextRef.current) {
                    result.bitmap.close();
                    throw new Error('ZEN_KARESANSUI_GROUND_BITMAP_PRESENTATION_UNAVAILABLE');
                }
            }
            if (canvas.width !== result.bitmap.width) canvas.width = result.bitmap.width;
            if (canvas.height !== result.bitmap.height) canvas.height = result.bitmap.height;
            contextRef.current.transferFromImageBitmap(result.bitmap);
            canvas.dataset.zenKaresansuiGroundStatus = 'ready';
        }).catch((error) => { if (current) setFailure(error); });
        return () => { current = false; };
    }, [groundHost, requestKey]);

    if (failure) throw failure;

    const placeholder = `linear-gradient(180deg, ${palette.sandRear} 0%, ${palette.sandBase} 48%, ${palette.sandFront} 100%)`;
    const mask = `linear-gradient(to bottom, transparent 0px, black ${model.topMaskBlackPx}px, black 100%)`;

    return (
        <div
            aria-hidden="true"
            className="absolute inset-x-0 z-0 pointer-events-none"
            data-zen-karesansui-ground="heightfield"
            data-zen-karesansui-selected={isActive ? 'true' : 'false'}
            data-zen-karesansui-phase={ambient.phase}
            style={{
                top: `${model.topPx}px`,
                height: `${model.paintHeightPx}px`,
            }}
        >
            <div
                className="absolute inset-0 overflow-hidden"
                style={{
                    background: placeholder,
                    WebkitMaskImage: mask,
                    maskImage: mask,
                }}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full"
                    data-zen-karesansui-ground-canvas="worker-bitmap"
                />
            </div>
        </div>
    );
}
