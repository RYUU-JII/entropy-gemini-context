#!/usr/bin/env node

import {
    readdir,
    readFile,
} from 'node:fs/promises';
import {
    extname,
    relative,
    resolve,
} from 'node:path';

import {
    ZEN_POND_RESEARCH_REPOSITORY_ROOT,
    ZEN_POND_RESEARCH_ROOT,
    validateZenPondResearchVariantRegistry,
} from '../dev/zen-pond-render-research/variants/registry.mjs';

const SOURCE_ROOT = resolve(
    ZEN_POND_RESEARCH_REPOSITORY_ROOT,
    'src',
);
const BROWSER_APP = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'browser/PondResearchApp.jsx',
);
const RUNTIME = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'browser/pondResearchRuntime.js',
);
const COMPARISON_STUDIO = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'browser/comparison/PondResearchComparisonStudio.jsx',
);
const COMPARISON_CATALOG = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'contracts/pondResearchComparisonCatalog.mjs',
);
const COMPARISON_COMPOSITION = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'contracts/pondResearchComparisonComposition.mjs',
);
const COMPARISON_SERVER = resolve(
    ZEN_POND_RESEARCH_ROOT,
    'host/comparisonStudioServer.mjs',
);
const GPU_TIMER = resolve(
    SOURCE_ROOT,
    'themes/plugins/zen/pond/renderers/pixi/telemetry/pixiGpuFrameTimer.js',
);
const SUPPORTED_SOURCE_EXTENSIONS = new Set([
    '.js',
    '.jsx',
    '.mjs',
    '.ts',
    '.tsx',
]);

const fail = (detail) => {
    console.error(`[zen-pond-research-boundary] FAIL ${detail}`);
    process.exit(1);
};

const listSourceFiles = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return listSourceFiles(path);
        if (!entry.isFile()) return [];
        return SUPPORTED_SOURCE_EXTENSIONS.has(extname(entry.name))
            ? [path]
            : [];
    }));
    return nested.flat();
};

const requireSourceFragments = async (path, fragments) => {
    const source = await readFile(path, 'utf8');
    fragments.forEach((fragment) => {
        if (!source.includes(fragment)) {
            fail(
                `${relative(
                    ZEN_POND_RESEARCH_REPOSITORY_ROOT,
                    path,
                )} missing ${fragment}`,
            );
        }
    });
};

const sourceFiles = await listSourceFiles(SOURCE_ROOT);
for (const path of sourceFiles) {
    const source = await readFile(path, 'utf8');
    if (
        source.includes('zen-pond-render-research')
        || source.includes('__ENTROPY_ZEN_POND_RESEARCH__')
    ) {
        fail(
            `product source imports or names research surface: ${relative(
                ZEN_POND_RESEARCH_REPOSITORY_ROOT,
                path,
            )}`,
        );
    }
}

const registry = validateZenPondResearchVariantRegistry({
    checkFiles: true,
});

await requireSourceFragments(BROWSER_APP, [
    'ZenSignalScannerContainer',
    'buildExperimentPondSyntheticDomainCandidates',
    'ZEN_POND_ROSTER_AUTHORITY_SOURCES.EXPERIMENT_SYNTHETIC',
    'dataIsolationMode',
    'workerRenderBudget={POND_WORKER_RENDER_BUDGET}',
    'onRuntimeFirstFrameReady',
    'ZenCoreStatusClassicHome',
    'BONSAI_LIFECYCLE_INPUT',
    'state.pondFirstFrame ?',
    'surface: \'bonsai\'',
]);

await requireSourceFragments(RUNTIME, [
    'fixed_lab_v1',
    'sequential_isolated_runs',
    'bitExactPixelReplay: false',
    'gpuTimerQueries: \'telemetry_gated_ext_disjoint_timer_query\'',
    'setSurfaceMode',
    'getZenHomeRendererWorkerSessionSnapshot',
    'captureRenderDiagnostics',
    'captureRuntimeHealth',
]);

await requireSourceFragments(COMPARISON_STUDIO, [
    'Compare',
    'Single',
    'comparison-axis-matrix',
    'activateSelection',
    'Visual comparison only',
    'Valid performance topology',
    'Measure 2.4s',
]);

await requireSourceFragments(COMPARISON_CATALOG, [
    "id: 'product'",
    "id: 'floor'",
    "id: 'plants'",
    "id: 'rocks'",
    "id: 'komorebi'",
    "id: 'caustics'",
    "id: 'sky_reflection'",
    "label: 'Botanical'",
    "label: 'Grounded'",
    'requireZenPondComparisonSelection',
]);

await requireSourceFragments(COMPARISON_COMPOSITION, [
    'buildZenPondComparisonCompositeManifest',
    'FLOOR_REPLACEMENTS',
    'KOMOREBI_REPLACEMENTS',
    'CAUSTICS_REPLACEMENTS',
    'SKY_REFLECTION_REPLACEMENTS',
    'ROCK_AUXILIARY_REPLACEMENTS',
    'comparisonProductPlantNaturalRockTextureFactories.js',
]);

await requireSourceFragments(COMPARISON_SERVER, [
    'startZenPondResearchServer',
    'buildZenPondComparisonCompositeManifest',
    'rendererSessions',
    'api/pond-comparison/activate',
    'api/pond-comparison/deactivate',
]);

await requireSourceFragments(GPU_TIMER, [
    'EXT_disjoint_timer_query_webgl2',
    'EXT_disjoint_timer_query',
    'pendingQueries.length >= pendingLimit',
    'GPU_DISJOINT_EXT',
    'timer_query_extension_unavailable',
]);

console.log(
    '[zen-pond-research-boundary] PASS '
    + `${sourceFiles.length} product source files; `
    + `${registry.variantCount} variant(s); `
    + `${registry.replacementCount} replacement(s)`,
);
