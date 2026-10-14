import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const out = {
    root: process.cwd(),
    label: 'release-v1-baseline',
    outFile: null,
    iterations: 420,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) {
      out.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--label' && argv[i + 1]) {
      out.label = String(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--out' && argv[i + 1]) {
      out.outFile = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--iterations' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 30) {
        out.iterations = parsed;
      }
      i += 1;
      continue;
    }
  }
  return out;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function summarize(samples) {
  if (!samples.length) {
    return {
      samples: 0,
      mean_ms: 0,
      p95_ms: 0,
      min_ms: 0,
      max_ms: 0,
    };
  }
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    samples: samples.length,
    mean_ms: sum / samples.length,
    p95_ms: quantile(samples, 0.95),
    min_ms: Math.min(...samples),
    max_ms: Math.max(...samples),
  };
}

function runTimed(iterations, work) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    work(i);
    samples.push(performance.now() - t0);
  }
  return summarize(samples);
}

function createRng(seed = 0x12345678) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function withSeededRandom(seed, fn) {
  const prev = Math.random;
  Math.random = createRng(seed);
  try {
    return fn();
  } finally {
    Math.random = prev;
  }
}

class MockGradient {
  addColorStop() {}
}

class MockPattern {
  setTransform() {}
}

class MockDOMMatrix {
  constructor() {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
  }
  translateSelf(x = 0, y = 0) {
    this.e += x;
    this.f += y;
    return this;
  }
  scaleSelf(x = 1, y = 1) {
    this.a *= x;
    this.d *= y;
    return this;
  }
}

class MockImageData {
  constructor(width, height) {
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }
}

class MockCanvasContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.lineWidth = 1;
    this.shadowColor = '#000';
    this.shadowBlur = 0;
    this.lineCap = 'butt';
    this.textAlign = 'left';
    this.font = '12px sans-serif';
    this.filter = 'none';
    this.imageSmoothingEnabled = true;
    this._lastImageData = null;
  }
  save() {}
  restore() {}
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  clip() {}
  roundRect() {}
  translate() {}
  rotate() {}
  scale() {}
  setTransform() {}
  fillText() {}
  measureText(text) {
    const len = String(text || '').length;
    return { width: len * 6.5 };
  }
  drawImage() {}
  createLinearGradient() {
    return new MockGradient();
  }
  createRadialGradient() {
    return new MockGradient();
  }
  createPattern() {
    return new MockPattern();
  }
  createImageData(width, height) {
    return new MockImageData(width, height);
  }
  getImageData(width, height) {
    const imageData = new MockImageData(width, height);
    if (this._lastImageData?.data?.length === imageData.data.length) {
      imageData.data.set(this._lastImageData.data);
    }
    return imageData;
  }
  putImageData(imageData) {
    this._lastImageData = imageData || null;
  }
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.style = {};
    this._ctx2d = new MockCanvasContext2D(this);
  }
  getContext(kind) {
    if (kind === '2d') return this._ctx2d;
    return null;
  }
  addEventListener() {}
  removeEventListener() {}
}

function installDomMocks() {
  if (!globalThis.performance) {
    globalThis.performance = performance;
  }
  if (!globalThis.window) {
    globalThis.window = {
      devicePixelRatio: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  } else if (!Number.isFinite(Number(globalThis.window.devicePixelRatio))) {
    globalThis.window.devicePixelRatio = 1;
  }
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = MockDOMMatrix;
  }
  if (!globalThis.ImageData) {
    globalThis.ImageData = MockImageData;
  }
  if (!globalThis.HTMLCanvasElement) {
    globalThis.HTMLCanvasElement = MockCanvas;
  }
  if (!globalThis.OffscreenCanvas) {
    globalThis.OffscreenCanvas = MockCanvas;
  }
  if (!globalThis.document) {
    globalThis.document = {
      createElement(tag) {
        if (String(tag).toLowerCase() === 'canvas') return new MockCanvas();
        return { style: {} };
      },
    };
  } else {
    const baseCreateElement = globalThis.document.createElement?.bind(globalThis.document);
    if (typeof baseCreateElement === 'function') {
      globalThis.document.createElement = (tag, ...rest) => {
        if (String(tag).toLowerCase() === 'canvas') {
          const canvas = baseCreateElement(tag, ...rest);
          if (canvas && typeof canvas.getContext === 'function' && canvas.getContext('2d')) {
            return canvas;
          }
          return new MockCanvas();
        }
        return baseCreateElement(tag, ...rest);
      };
    }
  }
}

