import {
    ZenBonsaiCanvasExecutor,
} from './render-runtime.js';
import {
    buildG15Scene,
} from './ZenBonsaiG15Scene.js';
import {
    requireZenBonsaiG15RenderPlanV1,
} from './ZenBonsaiG15RenderPlan.js';
import {
    resolveZenHomeGardenBedDeviceMesh,
} from '../rendering/zenHomeGardenBedGeometry.js';
import {
    drawZenHomeGardenBedBackLayer,
    drawZenHomeGardenBedContactShadow,
    drawZenHomeGardenBedFrontLayer,
} from '../rendering/zenHomeGardenBedRenderer.js';
import {
    resolveZenPotRenderModel,
} from '../../ZenPotRenderer.js';
import {
    resolveSakuraRenderLighting,
} from '../../sakura/sakuraRenderLighting.js';
import {
    drawZenBonsaiOpenAirBackdrop,
} from '../rendering/zenBonsaiOpenAirBackdrop.js';
import {
    resolveZenBonsaiInkTint,
    tintZenBonsaiPalette,
} from '../rendering/zenBonsaiInkTint.js';
import {
    drawZenBonsaiPaperSurface,
} from '../rendering/zenBonsaiPaperSurface.js';
import {
    resolveZenBonsaiRigMotion,
} from '../rendering/zenBonsaiRigMotion.js';
import {
    resolveZenBonsaiPresentationStyle,
} from '../rendering/zenBonsaiPresentationStyle.js';
import {
    resolveZenHomeGardenBedMaterialPreset,
} from '../rendering/zenHomeGardenBedGeometry.js';
import { drawZenBonsaiRainCanvas } from '../../../runtime/rain/zenRainCanvas.js';
import { resolveZenBonsaiRainPresentation } from '../../../runtime/rain/zenRainStreakRuntime.js';
import { hashStringFNV1a } from '../../../shared/zenSeededRandom.js';

export const G15_RENDER_CONTRACT_ID = 'g15_4_graph_to_scene_render_species_v1';

export { buildG15Scene };

export const ZenBonsaiG15RenderSpecies = Object.freeze({
    contract: G15_RENDER_CONTRACT_ID,
    isAnimated: true,

    getPotDimensions: () => ({
        width: 180,
        height: 55,
        depth: 45,
    }),

    renderPot: ({ ctx }) => {
        // G15 pot presentation is part of its scene-command stream.
        if (!ctx) return;
    },

    render: ({
        ctx,
        topology,
        wind = null,
        frameCount = 0,
        pixelRatio = 1,
        options = {},
    } = {}) => {
        if (!ctx || !topology) return;

        const renderPlan = options.renderPlan
            ? requireZenBonsaiG15RenderPlanV1(options.renderPlan, { topology })
            : null;
        let scene = renderPlan?.scene || topology.scene;
        if (!scene && topology.graph) {
            const width = ctx.canvas?.width || 900;
            const height = ctx.canvas?.height || 900;
            scene = buildG15Scene({
                g15Topology: topology,
                width,
                height,
                options,
            });
        }

        if (scene) {
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
            const sceneViewport = homeGardenBedGeometry?.sceneViewport || null;
            // One resolution of the scene's light for everything painted here:
            // the tree's command stream and the bed's own gradients alike.
            // One style resolution for everything painted below: the tree's
            // ink, the bed's material, and the surface the whole thing sits on.
            const presentationStyle = resolveZenBonsaiPresentationStyle(
                options.presentationStyle,
            );
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
            if (options.renderBackdrop !== false && options.renderMode !== 'trunk_sandbox') {
                drawZenBonsaiOpenAirBackdrop(ctx, {
                    environmentState: options.environmentState,
                    lifeState: options.lifeState,
                    sceneViewport,
                    plantingAnchor,
                    seed: renderPlan?.source?.topologySignature || scene.signature,
                    pixelRatio,
                    // G15 has no per-frame star layer; bright stars rest in the sky.
                    celestial: { mode: 'rest' },
                });
            }
            if (homeGardenBedGeometry && options.skipPot !== true) {
                drawZenHomeGardenBedBackLayer(ctx, {
                    geometry: homeGardenBedGeometry,
                    palette: bedPalette,
                    materialStyle,
                });
                drawZenHomeGardenBedContactShadow(ctx, {
                    geometry: homeGardenBedGeometry,
                    lighting: resolveSakuraRenderLighting(options.environmentState),
                });
            }
            drawZenBonsaiRainCanvas(ctx, {
                presentation: resolveZenBonsaiRainPresentation(homeGardenBedGeometry, ctx.canvas.width, ctx.canvas.height),
                seed: hashStringFNV1a(renderPlan ? renderPlan.source.topologySignature : scene.signature),
                options, pixelRatio, activeTimeSec: frameCount / 60,
            });
            ctx.save();
            if (homeGardenBedGeometry) {
                ctx.translate(
                    homeGardenBedGeometry.sceneViewport.x,
                    homeGardenBedGeometry.sceneViewport.y,
                );
                ctx.beginPath();
                ctx.rect(
                    0,
                    0,
                    homeGardenBedGeometry.sceneViewport.width,
                    homeGardenBedGeometry.sceneViewport.height,
                );
                ctx.clip();
            }
            // The command stream is neutral ink; the world's light is applied
            // here so the plan (and later its Pixi bake) stays independent of
            // the time of day.
            ZenBonsaiCanvasExecutor.executeCommands(ctx, scene, {
                mapColor: inkTint.mapColor,
                mapAccentColor: inkTint.mapAccentColor,
                mapMassColor: inkTint.mapMassColor,
                brushStyle: presentationStyle.brush,
                canopyWashScale: presentationStyle.canopyWashScale,
                // The plan describes a tree; this is the moment it is in.
                motion: resolveZenBonsaiRigMotion({
                    rigParts: scene.metadata?.rigParts || null,
                    wind: wind || options.wind,
                    lifeState: options.lifeState,
                    frameCount,
                }),
            });
            ctx.restore();
            if (homeGardenBedGeometry && options.skipPot !== true) {
                drawZenHomeGardenBedFrontLayer(ctx, {
                    geometry: homeGardenBedGeometry,
                    palette: bedPalette,
                    materialStyle,
                });
            }

            // Last: the shared paper the whole composite lives on.
            if (options.renderPaperSurface !== false) {
                const bedPolygons = homeGardenBedGeometry?.polygons;
                drawZenBonsaiPaperSurface(ctx, {
                    surface: {
                        width: ctx.canvas?.width,
                        height: ctx.canvas?.height,
                    },
                    clipRegions: homeGardenBedGeometry
                        ? [
                            homeGardenBedGeometry.sceneViewport,
                            bedPolygons.outerTop,
                            bedPolygons.frontRim,
                            bedPolygons.frontFace,
                        ]
                        : null,
                    midTone: inkTint.mapSurfaceColor('#8a8578'),
                    strength: presentationStyle.paperStrength,
                    seed: renderPlan?.source?.topologySignature || scene.signature,
                });
            }
        }
    },
});

export default ZenBonsaiG15RenderSpecies;
