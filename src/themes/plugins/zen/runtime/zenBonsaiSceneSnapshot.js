import {
    resolveZenBonsaiPresentationStyle,
} from '../model/bonsai/rendering/zenBonsaiPresentationStyle.js';
import {
    buildZenBonsaiLifeSignature,
    normalizeZenBonsaiLifeState,
} from '../model/ZenBonsaiLifecycle.js';
import {
    normalizeZenBonsaiActivationPresentation,
    resolveZenBonsaiActivationBakeSignal,
} from '../model/bonsai/presentation/ZenBonsaiActivationPresentation.js';
import {
    normalizeZenHomeGardenBedProjection,
} from '../model/bonsai/rendering/zenHomeGardenBedProjectionContract.js';
import {
    resolveZenBonsaiEnvironmentBakeSignature,
    resolveZenBonsaiEnvironmentSignature,
} from './zenBonsaiEnvironmentSignatures.js';
import {
    requireZenHomeGardenBedMaterialStyle,
    resolveZenHomeGardenBedCanopyViewport,
    resolveZenHomeGardenBedDeviceMesh,
} from '../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    requireZenBonsaiInputSignature,
    requireZenBonsaiMaterializationKey,
} from './worker/zenBonsaiWorkerProtocol.js';
import {
    requireZenBonsaiRenderPlanV1,
    ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT,
} from '../model/bonsai/rendering/zenBonsaiRenderPlan.js';
import {
    resolveZenBonsaiG15TopologySignature,
} from '../model/bonsai/g15/ZenBonsaiG15RenderPlan.js';
import {resolveZenBonsaiPlumeTopologySignature} from '../model/bonsai/plume/ZenBonsaiPlumeRenderPlan.js';

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, toNumber(value, min)));
const clamp01 = (value) => clamp(value, 0, 1);

const quantizeStep = (value, step = 1, digits = 3) => {
    const numeric = Number(value);
    const safeStep = Math.max(Number(step) || 1, 1e-6);
    if (!Number.isFinite(numeric)) {
        return 'na';
    }
    return String(Number((Math.round(numeric / safeStep) * safeStep).toFixed(digits)));
};

const hashSignatureText = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const resolveLifeHealthBand = (state) => {
    const vitality = clamp01(state.vitality);
    const stress = clamp01(state.stress);
    const dryness = clamp01(state.dryness);
    const branchSag = clamp01(state.branchSag);
    const analysisConfidence = clamp01(state.analysisConfidence);
    const wither = clamp01(analysisConfidence * (
        (dryness * 0.58)
        + (stress * 0.28)
        + ((1 - vitality) * 0.18)
        + (branchSag * 0.12)
    ));

    if (dryness >= 0.58 || wither >= 0.48) {
        return 'dry';
    }
    if (stress >= 0.46 || wither >= 0.24 || vitality <= 0.46) {
        return 'strained';
    }
    if (vitality >= 0.82 && stress <= 0.22 && dryness <= 0.18) {
        return 'vivid';
    }
    return 'stable';
};

const resolveLifeBloomBand = (state) => {
    const bloom = clamp01(state.bloom);
    if (bloom < 0.16) {
        return 'bare';
    }
    if (bloom < 0.44) {
        return 'budding';
    }
    if (bloom < 0.76) {
        return 'bloom';
    }
    return 'full';
};

const resolveLifePostureBand = (state) => {
    const postureLoad = clamp01(
        (clamp01(state.branchSag) * 0.78)
        + (clamp01(state.dryness) * 0.16)
        + (clamp01(state.stress) * 0.06),
    );
    if (postureLoad >= 0.5) {
        return 'sagging';
    }
    if (postureLoad >= 0.22) {
        return 'soft';
    }
    return 'upright';
};

const resolvePotSignature = (potStyleOverride) => (
    typeof potStyleOverride === 'string' && potStyleOverride.trim()
        ? potStyleOverride.trim()
        : 'pot_auto'
);

const resolveEnvironmentRuntimeConfigSignature = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : ''
);