async function importModuleFromRoot(root, relPath) {
  const fullPath = path.join(root, relPath);
  return import(pathToFileURL(fullPath).href);
}

function createSpriteStub() {
  return {
    texture: null,
    visible: false,
    alpha: 0,
    tint: 0xffffff,
  };
}

const BASELINE_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'baselineClearNoon',
    tuning: Object.freeze({
      envCloudiness: 0.18,
      cloudCountDensity: 0.18,
      envWaterClarity: 0.76,
      waterFlowMode: 'pond',
      waterSpeedMultiplier: 0.62,
      waterRippleIrregularity: 0.68,
      waterRippleScale: 7.4,
      refractionScale: 0.24,
      refractionMicroScale: 1.3,
      refractionJitter: 0.72,
      waterPebbleOpacity: 1.02,
      waterVeilOpacity: 0.16,
      waterHazeOpacity: 0.1,
      sunlightIntensity: 0.72,
      pondDepthStrength: 0.74,
      pondContourDensity: 0.96,
      pondSedimentAmount: 0.9,
      envCloudinessVisual: 0.18,
    }),
    envState: Object.freeze({
      windIntensity: 0.22,
      windDirection: 0.38,
      gustEnvelope: 0.18,
      daylight: 1.0,
      lightIntensity: 1.08,
      cloudCover: 0.18,
      cloudOcclusion: 0.94,
      cloudDrift: 0.22,
      moonlight: 0.04,
      sunAngle: Math.PI * 0.44,
      clearSkyReflectionBoost: 1.2,
      waterPalette: ['#183D4A', '#24525C', '#326B73'],
      lightColor: 'rgb(225, 235, 245)',
    }),
  }),
  Object.freeze({
    id: 'baselineOvercastNoon',
    tuning: Object.freeze({
      envCloudiness: 0.86,
      cloudCountDensity: 0.86,
      envWaterClarity: 0.54,
      waterFlowMode: 'pond',
      waterSpeedMultiplier: 0.74,
      waterRippleIrregularity: 0.86,
      waterRippleScale: 7.0,
      refractionScale: 0.42,
      refractionMicroScale: 1.5,
      refractionJitter: 1.18,
      waterPebbleOpacity: 0.62,
      waterVeilOpacity: 0.3,
      waterHazeOpacity: 0.24,
      sunlightIntensity: 0.46,
      pondDepthStrength: 0.7,
      pondContourDensity: 1.0,
      pondSedimentAmount: 1.0,
      envCloudinessVisual: 0.86,
    }),
    envState: Object.freeze({
      windIntensity: 0.42,
      windDirection: 0.76,
      gustEnvelope: 0.36,
      daylight: 0.94,
      lightIntensity: 0.82,
      cloudCover: 0.86,
      cloudOcclusion: 0.58,
      cloudDrift: 0.48,
      moonlight: 0.02,
      sunAngle: Math.PI * 0.43,
      clearSkyReflectionBoost: 1.0,
      waterPalette: ['#183D4A', '#24525C', '#326B73'],
      lightColor: 'rgb(200, 208, 216)',
    }),
  }),
  Object.freeze({
    id: 'baselineMoonlitNight',
    tuning: Object.freeze({
      envCloudiness: 0.26,
      cloudCountDensity: 0.26,
      envWaterClarity: 0.42,
      waterFlowMode: 'pond',
      waterSpeedMultiplier: 0.54,
      waterRippleIrregularity: 0.92,
      waterRippleScale: 6.2,
      refractionScale: 0.58,
      refractionMicroScale: 2.2,
      refractionJitter: 1.32,
      waterPebbleOpacity: 0.3,
      waterVeilOpacity: 0.44,
      waterHazeOpacity: 0.36,
      sunlightIntensity: 0.36,
      pondDepthStrength: 0.66,
      pondContourDensity: 0.96,
      pondSedimentAmount: 1.06,
      envCloudinessVisual: 0.26,
    }),
    envState: Object.freeze({
      windIntensity: 0.18,
      windDirection: 1.12,
      gustEnvelope: 0.12,
      daylight: 0.1,
      lightIntensity: 0.24,
      cloudCover: 0.26,
      cloudOcclusion: 0.82,
      cloudDrift: 0.3,
      moonlight: 0.88,
      sunAngle: Math.PI * 0.14,
      clearSkyReflectionBoost: 1.08,
      waterPalette: ['#142B3A', '#1D3F52', '#2A5570'],
      lightColor: 'rgb(180, 196, 220)',
    }),
  }),
  Object.freeze({
    id: 'baselineWindySunset',
    tuning: Object.freeze({
      envCloudiness: 0.58,
      cloudCountDensity: 0.58,
      envWaterClarity: 0.5,
      waterFlowMode: 'stream',
      waterSpeedMultiplier: 1.12,
      waterRippleIrregularity: 1.42,
      waterRippleScale: 8.6,
      refractionScale: 0.66,
      refractionMicroScale: 2.0,
      refractionJitter: 1.72,
      waterPebbleOpacity: 0.56,
      waterVeilOpacity: 0.28,
      waterHazeOpacity: 0.24,
      sunlightIntensity: 0.6,
      pondDepthStrength: 0.76,
      pondContourDensity: 1.08,
      pondSedimentAmount: 0.98,
      envCloudinessVisual: 0.58,
    }),
    envState: Object.freeze({
      windIntensity: 0.86,
      windDirection: 2.24,
      gustEnvelope: 0.78,
      daylight: 0.46,
      lightIntensity: 0.66,
      cloudCover: 0.58,
      cloudOcclusion: 0.72,
      cloudDrift: 0.82,
      moonlight: 0.14,
      sunAngle: Math.PI * 0.29,
      clearSkyReflectionBoost: 1.04,
      waterPalette: ['#203844', '#38565F', '#6B6E56'],
      lightColor: 'rgb(244, 206, 170)',
    }),
  }),
]);

