#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';
import { launchQaPlaywrightBrowser } from '../qa/browser/qaPlaywrightBrowserOwner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'reports/zen-bonsai-growth-matrix');
const BUNDLE_PATH = resolve(OUT_DIR, 'matrix.bundle.js');
const HTML_PATH = resolve(OUT_DIR, 'index.html');
const MANIFEST_PATH = resolve(OUT_DIR, 'manifest.json');
const REPORT_PATH = resolve(OUT_DIR, 'report.md');
const MATRIX_SHOT_PATH = resolve(OUT_DIR, 'matrix.png');
const PIXEL_CHANGE_RGB_DELTA_THRESHOLD = 12;
const ALLOWED_CLI_ARGUMENTS = new Set(['--bundle-only']);
const cliArguments = process.argv.slice(2);
const unknownCliArgument = cliArguments.find((argument) => !ALLOWED_CLI_ARGUMENTS.has(argument));
if (unknownCliArgument) {
    throw new Error(`ZEN_BONSAI_GROWTH_MATRIX_ARGUMENT_INVALID:${unknownCliArgument}`);
}
const BUNDLE_ONLY = cliArguments.includes('--bundle-only');

const BROWSER_ENTRY = String.raw`
import { SeededRandom } from './src/themes/plugins/zen/model/SeededRandom.js';
import { SakuraSpecies } from './src/themes/plugins/zen/model/SakuraSpecies.js';
import { STAGES } from './src/themes/plugins/zen/model/ZenCoreConfig.js';
import { resolveZenBonsaiLifecycleTarget } from './src/themes/plugins/zen/model/ZenBonsaiLifecycle.js';
		import {
		    applyZenBonsaiGrowthProjectionToStage,
		    collectZenBonsaiTerminalContinuityStats,
		    projectZenBonsaiGrowthNode,
		    resolveZenBonsaiGrowthProjection,
		    resolveZenBonsaiStageFlowerAvailability,
		    shouldRenderZenBonsaiGrowthNode,
		    ZEN_BONSAI_ENDPOINT_KINDS,
		} from './src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js';
import {
    projectZenBonsaiClassic2DevelopmentTopology,
    resolveZenBonsaiClassic2DisplayCandidateStage,
    resolveZenBonsaiClassic2RenderProjection,
    ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES,
} from './src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js';
import {
    bootstrapZenBonsaiClassic2LineageState,
    prepareZenBonsaiClassic2LineageCandidate,
    reconcileZenBonsaiClassic2LineageState,
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES,
} from './src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageModel.js';
import {
    resolveZenBonsaiClassic2BlossomPresentationTarget,
    resolveZenBonsaiClassic2GrowthExperienceTarget,
    ZEN_BONSAI_CLASSIC2_ACTIVATION_CHECKPOINTS,
    ZEN_BONSAI_CLASSIC2_GROWTH_CHECKPOINTS,
    ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_CONTRACT_VERSION,
    ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED,
} from './src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2GrowthExperienceContract.js';
import {
    createZenBonsaiActivationPresentation,
} from './src/themes/plugins/zen/model/bonsai/presentation/ZenBonsaiActivationPresentation.js';
import { BranchGeometryModel } from './src/themes/plugins/zen/model/bonsai/geometry/branchGeometryModel.js';
import { resolveBonsaiCamera } from './src/themes/plugins/zen/model/bonsai/rendering/resolveBonsaiCamera.js';
import { resolveSakuraLifeAppearanceProfile } from './src/themes/plugins/zen/model/sakura/sakuraLifeMood.js';
import {
    resolveNebariDevelopmentProfile,
    resolveNebariRootBaseWidth,
    resolveNebariTrunkWidth,
} from './src/themes/plugins/zen/model/sakura/sakuraRenderer.js';

const MATRIX_VERSION = 1;
const STRUCTURE_DEPTH = 6;
const TOPOLOGY_REFERENCE_HEIGHT = 360;
const VIEWPORT = { width: 360, height: 440 };
const PIXEL_CHANGE_RGB_DELTA_THRESHOLD = ${PIXEL_CHANGE_RGB_DELTA_THRESHOLD};
const GROWTH_MODELS = Object.freeze([
    { id: 'classic', label: 'Comparison · Classic' },
    { id: 'classic2', label: 'Main · Classic2' },
]);
const BASE_STAGE = Object.freeze({
    min: 86,
    max: 100,
    depth: STRUCTURE_DEPTH,
    leafChance: 0.62,
    flowerChance: 0.34,
    color: '#43A047',
    text: 'Snapshot',
});

const DAY_BUCKETS = Object.freeze([
    { day: 0, growthScore: 0, label: 'day 0' },
    { day: 2, growthScore: 25.2, label: 'day 2' },
    { day: 4, growthScore: 50.4, label: 'day 4' },
    { day: 6, growthScore: 75.6, label: 'day 6' },
    { day: 7, growthScore: 88.2, label: 'day 7' },
]);

const GROWTH_BUCKETS = Object.freeze([
    { growthStage: 12, label: 'growth 12', description: 'compact seedling form' },
    { growthStage: 24, label: 'growth 24', description: 'established seedling threshold' },
    { growthStage: 42, label: 'growth 42', description: 'early juvenile scaffold' },
    { growthStage: 55, label: 'growth 55', description: 'mid-juvenile ramification transition' },
    { growthStage: 70, label: 'growth 70', description: 'mature threshold' },
    { growthStage: 82, label: 'growth 82', description: 'late-mature canopy transition' },
    { growthStage: 92, label: 'growth 92', description: 'near-display fullness' },
    { growthStage: 100, label: 'growth 100', description: 'complete display form' },
]);

const ACTIVATION_BUCKETS = Object.freeze([
    { activation: 18, label: 'activation 18', description: 'low current vitality' },
    { activation: 58, label: 'activation 58', description: 'steady current vitality' },
    { activation: 92, label: 'activation 92', description: 'high current vitality' },
]);
const SENSITIVITY_HISTORY_ACTIVATION = 58;

const LINEAGE_REPLAY_PATHS = Object.freeze([
    Object.freeze({
        id: 'steady-care',
        label: 'Steady care history',
        activations: Object.freeze([92, 92, 92, 92, 92, 92, 92, 92]),
    }),
    Object.freeze({
        id: 'strain-recovery',
        label: 'Strain then recovery history',
        activations: Object.freeze([18, 18, 58, 58, 92, 92, 92, 92]),
    }),
]);

const SCENARIOS = Object.freeze([
    {
        id: 'healthy',
        label: 'Healthy practice',
        description: 'low strain, stable canopy, high current vitality',
        vigor: { vitality: 0.92, stress: 0.06, bloom: 0.72, dryness: 0.04, branchSag: 0.04, windResponse: 0.84 },
        segment: { exposureQuality: 0.9, stressWood: 0.04, recoveryWood: 0.18, volatility: 0.04, canopyReserve: 0.9, healthH: 0.9, vitalityTier: 'thriving' },
        structuralImprint: { exposureQuality: 0.9, stressWood: 0.04, recoveryWood: 0.18, volatility: 0.04, canopyReserve: 0.9, lastUpdatedDateKey: '2026-07-04' },
    },
    {
        id: 'remembered-strain',
        label: 'Remembered strain',
        description: 'healthy current vitality; only older wood carries strain memory',
        vigor: { vitality: 0.92, stress: 0.06, bloom: 0.72, dryness: 0.04, branchSag: 0.04, windResponse: 0.84 },
        segment: { exposureQuality: 0.88, stressWood: 0.32, recoveryWood: 0.03, volatility: 0.22, canopyReserve: 0.48, healthH: 0.72, vitalityTier: 'remembered_strain' },
        structuralImprint: { exposureQuality: 0.88, stressWood: 0.32, recoveryWood: 0.03, volatility: 0.22, canopyReserve: 0.48, lastUpdatedDateKey: '2026-07-04' },
    },
    {
        id: 'strain',
        label: 'Persistent strain',
        description: 'repeated overrun pressure; should read as shaped wood, not punishment',
        vigor: { vitality: 0.48, stress: 0.58, bloom: 0.18, dryness: 0.46, branchSag: 0.42, windResponse: 0.52 },
        segment: { exposureQuality: 0.88, stressWood: 0.32, recoveryWood: 0.03, volatility: 0.22, canopyReserve: 0.48, healthH: 0.48, vitalityTier: 'strained' },
        structuralImprint: { exposureQuality: 0.88, stressWood: 0.32, recoveryWood: 0.03, volatility: 0.22, canopyReserve: 0.48, lastUpdatedDateKey: '2026-07-04' },
    },
    {
        id: 'recovery',
        label: 'Recovery after strain',
        description: 'older stressed wood plus newer recovery wood',
        vigor: { vitality: 0.84, stress: 0.18, bloom: 0.48, dryness: 0.14, branchSag: 0.18, windResponse: 0.72 },
        segment: { exposureQuality: 0.86, stressWood: 0.14, recoveryWood: 0.28, volatility: 0.1, canopyReserve: 0.74, healthH: 0.78, vitalityTier: 'recovering' },
        structuralImprint: { exposureQuality: 0.86, stressWood: 0.2, recoveryWood: 0.28, volatility: 0.14, canopyReserve: 0.72, lastUpdatedDateKey: '2026-07-04' },
        earlySegment: { exposureQuality: 0.88, stressWood: 0.34, recoveryWood: 0.03, volatility: 0.2, canopyReserve: 0.5, healthH: 0.48, vitalityTier: 'strained' },
    },
]);

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const round = (value, digits = 4) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
};
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const growthFromScore = (growthScore) => round(0.5 + (smoothstep01(clamp(growthScore, 0, 100) / 100) * 0.5));
const phaseFromGrowth = (growth) => {
    if (growth >= 0.84) return 'mature';
    if (growth >= 0.42) return 'juvenile';
    return 'seedling';
};
const analysisConfidenceForDay = (day) => round(clamp((day - 3) / 25, 0, 1));

const makeSprite = ({ type, fill, stroke }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.translate(32, 32);
    if (type === 'flower') {
        for (let index = 0; index < 5; index += 1) {
            ctx.save();
            ctx.rotate((Math.PI * 2 * index) / 5);
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(0, -12, 7.5, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle = '#D8A24A';
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        return canvas;
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.bezierCurveTo(-8, -12, 18, -14, 22, 0);
    ctx.bezierCurveTo(14, 13, -10, 12, -18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(47,71,43,0.36)';
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.lineTo(17, 0);
    ctx.stroke();
    return canvas;
};

const createRenderedTerminalVisibility = () => ({
    renderedLeafSprites: 0,
    renderedStructuredLeafTerminals: 0,
    renderedGrowthTipLeafSprites: 0,
    renderedUnclassifiedLeafSprites: 0,
    renderedFlowerTerminals: 0,
    renderedFlowerBuds: 0,
    renderedHalfOpenFlowers: 0,
    renderedFullFlowers: 0,
    renderedUnclassifiedFlowers: 0,
});

const createSnapshotAssetCache = ({ telemetry, model }) => {
    const leaf = makeSprite({ type: 'leaf', fill: '#819568', stroke: '#53683F' });
    const flower = makeSprite({ type: 'flower', fill: '#FFE4EC', stroke: '#E6A7B9' });
    return {
        assetSize: 64,
        logicalAssetSize: 64,
        resolveLeafSprite: (terminal = null) => {
            telemetry.renderedLeafSprites += 1;
            if (model === 'classic2') {
                if (terminal?.classic2Development?.lineage === true) {
                    telemetry.renderedStructuredLeafTerminals += 1;
                } else {
                    telemetry.renderedGrowthTipLeafSprites += 1;
                }
            } else {
                telemetry.renderedUnclassifiedLeafSprites += 1;
            }
            return leaf;
        },
        resolveFlowerSprite: (terminal = null) => {
            telemetry.renderedFlowerTerminals += 1;
            const bloomStage = terminal?.blossom?.bloomStage;
            if (bloomStage === 'bud') {
                telemetry.renderedFlowerBuds += 1;
            } else if (bloomStage === 'half_open') {
                telemetry.renderedHalfOpenFlowers += 1;
            } else if (bloomStage === 'full') {
                telemetry.renderedFullFlowers += 1;
            } else {
                telemetry.renderedUnclassifiedFlowers += 1;
            }
            return flower;
        },
    };
};

const makeSegments = ({ dayBucket, scenario }) => {
    const milestoneCount = Math.max(0, Math.min(8, Math.floor(dayBucket.growthScore / 12)));
    return Array.from({ length: milestoneCount }, (_, index) => {
        const milestone = index + 1;
        const base = scenario.id === 'recovery' && milestone <= Math.max(1, Math.floor(milestoneCount / 2))
            ? scenario.earlySegment
            : scenario.segment;
        return {
            id: 'm' + milestone + '-' + scenario.id,
            milestone,
            growthScore: Math.min(100, milestone * 12),
            dateKey: '2026-07-' + String(Math.min(28, Math.max(1, dayBucket.day - milestoneCount + milestone))).padStart(2, '0'),
            ...base,
        };
    });
};

const makeLifeState = ({ dayBucket, scenario }) => {
    const growth = growthFromScore(dayBucket.growthScore);
    const segments = makeSegments({ dayBucket, scenario });
    return {
        phase: phaseFromGrowth(growth),
        growth,
        dataDays: dayBucket.day,
        analysisConfidence: analysisConfidenceForDay(dayBucket.day),
        ...scenario.vigor,
        structuralImprint: dayBucket.day >= 14 ? scenario.structuralImprint : null,
        growthSegments: dayBucket.day >= 14 ? segments : [],
    };
};

const makeGrowthActivationSegments = ({
    growthBucket,
    historyActivation = SENSITIVITY_HISTORY_ACTIVATION,
}) => {
    const milestoneCount = Math.max(0, Math.min(8, Math.floor(growthBucket.growthStage / 12)));
    const historyActivationRatio = clamp01(historyActivation / 100);
    return Array.from({ length: milestoneCount }, (_, index) => {
        const milestone = index + 1;
        const milestoneRatio = milestoneCount > 1 ? index / (milestoneCount - 1) : 0;
        return {
            id: 'ga-' + growthBucket.growthStage + '-h' + historyActivation + '-m' + milestone,
            milestone,
            growthScore: Math.min(100, milestone * 12),
            dateKey: '2026-07-' + String(Math.min(28, 2 + milestone)).padStart(2, '0'),
            exposureQuality: round(0.5 + (historyActivationRatio * 0.44), 4),
            stressWood: round((1 - historyActivationRatio) * (0.2 + milestoneRatio * 0.14), 4),
            recoveryWood: round(historyActivationRatio * (0.08 + milestoneRatio * 0.16), 4),
            volatility: round((1 - historyActivationRatio) * 0.16, 4),
            canopyReserve: round(0.42 + (historyActivationRatio * 0.5), 4),
            healthH: round(0.34 + (historyActivationRatio * 0.62), 4),
            vitalityTier: historyActivationRatio >= 0.78 ? 'thriving' : (historyActivationRatio >= 0.48 ? 'stable' : 'strained'),
        };
    });
};

const makeGrowthActivationLifecycleInput = ({
    growthBucket,
    activationBucket,
    historyActivation = SENSITIVITY_HISTORY_ACTIVATION,
}) => {
    const growthRatio = clamp01(growthBucket.growthStage / 100);
    const activationRatio = clamp01(activationBucket.activation / 100);
    const historyActivationRatio = clamp01(historyActivation / 100);
    const segments = makeGrowthActivationSegments({ growthBucket, historyActivation });
    const structuralImprint = {
        active: segments.length > 0,
        exposureQuality: round(0.48 + (historyActivationRatio * 0.46), 4),
        stressWood: round((1 - historyActivationRatio) * 0.24, 4),
        recoveryWood: round(historyActivationRatio * 0.18, 4),
        volatility: round((1 - historyActivationRatio) * 0.14, 4),
        canopyReserve: round(0.4 + (historyActivationRatio * 0.52), 4),
        lastUpdatedDateKey: '2026-07-04',
    };
    return {
        bonsaiPresentationMode: 'lab_preview',
        bonsaiCultivationLedgerPolicy: 'read_only',
        registeredSiteRuleCount: 1,
        registeredSiteGoalCount: 1,
        registeredSiteSignature: 'debug.bonsai.local',
        daysTracked: 28,
        trackedDateCount: 28,
        protectedVisitCount: Math.max(1, Math.round(2 + growthBucket.growthStage * 0.22)),
        activeProtectionDayCount: 7,
        frictionSuccessCount: Math.max(1, Math.round(activationRatio * 10)),
        todayActiveMs: 45 * 60 * 1000,
        todayProtectedMs: Math.round((16 + growthBucket.growthStage * 0.5) * 60 * 1000),
        weeklyProtectedAverageMs: Math.round((14 + growthBucket.growthStage * 0.36) * 60 * 1000),
        bonsaiGrowthScore: growthBucket.growthStage,
        progressionGrowthScore: growthBucket.growthStage,
        cycleScore: activationBucket.activation,
        dailyScore: activationBucket.activation,
        dailyDisplayScore: activationBucket.activation,
        integrityScore: activationBucket.activation,
        dailyLimitPercent: round(42 + ((1 - activationRatio) * 42), 2),
        signalCount: Math.round((1 - activationRatio) * 7),
        scoringMode: 'scored',
        scoreSummary: {
            score: activationBucket.activation,
            displayScore: activationBucket.activation,
            scoringMode: 'scored',
            totalCreditApplied: round(activationRatio * 100, 2),
            totalCreditAvailable: 100,
            totalDeductionApplied: round((1 - activationRatio) * 42, 2),
            criteriaCoverage: {
                coverageRatio: 0.92,
                displayReady: true,
            },
        },
        scoreCriteriaCoverage: {
            coverageRatio: 0.92,
            displayReady: true,
        },
        bonsaiStructuralImprint: structuralImprint,
        bonsaiGrowthSegments: segments,
        metrics: {
            bonsaiGrowthScore: growthBucket.growthStage,
            progressionGrowthScore: growthBucket.growthStage,
            dailyScore: activationBucket.activation,
            cycleScore: activationBucket.activation,
            registeredSiteRuleCount: 1,
            protectedVisitCount: Math.max(1, Math.round(2 + growthBucket.growthStage * 0.22)),
            activeProtectionDayCount: 7,
            frictionSuccessCount: Math.max(1, Math.round(activationRatio * 10)),
            todayProtectedMs: Math.round((16 + growthBucket.growthStage * 0.5) * 60 * 1000),
            weeklyProtectedAverageMs: Math.round((14 + growthBucket.growthStage * 0.36) * 60 * 1000),
            scoreSummary: {
                score: activationBucket.activation,
                displayScore: activationBucket.activation,
                scoringMode: 'scored',
                criteriaCoverage: {
                    coverageRatio: 0.92,
                    displayReady: true,
                },
            },
            bonsaiStructuralImprint: structuralImprint,
            bonsaiGrowthSegments: segments,
        },
        debugAxis: {
            growthStage: growthBucket.growthStage,
            growthRatio: round(growthRatio, 4),
            activation: activationBucket.activation,
            activationRatio: round(activationRatio, 4),
            historyActivation,
        },
    };
};

const makeGrowthActivationLifeState = ({
    growthBucket,
    activationBucket,
    historyActivation = SENSITIVITY_HISTORY_ACTIVATION,
}) => resolveZenBonsaiLifecycleTarget(
    makeGrowthActivationLifecycleInput({ growthBucket, activationBucket, historyActivation }),
);

const makeGrowthActivationPresentation = (activationBucket) => (
    createZenBonsaiActivationPresentation({
        ratio: activationBucket.activation / 100,
        reliability: 1,
    })
);

const countTerminalsByType = (terminals = []) => terminals.reduce((counts, terminal) => {
    const type = terminal?.type === 'flower' ? 'flower' : (terminal?.type === 'leaf' ? 'leaf' : 'other');
    counts.total += 1;
    counts[type] += 1;
    return counts;
}, { total: 0, flower: 0, leaf: 0, other: 0 });

const resolveMetricRoleDepth = (node = {}, role = 'scaffold', depth = 1) => {
    if (role === 'trunk') {
        return Math.max(1, Math.floor(Number(node.trunkMainDepth ?? depth) || 1));
    }
    if (role === 'twig') {
        return Math.max(1, Math.floor(Number(node.twigDepth ?? 1) || 1));
    }
    return Math.max(1, Math.floor(Number(node.scaffoldDepth ?? 1) || 1));
};

const resolveMetricRoleLimit = (node = {}, role = 'scaffold', depth = 1) => {
    if (role === 'trunk') {
        return Math.max(1, Math.floor(Number(node.trunkSegmentLimit ?? node.trunkDepthLimit ?? depth) || 1));
    }
    if (role === 'twig') {
        return Math.max(1, Math.floor(Number(node.twigMaxDepth ?? 1) || 1));
    }
    return Math.max(1, Math.floor(Number(node.scaffoldDepthLimit ?? node.scaffoldMaxDepth ?? depth) || 1));
};

const makeTerminalDepthBucket = () => ({
    generatedNodes: 0,
    visibleNodes: 0,
    generatedTerminals: 0,
    generatedFlowerTerminals: 0,
    generatedLeafTerminals: 0,
    visibleTerminals: 0,
    visibleFlowerTerminals: 0,
    visibleLeafTerminals: 0,
    hiddenTerminals: 0,
    hiddenFlowerTerminals: 0,
    hiddenLeafTerminals: 0,
});

const ensureTerminalDepthBucket = (distribution, key) => {
    if (!distribution[key]) {
        distribution[key] = makeTerminalDepthBucket();
    }
    return distribution[key];
};

const collectGrowthMetrics = ({ node, projection, depth = 1, out = null, ancestorVisible = true }) => {
    const metrics = out || {
        generatedNodes: 0,
        generatedScaffoldNodes: 0,
        generatedTwigNodes: 0,
        generatedTerminals: 0,
        generatedFlowerTerminals: 0,
        generatedLeafTerminals: 0,
        visibleNodes: 0,
        visibleScaffoldNodes: 0,
        visibleTwigs: 0,
        visibleTerminals: 0,
        visibleFlowerTerminals: 0,
        visibleLeafTerminals: 0,
        terminalCount: 0,
        lengthDeltaTotal: 0,
        widthDeltaTotal: 0,
        curveDeltaTotal: 0,
        maxCurveDelta: 0,
        terminalScaleDeltaTotal: 0,
        terminalDistDeltaTotal: 0,
        segmentsUsed: new Set(),
        terminalDepthDistribution: {},
    };
    if (!node) {
        return metrics;
    }
    const role = Number(node.branchOrder) === 3 ? 'twig' : (Number(node.branchOrder) === 0 ? 'trunk' : 'scaffold');
    const roleDepth = resolveMetricRoleDepth(node, role, depth);
    const roleLimit = resolveMetricRoleLimit(node, role, depth);
    const terminalDepthKey = role + ':' + roleDepth + '/' + roleLimit;
    const terminalDepthBucket = ensureTerminalDepthBucket(metrics.terminalDepthDistribution, terminalDepthKey);
    const terminals = Array.isArray(node.terminals) ? node.terminals : [];
    const terminalCounts = countTerminalsByType(terminals);
    metrics.generatedNodes += 1;
    terminalDepthBucket.generatedNodes += 1;
    if (role === 'twig') {
        metrics.generatedTwigNodes += 1;
    } else if (role === 'scaffold') {
        metrics.generatedScaffoldNodes += 1;
    }
    metrics.generatedTerminals += terminalCounts.total;
    metrics.generatedFlowerTerminals += terminalCounts.flower;
    metrics.generatedLeafTerminals += terminalCounts.leaf;
    terminalDepthBucket.generatedTerminals += terminalCounts.total;
    terminalDepthBucket.generatedFlowerTerminals += terminalCounts.flower;
    terminalDepthBucket.generatedLeafTerminals += terminalCounts.leaf;

    const isVisible = ancestorVisible && shouldRenderZenBonsaiGrowthNode(projection, node, depth);
    if (!isVisible) {
        terminalDepthBucket.hiddenTerminals += terminalCounts.total;
        terminalDepthBucket.hiddenFlowerTerminals += terminalCounts.flower;
        terminalDepthBucket.hiddenLeafTerminals += terminalCounts.leaf;
        if (Array.isArray(node.branches)) {
            node.branches.forEach((child) => collectGrowthMetrics({
                node: child?.obj,
                projection,
                depth: depth + 1,
                out: metrics,
                ancestorVisible: false,
            }));
        }
        return metrics;
    }
    const projected = projectZenBonsaiGrowthNode(node, projection, depth);
    metrics.visibleNodes += 1;
    terminalDepthBucket.visibleNodes += 1;
    if (role === 'twig') {
        metrics.visibleTwigs += 1;
    } else if (role === 'scaffold') {
        metrics.visibleScaffoldNodes += 1;
    }
    const baseLength = Math.max(0.0001, Number(node.length) || 0.0001);
    const baseWidth = Math.max(0.0001, Number(node.width) || 0.0001);
    metrics.lengthDeltaTotal += Math.abs(((Number(projected.length) || 0) / baseLength) - 1);
    metrics.widthDeltaTotal += Math.abs(((Number(projected.width) || 0) / baseWidth) - 1);
    const curveDelta = Math.max(
        Math.abs((Number(projected.curve) || 0) - (Number(node.curve) || 0)),
        Math.abs((Number(projected.curveIn) || 0) - (Number(node.curveIn) || 0)),
        Math.abs((Number(projected.curveOut) || 0) - (Number(node.curveOut) || 0)),
    );
    metrics.curveDeltaTotal += curveDelta;
    metrics.maxCurveDelta = Math.max(metrics.maxCurveDelta, curveDelta);
    if (projected.structuralSegmentId) {
        metrics.segmentsUsed.add(projected.structuralSegmentId);
    }
    const projectedTerminals = Array.isArray(projected.terminals) ? projected.terminals : [];
    const projectedTerminalCounts = countTerminalsByType(projectedTerminals);
    metrics.visibleTerminals += projectedTerminalCounts.total;
    metrics.visibleFlowerTerminals += projectedTerminalCounts.flower;
    metrics.visibleLeafTerminals += projectedTerminalCounts.leaf;
    terminalDepthBucket.visibleTerminals += projectedTerminalCounts.total;
    terminalDepthBucket.visibleFlowerTerminals += projectedTerminalCounts.flower;
    terminalDepthBucket.visibleLeafTerminals += projectedTerminalCounts.leaf;
    terminals.forEach((terminal, index) => {
        const projectedTerminal = projectedTerminals[index] || {};
        const baseScale = Math.max(0.0001, Number(terminal.scale) || 0.0001);
        const baseDist = Math.max(0.0001, Number(terminal.dist) || 0.0001);
        metrics.terminalCount += 1;
        metrics.terminalScaleDeltaTotal += Math.abs(((Number(projectedTerminal.scale) || 0) / baseScale) - 1);
        metrics.terminalDistDeltaTotal += Math.abs(((Number(projectedTerminal.dist) || 0) / baseDist) - 1);
    });
    if (Array.isArray(node.branches)) {
        node.branches.forEach((child) => collectGrowthMetrics({
            node: child?.obj,
            projection,
            depth: depth + 1,
            out: metrics,
            ancestorVisible: true,
        }));
    }
    return metrics;
};

const summarizeTerminalDepthDistribution = (distribution = {}) => Object.fromEntries(
    Object.entries(distribution).sort(([left], [right]) => left.localeCompare(right)),
);

const summarizeGrowthMetrics = (metrics) => ({
    generatedNodes: metrics.generatedNodes,
    generatedScaffoldNodes: metrics.generatedScaffoldNodes,
    generatedTwigNodes: metrics.generatedTwigNodes,
    generatedTerminals: metrics.generatedTerminals,
    generatedFlowerTerminals: metrics.generatedFlowerTerminals,
    generatedLeafTerminals: metrics.generatedLeafTerminals,
    visibleNodes: metrics.visibleNodes,
    visibleScaffoldNodes: metrics.visibleScaffoldNodes,
    visibleTwigs: metrics.visibleTwigs,
    visibleTerminals: metrics.visibleTerminals,
    visibleFlowerTerminals: metrics.visibleFlowerTerminals,
    visibleLeafTerminals: metrics.visibleLeafTerminals,
    terminalCount: metrics.terminalCount,
    meanLengthDelta: round(metrics.lengthDeltaTotal / Math.max(1, metrics.visibleNodes), 5),
    meanWidthDelta: round(metrics.widthDeltaTotal / Math.max(1, metrics.visibleNodes), 5),
    meanCurveDeltaPx: round(metrics.curveDeltaTotal / Math.max(1, metrics.visibleNodes), 4),
    maxCurveDeltaPx: round(metrics.maxCurveDelta, 4),
    meanTerminalScaleDelta: round(metrics.terminalScaleDeltaTotal / Math.max(1, metrics.terminalCount), 5),
    meanTerminalDistDelta: round(metrics.terminalDistDeltaTotal / Math.max(1, metrics.terminalCount), 5),
    segmentsUsed: Array.from(metrics.segmentsUsed).sort(),
    terminalDepthDistribution: summarizeTerminalDepthDistribution(metrics.terminalDepthDistribution),
});

const createClassic2RoleGrowthBucket = () => ({
    born: 0,
    lengthTotal: 0,
    widthTotal: 0,
    ageTotal: 0,
    naturalAgeTotal: 0,
    girthAgeTotal: 0,
    ageSamples: 0,
});

const collectClassic2RoleGrowthMetrics = (node, out = null) => {
    const metrics = out || {
        trunk: createClassic2RoleGrowthBucket(),
        scaffold: createClassic2RoleGrowthBucket(),
        twig: createClassic2RoleGrowthBucket(),
        root: null,
    };
    if (!node || node.type !== 'branch') {
        return metrics;
    }
    const development = node.classic2Development || null;
    const role = ['trunk', 'scaffold', 'twig'].includes(development?.role)
        ? development.role
        : (Number(node.branchOrder) === 3 ? 'twig' : (Number(node.branchOrder) === 0 ? 'trunk' : 'scaffold'));
    const bucket = metrics[role];
    bucket.born += 1;
    bucket.lengthTotal += Math.max(0, Number(node.length) || 0);
    bucket.widthTotal += Math.max(0, Number(node.width) || 0);
    if (Number.isFinite(Number(development?.age))) {
        bucket.ageTotal += clamp01(development.age);
        bucket.naturalAgeTotal += clamp01(development.naturalAge ?? development.age);
        bucket.girthAgeTotal += clamp01(development.girthAge ?? development.age);
        bucket.ageSamples += 1;
    }
    if (role === 'trunk' && metrics.root === null) {
        metrics.root = {
            nodeId: node.nodeId || null,
            length: round(Math.max(0, Number(node.length) || 0), 4),
            width: round(Math.max(0, Number(node.width) || 0), 4),
            age: Number.isFinite(Number(development?.age))
                ? round(clamp01(development.age), 4)
                : null,
            girthAge: Number.isFinite(Number(development?.girthAge))
                ? round(clamp01(development.girthAge), 4)
                : null,
        };
    }
    if (Array.isArray(node.branches)) {
        node.branches.forEach((child) => collectClassic2RoleGrowthMetrics(child?.obj, metrics));
    }
    return metrics;
};

const summarizeClassic2RoleGrowthMetrics = (metrics) => ({
    ...Object.fromEntries(['trunk', 'scaffold', 'twig'].map((role) => {
        const bucket = metrics[role];
        return [role, {
            born: bucket.born,
            totalLength: round(bucket.lengthTotal, 4),
            totalWidth: round(bucket.widthTotal, 4),
            meanLength: bucket.born > 0 ? round(bucket.lengthTotal / bucket.born, 4) : null,
            meanWidth: bucket.born > 0 ? round(bucket.widthTotal / bucket.born, 4) : null,
            meanAge: bucket.ageSamples > 0 ? round(bucket.ageTotal / bucket.ageSamples, 4) : null,
            meanNaturalAge: bucket.ageSamples > 0
                ? round(bucket.naturalAgeTotal / bucket.ageSamples, 4)
                : null,
            meanGirthAge: bucket.ageSamples > 0
                ? round(bucket.girthAgeTotal / bucket.ageSamples, 4)
                : null,
        }];
    })),
    root: metrics.root,
});

const createCard = ({ id, title, subtitle }) => {
    const card = document.createElement('section');
    card.className = 'card';
    card.dataset.shotId = id;
    card.innerHTML = [
        '<header>',
        '<strong>' + title + '</strong>',
        '<span>' + subtitle + '</span>',
        '</header>',
        '<canvas width="' + VIEWPORT.width + '" height="' + VIEWPORT.height + '"></canvas>',
        '<pre></pre>',
    ].join('');
    document.getElementById('matrix').appendChild(card);
    return {
        card,
        canvas: card.querySelector('canvas'),
        pre: card.querySelector('pre'),
    };
};

const imageDiff = (a, b) => {
    if (!a || !b || a.width !== b.width || a.height !== b.height) {
        return null;
    }
    let changed = 0;
    let total = 0;
    let sum = 0;
    const bounds = { minX: a.width, minY: a.height, maxX: -1, maxY: -1 };
    for (let y = 0; y < a.height; y += 1) {
        for (let x = 0; x < a.width; x += 1) {
            const i = (y * a.width + x) * 4;
            const dr = Math.abs(a.data[i] - b.data[i]);
            const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
            const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
            const delta = (dr + dg + db) / 3;
            sum += delta;
            total += 1;
            if (delta >= PIXEL_CHANGE_RGB_DELTA_THRESHOLD) {
                changed += 1;
                bounds.minX = Math.min(bounds.minX, x);
                bounds.minY = Math.min(bounds.minY, y);
                bounds.maxX = Math.max(bounds.maxX, x);
                bounds.maxY = Math.max(bounds.maxY, y);
            }
        }
    }
    return {
        meanRgbDelta: round(sum / Math.max(1, total), 3),
        changedPixelRatio: round(changed / Math.max(1, total), 5),
        changedBounds: changed > 0 ? bounds : null,
    };
};

const compactLifeState = (lifeState = {}) => ({
    phase: lifeState.phase,
    growth: lifeState.growth,
    vitality: lifeState.vitality,
    stress: lifeState.stress,
    bloom: lifeState.bloom,
    dryness: lifeState.dryness,
    branchSag: lifeState.branchSag,
    windResponse: lifeState.windResponse,
    dataDays: lifeState.dataDays,
    analysisConfidence: lifeState.analysisConfidence,
    growthEvent: lifeState.growthEvent || null,
    structuralImprint: lifeState.structuralImprint || null,
    growthSegments: Array.isArray(lifeState.growthSegments) ? lifeState.growthSegments : [],
});

const compactProjection = (projection = {}) => ({
    phase: projection.phase,
    progress: projection.progress,
    visibleDepth: projection.visibleDepth,
    lengthScale: projection.lengthScale,
    widthScale: projection.widthScale,
    trunkReveal: projection.trunkReveal,
    scaffoldReveal: projection.scaffoldReveal,
    twigReveal: projection.twigReveal,
    terminalReveal: projection.terminalReveal,
    terminalGrowthFloor: projection.terminalGrowthFloor,
    leafDensityFloor: projection.leafDensityFloor,
    flowerGateScale: projection.flowerGateScale,
    frontierReveal: projection.frontierReveal,
    growthTipScale: projection.growthTipScale,
    scaffoldDevelopment: projection.scaffoldDevelopment,
    twigDevelopment: projection.twigDevelopment,
    terminalDevelopment: projection.terminalDevelopment,
    bloomDevelopmentFloor: projection.bloomDevelopmentFloor,
    miniatureBloomScale: projection.miniatureBloomScale,
    ramificationFloor: projection.ramificationFloor,
    mossState: projection.mossState,
    mossSaturation: projection.mossSaturation,
    kinkPressure: projection.kinkPressure,
    scaffoldCompression: projection.scaffoldCompression,
    gravityBias: projection.gravityBias,
    canopyBudget: projection.canopyBudget,
    recoveryShootBias: projection.recoveryShootBias,
    active: projection.active,
    baselineProgress: projection.baselineProgress,
    growthSegments: Array.isArray(projection.growthSegments) ? projection.growthSegments : [],
});

const compactStage = (stage = {}) => ({
    min: stage.min,
    max: stage.max,
    depth: stage.depth,
    leafChance: stage.leafChance,
    flowerChance: stage.flowerChance,
    color: stage.color,
    text: stage.text,
});

const resolveSnapshotBaseStage = ({ lifeState, projection }) => {
    const phase = typeof lifeState?.phase === 'string' ? lifeState.phase : 'mature';
    if (phase === 'seedling') {
        return {
            ...BASE_STAGE,
            leafChance: 0.74,
            flowerChance: resolveZenBonsaiStageFlowerAvailability({
                phase,
                lifeState,
                growthProjection: projection,
                baseFlowerChance: 0.02,
            }),
        };
    }
    if (phase === 'juvenile') {
        return {
            ...BASE_STAGE,
            leafChance: 0.68,
            flowerChance: resolveZenBonsaiStageFlowerAvailability({
                phase,
                lifeState,
                growthProjection: projection,
                baseFlowerChance: 0.08,
            }),
        };
    }
    return BASE_STAGE;
};

const resolveSnapshotAppearance = ({ lifeState, projection, activationPresentation = null }) => {
    const lifeGrowth = clamp(
        Number.isFinite(Number(lifeState?.growth)) ? Number(lifeState.growth) : 1,
        0.16,
        1,
    );
    const projectedGrowth = Math.max(lifeGrowth, projection.terminalGrowthFloor);
    const canopyBudget = clamp(projection.canopyBudget ?? 1, 0.34, 1);
    return resolveSakuraLifeAppearanceProfile(lifeState, {
        activationPresentation,
        growth: lifeGrowth,
        projectedGrowth,
        leafDensityFloor: Math.max(0.08, projection.leafDensityFloor * lerp(0.62, 1.08, canopyBudget)),
        flowerGateScale: projection.flowerGateScale * lerp(0.56, 1.1, canopyBudget),
        bloomDevelopmentFloor: projection.bloomDevelopmentFloor,
        miniatureBloomScale: projection.miniatureBloomScale,
    });
};

const compactAppearance = (appearance = {}) => ({
    hasActivationPresentation: appearance.hasActivationPresentation,
    activationRatio: appearance.activationRatio,
    activationBand: appearance.activationBand,
    activationReliability: appearance.activationReliability,
    activationExpressionStrength: appearance.activationExpressionStrength,
    leafPresence: appearance.leafPresence,
    leafScale: appearance.leafScale,
    leafScaleFactor: appearance.leafScaleFactor,
    leafSaturation: appearance.leafSaturation,
    flowerPresence: appearance.flowerPresence,
    flowerScale: appearance.flowerScale,
    flowerScaleFactor: appearance.flowerScaleFactor,
    flowerSaturation: appearance.flowerSaturation,
    flowerAlpha: appearance.flowerAlpha,
    terminalBrightness: appearance.terminalBrightness,
    activationDroop: appearance.activationDroop,
    budSwelling: appearance.budSwelling,
    blossomOpenness: appearance.blossomOpenness,
    tipBudScale: appearance.tipBudScale,
    tipBudAlpha: appearance.tipBudAlpha,
    bloomDevelopmentGate: appearance.bloomDevelopmentGate,
    bloomDevelopmentFloor: appearance.bloomDevelopmentFloor,
    vitalityBloomFloor: appearance.vitalityBloomFloor,
    miniatureBloomScale: appearance.miniatureBloomScale,
});

const compactClassic2LineageTrace = (state = null) => {
    if (!state || typeof state !== 'object') {
        return null;
    }
    const decisions = Object.values(state.decisions || {}).sort((left, right) => (
        (Number(left?.birthProgress) - Number(right?.birthProgress))
        || String(left?.nodeId || '').localeCompare(String(right?.nodeId || ''))
    ));
    const sampleDecision = (decision) => ({
        nodeId: decision.nodeId,
        parentId: decision.parentId,
        role: decision.role,
        status: decision.status,
        birthProgress: decision.birthProgress,
        matureProgress: decision.matureProgress,
        source: decision.provenance?.source || null,
        cohortId: decision.provenance?.cohortId || null,
        historySegmentRef: decision.provenance?.historySegmentRef || null,
        score: decision.provenance?.score ?? null,
        scoreModelVersion: decision.provenance?.scoreModelVersion || null,
        featureContractVersion: decision.provenance?.featureContractVersion || null,
        featureSource: decision.provenance?.featureSource || null,
        scoreInputFingerprint: decision.provenance?.scoreInputFingerprint || null,
        scoreSignals: decision.provenance?.scoreSignals || null,
        scoreBreakdown: decision.provenance?.scoreBreakdown || null,
        reason: decision.provenance?.reason || null,
    });
    const decisionSamples = ['trunk', 'scaffold', 'twig'].flatMap((role) => {
        const roleDecisions = decisions.filter((entry) => entry.role === role);
        return roleDecisions.filter((entry) => entry.status === 'selected')
            .slice(0, 2)
            .map(sampleDecision);
    });
    const carrierEntries = Object.entries(state.candidateCarrierMetadata || {});
    const selectedNodeIds = new Set(decisions
        .filter((decision) => decision.status === 'selected')
        .map((decision) => decision.nodeId));
    const sumCarrierField = (entries, field) => entries.reduce(
        (total, [, metadata]) => total + (Number(metadata?.[field]) || 0),
        0,
    );
    const selectedCarrierEntries = carrierEntries.filter(([nodeId]) => selectedNodeIds.has(nodeId));
    return {
        contract: state.contract,
        treeIdentityFingerprint: state.treeIdentityFingerprint,
        treeFingerprint: state.treeFingerprint,
        identityRevision: state.identityRevision,
        stateRevision: state.stateRevision,
        maxObservedGrowth: state.maxObservedGrowth,
        candidateCarrierFingerprint: state.candidateCarrierFingerprint || null,
        candidateCarrierNodeCount: carrierEntries.filter(([, metadata]) => (
            Number(metadata?.terminalCount) > 0
        )).length,
        candidateTerminalCount: sumCarrierField(carrierEntries, 'terminalCount'),
        candidateFlowerTerminalCount: sumCarrierField(carrierEntries, 'flowerTerminalCount'),
        selectedCarrierNodeCount: selectedCarrierEntries.filter(([, metadata]) => (
            Number(metadata?.terminalCount) > 0
        )).length,
        selectedTerminalPotentialCount: sumCarrierField(selectedCarrierEntries, 'terminalCount'),
        selectedFlowerPotentialCount: sumCarrierField(
            selectedCarrierEntries,
            'flowerTerminalCount',
        ),
        bootstrap: state.bootstrap || null,
        decisionSamples,
    };
};

const resolveClassic2Stage = () => resolveZenBonsaiClassic2DisplayCandidateStage({
    baseStage: STAGES.BLOOM,
    structureDepth: STRUCTURE_DEPTH,
});

const renderSnapshotCase = ({
    shotId,
    title,
    subtitle,
    lifeState,
    summaryFields,
    model = 'classic',
    activationPresentation = null,
    classic2PreviousLineageState = null,
}) => {
    const projection = resolveZenBonsaiGrowthProjection({
        lifeState,
        structureDepth: STRUCTURE_DEPTH,
    });
    const modelConfig = GROWTH_MODELS.find((candidate) => candidate.id === model) || GROWTH_MODELS[0];
    const stage = modelConfig.id === 'classic2'
        ? resolveClassic2Stage()
        : applyZenBonsaiGrowthProjectionToStage(
            resolveSnapshotBaseStage({ lifeState, projection }),
            projection,
        );
    const appearance = resolveSnapshotAppearance({
        lifeState,
        projection,
        activationPresentation,
    });
    const candidateTopology = SakuraSpecies.generateTopology(
        new SeededRandom(ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED),
        stage,
        TOPOLOGY_REFERENCE_HEIGHT,
    );
    const classic2TreeIdentity = {
        contract: 'zen_bonsai_classic2_candidate_identity_v1',
        identityRevision: 1,
        treeType: 'sakura',
        treeSeed: ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED,
        structureDepth: STRUCTURE_DEPTH,
        structureMode: 'balanced',
        topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
        canonicalLatent: { version: 1, values: {} },
        generationInputs: { learningProgress: 0, canopyDistributionProfile: {} },
    };
    const classic2PreparedCandidate = modelConfig.id === 'classic2'
        ? prepareZenBonsaiClassic2LineageCandidate({
            topology: candidateTopology,
            treeIdentity: classic2TreeIdentity,
        })
        : null;
    const classic2LineageState = modelConfig.id === 'classic2'
        ? (classic2PreviousLineageState
            ? reconcileZenBonsaiClassic2LineageState({
                previousState: classic2PreviousLineageState,
                topology: candidateTopology,
                treeIdentity: classic2TreeIdentity,
                preparedCandidate: classic2PreparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_RECONCILE,
            })
            : bootstrapZenBonsaiClassic2LineageState({
                topology: candidateTopology,
                treeIdentity: classic2TreeIdentity,
                preparedCandidate: classic2PreparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_BOOTSTRAP,
            }))
        : null;
    const classic2Result = modelConfig.id === 'classic2'
        ? projectZenBonsaiClassic2DevelopmentTopology({
            topology: candidateTopology,
            lifeState,
            projection,
            lineageState: classic2LineageState,
            lineageRenderBinding: classic2PreparedCandidate.renderBinding,
            requireLineage: true,
            woodClockPolicy: ZEN_BONSAI_CLASSIC2_WOOD_CLOCK_POLICIES.PERSISTED_HISTORY,
        })
        : null;
    const topology = classic2Result?.topology || candidateTopology;
    const cameraTopology = modelConfig.id === 'classic2'
        ? candidateTopology
        : topology;
    const renderProjection = modelConfig.id === 'classic2'
        ? resolveZenBonsaiClassic2RenderProjection(projection)
        : projection;
    const sceneBounds = SakuraSpecies.measureSceneBounds(cameraTopology, {
        includePot: true,
        includeGroundShadow: true,
        growthProjection: renderProjection,
    });
    const camera = resolveBonsaiCamera({
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
        sceneBounds,
        preset: 'preview',
    });
    const view = createCard({
        id: shotId,
        title,
        subtitle,
    });
    const ctx = view.canvas.getContext('2d');
    const terminalRenderTelemetry = createRenderedTerminalVisibility();
    ctx.fillStyle = '#F3EFE6';
    ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);
    SakuraSpecies.render({
        ctx,
        topology,
        frameCount: 0,
        currentStage: stage,
        assetCache: createSnapshotAssetCache({
            telemetry: terminalRenderTelemetry,
            model: modelConfig.id,
        }),
        wind: 0,
        camera,
        options: {
            environmentState: {
                hour: 14,
                daylight: 0.86,
                windIntensity: 0.12,
                windDirection: 0.2,
                gustEnvelope: 0,
            },
            freezeBranchMotion: true,
            showGroundBranchShadow: true,
            lifeState,
            activationPresentation,
            growthProjection: renderProjection,
        },
    });
	    const growthMetrics = summarizeGrowthMetrics(collectGrowthMetrics({
	        node: topology,
	        projection: renderProjection,
	    }));
	    const terminalContinuity = collectZenBonsaiTerminalContinuityStats(topology, {
	        growthPlan: renderProjection,
	    });
	    const classic2RoleGrowth = modelConfig.id === 'classic2'
	        ? summarizeClassic2RoleGrowthMetrics(collectClassic2RoleGrowthMetrics(topology))
	        : null;
	    const classic2CandidateRoleGrowth = modelConfig.id === 'classic2'
	        ? summarizeClassic2RoleGrowthMetrics(
	            collectClassic2RoleGrowthMetrics(candidateTopology),
	        )
	        : null;
	    const classic2Nebari = modelConfig.id === 'classic2'
	        ? (() => {
	            const profile = resolveNebariDevelopmentProfile(renderProjection, topology);
	            const trunkWidth = resolveNebariTrunkWidth({ topology, lifeState });
	            const rootBaseWidth = resolveNebariRootBaseWidth({
	                trunkWidth,
	                developmentProfile: profile,
	            });
	            return {
	                clockSource: profile.clockSource,
	                rootAge: classic2RoleGrowth?.root?.age ?? null,
	                rootGirthAge: classic2RoleGrowth?.root?.girthAge ?? null,
	                projectedTrunkWidth: round(trunkWidth, 4),
	                rootBaseWidth: round(rootBaseWidth, 4),
	                rootBaseToTrunkRatio: round(rootBaseWidth / Math.max(0.001, trunkWidth), 4),
	                rootReachScale: round(profile.rootReachScale, 4),
	                rootMassScale: round(profile.rootBaseScale, 4),
	            };
	        })()
	        : null;
	    const renderedTerminalVisibility = {
	        measurement: 'post_renderer_visibility_and_activation_stage_asset_resolver_calls',
	        ...terminalRenderTelemetry,
	        growthTipSiteCount: terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.GROWTH_TIP] || 0,
	        terminalSpurSiteCount: terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_SPUR] || 0,
	    };
	    const summary = {
        shotId,
        ...summaryFields,
        model: modelConfig.id,
        modelLabel: modelConfig.label,
        phase: projection.phase,
        progress: projection.progress,
        visibleDepth: projection.visibleDepth,
        lengthScale: projection.lengthScale,
        widthScale: projection.widthScale,
        mossState: projection.mossState,
        mossSaturation: projection.mossSaturation,
        kinkPressure: projection.kinkPressure,
        scaffoldCompression: projection.scaffoldCompression,
        gravityBias: projection.gravityBias,
        canopyBudget: projection.canopyBudget,
        recoveryShootBias: projection.recoveryShootBias,
        growthSegmentCount: projection.growthSegments.length,
        strongestSegment: projection.growthSegments[projection.growthSegments.length - 1] || null,
        lifeState: compactLifeState(lifeState),
        activationPresentation,
        projection: compactProjection(projection),
        renderProjection: modelConfig.id === 'classic2' ? compactProjection(renderProjection) : null,
        classic2Development: classic2Result?.diagnostics || null,
        classic2LineageTrace: compactClassic2LineageTrace(classic2LineageState),
        cameraScale: camera.scale,
        cameraSceneBounds: sceneBounds,
        stage: compactStage(stage),
	        appearance: compactAppearance(appearance),
	        growthMetrics,
	        classic2RoleGrowth,
	        classic2CandidateRoleGrowth,
	        classic2Nebari,
	        renderedTerminalVisibility,
	        terminalContinuity,
	    };
	    view.pre.textContent = [
	        'model ' + summary.modelLabel,
        'phase ' + summary.phase + ' / progress ' + summary.progress,
        'life bloom ' + summary.lifeState.bloom + ' vitality ' + summary.lifeState.vitality + ' stress ' + summary.lifeState.stress,
        'dev scaffold ' + summary.projection.scaffoldDevelopment + ' twig ' + summary.projection.twigDevelopment + ' bloom floor ' + summary.projection.bloomDevelopmentFloor,
        'appearance flower ' + summary.appearance.flowerPresence + ' scale ' + summary.appearance.flowerScale + ' alpha ' + summary.appearance.flowerAlpha,
	        'stage depth ' + summary.stage.depth + ' leaf ' + summary.stage.leafChance + ' flower ' + summary.stage.flowerChance,
	        'camera scale ' + Number(summary.cameraScale || 0).toFixed(4) + ' bounds ' + Math.round(summary.cameraSceneBounds.width) + 'x' + Math.round(summary.cameraSceneBounds.height),
		        'visible scaffold ' + growthMetrics.visibleScaffoldNodes + ' twig ' + growthMetrics.visibleTwigs + ' structural flower ' + growthMetrics.visibleFlowerTerminals,
		        'rendered leaf ' + renderedTerminalVisibility.renderedStructuredLeafTerminals + ' flower ' + renderedTerminalVisibility.renderedFlowerTerminals + ' bud ' + renderedTerminalVisibility.renderedFlowerBuds + ' tip leaves ' + renderedTerminalVisibility.renderedGrowthTipLeafSprites,
		        'bare ends trunk ' + terminalContinuity.visibleBareEnds.trunk + ' scaffold ' + terminalContinuity.visibleBareEnds.scaffold + ' twig ' + terminalContinuity.visibleBareEnds.twig,
		        'endpoint spur ' + (terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.TERMINAL_SPUR] || 0) + ' growth tip ' + (terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.GROWTH_TIP] || 0) + ' hidden ' + (terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.HIDDEN_FRONTIER] || 0) + ' structural bare ' + (terminalContinuity.endpointKinds[ZEN_BONSAI_ENDPOINT_KINDS.STRUCTURAL_BARE] || 0),
		        'frontier twig ' + terminalContinuity.terminalTwigFrontierCount + ' scaffold->twig ' + terminalContinuity.scaffoldTwigFrontierCount + ' flower carriers ' + terminalContinuity.flowerCarrierCount,
	        summary.classic2Development
	            ? 'classic2 born twig ' + summary.classic2Development.byRole.twig.born + '/' + summary.classic2Development.byRole.twig.candidate + ' flower ' + summary.classic2Development.bornFlowerTerminals + '/' + summary.classic2Development.candidateFlowerTerminals
	            : null,
        'kink ' + summary.kinkPressure + ' comp ' + summary.scaffoldCompression + ' gravity ' + summary.gravityBias,
        'curve mean ' + growthMetrics.meanCurveDeltaPx + 'px max ' + growthMetrics.maxCurveDeltaPx + 'px',
        'length delta ' + growthMetrics.meanLengthDelta + ' width delta ' + growthMetrics.meanWidthDelta,
    ].filter(Boolean).join('\n');
    return {
        summary,
        imageData: ctx.getImageData(0, 0, VIEWPORT.width, VIEWPORT.height),
        lineageState: classic2LineageState,
    };
};

const renderCase = ({ dayBucket, scenario }) => {
    const lifeState = makeLifeState({ dayBucket, scenario });
    const shotId = dayBucket.label.replace(/\s+/g, '-') + '-' + scenario.id;
    return renderSnapshotCase({
        shotId,
        title: dayBucket.label + ' / ' + scenario.label,
        subtitle: scenario.description,
        lifeState,
        summaryFields: {
            caseKind: 'day_scenario',
            day: dayBucket.day,
            growthScore: dayBucket.growthScore,
            scenario: scenario.id,
            scenarioLabel: scenario.label,
        },
    });
};

const renderGrowthActivationCase = ({
    growthBucket,
    activationBucket,
    classic2PreviousLineageState = null,
}) => {
    const lifeState = makeGrowthActivationLifeState({ growthBucket, activationBucket });
    const activationPresentation = makeGrowthActivationPresentation(activationBucket);
    return GROWTH_MODELS.map((modelConfig) => renderSnapshotCase({
        shotId: modelConfig.id + '-growth-' + growthBucket.growthStage + '-activation-' + activationBucket.activation,
        title: modelConfig.label + ' / ' + growthBucket.label + ' / ' + activationBucket.label,
        subtitle: growthBucket.description + '; ' + activationBucket.description,
        lifeState,
        summaryFields: {
            caseKind: 'growth_activation',
            growthStage: growthBucket.growthStage,
            activation: activationBucket.activation,
            historyActivation: SENSITIVITY_HISTORY_ACTIVATION,
            growthLabel: growthBucket.label,
            activationLabel: activationBucket.label,
        },
        model: modelConfig.id,
        activationPresentation,
        classic2PreviousLineageState: modelConfig.id === 'classic2'
            ? classic2PreviousLineageState
            : null,
    }));
};

const renderLineageReplayPath = (historyPath) => {
    let lineageState = null;
    return GROWTH_BUCKETS.map((growthBucket, index) => {
        const activation = historyPath.activations[index];
        const activationBucket = ACTIVATION_BUCKETS.find((entry) => entry.activation === activation);
        if (!activationBucket) {
            throw new Error('ZEN_BONSAI_MATRIX_LINEAGE_REPLAY_ACTIVATION_INVALID:' + activation);
        }
        const rendered = renderSnapshotCase({
            shotId: 'classic2-replay-' + historyPath.id + '-growth-' + growthBucket.growthStage,
            title: 'Main · Classic2 replay / ' + historyPath.label + ' / ' + growthBucket.label,
            subtitle: 'Sequential development lineage; current ' + activationBucket.label,
            lifeState: makeGrowthActivationLifeState({
                growthBucket,
                activationBucket,
                historyActivation: activation,
            }),
            summaryFields: {
                caseKind: 'lineage_replay',
                historyPath: historyPath.id,
                historyPathLabel: historyPath.label,
                historyStep: index + 1,
                growthStage: growthBucket.growthStage,
                activation,
                historyActivation: activation,
            },
            model: 'classic2',
            activationPresentation: makeGrowthActivationPresentation(activationBucket),
            classic2PreviousLineageState: lineageState,
        });
        lineageState = rendered.lineageState;
        return rendered;
    });
};

const compareLineageDecisions = (leftState, rightState) => {
    const left = leftState?.decisions || {};
    const right = rightState?.decisions || {};
    const nodeIds = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    const statusChangedNodeIds = nodeIds.filter((nodeId) => (
        (left[nodeId]?.status || null) !== (right[nodeId]?.status || null)
    ));
    const compactDecision = (decision = null) => (decision ? {
        status: decision.status,
        role: decision.role,
        birthProgress: decision.birthProgress,
        matureProgress: decision.matureProgress,
        source: decision.provenance?.source || null,
        stateRevision: decision.provenance?.stateRevision ?? null,
        historySegmentRef: decision.provenance?.historySegmentRef || null,
        score: decision.provenance?.score ?? null,
        scoreBreakdown: decision.provenance?.scoreBreakdown || null,
        reason: decision.provenance?.reason || null,
    } : null);
    const provenanceChangedNodeIds = nodeIds.filter((nodeId) => (
        left[nodeId]
        && right[nodeId]
        && left[nodeId].status === right[nodeId].status
        && JSON.stringify(compactDecision(left[nodeId])) !== JSON.stringify(compactDecision(right[nodeId]))
    ));
    const traceNodeIds = [...new Set([
        ...statusChangedNodeIds,
        ...provenanceChangedNodeIds,
    ])].slice(0, 24);
    return {
        comparedDecisionNodeCount: nodeIds.length,
        statusChangedCount: statusChangedNodeIds.length,
        sameStatusProvenanceChangedCount: provenanceChangedNodeIds.length,
        statusChangedNodeIds: statusChangedNodeIds.slice(0, 24),
        provenanceChangedNodeIds: provenanceChangedNodeIds.slice(0, 24),
        traceSamples: traceNodeIds.map((nodeId) => ({
            nodeId,
            left: compactDecision(left[nodeId]),
            right: compactDecision(right[nodeId]),
        })),
    };
};

const assertSameFinalReplayInput = (leftSummary, rightSummary) => {
    const comparisons = {
        model: leftSummary?.model === rightSummary?.model,
        growthStage: leftSummary?.growthStage === rightSummary?.growthStage,
        activation: leftSummary?.activation === rightSummary?.activation,
        historyActivation: leftSummary?.historyActivation === rightSummary?.historyActivation,
        lifeState: JSON.stringify(leftSummary?.lifeState) === JSON.stringify(rightSummary?.lifeState),
        activationPresentation: JSON.stringify(leftSummary?.activationPresentation)
            === JSON.stringify(rightSummary?.activationPresentation),
        projection: JSON.stringify(leftSummary?.projection) === JSON.stringify(rightSummary?.projection),
        renderProjection: JSON.stringify(leftSummary?.renderProjection) === JSON.stringify(rightSummary?.renderProjection),
        stage: JSON.stringify(leftSummary?.stage) === JSON.stringify(rightSummary?.stage),
        appearance: JSON.stringify(leftSummary?.appearance) === JSON.stringify(rightSummary?.appearance),
        cameraScale: leftSummary?.cameraScale === rightSummary?.cameraScale,
        cameraSceneBounds: JSON.stringify(leftSummary?.cameraSceneBounds)
            === JSON.stringify(rightSummary?.cameraSceneBounds),
        treeIdentityFingerprint: leftSummary?.classic2LineageTrace?.treeIdentityFingerprint
            === rightSummary?.classic2LineageTrace?.treeIdentityFingerprint,
        candidateTreeFingerprint: leftSummary?.classic2LineageTrace?.treeFingerprint
            === rightSummary?.classic2LineageTrace?.treeFingerprint,
    };
    const mismatches = Object.entries(comparisons)
        .filter(([, matches]) => !matches)
        .map(([field]) => field);
    if (mismatches.length) {
        throw new Error('ZEN_BONSAI_MATRIX_FINAL_REPLAY_INPUT_MISMATCH:' + mismatches.join(','));
    }
    return {
        allEqual: true,
        fields: comparisons,
        treeIdentityFingerprint: leftSummary.classic2LineageTrace.treeIdentityFingerprint,
        candidateTreeFingerprint: leftSummary.classic2LineageTrace.treeFingerprint,
    };
};

const assertActivationLineageInvariance = (growthActivationCases) => (
    GROWTH_BUCKETS.map((growthBucket) => {
        const cases = growthActivationCases.filter((entry) => (
            entry.model === 'classic2'
            && entry.growthStage === growthBucket.growthStage
        ));
        if (cases.length !== ACTIVATION_BUCKETS.length) {
            throw new Error('ZEN_BONSAI_MATRIX_ACTIVATION_LINEAGE_CASES_INCOMPLETE:' + growthBucket.growthStage);
        }
        const compactStructuralResult = (entry) => ({
            treeIdentityFingerprint: entry.classic2LineageTrace?.treeIdentityFingerprint || null,
            candidateTreeFingerprint: entry.classic2LineageTrace?.treeFingerprint || null,
            lineageStateRevision: entry.classic2LineageTrace?.stateRevision ?? null,
            maxObservedGrowth: entry.classic2LineageTrace?.maxObservedGrowth ?? null,
            bornNodeIds: entry.classic2Development?.lineage?.bornNodeIds || [],
            pendingCount: entry.classic2Development?.lineage?.pendingCount ?? null,
            visibleScaffoldNodes: entry.growthMetrics?.visibleScaffoldNodes ?? null,
            visibleTwigs: entry.growthMetrics?.visibleTwigs ?? null,
            roleGrowth: entry.classic2RoleGrowth || null,
            bornTerminals: entry.classic2Development?.bornTerminals ?? null,
            bornFlowerTerminals: entry.classic2Development?.bornFlowerTerminals ?? null,
        });
        const reference = compactStructuralResult(cases[0]);
        const invariant = cases.every((entry) => (
            JSON.stringify(compactStructuralResult(entry)) === JSON.stringify(reference)
        ));
        if (!invariant) {
            throw new Error('ZEN_BONSAI_MATRIX_ACTIVATION_REWROTE_LINEAGE:' + growthBucket.growthStage);
        }
        return {
            growthStage: growthBucket.growthStage,
            historyActivation: SENSITIVITY_HISTORY_ACTIVATION,
            comparedActivations: cases.map((entry) => entry.activation).sort((a, b) => a - b),
            invariant: true,
            recordedCount: reference.bornNodeIds.length,
            pendingCount: reference.pendingCount,
            visibleScaffoldNodes: reference.visibleScaffoldNodes,
            visibleTwigs: reference.visibleTwigs,
            bornFlowerTerminals: reference.bornFlowerTerminals,
            treeIdentityFingerprint: reference.treeIdentityFingerprint,
            candidateTreeFingerprint: reference.candidateTreeFingerprint,
        };
    })
);

const resolveActivationPixelComparisons = ({ growthActivationCases, imageDataByKey }) => {
    const lowActivation = Math.min(...ACTIVATION_BUCKETS.map((entry) => entry.activation));
    const highActivation = Math.max(...ACTIVATION_BUCKETS.map((entry) => entry.activation));
    const resolveCase = (growthStage, activation) => growthActivationCases.find((entry) => (
        entry.model === 'classic2'
        && entry.growthStage === growthStage
        && entry.activation === activation
    ));
    const resolveImage = (growthStage, activation) => imageDataByKey.get(
        'growth:' + growthStage + ':activation:' + activation + ':model:classic2',
    );
    return GROWTH_BUCKETS.map((growthBucket) => {
        const low = resolveCase(growthBucket.growthStage, lowActivation);
        const high = resolveCase(growthBucket.growthStage, highActivation);
        const lowImage = resolveImage(growthBucket.growthStage, lowActivation);
        const highImage = resolveImage(growthBucket.growthStage, highActivation);
        if (!low || !high || !lowImage || !highImage) {
            throw new Error('ZEN_BONSAI_MATRIX_ACTIVATION_PIXEL_CASES_INCOMPLETE:' + growthBucket.growthStage);
        }
        const lowVisibility = low.renderedTerminalVisibility;
        const highVisibility = high.renderedTerminalVisibility;
        const delta = (field) => (
            Number(highVisibility?.[field] || 0) - Number(lowVisibility?.[field] || 0)
        );
        return {
            model: 'classic2',
            growthStage: growthBucket.growthStage,
            fromActivation: lowActivation,
            toActivation: highActivation,
            pixelDiff: imageDiff(lowImage, highImage),
            renderedTerminalVisibility: {
                low: lowVisibility,
                high: highVisibility,
                delta: {
                    structuredLeafTerminals: delta('renderedStructuredLeafTerminals'),
                    flowerTerminals: delta('renderedFlowerTerminals'),
                    flowerBuds: delta('renderedFlowerBuds'),
                    halfOpenFlowers: delta('renderedHalfOpenFlowers'),
                    fullFlowers: delta('renderedFullFlowers'),
                    growthTipLeafSprites: delta('renderedGrowthTipLeafSprites'),
                },
            },
            appearance: {
                low: low.appearance,
                high: high.appearance,
            },
        };
    });
};

const resolveClassic2GrowthTrajectory = (growthActivationCases) => {
    const observedCases = growthActivationCases.filter((entry) => (
        entry.model === 'classic2'
        && entry.activation === SENSITIVITY_HISTORY_ACTIVATION
    )).sort((left, right) => left.growthStage - right.growthStage);
    const referenceGrowthStage = Math.max(...GROWTH_BUCKETS.map((entry) => entry.growthStage));
    const reference = observedCases.find((entry) => entry.growthStage === referenceGrowthStage);
    if (!reference || observedCases.length !== GROWTH_BUCKETS.length) {
        throw new Error('ZEN_BONSAI_MATRIX_CLASSIC2_GROWTH_TRAJECTORY_INCOMPLETE');
    }
    const referenceTreeFingerprint = reference.classic2LineageTrace?.treeFingerprint || null;
    const referenceIdentityFingerprint = reference.classic2LineageTrace?.treeIdentityFingerprint || null;
    const referenceBornNodeIds = new Set(
        reference.classic2Development?.lineage?.bornNodeIds || [],
    );
    let priorBornNodeIds = new Set();
    observedCases.forEach((entry) => {
        if (entry.classic2LineageTrace?.treeFingerprint !== referenceTreeFingerprint
            || entry.classic2LineageTrace?.treeIdentityFingerprint !== referenceIdentityFingerprint) {
            throw new Error('ZEN_BONSAI_MATRIX_CLASSIC2_GROWTH_TRAJECTORY_TREE_DRIFT:'
                + entry.growthStage);
        }
        const bornNodeIds = new Set(entry.classic2Development?.lineage?.bornNodeIds || []);
        const missingPriorNodeId = [...priorBornNodeIds].find((nodeId) => !bornNodeIds.has(nodeId));
        const missingReferenceNodeId = [...bornNodeIds].find((nodeId) => !referenceBornNodeIds.has(nodeId));
        if (missingPriorNodeId || missingReferenceNodeId) {
            throw new Error('ZEN_BONSAI_MATRIX_CLASSIC2_GROWTH_TRAJECTORY_NOT_MONOTONIC:'
                + entry.growthStage + ':' + (missingPriorNodeId || missingReferenceNodeId));
        }
        priorBornNodeIds = bornNodeIds;
    });
    const ratio = (value, denominator) => {
        const numerator = typeof value === 'number' && Number.isFinite(value) ? value : null;
        const divisor = typeof denominator === 'number' && Number.isFinite(denominator)
            ? denominator
            : null;
        return numerator !== null && divisor !== null && divisor > 0
            ? round(numerator / divisor, 5)
            : null;
    };
    const referenceCarrierBorn = Number(reference.classic2Development?.bornTerminals) || 0;
    return {
        reference: {
            growthStage: referenceGrowthStage,
            activation: SENSITIVITY_HISTORY_ACTIVATION,
            treeFingerprint: referenceTreeFingerprint,
            treeIdentityFingerprint: referenceIdentityFingerprint,
            roleGrowth: reference.classic2RoleGrowth,
            candidateRoleGrowth: reference.classic2CandidateRoleGrowth,
            root: reference.classic2RoleGrowth?.root || null,
            nebari: reference.classic2Nebari || null,
            terminalCarrierBorn: referenceCarrierBorn,
        },
        observations: observedCases.map((entry) => ({
            growthStage: entry.growthStage,
            activation: entry.activation,
            recordedSubsetOfEndpoint: true,
            roles: Object.fromEntries(['trunk', 'scaffold', 'twig'].map((role) => {
                const observedRole = entry.classic2RoleGrowth?.[role] || {};
                const candidateRole = entry.classic2CandidateRoleGrowth?.[role] || {};
                return [role, {
                    born: observedRole.born ?? null,
                    bornRatio: ratio(observedRole.born, candidateRole.born),
                    totalLength: observedRole.totalLength ?? null,
                    aggregateLengthRatio: ratio(
                        observedRole.totalLength,
                        candidateRole.totalLength,
                    ),
                    totalWidth: observedRole.totalWidth ?? null,
                    aggregateWidthRatio: ratio(
                        observedRole.totalWidth,
                        candidateRole.totalWidth,
                    ),
                    meanAge: observedRole.meanAge ?? null,
                }];
            })),
            root: {
                ...(entry.classic2RoleGrowth?.root || {}),
                lengthRatio: ratio(
                    entry.classic2RoleGrowth?.root?.length,
                    entry.classic2CandidateRoleGrowth?.root?.length,
                ),
                widthRatio: ratio(
                    entry.classic2RoleGrowth?.root?.width,
                    entry.classic2CandidateRoleGrowth?.root?.width,
                ),
            },
            nebari: entry.classic2Nebari || null,
            terminalCarrierBorn: Number(entry.classic2Development?.bornTerminals) || 0,
            terminalCarrierBornRatio: ratio(
                entry.classic2Development?.bornTerminals,
                entry.classic2LineageTrace?.candidateTerminalCount,
            ),
        })),
    };
};

const evaluateObservedRange = ({ observed, target }) => {
    const numeric = typeof observed === 'number' && Number.isFinite(observed)
        ? observed
        : null;
    const inRange = numeric !== null && numeric >= target.min && numeric <= target.max;
    const deviation = numeric === null
        ? null
        : (numeric < target.min
            ? round(numeric - target.min, 5)
            : (numeric > target.max ? round(numeric - target.max, 5) : 0));
    return {
        observed: numeric,
        target,
        inRange,
        deviation,
        status: inRange ? 'PASS' : 'OUTSIDE_TARGET',
    };
};

const evaluateObservedMinimum = ({ observed, minimum }) => {
    const numeric = typeof observed === 'number' && Number.isFinite(observed)
        ? observed
        : null;
    const inRange = numeric !== null && numeric >= minimum;
    return {
        observed: numeric,
        target: { min: minimum },
        inRange,
        deviation: numeric === null ? null : (!inRange ? round(numeric - minimum, 5) : 0),
        status: inRange ? 'PASS' : 'OUTSIDE_TARGET',
    };
};

const resolveClassic2GrowthExperienceEvaluation = ({
    growthActivationCases,
    activationPixelComparisons,
    classic2GrowthTrajectory,
}) => {
    const observedGrowthCheckpoints = GROWTH_BUCKETS.map((entry) => entry.growthStage);
    const observedActivationCheckpoints = ACTIVATION_BUCKETS.map((entry) => entry.activation);
    if (JSON.stringify(observedGrowthCheckpoints) !== JSON.stringify(ZEN_BONSAI_CLASSIC2_GROWTH_CHECKPOINTS)
        || JSON.stringify(observedActivationCheckpoints) !== JSON.stringify(ZEN_BONSAI_CLASSIC2_ACTIVATION_CHECKPOINTS)) {
        throw new Error('ZEN_BONSAI_MATRIX_GROWTH_EXPERIENCE_AXIS_MISMATCH');
    }
    const trajectoryByGrowth = new Map(
        classic2GrowthTrajectory.observations.map((entry) => [entry.growthStage, entry]),
    );
    const activationPixelsByGrowth = new Map(
        activationPixelComparisons.map((entry) => [entry.growthStage, entry]),
    );
    const resolveObservedCase = (growthStage, activation) => growthActivationCases.find((entry) => (
        entry.model === 'classic2'
        && entry.growthStage === growthStage
        && entry.activation === activation
    ));
    const checkpoints = GROWTH_BUCKETS.map((growthBucket) => {
        const growthStage = growthBucket.growthStage;
        const target = resolveZenBonsaiClassic2GrowthExperienceTarget(growthStage);
        const trajectory = trajectoryByGrowth.get(growthStage);
        const activationPixels = activationPixelsByGrowth.get(growthStage);
        if (!trajectory || !activationPixels) {
            throw new Error('ZEN_BONSAI_MATRIX_GROWTH_EXPERIENCE_OBSERVATION_MISSING:' + growthStage);
        }
        const structural = {
            rootLengthRatio: evaluateObservedRange({
                observed: trajectory.root.lengthRatio,
                target: target.rootLengthRatio,
            }),
            rootWidthRatio: evaluateObservedRange({
                observed: trajectory.root.widthRatio,
                target: target.rootWidthRatio,
            }),
            rootBaseToTrunkRatio: evaluateObservedRange({
                observed: trajectory.nebari?.rootBaseToTrunkRatio,
                target: target.rootBaseToTrunkRatio,
            }),
            trunkLengthRatio: evaluateObservedRange({
                observed: trajectory.roles.trunk.aggregateLengthRatio,
                target: target.trunkLengthRatio,
            }),
            trunkWidthRatio: evaluateObservedRange({
                observed: trajectory.roles.trunk.aggregateWidthRatio,
                target: target.trunkWidthRatio,
            }),
            scaffoldBornRatio: evaluateObservedRange({
                observed: trajectory.roles.scaffold.bornRatio,
                target: target.scaffoldBornRatio,
            }),
            twigBornRatio: evaluateObservedRange({
                observed: trajectory.roles.twig.bornRatio,
                target: target.twigBornRatio,
            }),
            carrierBornRatio: evaluateObservedRange({
                observed: trajectory.terminalCarrierBornRatio,
                target: target.carrierBornRatio,
            }),
        };
        const blossomPresentation = target.blossomPresentation === null
            ? null
            : Object.fromEntries(ACTIVATION_BUCKETS.map((activationBucket) => {
            const observedCase = resolveObservedCase(growthStage, activationBucket.activation);
            if (!observedCase) {
                throw new Error('ZEN_BONSAI_MATRIX_GROWTH_EXPERIENCE_ACTIVATION_MISSING:'
                    + growthStage + ':' + activationBucket.activation);
            }
            const visibility = observedCase.renderedTerminalVisibility || {};
            const renderedFlowers = Number(visibility.renderedFlowerTerminals || 0);
            const targetPresentation = resolveZenBonsaiClassic2BlossomPresentationTarget({
                growthCheckpoint: growthStage,
                activationCheckpoint: activationBucket.activation,
            });
            const ratio = (count) => renderedFlowers > 0
                ? Number(count || 0) / renderedFlowers
                : 0;
            return [activationBucket.activation, {
                renderedFlowers: evaluateObservedRange({
                    observed: renderedFlowers,
                    target: targetPresentation.renderedFlowers,
                }),
                budRatio: evaluateObservedRange({
                    observed: ratio(visibility.renderedFlowerBuds),
                    target: targetPresentation.budRatio,
                }),
                halfOpenRatio: evaluateObservedRange({
                    observed: ratio(visibility.renderedHalfOpenFlowers),
                    target: targetPresentation.halfOpenRatio,
                }),
                fullRatio: evaluateObservedRange({
                    observed: ratio(visibility.renderedFullFlowers),
                    target: targetPresentation.fullRatio,
                }),
            }];
        }));
        const activationPixelDelta = {
            meanRgbDelta: evaluateObservedMinimum({
                observed: activationPixels.pixelDiff?.meanRgbDelta,
                minimum: target.activationPixelDelta.meanRgbDeltaMin,
            }),
            changedPixelRatio: evaluateObservedMinimum({
                observed: activationPixels.pixelDiff?.changedPixelRatio,
                minimum: target.activationPixelDelta.changedPixelRatioMin,
            }),
        };
        const evaluations = [
            ...Object.values(structural),
            ...Object.values(blossomPresentation || {}).flatMap((entry) => (
                Object.values(entry)
            )),
            ...Object.values(activationPixelDelta),
        ];
        const inRange = evaluations.every((entry) => entry.inRange === true);
        return {
            growthStage,
            inRange,
            status: inRange ? 'PASS' : 'OUTSIDE_TARGET',
            structural,
            blossomPresentation,
            activationPixelDelta,
        };
    });
    return {
        contractVersion: ZEN_BONSAI_CLASSIC2_GROWTH_EXPERIENCE_CONTRACT_VERSION,
        referenceSeed: ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED,
        hardFailOnOutsideTarget: false,
        status: checkpoints.every((entry) => entry.inRange) ? 'PASS' : 'OUTSIDE_TARGET',
        checkpoints,
    };
};

const run = () => {
    const cases = [];
    const dayScenarioCases = [];
    const growthActivationCases = [];
    const lineageReplayCases = [];
    const imageDataByKey = new Map();
    DAY_BUCKETS.forEach((dayBucket) => {
        SCENARIOS.forEach((scenario) => {
            const rendered = renderCase({ dayBucket, scenario });
            cases.push(rendered.summary);
            dayScenarioCases.push(rendered.summary);
            imageDataByKey.set(dayBucket.day + ':' + scenario.id, rendered.imageData);
        });
    });
    let sensitivityLineageState = null;
    GROWTH_BUCKETS.forEach((growthBucket) => {
        ACTIVATION_BUCKETS.forEach((activationBucket) => {
            const renderedCases = renderGrowthActivationCase({
                growthBucket,
                activationBucket,
                classic2PreviousLineageState: sensitivityLineageState,
            });
            const classic2Rendered = renderedCases.find((entry) => entry.summary.model === 'classic2');
            if (!classic2Rendered?.lineageState) {
                throw new Error('ZEN_BONSAI_MATRIX_SENSITIVITY_LINEAGE_STATE_MISSING:'
                    + growthBucket.growthStage + ':' + activationBucket.activation);
            }
            sensitivityLineageState = classic2Rendered.lineageState;
            renderedCases.forEach((rendered) => {
                cases.push(rendered.summary);
                growthActivationCases.push(rendered.summary);
                imageDataByKey.set(
                    'growth:' + growthBucket.growthStage + ':activation:' + activationBucket.activation + ':model:' + rendered.summary.model,
                    rendered.imageData,
                );
            });
        });
    });
    const lineageReplayResults = new Map();
    LINEAGE_REPLAY_PATHS.forEach((historyPath) => {
        const renderedCases = renderLineageReplayPath(historyPath);
        lineageReplayResults.set(historyPath.id, renderedCases);
        renderedCases.forEach((rendered) => {
            cases.push(rendered.summary);
            lineageReplayCases.push(rendered.summary);
            imageDataByKey.set(
                'lineage-replay:' + historyPath.id + ':' + rendered.summary.growthStage,
                rendered.imageData,
            );
        });
    });
    const comparisons = [];
    DAY_BUCKETS.forEach((dayBucket) => {
        const healthy = imageDataByKey.get(dayBucket.day + ':healthy');
        ['remembered-strain', 'strain', 'recovery'].forEach((scenarioId) => {
            comparisons.push({
                day: dayBucket.day,
                from: 'healthy',
                to: scenarioId,
                pixelDiff: imageDiff(healthy, imageDataByKey.get(dayBucket.day + ':' + scenarioId)),
            });
        });
    });
    const steadyFinal = lineageReplayResults.get('steady-care')?.at(-1) || null;
    const recoveryFinal = lineageReplayResults.get('strain-recovery')?.at(-1) || null;
    const lineageReplayComparisons = steadyFinal && recoveryFinal
        ? [{
            from: 'steady-care',
            to: 'strain-recovery',
            growthStage: steadyFinal.summary.growthStage,
            activation: steadyFinal.summary.activation,
            inputEquality: assertSameFinalReplayInput(
                steadyFinal.summary,
                recoveryFinal.summary,
            ),
            pixelDiff: imageDiff(steadyFinal.imageData, recoveryFinal.imageData),
            decisionDiff: compareLineageDecisions(
                steadyFinal.lineageState,
                recoveryFinal.lineageState,
            ),
        }]
        : [];
    const activationLineageInvariance = assertActivationLineageInvariance(
        growthActivationCases,
    );
    const activationPixelComparisons = resolveActivationPixelComparisons({
        growthActivationCases,
        imageDataByKey,
    });
    const classic2GrowthTrajectory = resolveClassic2GrowthTrajectory(growthActivationCases);
    const classic2GrowthExperienceEvaluation = resolveClassic2GrowthExperienceEvaluation({
        growthActivationCases,
        activationPixelComparisons,
        classic2GrowthTrajectory,
    });
    window.__ZEN_BONSAI_MATRIX__ = {
        version: MATRIX_VERSION,
        generatedAt: new Date().toISOString(),
        viewport: VIEWPORT,
        seed: ZEN_BONSAI_CLASSIC2_GROWTH_REFERENCE_SEED,
        structureDepth: STRUCTURE_DEPTH,
        lineageHistoryMode: 'sequential-fixed-history-sensitivity-plus-development-observation-replay',
        measurementContracts: {
            classic2GrowthObservation: 'observational_no_target_thresholds',
            renderedTerminalVisibility: 'post_renderer_visibility_and_activation_stage_asset_resolver_calls',
            activationPixelSensitivity: {
                comparison: 'activation_18_to_92_full_canvas',
                meanRgbDelta: 'mean_absolute_rgb_delta_per_pixel',
                changedPixelRatio: 'pixel_ratio_at_or_above_mean_absolute_rgb_delta_threshold',
                changedPixelMeanRgbDeltaThreshold: PIXEL_CHANGE_RGB_DELTA_THRESHOLD,
            },
            classic2GrowthTrajectory: 'immutable_candidate_topology_and_carrier_denominator',
        },
        cases,
        dayScenarioCases,
        growthActivationCases,
        lineageReplayCases,
        axes: {
            dayBuckets: DAY_BUCKETS,
            scenarios: SCENARIOS.map((scenario) => ({
                id: scenario.id,
                label: scenario.label,
                description: scenario.description,
            })),
            growthBuckets: GROWTH_BUCKETS,
            activationBuckets: ACTIVATION_BUCKETS,
            growthModels: GROWTH_MODELS,
            lineageReplayPaths: LINEAGE_REPLAY_PATHS,
            sensitivityHistoryActivation: SENSITIVITY_HISTORY_ACTIVATION,
        },
        comparisons,
        lineageReplayComparisons,
        activationLineageInvariance,
        activationPixelComparisons,
        classic2GrowthTrajectory,
        classic2GrowthExperienceEvaluation,
    };
    window.__ZEN_BONSAI_MATRIX_READY__ = true;
};

run();
`;