const resolveTerminalTopologyToken = (terminal = {}) => {
    const blossom = terminal?.blossom || {};
    const baseTokens = [
        typeof terminal?.type === 'string' ? terminal.type : 'terminal',
        typeof terminal?.color === 'string' ? terminal.color : '',
        Math.round(toNumber(terminal?.angle, 0) * 100),
        Math.round(toNumber(terminal?.dist, 0) * 10),
        Math.round(toNumber(terminal?.scale, 1) * 100),
        Number.isFinite(Number(terminal?.leafTemplateId)) ? Math.round(Number(terminal.leafTemplateId)) : '',
        typeof blossom?.bloomStage === 'string' ? blossom.bloomStage : '',
        typeof blossom?.form === 'string' ? blossom.form : '',
        typeof blossom?.silhouetteProfile === 'string' ? blossom.silhouetteProfile : '',
        Number.isFinite(Number(blossom?.layers)) ? Math.round(Number(blossom.layers)) : '',
        Number.isFinite(Number(blossom?.petalCount)) ? Math.round(Number(blossom.petalCount)) : '',
        Math.round(toNumber(blossom?.openness, 0) * 10),
        Math.round(toNumber(blossom?.petalFall, 0) * 10),
        Math.round(toNumber(blossom?.facingYaw, 0) * 4),
        Math.round(toNumber(blossom?.facingPitch, 0) * 4),
    ];
    if (Number.isFinite(Number(terminal?.attachT))) {
        baseTokens.splice(2, 0, `t${Math.round(Number(terminal.attachT) * 100)}`);
    }
    return baseTokens.join(':');
};

export const resolveZenBonsaiTopologySignature = (treeTopology) => {
    if (!treeTopology || typeof treeTopology !== 'object') {
        return 'no_topology';
    }
    if (treeTopology.isPlume === true || treeTopology.engine === 'plume') {
        return resolveZenBonsaiPlumeTopologySignature(treeTopology);
    }
    if (treeTopology.isG15 === true || treeTopology.engine === 'g15_4') {
        return resolveZenBonsaiG15TopologySignature(treeTopology);
    }

    const visited = new WeakSet();
    const queue = [{
        node: treeTopology,
        depth: 0,
        angle: toNumber(treeTopology?.initialAngle, 0),
    }];
    let branchCount = 0;
    let leafCount = 0;
    let terminalCount = 0;
    let maxDepth = 0;
    let lengthSum = 0;
    let widthSum = 0;
    const samples = [];
    let terminalHash = 2166136261;
    let queueIndex = 0;

    while (queueIndex < queue.length) {
        const current = queue[queueIndex];
        queueIndex += 1;
        const node = current?.node;
        if (!node || typeof node !== 'object' || visited.has(node)) {
            continue;
        }
        visited.add(node);

        const branches = Array.isArray(node?.branches) ? node.branches : [];
        const terminals = Array.isArray(node?.terminals) ? node.terminals : [];
        const length = toNumber(node?.length, 0);
        const width = toNumber(node?.width, 0);

        branchCount += 1;
        leafCount += branches.length ? 0 : 1;
        terminalCount += terminals.length;
        terminals.forEach((terminal, index) => {
            terminalHash = hashSignatureText([
                terminalHash,
                current?.depth,
                index,
                resolveTerminalTopologyToken(terminal),
            ].join('|'));
        });
        maxDepth = Math.max(maxDepth, Math.max(0, Math.floor(toNumber(current?.depth, 0))));
        lengthSum += length;
        widthSum += width;

        if (samples.length < 12) {
            samples.push(
                `${Math.round(length * 10)}:${Math.round(width * 10)}:${Math.round(toNumber(current?.angle, 0) * 100)}`,
            );
        }

        branches.forEach((entry) => {
            queue.push({
                node: entry?.obj || null,
                depth: toNumber(current?.depth, 0) + 1,
                angle: toNumber(entry?.angleOffset, 0),
            });
        });
    }

    return [
        branchCount,
        leafCount,
        terminalCount,
        maxDepth,
        Math.round(lengthSum * 10),
        Math.round(widthSum * 10),
        samples.join(','),
        terminalHash.toString(36),
    ].join('|');
};