function resolveScenarioQualityProfile() {
  return Object.freeze({
    effectIntensityScale: 1,
    densityScale: 0.8,
    enableWaterEffects: true,
    enableSecondCausticLayer: false,
    enableMicroHighlights: true,
  });
}

async function benchScenario({
  scenario,
  modules,
  iterations,
  seed,
}) {
  const {
    resolveZenWaterFrameState,
    createPixiSceneBackgroundFxController,
    createPixiWaterEffectsLayer,
    PixiWaterSurfaceFieldFilter,
    resolvePixiFrameChannels,
    createPixiWaterTemporalProjection,
  } = modules;
  const qualityProfile = resolveScenarioQualityProfile();

  const frameResolve = runTimed(iterations, () => {
    resolveZenWaterFrameState({
      tuning: scenario.tuning,
      envState: scenario.envState,
      qualityProfile,
      effectIntensityScale: qualityProfile.effectIntensityScale,
    });
  });

  const frameState = resolveZenWaterFrameState({
    tuning: scenario.tuning,
    envState: scenario.envState,
    qualityProfile,
    effectIntensityScale: qualityProfile.effectIntensityScale,
  });
  const frameChannels = resolvePixiFrameChannels({ frameState });
  const temporalProjection = createPixiWaterTemporalProjection();
  frameChannels.waterTemporalProjection = temporalProjection.update({
    deltaMs: 16.6667,
    frameState,
    frameChannels,
  });

  const baseWaterSprite = createSpriteStub();
  const postFxSprite = createSpriteStub();
  const depthMultiplySprite = createSpriteStub();
  const depthSoftSprite = createSpriteStub();
  const tintMultiplySprite = createSpriteStub();
  const tintSoftSprite = createSpriteStub();
  const tintScreenSprite = createSpriteStub();
  const backgroundController = createPixiSceneBackgroundFxController({
    width: 1280,
    height: 720,
    qualityProfile,
    resolveDepthTexture: () => null,
    waterPaletteRef: { current: null },
    ownedTextures: new Set(),
    baseWaterSprite,
    postFxSprite,
    depthMultiplySprite,
    depthSoftSprite,
    tintMultiplySprite,
    tintSoftSprite,
    tintScreenSprite,
  });
  // Warm-up
  for (let i = 0; i < 80; i += 1) {
    backgroundController.update(frameChannels, {
      fullUpdate: true,
      dynamicUpdate: true,
      worldPolicy: frameState.worldPolicy,
    });
  }
  const backgroundUpdate = runTimed(iterations, () => {
    backgroundController.update(frameChannels, {
      fullUpdate: true,
      dynamicUpdate: true,
      worldPolicy: frameState.worldPolicy,
    });
  });
  backgroundController.destroy();

  // CPU-only Filter/update fixture using explicit WebGL1 sources. This bench
  // does not certify rendering behavior or WebGL performance.
  const surfaceFieldFilter = new PixiWaterSurfaceFieldFilter(1280, 720, {
    webGLVersion: 1,
    waterReflectionAlgorithm: frameState.tuning.waterReflectionAlgorithm,
  });
  surfaceFieldFilter.setSurfaceFieldTexture({ destroyed: false });
  for (let i = 0; i < 100; i += 1) {
    surfaceFieldFilter.update(
      16.6667,
      1280,
      720,
      frameState.tuning,
      qualityProfile.effectIntensityScale,
      frameState,
      frameChannels,
    );
  }
  const surfaceFieldUpdate = runTimed(iterations, () => {
    surfaceFieldFilter.update(
      16.6667,
      1280,
      720,
      frameState.tuning,
      qualityProfile.effectIntensityScale,
      frameState,
      frameChannels,
    );
  });
  surfaceFieldFilter.destroy();

  const tuningRef = { current: scenario.tuning };
  const envStateRef = { current: scenario.envState };
  let layer = null;
  const layerCreateStart = performance.now();
  withSeededRandom(seed, () => {
    layer = createPixiWaterEffectsLayer({
      width: 1280,
      height: 720,
      tuningRef,
      envStateRef,
      qualityProfile,
    });
  });
  const layerCreateMs = Math.max(0, performance.now() - layerCreateStart);
  const layerMode = layer?.initMetrics ? 'textured' : 'noop';
  const waterEffectsInit = {
    mode: layerMode,
    create_ms: layerCreateMs,
    init_metrics_total_ms: Number(layer?.initMetrics?.totalMs) || 0,
    init_metrics_bottleneck: layer?.initMetrics?.bottleneck || null,
  };
  // Warm-up
  for (let i = 0; i < 50; i += 1) {
    layer.tick(16.6667, frameState, frameChannels, {
      fullUpdate: true,
      effectRevealProgress: 1,
    });
  }
  const waterEffectsTick = runTimed(Math.max(120, Math.floor(iterations * 0.6)), () => {
    layer.tick(16.6667, frameState, frameChannels, {
      fullUpdate: true,
      effectRevealProgress: 1,
    });
  });
  layer.destroy();
  temporalProjection.dispose();

  return {
    id: scenario.id,
    frame_env: {
      daylight: frameState.frameEnv.daylight,
      cloud_cover: frameState.frameEnv.cloudCover,
      moonlight: frameState.frameEnv.moonlight,
    },
    state_signature: {
      bottom_visibility: Number(frameState.channels.waterMedium.bottomVisibility),
      wave_energy: Number(frameState.channels.surface.waveEnergy),
      transmittance: Number(frameState.channels.waterMedium.transmittance),
      cloud_reflection: Number(frameState.channels.atmosphere.reflectionFactor),
    },
    frame_resolve: frameResolve,
    background_update: backgroundUpdate,
    surface_field_update: surfaceFieldUpdate,
    water_effects_init: waterEffectsInit,
    water_effects_tick: waterEffectsTick,
  };
}