const REPORT_STYLE = `
body {
  margin: 0;
  background: #E8DFD1;
  color: #2E2822;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.page {
  padding: 24px;
}
h1 {
  font-size: 20px;
  margin: 0 0 6px;
}
.intro {
  margin: 0 0 18px;
  color: #6C6256;
  max-width: 960px;
  line-height: 1.5;
}
.matrix {
  display: grid;
  grid-template-columns: repeat(4, 396px);
  gap: 18px;
  align-items: start;
}
.card {
  background: #F3EFE6;
  border: 1px solid #CFC3B3;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 10px 28px rgba(46, 40, 34, 0.08);
}
header {
  min-height: 54px;
  margin-bottom: 8px;
}
strong {
  display: block;
  font-size: 13px;
}
span {
  display: block;
  margin-top: 3px;
  color: #746A5E;
  font-size: 11px;
  line-height: 1.35;
}
canvas {
  display: block;
  width: 360px;
  height: 440px;
  background: #F3EFE6;
  border-radius: 6px;
}
pre {
  margin: 9px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(46, 40, 34, 0.06);
  color: #4B4239;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
}
`;

const ENDPOINT_KIND_KEYS = Object.freeze({
    TERMINAL_SPUR: 'terminal_spur',
    GROWTH_TIP: 'growth_tip',
    HIDDEN_FRONTIER: 'hidden_frontier',
    STRUCTURAL_BARE: 'structural_bare',
});

