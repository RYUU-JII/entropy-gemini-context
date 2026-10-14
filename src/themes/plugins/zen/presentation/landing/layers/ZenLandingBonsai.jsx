import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import React, { useEffect, useMemo, useRef } from 'react';

import { createAssetCache } from '../../../model/ZenCoreConfigAssetCache.js';
import { ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE } from '../../../model/ZenPotStyleIds.js';
import { SakuraSpecies } from '../../../model/SakuraSpecies.js';
import {
  DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
  resolveZenHomeGardenBedDeviceMesh,
} from '../../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
  normalizeZenHomeGardenBedProjection,
  ZEN_HOME_GARDEN_BED_RENDER_SPACE,
} from '../../../model/bonsai/rendering/zenHomeGardenBedProjectionContract.js';
import { resolveAnchoredBonsaiCamera } from '../../../model/bonsai/rendering/resolveBonsaiCamera.js';
import { resolveZenBonsaiWindState } from '../../../model/zenBonsaiSceneEnvironment.js';
import { createSakuraRenderPlanV1 } from '../../../model/sakura/sakuraRenderPlan.js';
import { resolveZenLandingClassic2Scene } from '../model/resolveZenLandingClassic2Scene.js';
import './ZenLandingBonsai.css';

const TARGET_FRAME_INTERVAL_MS = 1_000 / 24;
const LANDING_GROWTH_STEPS = 96;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function requirePresentation(presentation) {
  if (
    !presentation
    || typeof presentation !== 'object'
    || !presentation.state
    || !presentation.state.environment
    || !presentation.state.wind
    || !presentation.layers
    || !presentation.palette
    || !Number.isFinite(presentation.gardenGrowth)
    || !Number.isFinite(presentation.visualProgress)
    || !Number.isFinite(presentation.layers.bonsai)
  ) {
    throw new Error('ZEN_LANDING_BONSAI_PRESENTATION_REQUIRED');
  }
  if (!['full', 'reduced'].includes(presentation.state.motionMode)) {
    throw new Error('ZEN_LANDING_BONSAI_MOTION_MODE_INVALID');
  }
  if (
    presentation.gardenGrowth < 0
    || presentation.gardenGrowth > 1
    || presentation.layers.bonsai < 0
    || presentation.layers.bonsai > 1
  ) {
    throw new Error('ZEN_LANDING_BONSAI_PRESENTATION_RANGE_INVALID');
  }
  if (typeof presentation.palette.paper !== 'string' || !presentation.palette.paper.trim()) {
    throw new Error('ZEN_LANDING_BONSAI_PAPER_COLOR_REQUIRED');
  }
  return presentation;
}

function quantizeGrowth(growth) {
  return Math.round(clamp01(growth) * LANDING_GROWTH_STEPS) / LANDING_GROWTH_STEPS;
}

function resolveLandingEnvironment(presentation) {
  const { environment, wind } = presentation.state;
  const progress = clamp01(presentation.visualProgress);
  const solarElevation = Math.max(0.08, Math.sin(progress * Math.PI));
  const lowSun = clamp01(environment.dawn + environment.twilight);
  return Object.freeze({
    sunAngle: Math.PI * (0.75 + (progress * 0.5)),
    solarElevation,
    daylight: environment.daylight,
    night: environment.nightDepth,
    lightIntensity: 0.42 + (environment.daylight * 0.58) + (lowSun * 0.12),
    shadowLength: 12 + ((1 - solarElevation) * 34),
    lightColor: presentation.palette.paper,
    cloudCover: 0.12 + (environment.twilight * 0.16),
    windIntensity: presentation.state.motionMode === 'reduced'
      ? 0.08
      : Math.max(0.08, 0.12 + (wind.strength * 0.48)),
    windDirection: wind.x < 0 ? Math.PI : 0,
    gustEnvelope: presentation.state.motionMode === 'reduced'
      ? 0
      : wind.strength * 0.42,
    ambientChromaticState: Object.freeze({
      daylight: environment.daylight,
      nightDepth: environment.nightDepth,
      dawnWeight: environment.dawn,
      duskWeight: environment.twilight,
      warmth: environment.warmth,
      lowSun,
      twilightWeight: environment.twilight,
      nightWeight: environment.nightDepth,
    }),
  });
}