function buildSummaryByScenario(scenarios) {
  return scenarios.map((entry) => ({
    id: entry.id,
    frame_resolve_mean_ms: Number(entry.frame_resolve.mean_ms.toFixed(4)),
    background_update_mean_ms: Number(entry.background_update.mean_ms.toFixed(4)),
    surface_field_update_mean_ms: Number(entry.surface_field_update.mean_ms.toFixed(4)),
    water_effects_init_ms: Number((
      entry.water_effects_init.init_metrics_total_ms
      || entry.water_effects_init.create_ms
    ).toFixed(4)),
    water_effects_tick_mean_ms: Number(entry.water_effects_tick.mean_ms.toFixed(4)),
    water_effects_mode: entry.water_effects_init.mode,
  }));
}

async function main() {
  installDomMocks();
  const args = parseArgs(process.argv);

  const [
    { resolveZenWaterFrameState },
    { createPixiSceneBackgroundFxController },
    { createPixiWaterEffectsLayer },
    { PixiWaterSurfaceFieldFilter },
    { resolvePixiFrameChannels },
    { createPixiWaterTemporalProjection },
  ] = await Promise.all([
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/runtime/zenWaterFrameState.js',
    ),
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/renderers/pixi/pixiSceneBackgroundFxController.js',
    ),
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterEffectsLayer.js',
    ),
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/PixiWaterSurfaceFieldFilter.js',
    ),
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/renderers/pixi/pixiFrameChannels.js',
    ),
    importModuleFromRoot(
      args.root,
      'src/themes/plugins/zen/pond/renderers/pixi/pixiWaterTemporalProjection.js',
    ),
  ]);

  const modules = {
    resolveZenWaterFrameState,
    createPixiSceneBackgroundFxController,
    createPixiWaterEffectsLayer,
    PixiWaterSurfaceFieldFilter,
    resolvePixiFrameChannels,
    createPixiWaterTemporalProjection,
  };

  const baseline = [];
  for (let i = 0; i < BASELINE_SCENARIOS.length; i += 1) {
    const scenario = BASELINE_SCENARIOS[i];
    const result = await benchScenario({
      scenario,
      modules,
      iterations: args.iterations,
      seed: 0x2f33a911 + i * 17,
    });
    baseline.push(result);
  }

  const report = {
    formatVersion: 1,
    label: args.label,
    generated_at: new Date().toISOString(),
    root: path.relative(process.cwd(), args.root) || '.',
    iterations: args.iterations,
    benchmark_type: 'zen-water-release-v1-baseline',
    notes: [
      'CPU-side init/update proxy benchmark for frame-state + pixi water pipeline modules.',
      'Not a GPU render benchmark; intended for relative regression checks across baseline scenarios.',
    ],
    summary: buildSummaryByScenario(baseline),
    scenarios: baseline,
  };

  const payload = JSON.stringify(report, null, 2);
  if (args.outFile) {
    fs.mkdirSync(path.dirname(args.outFile), { recursive: true });
    fs.writeFileSync(args.outFile, payload, 'utf8');
  }
  console.log(payload);
}

main().catch((error) => {
  console.error('[zenWaterBaselineBench] failed:', error);
  process.exitCode = 1;
});
