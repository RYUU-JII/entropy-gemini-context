/**
 * Pixi backend for the G15.4 bonsai.
 *
 * The Canvas2D backend repaints the whole scene every frame: a thousand-odd
 * commands, most of them brush ribbons that expand into banded polygons with a
 * gradient each. Nothing about that work changes between frames except a few
 * limb angles, so it is the same picture being recomputed sixty times a second.
 *
 * This backend pays that cost once. Every run of commands is baked into a
 * texture at rest pose, and a frame becomes a handful of sprite rotations.
 *
 * Two things decide the shape of it:
 *
 * 1. **Order is preserved by construction.** The command stream is already
 *    depth sorted, so the bake walks it in order and starts a new sprite
 *    whenever the rig part changes. Grouping by rig instead — all static wood
 *    into one layer, limbs on top — would lift every limb in front of the
 *    trunk, including the ones behind it.
 * 2. **Sprites are cropped to what they paint.** A run baked at full surface
 *    size costs the whole canvas in texture memory, and there are of the order
 *    of a hundred runs. `zenBonsaiG15CommandBounds` measures each run instead.
 *
 * Painting itself is delegated to the canonical Canvas2D executor, so both
 * backends put down the same marks with the same brush; only the compositing
 * and the per-frame transform differ.
 */

import {
    Application,
    BaseTexture,
    Container,
    Geometry,
    Graphics,
    Mesh,
    MIPMAP_MODES,
    SCALE_MODES,
    Shader,
    Rectangle,
    Sprite,
    Texture,
    WRAP_MODES,
} from '@/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js';

import {
    ZenBonsaiCanvasExecutor,
} from '../../model/bonsai/g15/render-runtime.js';
import { destroyZenBonsaiG15Bake } from './destroyZenBonsaiG15Bake.js';
import {
    buildG15Scene,
} from '../../model/bonsai/g15/ZenBonsaiG15Scene.js';
import {
    requireZenBonsaiG15RenderPlanV1,
} from '../../model/bonsai/g15/ZenBonsaiG15RenderPlan.js';
import {
    resolveZenHomeGardenBedDeviceMesh,
    resolveZenHomeGardenBedMaterialPreset,
} from '../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    drawZenHomeGardenBedBackLayer,
    drawZenHomeGardenBedContactShadow,
    drawZenHomeGardenBedFrontLayer,
} from '../../model/bonsai/rendering/zenHomeGardenBedRenderer.js';
import {
    resolveZenPotRenderModel,
} from '../../model/ZenPotRenderer.js';
import {
    resolveSakuraRenderLighting,
} from '../../model/sakura/sakuraRenderLighting.js';
import {
    drawZenBonsaiOpenAirBackdrop,
} from '../../model/bonsai/rendering/zenBonsaiOpenAirBackdrop.js';
import {
    resolveZenBonsaiInkTint,
    tintZenBonsaiPalette,
} from '../../model/bonsai/rendering/zenBonsaiInkTint.js';
import {
    resolveZenBonsaiPaperTile,
    ZEN_BONSAI_PAPER_TILE_ALPHA,
    ZEN_BONSAI_PAPER_TILE_SIZE,
    ZEN_BONSAI_PAPER_VEIL_ALPHA,
} from '../../model/bonsai/rendering/zenBonsaiPaperSurface.js';
import {
    createZenBonsaiPaperFilter,
} from './zenBonsaiPaperFilter.js';
import {
    resolveZenBonsaiRigMotion,
} from '../../model/bonsai/rendering/zenBonsaiRigMotion.js';
import {
    resolveZenBonsaiPresentationStyle,
} from '../../model/bonsai/rendering/zenBonsaiPresentationStyle.js';
import {
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
    resolveZenBonsaiWorkerRendererLabel,
} from '../worker/zenBonsaiWorkerProtocol.js';
import {
    resolveZenBonsaiG15CommandRunBounds,
} from './zenBonsaiG15CommandBounds.js';
import { createZenRainPixiMesh } from '../rain/createZenRainPixiMesh.js';
import { resolveZenBonsaiRainInputs, resolveZenBonsaiRainPresentation } from '../rain/zenRainStreakRuntime.js';
import { hashStringFNV1a } from '../../shared/zenSeededRandom.js';

