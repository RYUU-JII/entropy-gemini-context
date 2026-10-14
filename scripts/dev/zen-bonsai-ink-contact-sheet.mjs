#!/usr/bin/env node
/**
 * Zen bonsai ink contact sheet.
 *
 * Renders the Home garden-bed composite across a day and across vitality
 * states into one sheet. Once the tree's colour is derived from the world's
 * light rather than fixed hex, a single screenshot stops being evidence: a
 * palette that reads beautifully at noon can collapse at midnight. This is the
 * check for that.
 *
 * Usage: npm run diagnose:zen:bonsai-ink-sheet
 * Output: reports/zen-bonsai-ink/contact-sheet.png (plus per-cell PNGs)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { launchQaPlaywrightBrowser } from '../qa/browser/qaPlaywrightBrowserOwner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'reports/zen-bonsai-ink');
const BUNDLE_PATH = resolve(OUT_DIR, 'contact-sheet.bundle.js');
const SHEET_PATH = resolve(OUT_DIR, 'contact-sheet.png');

const CELL_CSS_WIDTH = 380;
const CELL_CSS_HEIGHT = 262;
const PIXEL_RATIO = 2;

// Solar hours, not clock hours: the point is to catch the extremes of the
// tint's contrast rule, so dawn and midnight matter more than mid-morning.
const HOURS = [
    { id: 'dawn', hour: 6.2, label: 'Dawn 06:12' },
    { id: 'noon', hour: 12.5, label: 'Noon 12:30' },
    { id: 'dusk', hour: 18.9, label: 'Dusk 18:54' },
    { id: 'night', hour: 23.5, label: 'Night 23:30' },
];

const STYLES = [
    { id: 'ink', label: '수묵' },
    { id: 'natural', label: '실경' },
];

const LIFE_STATES = [
    {
        id: 'thriving',
        label: 'Mature · thriving',
        lifeState: {
            phase: 'mature', growth: 1, vitality: 0.95, stress: 0.04, bloom: 0.92, dryness: 0.04, branchSag: 0.02,
        },
    },
    {
        id: 'strained',
        label: 'Mature · strained',
        lifeState: {
            phase: 'mature', growth: 1, vitality: 0.58, stress: 0.38, bloom: 0.15, dryness: 0.42, branchSag: 0.3,
        },
    },
];

const ROWS = STYLES.flatMap((style) => LIFE_STATES.map((state) => ({
    id: `${style.id}-${state.id}`,
    style,
    state,
})));

const BROWSER_ENTRY = String.raw`
import { generateG15Topology } from './src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15Species.js';
import { ZenBonsaiG15RenderSpecies } from './src/themes/plugins/zen/model/bonsai/g15/ZenBonsaiG15RenderSpecies.js';
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
import { resolveZenAmbientPalette } from './src/themes/plugins/zen/runtime/environment/zenWorldMaterialPalette.js';

const topologyCache = new Map();

window.renderInkCell = ({ hour, lifeState, seed, cssWidth, cssHeight, pixelRatio, canvasId, paper, presentationStyle }) => {
  const layoutFrame = {
    coordinateSpace: 'css-pixel',
    layoutMode: 'landscape',
    boundaryOvershootCssPx: 1,
    leftIntrusionCssPx: 20,
    surfaceSize: { width: cssWidth, height: cssHeight },
    sceneViewport: { x: 21, y: 0, width: cssWidth - 22, height: cssHeight },
  };
  const surface = resolveZenHomeGardenBedCanvasProjection({ pixelRatio, layoutFrame });
  const geometry = resolveZenHomeGardenBedDeviceMesh({ projection: surface.projection });
  const groundPlane = resolveZenHomeGardenBedGroundPlane({ geometry });

  const cacheKey = seed + '|' + JSON.stringify(lifeState);
  if (!topologyCache.has(cacheKey)) {
    topologyCache.set(cacheKey, generateG15Topology({ seed, lifeState }));
  }
  const topology = topologyCache.get(cacheKey);

  const plan = createZenBonsaiG15RenderPlanV1({
    topology,
    surface: {
      pixelWidth: surface.scenePixelWidth,
      pixelHeight: surface.scenePixelHeight,
      treeViewport: { x: 0, y: 0, width: surface.scenePixelWidth, height: surface.scenePixelHeight },
      clipTreePaint: true,
    },
    includePot: false,
    includeBackground: false,
    groundPlane,
    cameraAnchor: {
      fitMode: ZEN_BONSAI_G15_CAMERA_FIT_MODES.ROOTED_ABOVE_GROUND,
      horizontalComposition: {
        mode: ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES.STRUCTURAL_MASS,
        targetViewportX: geometry.sceneViewport.width * 0.5,
        maximumRootShiftPx: 20,
      },
      world: { x: 0, y: 0, z: 0 },
      viewport: {
        x: geometry.plantingAnchor.x - geometry.sceneViewport.x,
        y: geometry.plantingAnchor.y - geometry.sceneViewport.y,
      },
    },
  });

  const environmentState = getCurrentEnvironment(hour);
  const canvas = document.getElementById(canvasId);
  canvas.width = surface.pixelWidth;
  canvas.height = surface.pixelHeight;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ZenBonsaiG15RenderSpecies.render({
    ctx,
    topology,
    options: {
      renderPlan: plan,
      homeGardenBedProjection: surface.projection,
      lifeState,
      environmentState,
      renderBackdrop: true,
      renderPaperSurface: paper !== false,
      presentationStyle,
    },
  });
  // The pond reads the same canonical palette, so its water tones are the
  // reference this sheet has to be judged against.
  const ambient = resolveZenAmbientPalette(environmentState.ambientChromaticState);
  return {
    daylight: environmentState.daylight,
    night: environmentState.night,
    water: ambient.water,
  };
};
`;

const buildBundle = async () => {
    await esbuild.build({
        stdin: {
            contents: BROWSER_ENTRY,
            resolveDir: ROOT,
            sourcefile: 'ink-contact-sheet-entry.js',
            loader: 'js',
        },
        bundle: true,
        format: 'iife',
        outfile: BUNDLE_PATH,
        platform: 'browser',
        logLevel: 'error',
        define: { 'process.env.NODE_ENV': '"development"' },
    });
    return readFile(BUNDLE_PATH, 'utf8');
};

const run = async () => {
    await mkdir(OUT_DIR, { recursive: true });
    const bundle = await buildBundle();

    const browser = await launchQaPlaywrightBrowser();
    const page = await browser.newPage({
        viewport: {
            width: (CELL_CSS_WIDTH * HOURS.length) + 24,
            height: ((CELL_CSS_HEIGHT + 30) * ROWS.length) + 60,
        },
        deviceScaleFactor: 1,
    });
    page.on('pageerror', (error) => {
        process.exitCode = 1;
        console.error('[ink-sheet] page error:', error.message);
    });

    const cells = ROWS.map((row) => HOURS.map((hour) => (
        `<div class="cell"><canvas id="c-${row.id}-${hour.id}"></canvas>`
        + `<div class="water" id="w-${row.id}-${hour.id}"></div>`
        + `<div class="cap">${row.style.label} · ${row.state.label} · ${hour.label}</div></div>`
    )).join('')).join('');

    await page.setContent(`<body style="margin:0;background:#15171a;font:11px/1.5 ui-sans-serif,system-ui">
        <div id="sheet" style="display:grid;grid-template-columns:repeat(${HOURS.length},max-content);gap:8px;padding:8px">${cells}</div>
        <style>
          .cell{background:#000;border-radius:2px;overflow:hidden}
          .cap{color:#9aa0a6;padding:4px 6px;background:#1c1f23}
          .water{display:flex;height:10px}
          .water i{flex:1}
          canvas{display:block}
        </style>
        <script>${bundle}</script>
    </body>`);

    for (const row of ROWS) {
        for (const hour of HOURS) {
            const info = await page.evaluate((input) => window.renderInkCell(input), {
                hour: hour.hour,
                lifeState: row.state.lifeState,
                presentationStyle: row.style.id,
                seed: 150031,
                cssWidth: CELL_CSS_WIDTH,
                cssHeight: CELL_CSS_HEIGHT,
                pixelRatio: PIXEL_RATIO,
                canvasId: `c-${row.id}-${hour.id}`,
            });
            // The pond's own water ramp, painted under each cell as the tone
            // the tree has to sit beside.
            await page.evaluate(({ id, water }) => {
                const strip = document.getElementById(id);
                strip.innerHTML = water
                    .map((tone) => `<i style="background:${tone}"></i>`)
                    .join('');
            }, { id: `w-${row.id}-${hour.id}`, water: info.water });
            console.log(
                `[ink-sheet] ${row.id}/${hour.id}`,
                `daylight=${Number(info.daylight).toFixed(2)}`,
                `water=${info.water.join(',')}`,
            );
            await page.locator(`#c-${row.id}-${hour.id}`).screenshot({
                path: resolve(OUT_DIR, `${row.id}-${hour.id}.png`),
            });
        }
    }

    await page.locator('#sheet').screenshot({ path: SHEET_PATH });
    await browser.close();
    await writeFile(
        resolve(OUT_DIR, 'manifest.json'),
        `${JSON.stringify({ hours: HOURS, rows: ROWS.map((row) => row.id) }, null, 2)}\n`,
    );
    console.log(`[ink-sheet] wrote ${SHEET_PATH}`);
};

await run();