function resolveLandingProjection(width, height, devicePixelRatio) {
  const horizontalInset = Math.max(2, Math.round(width * 0.018));
  return normalizeZenHomeGardenBedProjection({
    coordinateSpace: ZEN_HOME_GARDEN_BED_RENDER_SPACE,
    boundaryOvershootDevicePx: Math.min(devicePixelRatio, horizontalInset),
    leftIntrusionDevicePx: 0,
    support: 'planter',
    bedInsetLeftDevicePx: 0,
    surfaceSize: { width, height },
    sceneViewport: {
      x: horizontalInset,
      y: 0,
      width: width - (horizontalInset * 2),
      height,
    },
  });
}

function createLandingRenderPlan(scene, projection) {
  return createSakuraRenderPlanV1({
    topology: scene.topology,
    species: SakuraSpecies,
    surface: {
      pixelWidth: projection.sceneViewport.width,
      pixelHeight: projection.sceneViewport.height,
      treeViewport: {
        x: 0,
        y: 0,
        width: projection.sceneViewport.width,
        height: projection.sceneViewport.height,
      },
      clipTreePaint: true,
    },
    includePot: false,
    includeGroundShadow: false,
    potStyleOverride: ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE,
    growthProjection: scene.currentStage?.growthProjection || null,
    lifeState: scene.lifeState,
  });
}

function resolveLandingCamera(renderPlan, projection) {
  const geometry = resolveZenHomeGardenBedDeviceMesh({ projection });
  const sceneBounds = {
    ...renderPlan.bounds.maximumMotionReserve,
    trunkOffsetX: renderPlan.anchor.trunkOffsetX,
    trunkBaseY: renderPlan.anchor.trunkBaseY,
  };
  if (
    !Number.isFinite(sceneBounds?.trunkOffsetX)
    || !Number.isFinite(sceneBounds?.trunkBaseY)
  ) {
    throw new Error('ZEN_LANDING_CLASSIC2_TREE_ANCHOR_REQUIRED');
  }
  return resolveAnchoredBonsaiCamera({
    viewportWidth: projection.sceneViewport.width,
    viewportHeight: projection.sceneViewport.height,
    sceneBounds,
    preset: 'home-frame-garden-bed',
    worldAnchor: {
      x: sceneBounds.trunkOffsetX,
      y: sceneBounds.trunkBaseY,
    },
    viewportAnchor: {
      x: geometry.plantingAnchor.x - geometry.sceneViewport.x,
      y: geometry.plantingAnchor.y - geometry.sceneViewport.y,
    },
  });
}

function renderLandingBonsaiFrame(context, {
  assetCache,
  camera,
  frameCount,
  presentation,
  projection,
  renderPlan,
  scene,
}) {
  const environmentState = resolveLandingEnvironment(presentation);
  const reducedMotion = presentation.state.motionMode === 'reduced';
  const resolvedFrameCount = reducedMotion ? 0 : frameCount;
  const wind = resolveZenBonsaiWindState({
    environmentState,
    frameCount: resolvedFrameCount,
  });

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  SakuraSpecies.render({
    ctx: context,
    topology: scene.topology,
    frameCount: resolvedFrameCount,
    currentStage: scene.currentStage,
    assetCache,
    wind,
    camera,
    options: {
      renderMode: 'full',
      renderBackdrop: false,
      potStyleOverride: ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE,
      homeGardenBedProjection: projection,
      gardenBedMaterialStyle: DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
      environmentState,
      lifeState: scene.lifeState,
      showGroundBranchShadow: true,
      freezeBranchMotion: reducedMotion,
      renderPlan,
    },
  });
}