const getEndpointKindCount = (item, kind) => (
    item.terminalContinuity?.endpointKinds?.[kind] ?? 'n/a'
);

const buildMarkdownReport = (manifest) => {
    const dayScenarioRows = (manifest.dayScenarioCases || manifest.cases.filter((item) => item.caseKind === 'day_scenario')).map((item) => [
        item.day,
        item.scenario,
        item.phase,
        item.progress,
        item.stage?.depth ?? item.visibleDepth,
        item.stage?.leafChance ?? 'n/a',
        item.stage?.flowerChance ?? 'n/a',
        item.kinkPressure,
        item.scaffoldCompression,
        item.gravityBias,
        item.canopyBudget,
        item.growthMetrics.visibleScaffoldNodes,
        item.growthMetrics.visibleTwigs,
        item.growthMetrics.visibleFlowerTerminals,
	        item.growthMetrics.meanCurveDeltaPx,
	        item.growthMetrics.maxCurveDeltaPx,
	        item.growthMetrics.meanLengthDelta,
	        item.growthMetrics.meanWidthDelta,
	        item.terminalContinuity?.visibleBareEnds?.trunk ?? 'n/a',
	        item.terminalContinuity?.visibleBareEnds?.scaffold ?? 'n/a',
	        item.terminalContinuity?.visibleBareEnds?.twig ?? 'n/a',
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.TERMINAL_SPUR),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.GROWTH_TIP),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.HIDDEN_FRONTIER),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.STRUCTURAL_BARE),
	        item.terminalContinuity?.terminalTwigFrontierCount ?? 'n/a',
	        item.terminalContinuity?.flowerCarrierCount ?? 'n/a',
	    ]);
    const growthActivationRows = (manifest.growthActivationCases || manifest.cases.filter((item) => item.caseKind === 'growth_activation')).map((item) => [
        item.model || 'classic',
        item.growthStage,
        item.activation,
        item.historyActivation ?? 'n/a',
        item.lifeState?.phase ?? item.phase,
        item.lifeState?.growth ?? 'n/a',
        item.lifeState?.bloom ?? 'n/a',
        item.lifeState?.vitality ?? 'n/a',
        item.projection?.scaffoldReveal ?? 'n/a',
        item.projection?.twigReveal ?? 'n/a',
        item.projection?.flowerGateScale ?? 'n/a',
        item.projection?.bloomDevelopmentFloor ?? 'n/a',
        item.projection?.miniatureBloomScale ?? 'n/a',
        item.projection?.ramificationFloor ?? 'n/a',
        item.appearance?.flowerPresence ?? 'n/a',
        item.appearance?.flowerScale ?? 'n/a',
        item.stage?.depth ?? item.visibleDepth,
        item.stage?.leafChance ?? 'n/a',
        item.stage?.flowerChance ?? 'n/a',
        item.growthMetrics.visibleScaffoldNodes,
        item.growthMetrics.visibleTwigs,
        item.growthMetrics.visibleFlowerTerminals,
        item.growthMetrics.generatedFlowerTerminals,
	        item.classic2Development?.bornFlowerTerminals ?? 'n/a',
	        item.classic2Development?.candidateFlowerTerminals ?? 'n/a',
	        item.classic2Development?.meanNodeAge ?? 'n/a',
	        item.terminalContinuity?.visibleBareEnds?.trunk ?? 'n/a',
	        item.terminalContinuity?.visibleBareEnds?.scaffold ?? 'n/a',
	        item.terminalContinuity?.visibleBareEnds?.twig ?? 'n/a',
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.TERMINAL_SPUR),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.GROWTH_TIP),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.HIDDEN_FRONTIER),
	        getEndpointKindCount(item, ENDPOINT_KIND_KEYS.STRUCTURAL_BARE),
	        item.terminalContinuity?.terminalTwigFrontierCount ?? 'n/a',
	        item.terminalContinuity?.flowerCarrierCount ?? 'n/a',
	    ]);
    const lineageReplayRows = (manifest.lineageReplayCases || []).map((item) => [
        item.historyPath,
        item.historyStep,
        item.growthStage,
        item.activation,
        item.historyActivation,
        item.classic2LineageTrace?.stateRevision ?? 'n/a',
        item.classic2Development?.lineage?.selectedCount ?? 'n/a',
        item.classic2Development?.lineage?.pendingCount ?? 'n/a',
        item.growthMetrics.visibleScaffoldNodes,
        item.growthMetrics.visibleTwigs,
        item.growthMetrics.visibleFlowerTerminals,
        item.classic2LineageTrace?.decisionSamples?.length ?? 0,
    ]);
    const comparisonRows = manifest.comparisons.map((item) => [
        item.day,
        item.to,
        item.pixelDiff?.meanRgbDelta ?? 'n/a',
        item.pixelDiff?.changedPixelRatio ?? 'n/a',
    ]);
    const lineageReplayComparisonRows = (manifest.lineageReplayComparisons || []).map((item) => [
        item.from,
        item.to,
        item.growthStage,
        item.activation,
        item.inputEquality?.allEqual === true ? 'yes' : 'no',
        item.decisionDiff?.statusChangedCount ?? 'n/a',
        item.decisionDiff?.sameStatusProvenanceChangedCount ?? 'n/a',
        item.decisionDiff?.comparedDecisionNodeCount ?? 'n/a',
        item.pixelDiff?.meanRgbDelta ?? 'n/a',
        item.pixelDiff?.changedPixelRatio ?? 'n/a',
    ]);
    const activationInvariantRows = (manifest.activationLineageInvariance || []).map((item) => [
        item.growthStage,
        item.historyActivation,
        item.comparedActivations?.join(', ') || 'n/a',
        item.invariant === true ? 'yes' : 'no',
        item.recordedCount,
        item.pendingCount,
        item.visibleScaffoldNodes,
        item.visibleTwigs,
        item.bornFlowerTerminals,
    ]);
    const classic2ObservationCases = (
        manifest.growthActivationCases
        || manifest.cases.filter((item) => item.caseKind === 'growth_activation')
    ).filter((item) => item.model === 'classic2');
    const classic2WoodRows = classic2ObservationCases.map((item) => {
        const trunk = item.classic2RoleGrowth?.trunk || {};
        const scaffold = item.classic2RoleGrowth?.scaffold || {};
        const twig = item.classic2RoleGrowth?.twig || {};
        return [
            item.growthStage,
            item.activation,
            item.lifeState?.phase ?? item.phase,
            item.lifeState?.growth ?? 'n/a',
            trunk.born ?? 'n/a',
            trunk.meanLength ?? 'n/a',
            trunk.meanWidth ?? 'n/a',
            trunk.meanAge ?? 'n/a',
            scaffold.born ?? 'n/a',
            scaffold.meanLength ?? 'n/a',
            scaffold.meanWidth ?? 'n/a',
            scaffold.meanAge ?? 'n/a',
            twig.born ?? 'n/a',
            twig.meanLength ?? 'n/a',
            twig.meanWidth ?? 'n/a',
            twig.meanAge ?? 'n/a',
        ];
    });
    const classic2TrajectoryRows = (manifest.classic2GrowthTrajectory?.observations || []).map((item) => [
        item.growthStage,
        item.root?.lengthRatio ?? 'n/a',
        item.root?.widthRatio ?? 'n/a',
        item.root?.girthAge ?? 'n/a',
        item.nebari?.rootReachScale ?? 'n/a',
        item.nebari?.rootBaseToTrunkRatio ?? 'n/a',
        item.roles?.trunk?.bornRatio ?? 'n/a',
        item.roles?.trunk?.aggregateLengthRatio ?? 'n/a',
        item.roles?.trunk?.aggregateWidthRatio ?? 'n/a',
        item.roles?.scaffold?.bornRatio ?? 'n/a',
        item.roles?.scaffold?.aggregateLengthRatio ?? 'n/a',
        item.roles?.scaffold?.aggregateWidthRatio ?? 'n/a',
        item.roles?.twig?.bornRatio ?? 'n/a',
        item.roles?.twig?.aggregateLengthRatio ?? 'n/a',
        item.roles?.twig?.aggregateWidthRatio ?? 'n/a',
        item.terminalCarrierBorn,
        item.terminalCarrierBornRatio ?? 'n/a',
    ]);
    const classic2TerminalRows = classic2ObservationCases.map((item) => {
        const visibility = item.renderedTerminalVisibility || {};
        return [
            item.growthStage,
            item.activation,
            item.growthMetrics?.visibleLeafTerminals ?? 'n/a',
            item.growthMetrics?.visibleFlowerTerminals ?? 'n/a',
            visibility.renderedStructuredLeafTerminals ?? 'n/a',
            visibility.renderedFlowerTerminals ?? 'n/a',
            visibility.renderedFlowerBuds ?? 'n/a',
            visibility.renderedHalfOpenFlowers ?? 'n/a',
            visibility.renderedFullFlowers ?? 'n/a',
            visibility.renderedGrowthTipLeafSprites ?? 'n/a',
            visibility.growthTipSiteCount ?? 'n/a',
            visibility.terminalSpurSiteCount ?? 'n/a',
        ];
    });
    const activationPixelRows = (manifest.activationPixelComparisons || []).map((item) => {
        const low = item.renderedTerminalVisibility?.low || {};
        const high = item.renderedTerminalVisibility?.high || {};
        const pair = (field) => `${low[field] ?? 'n/a'} -> ${high[field] ?? 'n/a'}`;
        return [
            item.growthStage,
            `${item.fromActivation} -> ${item.toActivation}`,
            item.pixelDiff?.meanRgbDelta ?? 'n/a',
            item.pixelDiff?.changedPixelRatio ?? 'n/a',
            pair('renderedStructuredLeafTerminals'),
            pair('renderedFlowerTerminals'),
            pair('renderedFlowerBuds'),
            pair('renderedHalfOpenFlowers'),
            pair('renderedFullFlowers'),
            pair('renderedGrowthTipLeafSprites'),
        ];
    });
    const formatTargetEvaluation = (evaluation = {}) => {
        const target = evaluation.target || {};
        const targetLabel = target.max === undefined
            ? `>=${target.min ?? 'n/a'}`
            : `${target.min ?? 'n/a'}..${target.max ?? 'n/a'}`;
        return `${evaluation.observed ?? 'n/a'} / ${targetLabel} / ${evaluation.status || 'n/a'} / dev ${evaluation.deviation ?? 'n/a'}`;
    };
    const growthExperienceRows = (
        manifest.classic2GrowthExperienceEvaluation?.checkpoints
        || []
    ).map((item) => [
        item.growthStage,
        item.status,
        formatTargetEvaluation(item.structural?.rootLengthRatio),
        formatTargetEvaluation(item.structural?.rootWidthRatio),
        formatTargetEvaluation(item.structural?.rootBaseToTrunkRatio),
        formatTargetEvaluation(item.structural?.trunkLengthRatio),
        formatTargetEvaluation(item.structural?.trunkWidthRatio),
        formatTargetEvaluation(item.structural?.scaffoldBornRatio),
        formatTargetEvaluation(item.structural?.twigBornRatio),
        formatTargetEvaluation(item.structural?.carrierBornRatio),
        formatTargetEvaluation(item.activationPixelDelta?.meanRgbDelta),
        formatTargetEvaluation(item.activationPixelDelta?.changedPixelRatio),
    ]);
    const growthExperienceFlowerRows = (
        manifest.classic2GrowthExperienceEvaluation?.checkpoints
        || []
    ).flatMap((item) => Object.entries(item.blossomPresentation || {}).map(([activation, evaluation]) => [
        item.growthStage,
        activation,
        formatTargetEvaluation(evaluation.renderedFlowers),
        formatTargetEvaluation(evaluation.budRatio),
        formatTargetEvaluation(evaluation.halfOpenRatio),
        formatTargetEvaluation(evaluation.fullRatio),
    ]));
    return [
        '# Zen Bonsai Growth Snapshot Matrix',
        '',
        `Generated: ${manifest.generatedAt}`,
        `Seed: ${manifest.seed}`,
        `Lineage history mode: ${manifest.lineageHistoryMode}`,
        '',
        `Growth x activation checkpoints advance one sequential ephemeral development lineage while holding synthetic structural history at activation ${manifest.axes?.sensitivityHistoryActivation ?? 'n/a'}; all three current-activation views reuse that checkpoint state. Each synthetic current activation uses the canonical ephemeral activationPresentation seam and never enters lifecycle history or lineage identity. The sequential section replays development observations without executing the durable repository/CAS or claiming to reconstruct the cultivation ledger. Its two final cards are runtime-asserted to share the same lifecycle/projection/identity input; observation provenance may differ, but branch membership must remain identical. Current-runtime Main applies those transition semantics through durable CAS persistence.`,
        '',
        '## Growth x Activation Cases',
        '',
	        '| model | growth | activation | fixed history activation | phase | life growth | bloom | vitality | scaffold reveal | twig reveal | flower gate | bloom floor | bloom scale | ramification floor | flower presence | flower scale | stage depth | leaf chance | flower chance | visible scaffold | visible twig | visible flower | generated flower | classic2 born flower | classic2 candidate flower | classic2 mean age | bare trunk | bare scaffold | bare twig | endpoint spur | growth tip | hidden frontier | structural bare | terminal twig frontier | flower carriers |',
	        '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...growthActivationRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Classic2 normalized growth trajectory',
        '',
        `Ratios are observational values normalized directly to the immutable candidate topology and carrier counts. Aggregate length and width include every presented node in the role; growth 100 must reach branch/carrier coverage 1, full candidate length, and full root/trunk width rather than merely normalize against its own smaller final state. Scaffold/twig raw-candidate width ratios may remain below 1 only where the canonical parent-child taper ceiling records the unclamped endpoint width.`,
        '',
        '| growth | root length ratio | root width ratio | root girth age | nebari reach | root base/trunk ratio | trunk born ratio | trunk length ratio | trunk width ratio | scaffold born ratio | scaffold length ratio | scaffold width ratio | twig born ratio | twig length ratio | twig width ratio | terminal carrier born | carrier born ratio |',
        '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...classic2TrajectoryRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Classic2 target-envelope observation',
        '',
        `Contract ${manifest.classic2GrowthExperienceEvaluation?.contractVersion || 'n/a'} / overall ${manifest.classic2GrowthExperienceEvaluation?.status || 'n/a'}. OUTSIDE_TARGET is reported as evidence and does not fail this diagnostic run. Cell format: observed / target / status / signed deviation.`,
        '',
        '| growth | checkpoint | root length ratio | root width ratio | root base/trunk ratio | trunk length ratio | trunk width ratio | scaffold born ratio | twig born ratio | carrier born ratio | activation mean RGB | activation changed pixels |',
        '| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...growthExperienceRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '| growth | activation | rendered flowers | bud ratio | half-open ratio | full ratio |',
        '| ---: | ---: | --- | --- | --- | --- |',
        ...growthExperienceFlowerRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Classic2 wood development observations',
        '',
        'These are observational measurements, not target-value gates. Length and width use projected topology units; age is the Classic2 rendered development age.',
        '',
        '| growth | activation | phase | life growth | trunk born | trunk mean length | trunk mean width | trunk mean age | scaffold born | scaffold mean length | scaffold mean width | scaffold mean age | twig born | twig mean length | twig mean width | twig mean age |',
        '| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...classic2WoodRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Classic2 rendered terminal visibility',
        '',
        'Structural columns count born projected terminals. Rendered columns count sprite resolver calls after renderer visibility and activation bloom-stage resolution, so hidden terminals are excluded and bud/half-open/full reflect the actual presented child. Tip leaves pass the separate growth-tip gate and do not mutate topology.',
        '',
        '| growth | activation | structural leaf | structural flower | rendered leaf | rendered flower | rendered flower bud | rendered half-open | rendered full | rendered tip leaves | growth-tip sites | terminal-spur sites |',
        '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...classic2TerminalRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Activation isolation invariant',
        '',
        'With structural history fixed, changing current activation must not change branch membership, projected wood geometry, branch visibility, or terminal birth.',
        '',
        '| growth | history activation | compared current activations | lineage invariant | recorded | pending | visible scaffold | visible twig | born flower terminals |',
        '| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
        ...activationInvariantRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Low-to-high activation pixel sensitivity',
        '',
        `This section records activation 18 to 92 full-canvas deltas. A pixel counts as changed at mean absolute RGB delta >= ${PIXEL_CHANGE_RGB_DELTA_THRESHOLD}; checkpoint minima are evaluated in the target-envelope table above.`,
        '',
        '| growth | activation | mean RGB delta | changed pixel ratio | rendered leaf | rendered flower | flower bud | half-open | full flower | tip leaves |',
        '| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |',
        ...activationPixelRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '## Sequential Development-Lineage Replay',
        '',
        '| history | step | growth | activation | history activation | state revision | recorded | pending | visible scaffold | visible twig | visible flower | trace samples |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...lineageReplayRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '### Same final lifecycle-input history comparison',
        '',
        '| from | to | growth | activation | final inputs equal | status changes | same-status provenance changes | compared decision nodes | mean RGB delta | changed pixel ratio |',
        '| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
        ...lineageReplayComparisonRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '## Day Scenario Cases',
        '',
	        '| day | scenario | phase | progress | stage depth | leaf chance | flower chance | kink | compression | gravity | canopy | visible scaffold | visible twig | visible flower | mean curve px | max curve px | mean length delta | mean width delta | bare trunk | bare scaffold | bare twig | endpoint spur | growth tip | hidden frontier | structural bare | terminal twig frontier | flower carriers |',
	        '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...dayScenarioRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '## Healthy Pixel Comparisons',
        '',
        '| day | compared scenario | mean RGB delta | changed pixel ratio |',
        '| --- | --- | ---: | ---: |',
        ...comparisonRows.map((row) => `| ${row.join(' | ')} |`),
        '',
        '## Files',
        '',
        '- `index.html`: visual matrix',
        '- `matrix.png`: full-page capture',
        '- `manifest.json`: machine-readable projection, lineage fingerprints/revisions, per-role growth, rendered terminal visibility, decision provenance samples, and pixel metrics',
    ].join('\n');
};

