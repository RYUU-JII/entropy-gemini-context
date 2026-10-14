import {
    ZenBonsaiScene,
} from './render-runtime.js';
import { resolveZenG15SceneClock } from './ZenBonsaiG15DevelopmentClock.js';

export function buildG15Scene({
    g15Topology,
    width = 900,
    height = 900,
    options = {},
} = {}) {
    if (!g15Topology?.graph) {
        throw new Error('ZEN_G15_TOPOLOGY_GRAPH_REQUIRED');
    }

    const { graph, sceneConfig } = g15Topology;
    const developmentClock = resolveZenG15SceneClock(
        sceneConfig.eventResolution, graph.events.length, options.subEventProgress,
    );
    const presentationParams = sceneConfig?.presentationParams ?? {};
    if (!Number.isFinite(presentationParams.dryness)
        || presentationParams.dryness < 0 || presentationParams.dryness > 1) {
        throw new Error('ZEN_G15_PRESENTATION_DRYNESS_REQUIRED');
    }
    // The product life-state adapter reports maturity and vitality tier on the
    // normalized life state it resolved; there is no flattened copy beside it.
    const lifeState = sceneConfig?.lifeState ?? null;

    const sceneOptions = {
        width,
        height,
        mode: options.mode || 'natural',
        showWoodPresentation: options.showWoodPresentation !== false,
        showSakuraFlowering: options.showSakuraFlowering !== false,
        showNebari: options.showNebari !== false,
        showCanopyTwigVolume: true,
        growth: lifeState?.growth ?? 1.0,
        vitality: lifeState?.vitalityTier ?? 'steady',
        bloomProgress: presentationParams.bloomProgress ?? 0.84,
        bloomStage: presentationParams.bloomStage || options.bloomStage || 'full',
        floweringLoad: presentationParams.floweringLoad !== undefined
            ? presentationParams.floweringLoad
            : (options.floweringLoad ?? 1.2),
        branchSag: presentationParams.branchSag ?? 0,
        dryness: presentationParams.dryness,
        ...options,
        // The materialized product clock is authoritative even in debug views.
        eventLimit: developmentClock.eventLimit,
        developmentClock,
    };

    return ZenBonsaiScene.buildSceneCommands(graph, sceneOptions);
}

export default buildG15Scene;
