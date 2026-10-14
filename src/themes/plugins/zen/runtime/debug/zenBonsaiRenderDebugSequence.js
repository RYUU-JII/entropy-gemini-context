import {
    createZenBonsaiMainSceneSnapshot,
    resolveZenBonsaiTopologySignature,
} from '../zenBonsaiSceneSnapshot.js';
import { createSakuraRenderPlanV1 } from '../../model/sakura/sakuraRenderPlan.js';
import { SakuraRenderSpecies } from '../../model/SakuraRenderSpecies.js';
import { resolveZenWorldAmbientGrammar } from '../environment/zenWorldAmbientGrammar.js';

export const ZEN_BONSAI_RENDER_DEBUG_SEQUENCE_VERSION = 1;

const STATIC_LAYER_IDS = Object.freeze(['back', 'front']);

const DEBUG_TOPOLOGY = Object.freeze({
    type: 'branch',
    nodeId: 'debug-root',
    branchOrder: 0,
    initialAngle: 0.42,
    length: 14,
    width: 2.8,
    curve: 0,
    curveIn: 0,
    curveOut: 0,
    visualPhenotype: Object.freeze({
        trunkOffsetX: 0,
        potScale: 1,
        morphologyProfile: Object.freeze({}),
    }),
    terminals: [],
    branches: Object.freeze([
        Object.freeze({
            angleOffset: -0.28,
            obj: Object.freeze({
                type: 'branch',
                nodeId: 'debug-primary-left',
                branchOrder: 1,
                length: 8,
                width: 1.6,
                curve: 0,
                curveIn: 0,
                curveOut: 0,
                terminals: Object.freeze([Object.freeze({})]),
                branches: Object.freeze([
                    Object.freeze({
                        angleOffset: -0.18,
                        obj: Object.freeze({
                            type: 'branch',
                            nodeId: 'debug-secondary-left',
                            branchOrder: 2,
                            length: 4.2,
                            width: 0.82,
                            curve: 0,
                            curveIn: 0,
                            curveOut: 0,
                            terminals: Object.freeze([Object.freeze({})]),
                            branches: Object.freeze([]),
                        }),
                    }),
                ]),
            }),
        }),
        Object.freeze({
            angleOffset: 0.34,
            obj: Object.freeze({
                type: 'branch',
                nodeId: 'debug-primary-right',
                branchOrder: 1,
                length: 7.2,
                width: 1.42,
                curve: 0,
                curveIn: 0,
                curveOut: 0,
                terminals: Object.freeze([Object.freeze({}), Object.freeze({})]),
                branches: Object.freeze([]),
            }),
        }),
    ]),
});

const BASE_ENVIRONMENT = Object.freeze({
    ambientChromaticState: resolveZenWorldAmbientGrammar({
        hour: 12, daylight: 0.9, nightDepth: 0.04, solarElevation: 0.72,
    }),
    sunAngle: Math.PI,
    solarElevation: 0.72,
    daylight: 0.9,
    night: 0.04,
    nightDepth: 0.04,
    cloudCover: 0,
    rainIntensity: 0,
    directSunlight: 0.9,
    diffuseSkylight: 0.18,
    moonlight: 0,
    // A set new moon: the fixed debug noon has no moon on the panel.
    moonIllumination: 0,
    moonAltitudeRadians: -0.5,
    moonAzimuthSouthRadians: 0,
    moonParallacticAngle: 0,
    moonBrightLimbAngle: 0,
    sunDirectionY: 0,
    sunDirectionZ: 0.72,
    // A due-south noon sun, Math.asin(0.72) high.
    solarAltitudeRadians: 0.8038,
    sunAzimuthSouthRadians: 0,
    lightIntensity: 1.08,
    shadowLength: 12,
    windIntensity: 0.16,
    gustEnvelope: 0.12,
    windDirection: -0.4,
    lightColor: 'rgba(255, 250, 230, 1)',
});