const RENDERER_NAME = resolveZenBonsaiWorkerRendererLabel(
    ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15,
);

const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
const clampPixelExtent = (value) => Math.max(1, Math.round(toNumber(value, 1)));
const clampPixelRatio = (value) => {
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio <= 0) return 1;
    return Math.min(3, ratio);
};
const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);
const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};

const createBakeCanvas = (width, height) => {
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(clampPixelExtent(width), clampPixelExtent(height));
    }
    if (typeof document !== 'undefined' && document.createElement) {
        const canvas = document.createElement('canvas');
        canvas.width = clampPixelExtent(width);
        canvas.height = clampPixelExtent(height);
        return canvas;
    }
    throw new Error('ZEN_BONSAI_G15_PIXI_BAKE_CANVAS_UNAVAILABLE');
};

const textureFromCanvas = (canvas, wrapMode = WRAP_MODES.CLAMP) => new Texture(new BaseTexture(canvas, {
    wrapMode,
    // The bake is already at device resolution and is only ever rotated by a
    // few degrees, so a mipmap chain would cost memory to make it softer.
    mipmap: MIPMAP_MODES.OFF,
    scaleMode: SCALE_MODES.LINEAR,
    resolution: 1,
}));

/** Straight 0..1 RGB for the shader's veil uniform. */
const parseVeilColor = (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (hex.length === 6) {
        return [
            Number.parseInt(hex.slice(0, 2), 16) / 255,
            Number.parseInt(hex.slice(2, 4), 16) / 255,
            Number.parseInt(hex.slice(4, 6), 16) / 255,
        ];
    }
    const channels = raw.match(/[\d.]+/gu);
    if (channels && channels.length >= 3) {
        return [
            Number(channels[0]) / 255,
            Number(channels[1]) / 255,
            Number(channels[2]) / 255,
        ];
    }
    throw new Error(`ZEN_BONSAI_G15_PIXI_VEIL_COLOR_INVALID:${raw || 'missing'}`);
};