if (!BUNDLE_ONLY) {
    await rm(OUT_DIR, { recursive: true, force: true });
}
await mkdir(OUT_DIR, { recursive: true });

await esbuild.build({
    stdin: {
        contents: BROWSER_ENTRY,
        resolveDir: ROOT,
        sourcefile: 'zen-bonsai-growth-snapshot-matrix.browser.js',
    },
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    outfile: BUNDLE_PATH,
    logLevel: 'silent',
    plugins: [{
        name: 'entropy-src-alias',
        setup(build) {
            build.onResolve({ filter: /^@\// }, (args) => ({
                path: resolve(ROOT, 'src', args.path.slice(2)),
            }));
        },
    }],
});

await writeFile(HTML_PATH, [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Zen Bonsai Growth Snapshot Matrix</title>',
    '<style>',
    REPORT_STYLE,
    '</style>',
    '</head>',
    '<body>',
    '<main class="page">',
    '<h1>Zen Bonsai Growth Snapshot Matrix</h1>',
    '<p class="intro">Growth-stage, activation, habit-scenario, and sequential lineage snapshots. Activation sensitivity advances one exact-once ephemeral lineage with fixed structural history, then uses the canonical activationPresentation seam without entering lineage identity. Replay cards carry exact-once decisions through synthetic history observations, with runtime assertions that the final lifecycle/projection/identity inputs match; durable CAS itself is covered by repository tests.</p>',
    '<div id="matrix" class="matrix"></div>',
    '</main>',
    `<script src="./${BUNDLE_PATH.split('/').pop()}"></script>`,
    '</body>',
    '</html>',
].join('\n'));