export {
    resolveZenBonsaiEnvironmentBakeSignature,
    resolveZenBonsaiEnvironmentSignature,
} from './zenBonsaiEnvironmentSignatures.js';

export const buildZenBonsaiLifeAppearanceSignature = (lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return 'life:none';
    }
    const state = normalizeZenBonsaiLifeState(lifeState);
    const phase = typeof state.phase === 'string' ? state.phase : 'unknown';
    const health = resolveLifeHealthBand(state);
    const bloom = resolveLifeBloomBand(state);
    const posture = resolveLifePostureBand(state);
    return [
        'life:bake',
        phase,
        health,
        bloom,
        posture,
    ].join('|');
};

export const buildZenBonsaiActivationRuntimeSignature = (activationPresentation = null) => {
    const activation = normalizeZenBonsaiActivationPresentation(activationPresentation);
    if (!activation) {
        return '';
    }
    return [
        'activation:runtime',
        quantizeStep(activation.ratio, 0.01, 2),
        quantizeStep(activation.reliability, 0.05, 2),
    ].join('|');
};

export const buildZenBonsaiActivationBakeSignature = (activationPresentation = null) => {
    const activation = normalizeZenBonsaiActivationPresentation(activationPresentation);
    if (!activation) {
        return '';
    }
    const signal = resolveZenBonsaiActivationBakeSignal(activation);
    return [
        'activation:bake',
        activation.band,
        `cohort:${signal}`,
    ].join('|');
};

export const buildZenBonsaiLifeBackdropSignature = (lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return 'life:back:none';
    }
    const state = normalizeZenBonsaiLifeState(lifeState);
    return [
        'life:back',
        typeof state.phase === 'string' ? state.phase : 'unknown',
        resolveLifeHealthBand(state),
        resolveLifeBloomBand(state),
    ].join('|');
};

export const buildZenBonsaiLifeFrontSignature = (lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return 'life:front:none';
    }
    const state = normalizeZenBonsaiLifeState(lifeState);
    return [
        'life:front',
        typeof state.phase === 'string' ? state.phase : 'unknown',
        resolveLifeHealthBand(state),
    ].join('|');
};

const assertRenderPlanSurfaceIdentity = ({
    renderPlan,
    canvasMetrics,
    homeGardenBedProjection,
}) => {
    const surface = renderPlan.surface;
    const expectedSurface = homeGardenBedProjection
        ? renderPlan.contract === ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT
            ? resolveZenHomeGardenBedCanopyViewport(resolveZenHomeGardenBedDeviceMesh({ projection: homeGardenBedProjection }))
            : homeGardenBedProjection.sceneViewport
        : {
            width: Number(canvasMetrics.pixelWidth),
            height: Number(canvasMetrics.pixelHeight),
        };
    if (
        surface.pixelWidth !== expectedSurface.width
        || surface.pixelHeight !== expectedSurface.height
    ) {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_SURFACE_SIZE_MISMATCH');
    }
    if (
        surface.treeViewport.x !== 0
        || surface.treeViewport.y !== 0
        || surface.treeViewport.width !== expectedSurface.width
        || surface.treeViewport.height !== expectedSurface.height
    ) {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_VIEWPORT_MISMATCH');
    }
    const expectedClipTreePaint = homeGardenBedProjection !== null;
    if (surface.clipTreePaint !== expectedClipTreePaint) {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_CLIP_MISMATCH');
    }
};