export function createZenBonsaiG15PixiRenderer({ canvas } = {}) {
    if (!canvas) {
        throw new Error('ZEN_BONSAI_G15_PIXI_CANVAS_MISSING');
    }

    const application = new Application({
        view: canvas,
        width: clampPixelExtent(canvas.width),
        height: clampPixelExtent(canvas.height),
        backgroundAlpha: 0,
        antialias: false,
        autoStart: false,
        autoDensity: false,
        resolution: 1,
        zenPondSpriteBatchDialect: true,
        zenPondTilingSpriteDialect: true,
    });

    let disposed = false;
    let sizeState = {
        pixelWidth: clampPixelExtent(canvas.width),
        pixelHeight: clampPixelExtent(canvas.height),
        pixelRatio: 1,
    };
    /** @type {{signature: string, rigSprites: Array, rigParts: Array}|null} */
    let bake = null;
    let rain = null;

    const disposeBake = () => {
        if (!bake) return;
        const previousBake = bake;
        bake = null;
        // Weather meshes survive a tree/material bake and own their resources.
        rain?.container.parent?.removeChild(rain.container);
        destroyZenBonsaiG15Bake(previousBake);
    };

    const resize = (nextSizeState = {}) => {
        if (disposed) return;
        const next = {
            pixelWidth: clampPixelExtent(nextSizeState.pixelWidth),
            pixelHeight: clampPixelExtent(nextSizeState.pixelHeight),
            pixelRatio: clampPixelRatio(nextSizeState.pixelRatio),
        };
        const changed = next.pixelWidth !== sizeState.pixelWidth
            || next.pixelHeight !== sizeState.pixelHeight;
        sizeState = next;
        if (changed) {
            application.renderer.resize(sizeState.pixelWidth, sizeState.pixelHeight);
            // Every baked sprite was rasterized for the old surface.
            disposeBake();
        }
    };

    /**
     * Resolves everything the bake and the frame both need, exactly the way the
     * Canvas2D species renderer resolves it, so the two cannot drift.
     */
    const resolveSceneContext = (scene, options) => {
        const homeGardenBedGeometry = options.homeGardenBedProjection
            ? resolveZenHomeGardenBedDeviceMesh({
                projection: options.homeGardenBedProjection,
            })
            : null;
        const potModel = homeGardenBedGeometry
            ? resolveZenPotRenderModel({
                width: 180,
                height: 55,
                type: options.potStyleOverride,
            })
            : null;
        const materialStyle = options.gardenBedMaterialStyle || potModel?.materialStyle;
        const presentationStyle = resolveZenBonsaiPresentationStyle(options.presentationStyle);
        const inkTint = resolveZenBonsaiInkTint({
            environmentState: options.environmentState,
            presentationStyle: presentationStyle.id,
        });
        const bedPalette = homeGardenBedGeometry
            ? tintZenBonsaiPalette(
                resolveZenHomeGardenBedMaterialPreset(materialStyle).palette,
                inkTint.mapSurfaceColor,
            )
            : null;
        const sceneCameraOffsetX = Number(scene.camera?.offsetX);
        const sceneCameraOffsetY = Number(scene.camera?.offsetY);
        const plantingAnchor = homeGardenBedGeometry
            ? {
                x: homeGardenBedGeometry.plantingAnchor.x
                    - homeGardenBedGeometry.sceneViewport.x,
                y: homeGardenBedGeometry.plantingAnchor.y
                    - homeGardenBedGeometry.sceneViewport.y,
            }
            : {
                x: Number.isFinite(sceneCameraOffsetX)
                    ? sceneCameraOffsetX
                    : scene.width * 0.5,
                y: Number.isFinite(sceneCameraOffsetY)
                    ? sceneCameraOffsetY
                    : scene.height * 0.84,
            };
        return {
            homeGardenBedGeometry,
            materialStyle,
            presentationStyle,
            inkTint,
            bedPalette,
            plantingAnchor,
        };
    };

    const buildBake = ({ scene, options, renderPlan }) => {
        const context = resolveSceneContext(scene, options);
        const {
            homeGardenBedGeometry, materialStyle, presentationStyle, inkTint, bedPalette,
            plantingAnchor,
        } = context;
        const surfaceWidth = sizeState.pixelWidth;
        const surfaceHeight = sizeState.pixelHeight;
        const seed = renderPlan?.source?.topologySignature || scene.signature;
        const textures = [];
        const stage = application.stage;
        const sceneContainer = new Container();
        const filters = [];
        const resources = { sceneContainer, filters, textures };
        stage.addChild(sceneContainer);

        try {
            const executorOptions = {
                mapColor: inkTint.mapColor,
                mapAccentColor: inkTint.mapAccentColor,
                mapMassColor: inkTint.mapMassColor,
                brushStyle: presentationStyle.brush,
                canopyWashScale: presentationStyle.canopyWashScale,
                // Rest pose: the motion is what the sprite transform expresses.
            };

            // --- static back: sky, bed back, contact shadow -------------------
            const backCanvas = createBakeCanvas(surfaceWidth, surfaceHeight);
            const backCtx = backCanvas.getContext('2d');
            if (options.renderBackdrop !== false && options.renderMode !== 'trunk_sandbox') {
                drawZenBonsaiOpenAirBackdrop(backCtx, {
                    environmentState: options.environmentState,
                    lifeState: options.lifeState,
                    sceneViewport: homeGardenBedGeometry?.sceneViewport || null,
                    plantingAnchor,
                    seed,
                    pixelRatio: sizeState.pixelRatio,
                    // G15 has no per-frame star layer; bright stars rest in the sky.
                    celestial: { mode: 'rest' },
                });
            }
            if (homeGardenBedGeometry && options.skipPot !== true) {
                drawZenHomeGardenBedBackLayer(backCtx, {
                    geometry: homeGardenBedGeometry,
                    palette: bedPalette,
                    materialStyle,
                });
                drawZenHomeGardenBedContactShadow(backCtx, {
                    geometry: homeGardenBedGeometry,
                    lighting: resolveSakuraRenderLighting(options.environmentState),
                });
            }
            // Everything the paper sits on goes in one container, because the
            // paper is a pass over the finished composite rather than a layer in it.

            const backTexture = textureFromCanvas(backCanvas);
            textures.push(backTexture);
            sceneContainer.addChild(new Sprite(backTexture));

            if (!rain) {
                rain = createZenRainPixiMesh({
                    pixi: { Container, Geometry, Mesh, Shader }, renderer: application.renderer,
                    parent: sceneContainer,
                });
            } else {
                sceneContainer.addChild(rain.container);
            }

            // --- the tree: hierarchical layers preserving depth order ---------
            const viewportX = homeGardenBedGeometry ? homeGardenBedGeometry.sceneViewport.x : 0;
            const viewportY = homeGardenBedGeometry ? homeGardenBedGeometry.sceneViewport.y : 0;
            const clip = homeGardenBedGeometry
                ? {
                    x: viewportX,
                    y: viewportY,
                    width: homeGardenBedGeometry.sceneViewport.width,
                    height: homeGardenBedGeometry.sceneViewport.height,
                }
                : { x: 0, y: 0, width: surfaceWidth, height: surfaceHeight };

            // Everything inside `treeContainer` is in SCENE space, and the container
            // carries the viewport offset for all of it.
            //
            // This is the one thing that has to be true for a limb to turn about its
            // own joint. Pivots are read off wood-surface centrelines, which are
            // scene coordinates; sprites used to be positioned in stage coordinates
            // — scene plus the viewport — so a rotation built around a scene pivot
            // was applied to a stage point and every limb swung about a phantom
            // joint displaced by exactly the viewport origin. Placing the offset on
            // the container instead of on each sprite means there is no second space
            // to keep in step: the rig, the bake, and the motion all speak scene.
            const sceneClip = { x: 0, y: 0, width: clip.width, height: clip.height };
            const treeContainer = new Container();
            sceneContainer.addChild(treeContainer);
            treeContainer.position.set(clip.x, clip.y);
            const treeMask = new Graphics();
            sceneContainer.addChild(treeMask);
            treeMask.beginFill(0xffffff);
            treeMask.drawRect(clip.x, clip.y, clip.width, clip.height);
            treeMask.endFill();
            treeContainer.mask = treeMask;

            const rigParts = scene.metadata?.rigParts || [];
            const rigPartMap = new Map();
            rigParts.forEach((part) => {
                if (part?.id) rigPartMap.set(part.id, part);
            });

            // Bake per (stratum, rig).
            //
            // The two constraints pull against each other: marks on one branch must
            // move together, so they want to share a sprite; and the stream is a
            // painter's sequence, so its order must survive. Bucketing by rig alone
            // resolved the first and broke the second — a limb's back blossoms, its
            // wood and its front blossoms collapsed into one sprite parked at the
            // earliest of those positions, which is why blossoms ended up behind
            // branches they hang off, and the nebari's front roots ended up behind
            // the whole tree.
            //
            // Cutting on the stratum boundary keeps both. Depth between strata is
            // the composition and is preserved exactly; depth within a stratum is
            // resolved per rig, which is the granularity a rig can honour anyway,
            // since everything in one sprite necessarily moves as one.
            const STATIC_RIG_KEY = '__static__';
            const bakeBuckets = new Map();
            (scene.commands || []).forEach((command, index) => {
                const rigId = (command?.rig && rigPartMap.has(command.rig)) ? command.rig : null;
                const stratum = Number.isFinite(Number(command?.stratum))
                    ? Number(command.stratum)
                    : 0;
                const key = `${stratum}|${rigId || STATIC_RIG_KEY}`;
                let bucket = bakeBuckets.get(key);
                if (!bucket) {
                    bucket = { stratum, rigId, minIndex: index, commands: [] };
                    bakeBuckets.set(key, bucket);
                }
                bucket.commands.push(command);
            });

            const orderedBuckets = Array.from(bakeBuckets.values()).sort((a, b) => (
                a.stratum - b.stratum || a.minIndex - b.minIndex
            ));

            const rigSprites = [];
            orderedBuckets.forEach((bucket) => {
                const bounds = resolveZenBonsaiG15CommandRunBounds(bucket.commands, {
                    offsetX: 0,
                    offsetY: 0,
                    clip: sceneClip,
                });
                if (!bounds) return;

                const runCanvas = createBakeCanvas(bounds.width, bounds.height);
                const runCtx = runCanvas.getContext('2d');
                runCtx.translate(-bounds.x, -bounds.y);
                ZenBonsaiCanvasExecutor.executeCommands(
                    runCtx,
                    { commands: bucket.commands },
                    executorOptions,
                );
                const texture = textureFromCanvas(runCanvas);
                textures.push(texture);
                const sprite = new Sprite(texture);
                sprite.position.set(bounds.x, bounds.y);
                // Added in stratum order, so the scene graph *is* the paint order.
                treeContainer.addChild(sprite);
                if (bucket.rigId) {
                    rigSprites.push({
                        rigId: bucket.rigId,
                        sprite,
                        restX: bounds.x,
                        restY: bounds.y,
                    });
                }
            });

            // --- static front: the bed's near wall ----------------------------
            if (homeGardenBedGeometry && options.skipPot !== true) {
                const frontCanvas = createBakeCanvas(surfaceWidth, surfaceHeight);
                const frontCtx = frontCanvas.getContext('2d');
                drawZenHomeGardenBedFrontLayer(frontCtx, {
                    geometry: homeGardenBedGeometry,
                    palette: bedPalette,
                    materialStyle,
                });
                const frontTexture = textureFromCanvas(frontCanvas);
                textures.push(frontTexture);
                sceneContainer.addChild(new Sprite(frontTexture));
            }

            // --- the shared paper, over everything ----------------------------
            const paperStrength = Math.max(0, Math.min(1, presentationStyle.paperStrength));
            if (options.renderPaperSurface !== false && paperStrength > 0.001) {
                const tile = resolveZenBonsaiPaperTile(seed);
                if (!tile) {
                    throw new Error('ZEN_BONSAI_G15_PIXI_PAPER_TILE_UNAVAILABLE');
                }
                const tileTexture = textureFromCanvas(tile, WRAP_MODES.REPEAT);
                textures.push(tileTexture);
                const veil = parseVeilColor(inkTint.mapSurfaceColor('#8a8578'));
                filters.push(createZenBonsaiPaperFilter({
                    webGLVersion: application.renderer.context.webGLVersion,
                    paperTexture: tileTexture,
                    tileSize: ZEN_BONSAI_PAPER_TILE_SIZE,
                    tileAlpha: ZEN_BONSAI_PAPER_TILE_ALPHA * paperStrength,
                    veilAlpha: ZEN_BONSAI_PAPER_VEIL_ALPHA * paperStrength,
                    veilColor: veil,
                }));
                sceneContainer.filters = filters;
                sceneContainer.filterArea = new Rectangle(0, 0, surfaceWidth, surfaceHeight);
            }

            return {
                ...resources,
                signature: scene.signature,
                rigSprites,
                rigParts,
                viewportX,
                viewportY,
            };
        } catch (error) {
            rain?.container.parent?.removeChild(rain.container);
            try {
                destroyZenBonsaiG15Bake(resources);
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'ZEN_BONSAI_G15_PIXI_BAKE_FAILED');
            }
            throw error;
        }
    };

    const render = ({
        scene: sceneInput,
        frameCount = 0,
        windState = null,
    } = {}) => {
        const renderStartedAtMs = nowPerfMs();
        if (disposed || !sceneInput?.topology) {
            return {
                renderer: RENDERER_NAME,
                rendered: false,
                timing: { totalMs: roundMs(nowPerfMs() - renderStartedAtMs) },
            };
        }
        const { topology } = sceneInput;
        const options = {
            ...(sceneInput.renderOptions || {}),
            renderPlan: sceneInput.renderPlan,
        };
        const renderPlan = options.renderPlan
            ? requireZenBonsaiG15RenderPlanV1(options.renderPlan, { topology })
            : null;
        let scene = renderPlan?.scene || topology.scene;
        if (!scene && topology.graph) {
            scene = buildG15Scene({
                g15Topology: topology,
                width: sizeState.pixelWidth,
                height: sizeState.pixelHeight,
                options,
            });
        }
        if (!scene) {
            throw new Error('ZEN_BONSAI_G15_PIXI_SCENE_REQUIRED');
        }

        // The bake is keyed on everything that changes a painted mark. The
        // scene signature covers the tree; the light and the style are applied
        // at paint time and so have to be named here as well.
        const bakeSignature = [
            scene.signature,
            options.presentationStyle || 'default',
            options.gardenBedMaterialStyle || 'default',
            resolveZenBonsaiInkTint({
                environmentState: options.environmentState,
                presentationStyle: resolveZenBonsaiPresentationStyle(
                    options.presentationStyle,
                ).id,
            }).signature,
            options.renderPaperSurface === false ? 'nopaper' : 'paper',
        ].join('|');

        const bakeStartMs = nowPerfMs();
        if (!bake || bake.signature !== bakeSignature) {
            disposeBake();
            bake = buildBake({ scene, options, renderPlan });
            bake.signature = bakeSignature;
        }
        const bakeEndMs = nowPerfMs();

        // Home's sky/soil aperture may change while the tree plan and surface
        // stay equal. Rain consumes the current projection, not the baked one.
        const rainGeometry = options.homeGardenBedProjection
            ? resolveZenHomeGardenBedDeviceMesh({ projection: options.homeGardenBedProjection })
            : null;
        rain.container.scale.set(sizeState.pixelRatio);
        rain.setInputs(resolveZenBonsaiRainInputs({
            presentation: resolveZenBonsaiRainPresentation(rainGeometry, sizeState.pixelWidth, sizeState.pixelHeight),
            seed: hashStringFNV1a(renderPlan ? renderPlan.source.topologySignature : scene.signature),
            options, ...sizeState,
        }));
        rain.update(frameCount / 60);

        // The only per-frame work: each baked part takes the world transform its
        // rig resolved to. The motion module has already composed each limb's
        // own deflection with its ancestors', so this is a placement, not a
        // second opinion about the hierarchy — the flat sprite list and the rig
        // tree stay consistent because only one of them describes kinematics.
        const motion = resolveZenBonsaiRigMotion({
            rigParts: bake.rigParts,
            wind: windState || options.wind,
            lifeState: options.lifeState,
            frameCount,
        });
        bake.rigSprites.forEach(({ rigId, sprite, restX, restY }) => {
            const transform = motion.transformFor(rigId);
            if (!transform) {
                sprite.rotation = 0;
                sprite.position.set(restX, restY);
                return;
            }
            sprite.rotation = transform.angle;
            sprite.position.set(
                (transform.cos * restX) - (transform.sin * restY) + transform.tx,
                (transform.sin * restX) + (transform.cos * restY) + transform.ty,
            );
        });

        const drawStartMs = nowPerfMs();
        application.renderer.render(application.stage);
        const drawEndMs = nowPerfMs();

        return {
            renderer: RENDERER_NAME,
            rendered: true,
            timing: {
                bakeMs: roundMs(bakeEndMs - bakeStartMs),
                drawMs: roundMs(drawEndMs - drawStartMs),
                totalMs: roundMs(drawEndMs - renderStartedAtMs),
            },
        };
    };

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        try {
            rain?.dispose();
            rain = null;
            disposeBake();
        } finally {
            application.destroy(false, { children: true, texture: true, baseTexture: true });
        }
    };

    return {
        renderer: RENDERER_NAME,
        render,
        resize,
        dispose,
    };
}

export default createZenBonsaiG15PixiRenderer;
