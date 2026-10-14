#!/usr/bin/env node
/**
 * Zen bonsai Pixi/Canvas2D parity check.
 *
 * The Pixi backend exists to stop repainting a picture that is not changing,
 * not to draw a different one. That only holds if the two backends land on the
 * same image, and "looks the same" is not a check — the bake splits one flat
 * pass into layered sprites with their own blend modes, which is exactly the
 * kind of change that shifts a few percent everywhere and is invisible by eye.
 *
 * So: render the same scene through both, diff them, and report where they
 * disagree.
 *
 * Usage: npm run diagnose:zen:bonsai-pixi-parity
 * Output: reports/zen-bonsai-pixi/{canvas2d,pixi,diff}.png
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { launchQaPlaywrightBrowser } from '../qa/browser/qaPlaywrightBrowserOwner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'reports/zen-bonsai-pixi');
const BUNDLE_PATH = resolve(OUT_DIR, 'parity.bundle.js');

const CSS_WIDTH = 560;
const CSS_HEIGHT = 440;
const PIXEL_RATIO = 2;
const SEED = 150031;

const BROWSER_ENTRY = String.raw`
import { generateG15Topology } from './src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15Species.js';
import { ZenBonsaiG15RenderSpecies } from './src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15RenderSpecies.js';
import { createZenBonsaiG15PixiRenderer } from './src/themes/plugins/zen/runtime/pixi/createZenBonsaiG15PixiRenderer.js';
import {
  createZenBonsaiG15RenderPlanV1,
  ZEN_BONSAI_G15_CAMERA_FIT_MODES,
  ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES,
} from './src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15RenderPlan.js';
import { resolveZenHomeGardenBedCanvasProjection } from './src/themes/plugins/zen/runtime/zenHomeGardenBedCanvasProjection.js';
import {
  resolveZenHomeGardenBedDeviceMesh,
  resolveZenHomeGardenBedGroundPlane,
} from './src/themes/plugins/zen/model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import { getCurrentEnvironment } from './src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentTimeline.js';

const LIFE = { phase:'mature', growth:1, vitality:0.95, stress:0.04, bloom:0.92, dryness:0.04, branchSag:0.02 };

function buildScene({ seed, style, cssWidth, cssHeight, pixelRatio }) {
  const layoutFrame = {
    coordinateSpace: 'css-pixel', layoutMode: 'landscape', boundaryOvershootCssPx: 1,
    leftIntrusionCssPx: 20, surfaceSize: { width: cssWidth, height: cssHeight },
    sceneViewport: { x: 21, y: 0, width: cssWidth - 22, height: cssHeight },
  };
  const surface = resolveZenHomeGardenBedCanvasProjection({ pixelRatio, layoutFrame });
  const geometry = resolveZenHomeGardenBedDeviceMesh({ projection: surface.projection });
  const groundPlane = resolveZenHomeGardenBedGroundPlane({ geometry });
  const topology = generateG15Topology({ seed, lifeState: LIFE });
  const renderPlan = createZenBonsaiG15RenderPlanV1({
    topology,
    surface: {
      pixelWidth: surface.scenePixelWidth, pixelHeight: surface.scenePixelHeight,
      treeViewport: { x: 0, y: 0, width: surface.scenePixelWidth, height: surface.scenePixelHeight },
      clipTreePaint: true,
    },
    includePot: false, includeBackground: false, groundPlane,
    cameraAnchor: {
      fitMode: ZEN_BONSAI_G15_CAMERA_FIT_MODES.ROOTED_ABOVE_GROUND,
      horizontalComposition: {
        mode: ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES.STRUCTURAL_MASS,
        targetViewportX: geometry.sceneViewport.width * 0.5, maximumRootShiftPx: 20,
      },
      world: { x: 0, y: 0, z: 0 },
      viewport: {
        x: geometry.plantingAnchor.x - geometry.sceneViewport.x,
        y: geometry.plantingAnchor.y - geometry.sceneViewport.y,
      },
    },
  });
  return {
    surface,
    workerScene: {
      topology,
      renderPlan,
      renderOptions: {
        homeGardenBedProjection: surface.projection,
        lifeState: LIFE,
        environmentState: getCurrentEnvironment(12.5),
        renderBackdrop: true,
        renderPaperSurface: true,
        presentationStyle: style,
      },
    },
  };
}

window.renderBoth = async ({ seed, style, cssWidth, cssHeight, pixelRatio, frameCount }) => {
  const { surface, workerScene } = buildScene({ seed, style, cssWidth, cssHeight, pixelRatio });
  const sizeState = {
    pixelWidth: surface.pixelWidth, pixelHeight: surface.pixelHeight, pixelRatio,
  };

  const a = document.getElementById('canvas2d');
  a.width = surface.pixelWidth; a.height = surface.pixelHeight;
  const actx = a.getContext('2d');
  actx.clearRect(0, 0, a.width, a.height);
  ZenBonsaiG15RenderSpecies.render({
    ctx: actx, topology: workerScene.topology, frameCount,
    options: { ...workerScene.renderOptions, renderPlan: workerScene.renderPlan },
  });

  const b = document.getElementById('pixi');
  b.width = surface.pixelWidth; b.height = surface.pixelHeight;
  const renderer = createZenBonsaiG15PixiRenderer({ canvas: b });
  renderer.resize(sizeState);
  const result = renderer.render({ scene: workerScene, sizeState, frameCount, windState: null });

  // The diff has to happen in this same task. A WebGL canvas without
  // preserveDrawingBuffer is emptied as soon as control returns to the
  // browser, so reading it from a later call measures a blank surface and
  // reports a total mismatch that is entirely an artifact of the harness.
  const stats = window.diff();

  // Steady-state cost: what each backend spends on a frame once nothing about
  // the tree has changed but the wind. This is the whole reason the Pixi
  // backend exists, so it is measured rather than assumed.
  const FRAMES = 60;
  const wind = { intensity: 0.6, gustEnvelope: 0.5, direction: 1.8, dirX: -0.22, dirY: 0.97, sway: 0.006, gust: 0.003, flutter: 0.0008 };
  const canvasStart = performance.now();
  for (let f = 1; f <= FRAMES; f += 1) {
    actx.clearRect(0, 0, a.width, a.height);
    ZenBonsaiG15RenderSpecies.render({
      ctx: actx, topology: workerScene.topology, frameCount: f, wind,
      options: { ...workerScene.renderOptions, renderPlan: workerScene.renderPlan },
    });
  }
  const canvasMs = (performance.now() - canvasStart) / FRAMES;

  const pixiStart = performance.now();
  for (let f = 1; f <= FRAMES; f += 1) {
    renderer.render({ scene: workerScene, sizeState, frameCount: f, windState: wind });
  }
  const pixiMs = (performance.now() - pixiStart) / FRAMES;

  return {
    pixelWidth: surface.pixelWidth, pixelHeight: surface.pixelHeight, result, stats,
    frameCost: { canvas2dMs: +canvasMs.toFixed(2), pixiMs: +pixiMs.toFixed(2) },
  };
};

window.diff = () => {
  const a = document.getElementById('canvas2d');
  const b = document.getElementById('pixi');
  const w = a.width, h = a.height;
  const ad = a.getContext('2d').getImageData(0, 0, w, h).data;
  const bctx = b.getContext('2d');
  // The Pixi canvas is a WebGL surface; read it back through a 2D copy.
  const copy = document.createElement('canvas');
  copy.width = w; copy.height = h;
  const cctx = copy.getContext('2d');
  cctx.drawImage(b, 0, 0);
  const bd = cctx.getImageData(0, 0, w, h).data;

  const out = document.getElementById('diff');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);

  let differing = 0;
  let total = 0;
  let sum = 0;
  let worst = 0;
  for (let i = 0; i < ad.length; i += 4) {
    const da = Math.abs(ad[i] - bd[i]) + Math.abs(ad[i+1] - bd[i+1]) + Math.abs(ad[i+2] - bd[i+2]) + Math.abs(ad[i+3] - bd[i+3]);
    total += 1;
    sum += da;
    if (da > worst) worst = da;
    if (da > 12) differing += 1;
    const v = Math.min(255, da * 4);
    img.data[i] = v; img.data[i+1] = 0; img.data[i+2] = 0; img.data[i+3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return {
    differingPixels: differing,
    totalPixels: total,
    differingPercent: +(differing / total * 100).toFixed(3),
    meanChannelDelta: +(sum / total / 4).toFixed(3),
    worstPixelDelta: worst,
  };
};
`;

const buildBundle = async () => {
    await esbuild.build({
        stdin: {
            contents: BROWSER_ENTRY, resolveDir: ROOT, sourcefile: 'pixi-parity-entry.js', loader: 'js',
        },
        bundle: true,
        format: 'iife',
        outfile: BUNDLE_PATH,
        platform: 'browser',
        logLevel: 'error',
        define: { 'process.env.NODE_ENV': '"development"' },
        alias: { '@': resolve(ROOT, 'src') },
    });
    return readFile(BUNDLE_PATH, 'utf8');
};

const run = async () => {
    await mkdir(OUT_DIR, { recursive: true });
    const bundle = await buildBundle();

    const browser = await launchQaPlaywrightBrowser();
    const page = await browser.newPage({
        viewport: { width: CSS_WIDTH * 2 + 60, height: CSS_HEIGHT + 80 },
        deviceScaleFactor: 1,
    });
    let pageError = null;
    page.on('pageerror', (error) => { pageError = error; console.error('[pixi-parity] page error:', error.message); });
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            console.error(`[pixi-parity] console.${message.type()}:`, message.text().slice(0, 2000));
        }
    });

    await page.setContent(`<body style="margin:0;background:#111">
      <canvas id="canvas2d"></canvas><canvas id="pixi"></canvas><canvas id="diff"></canvas>
      <script>${bundle}</script>
    </body>`);

    const styles = ['ink', 'natural'];
    const summary = [];
    for (const style of styles) {
        const info = await page.evaluate((input) => window.renderBoth(input), {
            seed: SEED, style, cssWidth: CSS_WIDTH, cssHeight: CSS_HEIGHT, pixelRatio: PIXEL_RATIO, frameCount: 0,
        });
        if (pageError) throw pageError;
        const stats = info.stats;
        summary.push({
            style, ...stats, timing: info.result?.timing || null, frameCost: info.frameCost,
        });
        await page.locator('#canvas2d').screenshot({ path: resolve(OUT_DIR, `${style}-canvas2d.png`) });
        await page.locator('#pixi').screenshot({ path: resolve(OUT_DIR, `${style}-pixi.png`) });
        await page.locator('#diff').screenshot({ path: resolve(OUT_DIR, `${style}-diff.png`) });
        console.log(`[pixi-parity] ${style}`, JSON.stringify(stats));
        console.log(`[pixi-parity] ${style} per-frame`, JSON.stringify(info.frameCost));
    }

    await browser.close();
    await writeFile(resolve(OUT_DIR, 'parity.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log('[pixi-parity] wrote', OUT_DIR);
};

await run();