export default function ZenLandingBonsai({ presentation }) {
  const resolvedPresentation = requirePresentation(presentation);
  const canvasRef = useRef(null);
  const frameInputRef = useRef(null);
  const runtimeRef = useRef(null);
  const sceneGrowth = quantizeGrowth(resolvedPresentation.gardenGrowth);
  const scene = useMemo(
    () => resolveZenLandingClassic2Scene(sceneGrowth),
    [sceneGrowth],
  );
  frameInputRef.current = { presentation: resolvedPresentation, scene };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('ZEN_LANDING_BONSAI_CANVAS_MOUNT_FAILED');
    if (typeof ResizeObserver !== 'function') {
      throw new Error('ZEN_LANDING_RESIZE_OBSERVER_REQUIRED');
    }
    if (typeof IntersectionObserver !== 'function') {
      throw new Error('ZEN_LANDING_INTERSECTION_OBSERVER_REQUIRED');
    }

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('ZEN_LANDING_BONSAI_CONTEXT_UNAVAILABLE');
    const assetCache = createAssetCache();

    let animationFrame = 0;
    let camera = null;
    let frameCount = 0;
    let lastDrawAt = -Infinity;
    let pageVisible = !document.hidden;
    let projection = null;
    let renderPlan = null;
    let renderPlanScene = null;
    let stageVisible = true;

    const syncRenderPlan = () => {
      if (!projection) return;
      const currentScene = frameInputRef.current.scene;
      if (renderPlan && renderPlanScene === currentScene) return;
      renderPlan = createLandingRenderPlan(currentScene, projection);
      renderPlanScene = currentScene;
      camera = resolveLandingCamera(renderPlan, projection);
    };

    const draw = () => {
      syncRenderPlan();
      if (!projection || !camera || !renderPlan) return;
      renderLandingBonsaiFrame(context, {
        ...frameInputRef.current,
        assetCache,
        camera,
        frameCount,
        projection,
        renderPlan,
      });
    };

    const shouldAnimate = () => (
      pageVisible
      && stageVisible
      && frameInputRef.current.presentation.layers.bonsai > 0.001
      && frameInputRef.current.presentation.state.motionMode === 'full'
    );

    const animate = (timeMs) => {
      animationFrame = 0;
      if (timeMs - lastDrawAt >= TARGET_FRAME_INTERVAL_MS) {
        frameCount += 1;
        draw();
        lastDrawAt = timeMs;
      }
      if (shouldAnimate()) animationFrame = requestAnimationFrame(animate);
    };

    const sync = () => {
      if (shouldAnimate()) {
        if (animationFrame === 0) animationFrame = requestAnimationFrame(animate);
        return;
      }
      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      draw();
    };

    let rasterSignature = '';
    const resize = (cssWidth, cssHeight) => {
      if (cssWidth <= 0 || cssHeight <= 0) return;
      const { effectivePixelRatio: devicePixelRatio, pixelWidth: width, pixelHeight: height } = resolveRasterResolution({ cssWidth: cssWidth, cssHeight: cssHeight, devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
      const signature = `${width}:${height}:${devicePixelRatio}`;
      if (rasterSignature === signature) return;
      rasterSignature = signature;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      projection = resolveLandingProjection(width, height, devicePixelRatio);
      renderPlan = null;
      renderPlanScene = null;
      syncRenderPlan();
      draw();
    };
    const resizeObserver = new ResizeObserver(([entry]) => resize(entry.contentRect.width, entry.contentRect.height));
    resizeObserver.observe(canvas);
    const stopDpr = observeDevicePixelRatio({ onChange: () => {
      const rect = canvas.getBoundingClientRect();
      resize(rect.width, rect.height);
    } });

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      sync();
    }, { threshold: 0.01 });
    intersectionObserver.observe(canvas);

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    runtimeRef.current = {
      redraw() {
        sync();
      },
    };
    sync();

    return () => {
      runtimeRef.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      stopDpr();
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.redraw();
  }, [resolvedPresentation, scene]);

  const style = {
    '--zen-landing-bonsai-night': resolvedPresentation.state.environment.nightDepth,
    '--zen-landing-bonsai-opacity': resolvedPresentation.layers.bonsai,
    '--zen-landing-bonsai-twilight': resolvedPresentation.state.environment.twilight,
  };

  return (
    <div
      className="zenLandingBonsai zenLandingBonsai--classic2"
      data-renderer="sakura-canvas2d"
      data-scene-contract={scene.contract}
      data-topology="classic2"
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="zenLandingBonsai__canvas" />
    </div>
  );
}