const BASE_LIFE = Object.freeze({
    phase: 'mature',
    vitality: 0.74,
    stress: 0.18,
    bloom: 0.32,
    dryness: 0.12,
    branchSag: 0.08,
    windResponse: 0.72,
    analysisConfidence: 1,
});

const BASE_INPUT = Object.freeze({
    bonsaiMaterializationKey: 'zen_bonsai_debug_materialization_v1',
    inputSignature: 'zen_bonsai_debug_input_v1',
    treeType: 'sakura',
    treeSeed: 42,
    currentPhenotype: Object.freeze({ silhouette: 'debug-upright' }),
    currentStage: Object.freeze({ stage: 'mature' }),
    treeTopology: DEBUG_TOPOLOGY,
    lifeState: BASE_LIFE,
    environmentState: BASE_ENVIRONMENT,
    canvasMetrics: Object.freeze({
        pixelWidth: 960,
        pixelHeight: 640,
        pixelRatio: 2,
    }),
    cameraPreset: 'workspace',
    hidePot: false,
    potStyleOverride: 'oval-tokoname-clay',
    showBackboneDebug: false,
    showBranchTierDebug: false,
    renderMode: 'full',
    mainRenderQuality: 'full',
    renderLoopMode: 'dirty',
    renderBackend: 'pixi',
    mainRenderVersion: 7,
});

const EXPECTED_KEYS = Object.freeze([
    'sceneChanged',
    'backRebake',
    'frontRebake',
    'branchRigRebuild',
]);

const createExpected = ({
    sceneChanged,
    backRebake,
    frontRebake,
    branchRigRebuild,
}) => Object.freeze({
    sceneChanged: Boolean(sceneChanged),
    backRebake: Boolean(backRebake),
    frontRebake: Boolean(frontRebake),
    branchRigRebuild: Boolean(branchRigRebuild),
});

const mergeInput = (...overrides) => overrides.reduce((acc, override) => ({
    ...acc,
    ...override,
    currentPhenotype: override?.currentPhenotype
        ? { ...acc.currentPhenotype, ...override.currentPhenotype }
        : acc.currentPhenotype,
    currentStage: override?.currentStage
        ? { ...acc.currentStage, ...override.currentStage }
        : acc.currentStage,
    lifeState: override?.lifeState
        ? { ...acc.lifeState, ...override.lifeState }
        : acc.lifeState,
    environmentState: override?.environmentState
        ? {
            ...acc.environmentState,
            ...override.environmentState,
            ambientChromaticState: resolveZenWorldAmbientGrammar({
                ...acc.environmentState,
                ...override.environmentState,
                nightDepth: override.environmentState.night ?? acc.environmentState.night,
            }),
        }
        : acc.environmentState,
    canvasMetrics: override?.canvasMetrics
        ? { ...acc.canvasMetrics, ...override.canvasMetrics }
        : acc.canvasMetrics,
}), { ...BASE_INPUT });

