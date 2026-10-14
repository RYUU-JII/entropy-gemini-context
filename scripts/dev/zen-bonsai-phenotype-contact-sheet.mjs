#!/usr/bin/env node
/**
 * Zen bonsai phenotype contact sheet.
 *
 * The G15.4 species crosses three independent phenotype axes — form (overall
 * silhouette), preset (classical bonsai style: trunk lean and scale), and
 * trait (per-fork temperament) — on top of the seed's own randomness. Reading
 * what one axis actually changes from source alone is unreliable, since two
 * of the three interact with per-seed noise the way the crown-base height did.
 * This renders one axis at a time, holding the other two at the product
 * default, across a few seeds each, so the comparison isn't one lucky or
 * unlucky roll.
 *
 * Usage: npm run diagnose:zen:bonsai-phenotype-sheet
 * Output: reports/zen-bonsai-phenotype/contact-sheet.png (plus per-cell PNGs)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { launchQaPlaywrightBrowser } from '../qa/browser/qaPlaywrightBrowserOwner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'reports/zen-bonsai-phenotype');
const BUNDLE_PATH = resolve(OUT_DIR, 'contact-sheet.bundle.js');
const SHEET_PATH = resolve(OUT_DIR, 'contact-sheet.png');

const CELL_CSS_WIDTH = 320;
const CELL_CSS_HEIGHT = 280;
const PIXEL_RATIO = 2;
const SEED_BASE = 150031;
const SEEDS_PER_ROW = [SEED_BASE, SEED_BASE + 977, SEED_BASE + 2 * 977];

const DEFAULT_PHENOTYPE = Object.freeze({
    preset: 'moyogi',
    form: 'central_recursive_meander',
    trait: 'balanced_natural',
});

// One axis varies per row; the other two stay at the product default so the
// row is reading that axis alone, not a confound of two.
const ROWS = [
    // kengai excluded: its trunk has no lean-correction budget (a dedicated
    // gravity rule droops it instead), and an unlucky seed lets that lean
    // compound uncorrected into a trunk that never rises — not a rare
    // outlier worth filtering, a preset not worth shipping as-is.
    ...['natural', 'moyogi', 'bunjin', 'shakan', 'sokan', 'fukinagashi'].map((preset) => ({
        id: `preset-${preset}`,
        label: `preset · ${preset}${preset === DEFAULT_PHENOTYPE.preset ? ' (기본)' : ''}`,
        phenotype: { ...DEFAULT_PHENOTYPE, preset },
    })),
    ...['central_recursive_meander', 'low_spread', 'asymmetric_counterweight', 'weeping_release', 'terminal_multisplit'].map((form) => ({
        id: `form-${form}`,
        label: `form · ${form}${form === DEFAULT_PHENOTYPE.form ? ' (기본)' : ''}`,
        phenotype: { ...DEFAULT_PHENOTYPE, form },
    })),
    ...['balanced_natural', 'deep_meander', 'codominant_forks', 'weeping_temperament', 'fine_ramification'].map((trait) => ({
        id: `trait-${trait}`,
        label: `trait · ${trait}${trait === DEFAULT_PHENOTYPE.trait ? ' (기본)' : ''}`,
        phenotype: { ...DEFAULT_PHENOTYPE, trait },
    })),
];

const LIFE_STATE = {
    phase: 'mature', growth: 1, vitality: 0.95, stress: 0.04, bloom: 0.92, dryness: 0.04, branchSag: 0.02,
};

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

window.renderPhenotypeCell = ({ seed, phenotype, lifeState, cssWidth, cssHeight, pixelRatio, canvasId }) => {
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

  const topology = generateG15Topology({ seed, lifeState, phenotype });

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

  const environmentState = getCurrentEnvironment(12.5);
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
      renderPaperSurface: true,
      presentationStyle: 'natural',
    },
  });
};
`;

const buildBundle = async () => {
    await esbuild.build({
        stdin: {
            contents: BROWSER_ENTRY,
            resolveDir: ROOT,
            sourcefile: 'phenotype-contact-sheet-entry.js',
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
            width: (CELL_CSS_WIDTH * SEEDS_PER_ROW.length) + 240,
            height: ((CELL_CSS_HEIGHT + 26) * ROWS.length) + 60,
        },
        deviceScaleFactor: 1,
    });
    page.on('pageerror', (error) => {
        process.exitCode = 1;
        console.error('[phenotype-sheet] page error:', error.message);
    });

    const cells = ROWS.map((row) => SEEDS_PER_ROW.map((seed) => (
        `<div class="cell"><canvas id="c-${row.id}-${seed}"></canvas></div>`
    )).join('')).join('');
    const rowLabels = ROWS.map((row) => `<div class="rowlabel">${row.label}</div>`).join('');

    await page.setContent(`<body style="margin:0;background:#15171a;font:11px/1.5 ui-sans-serif,system-ui">
        <div style="display:flex">
          <div style="display:flex;flex-direction:column">${rowLabels}</div>
          <div id="sheet" style="display:grid;grid-template-columns:repeat(${SEEDS_PER_ROW.length},max-content);gap:4px;padding:8px">${cells}</div>
        </div>
        <style>
          .cell{background:#000;border-radius:2px;overflow:hidden}
          .rowlabel{height:${CELL_CSS_HEIGHT + 26}px;display:flex;align-items:center;padding:0 8px;color:#cfd3d8;white-space:nowrap}
          canvas{display:block}
        </style>
        <script>${bundle}</script>
    </body>`);

    for (const row of ROWS) {
        for (const seed of SEEDS_PER_ROW) {
            await page.evaluate((input) => window.renderPhenotypeCell(input), {
                seed,
                phenotype: row.phenotype,
                lifeState: LIFE_STATE,
                cssWidth: CELL_CSS_WIDTH,
                cssHeight: CELL_CSS_HEIGHT,
                pixelRatio: PIXEL_RATIO,
                canvasId: `c-${row.id}-${seed}`,
            });
            console.log(`[phenotype-sheet] ${row.id} seed=${seed}`);
        }
    }

    await page.locator('body > div').first().screenshot({ path: SHEET_PATH });

    // The full sheet is too tall to review in one glance, so also cut it into
    // the three axis sections at their known row boundaries.
    const rowHeight = CELL_CSS_HEIGHT + 26;
    const sectionCounts = { preset: 6, form: 5, trait: 5 };
    let rowCursor = 0;
    for (const [section, count] of Object.entries(sectionCounts)) {
        await page.screenshot({
            path: resolve(OUT_DIR, `section-${section}.png`),
            clip: {
                x: 0, y: 8 + (rowCursor * rowHeight),
                width: (CELL_CSS_WIDTH * SEEDS_PER_ROW.length) + 240,
                height: count * rowHeight,
            },
        });
        rowCursor += count;
    }

    await browser.close();
    await writeFile(
        resolve(OUT_DIR, 'manifest.json'),
        `${JSON.stringify({ rows: ROWS.map((row) => ({ id: row.id, phenotype: row.phenotype })), seeds: SEEDS_PER_ROW }, null, 2)}\n`,
    );
    console.log(`[phenotype-sheet] wrote ${SHEET_PATH}`);
};

await run();