export const createZenBonsaiMainSceneSnapshot = ({
    bonsaiMaterializationKey,
    inputSignature,
    treeType,
    treeSeed,
    currentPhenotype,
    currentStage,
    treeTopology,
    topologySignature: providedTopologySignature = null,
    renderPlan,
    lifeState = null,
    activationPresentation = null,
    environmentState,
    environmentSignature = resolveZenBonsaiEnvironmentSignature(environmentState),
    environmentBakeSignature = resolveZenBonsaiEnvironmentBakeSignature(environmentState),
    environmentRuntimeConfigSignature = '',
    canvasMetrics,
    cameraPreset,
    hidePot = false,
    potStyleOverride = null,
    showBackboneDebug = false,
    showBranchTierDebug = false,
    renderMode = 'full',
    mainRenderQuality = 'full',
    renderLoopMode = 'continuous',
    renderBackend = 'canvas2d',
    mainRenderVersion = 0,
    homeGardenBedProjection = null,
    gardenBedMaterialStyle = null,
    presentationStyle = null,
} = {}) => {
    if (!canvasMetrics || typeof canvasMetrics !== 'object') {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_METRICS_MISSING');
    }
    const resolvedBonsaiMaterializationKey = requireZenBonsaiMaterializationKey(
        bonsaiMaterializationKey,
    );
    const resolvedInputSignature = requireZenBonsaiInputSignature(inputSignature);

    const resolvedRenderPlan = requireZenBonsaiRenderPlanV1(renderPlan, {
        topology: treeTopology,
    });
    const trunkSandboxMode = renderMode === 'trunk_sandbox';
    const topologySignature = providedTopologySignature === null
        ? resolveZenBonsaiTopologySignature(treeTopology)
        : providedTopologySignature;
    if (typeof topologySignature !== 'string' || !topologySignature) {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_TOPOLOGY_SIGNATURE_REQUIRED');
    }
    if (resolvedRenderPlan.source.topologySignature !== topologySignature) {
        throw new Error('ZEN_BONSAI_MAIN_SCENE_RENDER_PLAN_TOPOLOGY_MISMATCH');
    }
    const hasLifeState = Boolean(lifeState && typeof lifeState === 'object');
    const normalizedLifeState = hasLifeState ? normalizeZenBonsaiLifeState(lifeState) : null;
    const normalizedActivationPresentation = normalizeZenBonsaiActivationPresentation(
        activationPresentation,
    );
    const normalizedPresentationStyle = resolveZenBonsaiPresentationStyle(
        presentationStyle,
    ).id;
    const normalizedHomeGardenBedProjection = homeGardenBedProjection === null
        ? null
        : normalizeZenHomeGardenBedProjection(homeGardenBedProjection);
    const normalizedGardenBedMaterialStyle = gardenBedMaterialStyle === null
        ? null
        : requireZenHomeGardenBedMaterialStyle(gardenBedMaterialStyle);
    if (
        normalizedHomeGardenBedProjection
        && (
            normalizedHomeGardenBedProjection.surfaceSize.width
                !== Number(canvasMetrics.pixelWidth)
            || normalizedHomeGardenBedProjection.surfaceSize.height
                !== Number(canvasMetrics.pixelHeight)
        )
    ) {
        throw new Error('ZEN_HOME_GARDEN_BED_PROJECTION_CANVAS_SIZE_MISMATCH');
    }
    assertRenderPlanSurfaceIdentity({
        renderPlan: resolvedRenderPlan,
        canvasMetrics,
        homeGardenBedProjection: normalizedHomeGardenBedProjection,
    });
    const lifeSignature = hasLifeState ? buildZenBonsaiLifeSignature(normalizedLifeState) : 'life:none';
    const lifeAppearanceSignature = hasLifeState
        ? buildZenBonsaiLifeAppearanceSignature(normalizedLifeState)
        : 'life:none';
    const lifeBackdropSignature = hasLifeState
        ? buildZenBonsaiLifeBackdropSignature(normalizedLifeState)
        : 'life:back:none';
    const lifeFrontSignature = hasLifeState
        ? buildZenBonsaiLifeFrontSignature(normalizedLifeState)
        : 'life:front:none';
    const activationRuntimeSignature = buildZenBonsaiActivationRuntimeSignature(
        normalizedActivationPresentation,
    );
    const activationBakeSignature = buildZenBonsaiActivationBakeSignature(
        normalizedActivationPresentation,
    );
    const sharedLayoutSignature = `${treeType}_${treeSeed}_${JSON.stringify(currentPhenotype)}_${JSON.stringify(currentStage)}_${topologySignature}`;
    const gardenBedProjectionSignature = normalizedHomeGardenBedProjection
        ? `_${JSON.stringify(normalizedHomeGardenBedProjection)}`
        : '';
    const canvasSignature = `${canvasMetrics.pixelWidth}_${canvasMetrics.pixelHeight}_${canvasMetrics.pixelRatio}_${cameraPreset}${gardenBedProjectionSignature}`;
    const gardenBedMaterialSignature = normalizedGardenBedMaterialStyle === null
        ? ''
        : `_garden_bed_material:${normalizedGardenBedMaterialStyle}`;
    const potSignature = `${hidePot ? 'pot_off' : 'pot_on'}_${resolvePotSignature(potStyleOverride)}${gardenBedMaterialSignature}`;
    const presentationStyleSignature = `style:${normalizedPresentationStyle}`;
    const modeQualitySignature = `${trunkSandboxMode ? 'trunk_sandbox' : 'full'}_${mainRenderQuality}_${mainRenderVersion}`;
    const debugSignature = `${showBackboneDebug ? 'spine_debug_on' : 'spine_debug_off'}_${showBranchTierDebug ? 'tier_debug_on' : 'tier_debug_off'}`;
    const runtimeConfigSignature = resolveEnvironmentRuntimeConfigSignature(environmentRuntimeConfigSignature);
    const sceneEnvironmentSignature = runtimeConfigSignature
        ? `${environmentSignature}_${runtimeConfigSignature}`
        : environmentSignature;
    const backLayerSignature = `${sharedLayoutSignature}_${lifeBackdropSignature}_${environmentBakeSignature}_${canvasSignature}_${potSignature}_${presentationStyleSignature}_${trunkSandboxMode ? 'trunk_sandbox' : 'full'}_${mainRenderQuality}_${mainRenderVersion}`;
    const frontLayerSignature = `${sharedLayoutSignature}_${lifeFrontSignature}_${environmentBakeSignature}_${canvasSignature}_${potSignature}_${presentationStyleSignature}_${showBackboneDebug ? 'spine_debug_on' : 'spine_debug_off'}_${modeQualitySignature}`;
    const staticLayerSignatures = Object.freeze({
        back: backLayerSignature,
        front: frontLayerSignature,
    });
    const sceneSignature = [
        sharedLayoutSignature,
        lifeAppearanceSignature,
        activationRuntimeSignature,
        activationBakeSignature,
        sceneEnvironmentSignature,
        environmentBakeSignature,
        canvasSignature,
        potSignature,
        presentationStyleSignature,
        debugSignature,
        modeQualitySignature,
        renderLoopMode,
        renderBackend,
        `render-plan:${resolvedRenderPlan.signature}`,
        `materialization:${resolvedBonsaiMaterializationKey}`,
    ].filter(Boolean).join('_');
    const branchRigSignature = [
        sharedLayoutSignature,
        lifeAppearanceSignature,
        activationBakeSignature,
        `render-plan-bake:${resolvedRenderPlan.bakeSignature}`,
        presentationStyleSignature,
        showBranchTierDebug ? 'tier_debug_on' : 'tier_debug_off',
        modeQualitySignature,
    ].filter(Boolean).join('_');

    return {
        bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
        inputSignature: resolvedInputSignature,
        sceneSignature,
        topologySignature,
        renderPlanSignature: resolvedRenderPlan.signature,
        renderPlanBakeSignature: resolvedRenderPlan.bakeSignature,
        staticLayerSignatures,
        branchRigSignature,
        lifeSignature,
        lifeAppearanceSignature,
        lifeBackdropSignature,
        lifeFrontSignature,
        activationRuntimeSignature,
        activationBakeSignature,
        environmentSignature,
        environmentBakeSignature,
        renderOptions: {
            skipPot: hidePot,
            potStyleOverride,
            showBackboneDebug,
            showBranchTierDebug,
            backboneDebugCompact: false,
            renderMode,
            qualityMode: mainRenderQuality,
            environmentState,
            environmentRuntimeConfigSignature: runtimeConfigSignature,
            lifeState: normalizedLifeState,
            activationPresentation: normalizedActivationPresentation,
            growthProjection: currentStage?.growthProjection || null,
            homeGardenBedProjection: normalizedHomeGardenBedProjection,
            gardenBedMaterialStyle: normalizedGardenBedMaterialStyle,
            presentationStyle: normalizedPresentationStyle,
        },
    };
};