const SEQUENCE_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'baseline',
        reasonId: 'initial',
        input: BASE_INPUT,
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: true,
        }),
    }),
    Object.freeze({
        id: 'wind_motion',
        reasonId: 'wind_runtime',
        input: mergeInput({
            environmentState: {
                windIntensity: 0.72,
                gustEnvelope: 0.68,
                windDirection: 1.2,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: false,
            frontRebake: false,
            branchRigRebuild: false,
        }),
    }),
    Object.freeze({
        id: 'gust_motion',
        reasonId: 'wind_runtime',
        input: mergeInput({
            environmentState: {
                windIntensity: 0.94,
                gustEnvelope: 0.82,
                windDirection: 1.8,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: false,
            frontRebake: false,
            branchRigRebuild: false,
        }),
    }),
    Object.freeze({
        id: 'bloom_band',
        reasonId: 'bloom_backdrop',
        input: mergeInput({
            lifeState: {
                bloom: 0.62,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: false,
            branchRigRebuild: true,
        }),
    }),
    Object.freeze({
        id: 'health_band',
        reasonId: 'health_full',
        input: mergeInput({
            lifeState: {
                vitality: 0.24,
                stress: 0.82,
                bloom: 0.08,
                dryness: 0.78,
                branchSag: 0.72,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: true,
        }),
    }),
    Object.freeze({
        id: 'light_band',
        reasonId: 'light_bake',
        input: mergeInput({
            lifeState: {
                vitality: 0.24,
                stress: 0.82,
                bloom: 0.08,
                dryness: 0.78,
                branchSag: 0.72,
            },
            environmentState: {
                sunAngle: Math.PI * 0.88,
                solarElevation: 0.18,
                daylight: 0.1,
                night: 0.82,
                lightIntensity: 0.12,
                shadowLength: 52,
                lightColor: 'rgba(167, 179, 226, 1)',
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: false,
        }),
    }),
    Object.freeze({
        id: 'canvas_resize',
        reasonId: 'canvas_static',
        input: mergeInput({
            lifeState: {
                vitality: 0.24,
                stress: 0.82,
                bloom: 0.08,
                dryness: 0.78,
                branchSag: 0.72,
            },
            environmentState: {
                sunAngle: Math.PI * 0.88,
                solarElevation: 0.18,
                daylight: 0.1,
                night: 0.82,
                lightIntensity: 0.12,
                shadowLength: 52,
                lightColor: 'rgba(167, 179, 226, 1)',
            },
            canvasMetrics: {
                pixelWidth: 1120,
                pixelHeight: 720,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: false,
        }),
    }),
    Object.freeze({
        id: 'seed_change',
        reasonId: 'seed_cache',
        input: mergeInput({
            treeSeed: 108,
            currentPhenotype: {
                silhouette: 'debug-slant',
            },
            lifeState: {
                vitality: 0.24,
                stress: 0.82,
                bloom: 0.08,
                dryness: 0.78,
                branchSag: 0.72,
            },
            environmentState: {
                sunAngle: Math.PI * 0.88,
                solarElevation: 0.18,
                daylight: 0.1,
                night: 0.82,
                lightIntensity: 0.12,
                shadowLength: 52,
                lightColor: 'rgba(167, 179, 226, 1)',
            },
            canvasMetrics: {
                pixelWidth: 1120,
                pixelHeight: 720,
            },
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: true,
        }),
    }),
    Object.freeze({
        id: 'version_bump',
        reasonId: 'version_cache',
        input: mergeInput({
            treeSeed: 108,
            currentPhenotype: {
                silhouette: 'debug-slant',
            },
            lifeState: {
                vitality: 0.24,
                stress: 0.82,
                bloom: 0.08,
                dryness: 0.78,
                branchSag: 0.72,
            },
            environmentState: {
                sunAngle: Math.PI * 0.88,
                solarElevation: 0.18,
                daylight: 0.1,
                night: 0.82,
                lightIntensity: 0.12,
                shadowLength: 52,
                lightColor: 'rgba(167, 179, 226, 1)',
            },
            canvasMetrics: {
                pixelWidth: 1120,
                pixelHeight: 720,
            },
            mainRenderVersion: 8,
        }),
        expected: createExpected({
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: true,
        }),
    }),
    Object.freeze({
        id: 'resume_rehydrate',
        reasonId: 'resume_rig',
        operation: 'resume_rehydrate',
        expected: createExpected({
            sceneChanged: false,
            backRebake: false,
            frontRebake: false,
            branchRigRebuild: true,
        }),
    }),
]);

const compareSnapshots = (previousSnapshot, snapshot) => {
    if (!previousSnapshot) {
        return {
            sceneChanged: true,
            backRebake: true,
            frontRebake: true,
            branchRigRebuild: true,
        };
    }

    return {
        sceneChanged: previousSnapshot.sceneSignature !== snapshot.sceneSignature,
        backRebake: previousSnapshot.staticLayerSignatures.back !== snapshot.staticLayerSignatures.back,
        frontRebake: previousSnapshot.staticLayerSignatures.front !== snapshot.staticLayerSignatures.front,
        branchRigRebuild: previousSnapshot.branchRigSignature !== snapshot.branchRigSignature,
    };
};

const hasExpectedOutcome = (observed, expected) => (
    EXPECTED_KEYS.every((key) => observed[key] === expected[key])
);

const createSignatureDigest = (snapshot) => Object.freeze({
    scene: snapshot.sceneSignature,
    back: snapshot.staticLayerSignatures.back,
    front: snapshot.staticLayerSignatures.front,
    branchRig: snapshot.branchRigSignature,
    life: snapshot.lifeAppearanceSignature,
    lifeBack: snapshot.lifeBackdropSignature,
    lifeFront: snapshot.lifeFrontSignature,
    environmentMotion: snapshot.environmentSignature,
    environmentBake: snapshot.environmentBakeSignature,
});

const buildSummary = (steps) => {
    const totals = steps.reduce((acc, step) => {
        if (step.observed.sceneChanged) acc.sceneUpdates += 1;
        if (step.observed.backRebake) acc.backLayerRebakes += 1;
        if (step.observed.frontRebake) acc.frontLayerRebakes += 1;
        if (step.observed.branchRigRebuild) acc.branchRigRebuilds += 1;
        if (step.passed) acc.passCount += 1;
        if (!step.passed) acc.failCount += 1;
        return acc;
    }, {
        sceneUpdates: 0,
        backLayerRebakes: 0,
        frontLayerRebakes: 0,
        branchRigRebuilds: 0,
        passCount: 0,
        failCount: 0,
    });

    return Object.freeze({
        ...totals,
        stepCount: steps.length,
        passed: totals.failCount === 0,
    });
};

const createDebugRenderPlan = (input) => {
    const pixelWidth = Number(input?.canvasMetrics?.pixelWidth);
    const pixelHeight = Number(input?.canvasMetrics?.pixelHeight);
    return createSakuraRenderPlanV1({
        topology: input.treeTopology,
        species: SakuraRenderSpecies,
        sourceTopologySignature: resolveZenBonsaiTopologySignature(input.treeTopology),
        surface: {
            pixelWidth,
            pixelHeight,
            treeViewport: { x: 0, y: 0, width: pixelWidth, height: pixelHeight },
            clipTreePaint: false,
        },
        includePot: input.hidePot !== true,
        includeGroundShadow: input.hidePot !== true,
        potStyleOverride: input.potStyleOverride,
        growthProjection: input.currentStage?.growthProjection || null,
        lifeState: input.lifeState,
    });
};

export function runZenBonsaiRenderDebugSequence() {
    const steps = [];
    let previousSnapshot = null;

    SEQUENCE_DEFINITIONS.forEach((definition, index) => {
        const snapshot = definition.operation === 'resume_rehydrate'
            ? previousSnapshot
            : createZenBonsaiMainSceneSnapshot({
                ...definition.input,
                renderPlan: createDebugRenderPlan(definition.input),
            });
        if (!snapshot) {
            throw new Error('ZEN_BONSAI_RENDER_DEBUG_SEQUENCE_SNAPSHOT_MISSING');
        }

        const observed = compareSnapshots(previousSnapshot, snapshot);
        if (definition.operation === 'resume_rehydrate') {
            observed.branchRigRebuild = true;
        }

        const passed = hasExpectedOutcome(observed, definition.expected);
        steps.push(Object.freeze({
            id: definition.id,
            index,
            reasonId: definition.reasonId,
            operation: definition.operation || 'snapshot',
            observed: Object.freeze(observed),
            expected: definition.expected,
            passed,
            signatures: createSignatureDigest(snapshot),
        }));

        previousSnapshot = snapshot;
    });

    return Object.freeze({
        version: ZEN_BONSAI_RENDER_DEBUG_SEQUENCE_VERSION,
        staticLayerIds: STATIC_LAYER_IDS,
        summary: buildSummary(steps),
        steps: Object.freeze(steps),
    });
}

export default runZenBonsaiRenderDebugSequence;