if (BUNDLE_ONLY) {
    console.log(`wrote ${BUNDLE_PATH}`);
    console.log(`wrote ${HTML_PATH}`);
} else {
    const browser = await launchQaPlaywrightBrowser();
    const page = await browser.newPage({
        viewport: { width: 1640, height: 1800 },
        deviceScaleFactor: 1,
    });
    const consoleErrors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        consoleErrors.push(String(error));
    });

    await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'load' });
    await page.waitForFunction(
        () => window.__ZEN_BONSAI_MATRIX_READY__ === true,
        null,
        { timeout: 15000 },
    );
    await page.screenshot({ path: MATRIX_SHOT_PATH, fullPage: true });

    const manifest = await page.evaluate(() => window.__ZEN_BONSAI_MATRIX__);
    for (const item of manifest.cases) {
        const locator = page.locator(`[data-shot-id="${item.shotId}"] canvas`);
        await locator.screenshot({ path: resolve(OUT_DIR, `${item.shotId}.png`) });
    }

    await browser.close();

    if (consoleErrors.length > 0) {
        throw new Error(`ZEN_BONSAI_GROWTH_MATRIX_BROWSER_ERRORS\n${consoleErrors.join('\n')}`);
    }

    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(REPORT_PATH, `${buildMarkdownReport(manifest)}\n`);

    console.log(`wrote ${HTML_PATH}`);
    console.log(`wrote ${MATRIX_SHOT_PATH}`);
    console.log(`wrote ${MANIFEST_PATH}`);
    console.log(`wrote ${REPORT_PATH}`);
}
