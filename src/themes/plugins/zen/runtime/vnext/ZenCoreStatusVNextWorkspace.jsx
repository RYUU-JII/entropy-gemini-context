import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation';
import ZenModelRepository from '@/themes/plugins/zen/state/ZenModelRepository.js';
import {
    readZenClassicExperimentalPotStyle,
    writeZenClassicExperimentalPotStyle,
    ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE,
} from '@/themes/plugins/zen/state/ZenWorkspaceState.js';
import { createZenThemeModelRuntime } from '../createZenThemeModelRuntime.js';
import {
    createVNextFeedbackStore,
    createVNextPreferenceModelStore,
    normalizeFactorVectorV2,
    runZenBonsaiEngineVNextWithAnalysis,
} from '../../model/vnext/index.js';
import { useZenLabTreeRenderer } from '../useZenLabTreeRenderer.js';
import {
    ZEN_BONSAI_MAIN_RENDER_OWNERS,
} from '../zenBonsaiMainRendererOwnership.js';
import { useZenVNextPersistentState } from './useZenVNextPersistentState.js';
import { useZenVNextLoopState } from './useZenVNextLoopState.js';
import { useZenVNextCompareController } from './useZenVNextCompareController.js';
import { useZenVNextPreferenceTraining } from './useZenVNextPreferenceTraining.js';
import { ZenVNextCompareStage } from '../../widgets/core/components/ZenVNextCompareStage';
import { ZenInlineErrorBanner } from '../../widgets/core/components/ZenInlineErrorBanner';
import { ZenVNextPreviewStage } from '../../widgets/core/components/ZenVNextPreviewStage';
import { ZenVNextSidebarContent } from '../../widgets/core/components/ZenVNextSidebarContent';
import { STAGES, createAssetCache, resolveSpecies, TOPOLOGY_REFERENCE_HEIGHT, ZEN_ASSET_CACHE_VERSION } from '../../model/ZenCoreConfig';
import { ZenVNextOptimizerWorkerClient } from '../../model/vnext/ZenVNextOptimizerWorkerClient';
import { ZenVNextPreferenceTrainerWorkerClient } from '../../model/vnext/ZenVNextPreferenceTrainerWorkerClient';
import { deriveZenBonsaiPondBioticSignalFromAnalysis } from '../../model/zenBonsaiPondBioticSignal.js';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
} from '../../model/bonsai/evaluation/bonsaiCandidateEvaluationProfile.js';
import { useZenBonsaiSceneStore } from '../../pond/state/stores/useZenBonsaiSceneStore.js';

const DEFAULT_CONSTRAINTS = Object.freeze({
    maxNodes: 240,
    maxSteps: 50,
    maxDepth: 10,
    bounds: {
        width: 420,
        height: 420,
        depth: 420,
    },
});

const DEFAULT_OPTIONS = Object.freeze({
    traceLevel: 'compact',
    maxProvenanceEvents: 1024,
});

const FACTOR_SLIDERS = Object.freeze([
    { key: 'trunk_division', label: 'Secondary Trunk', hint: 'Single leader vs twin-trunk tendency' },
    { key: 'trunk_lean', label: 'Trunk Lean', hint: 'Overall axis tilt across the whole tree' },
    { key: 'trunk_movement', label: 'Trunk Movement', hint: 'How much the backbone redirects and turns' },
    { key: 'trunk_primary_sweep', label: 'Primary Sweep', hint: 'Dominant lateral sweep target along the backbone' },
    { key: 'trunk_counter_sweep', label: 'Counter Sweep', hint: 'Return motion that balances the main sweep' },
    { key: 'trunk_apex_reach', label: 'Apex Reach', hint: 'How far the apex target is allowed to drift laterally' },
    { key: 'trunk_void_respect', label: 'Void Respect', hint: 'How strongly the trunk preserves a negative-space corridor' },
    { key: 'trunk_taper', label: 'Trunk Taper', hint: 'Base-to-tip thickness compression' },
    { key: 'trunk_height', label: 'Trunk Height', hint: 'Vertical reach before crown mass builds' },
    { key: 'first_branch_height', label: 'First Branch Height', hint: 'How low the first scaffold emerges' },
    { key: 'apex_softness', label: 'Apex Softness', hint: 'Sharp crown finish vs softer terminal rise' },
    { key: 'branch_density', label: 'Branch Density', hint: 'How many scaffold and twig decisions survive' },
    { key: 'branch_spread', label: 'Branch Spread', hint: 'Lateral silhouette width and extension' },
    { key: 'lineage_sweep_persistence', label: 'Sweep Persistence', hint: 'How long scaffold branches keep a sweeping gesture before settling' },
    { key: 'lineage_recovery_bias', label: 'Recovery Bias', hint: 'How strongly branches recover inward and upward after a sweep' },
    { key: 'pad_compactness', label: 'Pad Compactness', hint: 'How tightly each scaffold root compresses into a foliage pad' },
    { key: 'pad_terminal_density', label: 'Pad Terminal Density', hint: 'How flower- and spur-heavy each pad becomes near its edge' },
    { key: 'pad_sweep_bias', label: 'Pad Sweep Bias', hint: 'How much pad growth prefers long lateral sweeps over neutral extension' },
    { key: 'ramification', label: 'Ramification', hint: 'Twig subdivision and fine branching texture' },
    { key: 'crown_openness', label: 'Crown Openness', hint: 'Visible air pockets through the canopy' },
    { key: 'droop_bias', label: 'Droop Bias', hint: 'Downward pull in branches and terminals' },
    { key: 'blossom_bias', label: 'Blossom Bias', hint: 'Flower-forward terminal emphasis' },
]);
const BASIC_FACTOR_KEYS = new Set([
    'trunk_division',
    'trunk_movement',
    'trunk_height',
    'first_branch_height',
    'branch_density',
    'branch_spread',
    'crown_openness',
    'blossom_bias',
]);
const BASIC_FACTOR_SLIDERS = FACTOR_SLIDERS.filter((item) => BASIC_FACTOR_KEYS.has(item.key));
const ADVANCED_FACTOR_SLIDERS = FACTOR_SLIDERS.filter((item) => !BASIC_FACTOR_KEYS.has(item.key));
const FACTOR_LABEL_BY_KEY = Object.freeze(
    FACTOR_SLIDERS.reduce((acc, item) => {
        acc[item.key] = item.label;
        return acc;
    }, {}),
);
const SECTION_TABS = Object.freeze([
    { key: 'preview', label: 'Preview', description: '현재 결과와 비교 상태' },
    { key: 'shape', label: 'Core Shape', description: '핵심 형태 축 조절' },
    { key: 'learning', label: 'Learning', description: 'A/B 학습과 자동 비교' },
    { key: 'debug', label: 'Debug', description: '세부 팩터와 루프 도구' },
]);
const SURFACE_CARD_CLASS = 'rounded-[20px] border border-[#E6DCC9] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,241,231,0.94))] shadow-[0_14px_36px_rgba(99,76,44,0.06)]';
const COOL_SURFACE_CARD_CLASS = 'rounded-[20px] border border-[#D7E7F0] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,248,251,0.94))] shadow-[0_16px_40px_rgba(39,80,106,0.08)]';
const DEFAULT_AB_CANVAS_WIDTH = 320;
const DEFAULT_AB_CANVAS_HEIGHT = 252;
const EXPERIMENTAL_POT_STYLE_OPTIONS = Object.freeze([
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE,
        labelKey: 'core_status.experimental_pot_style_shallow_warm_stone',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_IRON_ASH,
        labelKey: 'core_status.experimental_pot_style_shallow_iron_ash',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.OVAL_TOKONAME_CLAY,
        labelKey: 'core_status.experimental_pot_style_oval_tokoname_clay',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.OVAL_MOSS_GRAY,
        labelKey: 'core_status.experimental_pot_style_oval_moss_gray',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.RECT_RIVER_STONE,
        labelKey: 'core_status.experimental_pot_style_rect_river_stone',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.OVAL_CELADON,
        labelKey: 'core_status.experimental_pot_style_oval_celadon',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.OVAL_INKSTONE,
        labelKey: 'core_status.experimental_pot_style_oval_inkstone',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.RECT_SANDSTONE,
        labelKey: 'core_status.experimental_pot_style_rect_sandstone',
    },
    {
        id: ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SLIM_OVAL_PORCELAIN,
        labelKey: 'core_status.experimental_pot_style_slim_oval_porcelain',
    },
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const formatFactorValue = (slider, value) => (slider?.integer ? String(Math.round(value)) : value.toFixed(2));
export default function ZenCoreStatusVNextWorkspace({ experimental = false, solarLocationProfile = null }) {
    const { t } = useAppTranslation('main');
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const compareCanvasARef = useRef(null);
    const compareCanvasBRef = useRef(null);

    // ZenTreeRenderer additional refs and state for main
    const frameIdRef = useRef(null);
    const staticCacheRef = useRef(null);
    const treeCacheRef = useRef(null);
    const lastCacheKeyRef = useRef('');

    // ZenTreeRenderer additional refs and state for A/B
    const abFrameIdRef = useRef(null);
    const abStaticCacheRef = useRef(null);
    const abTreeCacheRef = useRef(null);
    const abLastCacheKeyRef = useRef('');

    // Core state
    const { width, height, targetRef: containerTargetRef } = useResizeObserver(containerRef);
    const {
        width: observedAbWidthA,
        height: observedAbHeightA,
        targetRef: compareCanvasATargetRef,
    } = useResizeObserver(compareCanvasARef);
    const {
        width: observedAbWidthB,
        height: observedAbHeightB,
        targetRef: compareCanvasBTargetRef,
    } = useResizeObserver(compareCanvasBRef);
    const renderWidth = Math.max(1, Math.floor(width || 420));
    const renderHeight = Math.max(1, Math.floor(height || 420));
    const abWidthA = Math.max(1, Math.floor(observedAbWidthA || DEFAULT_AB_CANVAS_WIDTH));
    const abHeightA = Math.max(1, Math.floor(observedAbHeightA || DEFAULT_AB_CANVAS_HEIGHT));
    const abWidthB = Math.max(1, Math.floor(observedAbWidthB || DEFAULT_AB_CANVAS_WIDTH));
    const abHeightB = Math.max(1, Math.floor(observedAbHeightB || DEFAULT_AB_CANVAS_HEIGHT));

    const {
        seed,
        setSeed,
        factors,
        setFactors,
        reliabilityHint,
        setReliabilityHint,
        autoCompareMaxRounds,
        setAutoCompareMaxRounds,
        autoCompareStopReliability,
        setAutoCompareStopReliability,
        activeSection,
        setActiveSection,
    } = useZenVNextPersistentState({ sectionTabs: SECTION_TABS });
    const [result, setResult] = useState(null);
    const [latestOptimization, setLatestOptimization] = useState(null);
    const [abTrialCount, setAbTrialCount] = useState(0);
    const [reliabilityState, setReliabilityState] = useState(null);
    const [comparePair, setComparePair] = useState(null);
    const [preferenceModel, setPreferenceModel] = useState(null);
    const [showExtensions, setShowExtensions] = useState(false);
    const [errorState, setErrorState] = useState(null);
    const [loopActionMessage, setLoopActionMessage] = useState('');
    const [experimentalPotStyle, setExperimentalPotStyle] = useState(() => (
        readZenClassicExperimentalPotStyle(ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE)
    ));
    const publishPondBioticSignal = useZenBonsaiSceneStore((state) => state.publishPondBioticSignal);

    const zenThemeModelRuntime = useMemo(() => createZenThemeModelRuntime({
        modelStateStore: ZenModelRepository.getInstance(),
    }), []);
    const { zenThemeModelState } = zenThemeModelRuntime;
    const workerClient = useMemo(() => new ZenVNextOptimizerWorkerClient({ enabled: true }), []);
    const trainerWorkerClient = useMemo(() => new ZenVNextPreferenceTrainerWorkerClient({ enabled: true }), []);
    const feedbackStore = useMemo(() => createVNextFeedbackStore({
        zenThemeModelState,
    }), [zenThemeModelState]);
    const preferenceModelStore = useMemo(() => createVNextPreferenceModelStore({
        zenThemeModelState,
    }), [zenThemeModelState]);
    const species = useMemo(() => resolveSpecies('sakura'), []);
    const assetCache = useMemo(() => createAssetCache(), [ZEN_ASSET_CACHE_VERSION]);
    // We force the standard healthy/bloom stage for evaluation.
    const evaluationStage = useMemo(() => ({
        ...STAGES.BLOOM,
        depth: 6,
        learningProgress: 1,
    }), []);

    useEffect(() => () => {
        workerClient.dispose('ZEN_VNEXT_WORKSPACE_UNMOUNT');
    }, [workerClient]);

    useEffect(() => () => {
        trainerWorkerClient.dispose('ZEN_VNEXT_PREFERENCE_WORKSPACE_UNMOUNT');
    }, [trainerWorkerClient]);

    const runGeneration = useCallback((nextSeed, nextFactors) => {
        const output = runZenBonsaiEngineVNextWithAnalysis({
            seed: nextSeed,
            factors: nextFactors,
            constraints: DEFAULT_CONSTRAINTS,
            options: DEFAULT_OPTIONS,
        });
        setResult(output);
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            runGeneration(seed, factors);
        }, 80);
        return () => window.clearTimeout(handle);
    }, [seed, factors, runGeneration]);

    useEffect(() => {
        const signal = deriveZenBonsaiPondBioticSignalFromAnalysis({
            analysis: result?.analysis,
            source: 'zen_vnext_workspace',
            engine: 'vnext',
            stageId: 'bloom',
            seasonSpanDays: 7,
        });
        if (signal) {
            publishPondBioticSignal(signal);
        }
    }, [publishPondBioticSignal, result?.analysis]);

    useEffect(() => {
        if (comparePair) {
            setActiveSection('preview');
            setShowExtensions(false);
        }
    }, [comparePair, setActiveSection]);

    useEffect(() => {
        writeZenClassicExperimentalPotStyle(experimentalPotStyle);
    }, [experimentalPotStyle]);

    const vnextRendererInputSignature = useMemo(() => (
        `zen_bonsai_vnext_renderer_input_v1:${JSON.stringify({
            seed,
            factors: Object.fromEntries(
                Object.entries(factors || {}).sort(([left], [right]) => left.localeCompare(right)),
            ),
        })}`
    ), [factors, seed]);
    const vnextBonsaiMaterializationKey = useMemo(() => {
        if (!result?.treeTopology) return null;
        return `zen_bonsai_vnext_materialization_v1:${JSON.stringify({
            inputSignature: vnextRendererInputSignature,
            stepCount: Number(result?.diagnostics?.stepCount) || 0,
            nodeCount: Number(result?.features?.nodeCount) || 0,
        })}`;
    }, [
        result?.diagnostics?.stepCount,
        result?.features?.nodeCount,
        result?.treeTopology,
        vnextRendererInputSignature,
    ]);

    // Connect the main Renderer hook
    useZenLabTreeRenderer({
        mainRendererOwner: ZEN_BONSAI_MAIN_RENDER_OWNERS.LAB_PREVIEW,
        bonsaiMaterializationKey: vnextBonsaiMaterializationKey,
        inputSignature: vnextRendererInputSignature,
        canvasRef,
        width: renderWidth,
        height: renderHeight,
        frameIdRef,
        staticCacheRef,
        treeCacheRef,
        lastCacheKeyRef,
        treeType: 'sakura',
        treeSeed: seed,
        currentPhenotype: null, // Replaced by topology directly
        currentStage: evaluationStage,
        treeTopology: result?.treeTopology,
        species,
        assetCache,
        mainTargetFps: 60,
        isCollectionMode: Boolean(comparePair),
        abPair: null,
        abCanvasRefA: null,
        abCanvasRefB: null,
        abWidthA: 0,
        abHeightA: 0,
        abWidthB: 0,
        abHeightB: 0,
        minABRenderSize: 8,
        mainRenderVersion: Number(result?.diagnostics?.stepCount || 0) + Number(result?.features?.nodeCount || 0),
        abRenderVersion: 0,
        onRenderDebugEvent: null,
        potStyleOverride: experimental ? experimentalPotStyle : null,
        solarLocationProfile,
        enableMainRender: vnextBonsaiMaterializationKey !== null,
    });

    // Helper to dummy-wrap AB output for the renderer hook
    const dummyAbPairForRender = useMemo(() => {
        if (!comparePair?.outputA?.treeTopology || !comparePair?.outputB?.treeTopology) {
            return null;
        }
        return {
            A: {
                id: 'A',
                seed: comparePair?.candidateA?.seed ?? seed,
                topology: comparePair.outputA.treeTopology,
                phenotype: null,
                render: {
                    evaluationProfile: BONSAI_CANDIDATE_EVALUATION_PROFILE.MATERIALIZED_TOPOLOGY_PROJECTION,
                },
            },
            B: {
                id: 'B',
                seed: comparePair?.candidateB?.seed ?? seed,
                topology: comparePair.outputB.treeTopology,
                phenotype: null,
                render: {
                    evaluationProfile: BONSAI_CANDIDATE_EVALUATION_PROFILE.MATERIALIZED_TOPOLOGY_PROJECTION,
                },
            },
        };
    }, [comparePair, seed]);

    // Connect the A/B renderer hook
    useZenLabTreeRenderer({
        mainRendererOwner: ZEN_BONSAI_MAIN_RENDER_OWNERS.LAB_PREVIEW,
        canvasRef: null,
        width: 0,
        height: 0,
        frameIdRef: abFrameIdRef,
        staticCacheRef: abStaticCacheRef,
        treeCacheRef: abTreeCacheRef,
        lastCacheKeyRef: abLastCacheKeyRef,
        treeType: 'sakura',
        treeSeed: seed,
        currentPhenotype: null,
        currentStage: evaluationStage,
        treeTopology: null,
        species,
        assetCache,
        mainTargetFps: 60,
        isCollectionMode: true, // Crucial to enable A/B rendering logic in hook
        abPair: dummyAbPairForRender,
        abCanvasRefA: compareCanvasARef,
        abCanvasRefB: compareCanvasBRef,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        minABRenderSize: 8,
        mainRenderVersion: 0,
        abRenderVersion: Number(comparePair?.meta?.createdAt || 0),
        onRenderDebugEvent: null,
        potStyleOverride: experimental ? experimentalPotStyle : null,
        solarLocationProfile,
    });



    const handleSliderChange = (slider, value) => {
        const min = Number.isFinite(Number(slider?.min)) ? Number(slider.min) : 0;
        const max = Number.isFinite(Number(slider?.max)) ? Number(slider.max) : 1;
        const numericRaw = toNumber(value, min);
        const numeric = clamp(numericRaw, min, max);
        const normalized = slider?.integer ? Math.round(numeric) : numeric;
        setFactors((prev) => normalizeFactorVectorV2({
            ...prev,
            [slider.key]: normalized,
        }));
    };

    const renderFactorSlider = useCallback((slider) => {
        const min = Number.isFinite(Number(slider?.min)) ? Number(slider.min) : 0;
        const max = Number.isFinite(Number(slider?.max)) ? Number(slider.max) : 1;
        const value = clamp(toNumber(factors?.[slider.key], min), min, max);
        const fillPercent = max > min ? ((value - min) / (max - min)) * 100 : 0;
        return (
            <label
                key={slider.key}
                className={`${SURFACE_CARD_CLASS} flex flex-col gap-1.5 px-2.5 py-2.5 text-stone-700`}
            >
                <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                        <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-stone-700">{slider.label}</span>
                        {slider.hint && (
                            <span className="mt-1 block text-[8px] font-semibold normal-case tracking-normal leading-4 text-stone-500">
                                {slider.hint}
                            </span>
                        )}
                    </span>
                    <span className="shrink-0 rounded-full border border-[#E3D6C0] bg-white px-1.5 py-0.5 font-mono text-[7px] text-stone-600">
                        {formatFactorValue(slider, value)}
                    </span>
                </span>
                <span className="relative h-1.5 overflow-hidden rounded-full bg-[#E9E0CF]">
                    <span
                        className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#27506A,#8BAF8C)]"
                        style={{ width: `${clamp(fillPercent, 0, 100)}%` }}
                    />
                </span>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={slider?.step || 0.01}
                    value={value}
                    onChange={(event) => handleSliderChange(slider, event.target.value)}
                    className="h-1.5 w-full accent-[#27506A]"
                />
            </label>
        );
    }, [factors]);

    const resolvePreferenceProfile = useCallback(() => ({
        factors: {
            ...factors,
        },
        style: {
            nodeCount: Number(result?.features?.nodeCount || 92),
            deadwoodRatio: clamp01(Number(result?.features?.deadwoodRatio || 0.08)),
        },
        weights: {
            crown_openness: 1.5,
            blossom_bias: 1.4,
            trunk_movement: 1.22,
            trunk_primary_sweep: 1.12,
            trunk_counter_sweep: 1.06,
            trunk_apex_reach: 1.08,
            trunk_void_respect: 1.1,
            branch_spread: 1.2,
            lineage_sweep_persistence: 1.1,
            lineage_recovery_bias: 1.08,
            ramification: 1.16,
        },
    }), [factors, result]);
    const {
        isTrainingPreference,
        trainPreferenceModel,
    } = useZenVNextPreferenceTraining({
        feedbackStore,
        preferenceModelStore,
        trainerWorkerClient,
        preferenceModel,
        abTrialCount,
        setAbTrialCount,
        setReliabilityState,
        setReliabilityHint,
        setPreferenceModel,
    });

    const {
        isPreparingCompare,
        isSubmittingCompare,
        isOptimizing,
        optimizeProgress,
        isAutoCompareRunning,
        autoCompareEpisodeId,
        autoCompareRound,
        autoCompareCompleted,
        handleOptimize,
        handlePrepareCompare,
        handleStartAutoCompare,
        handleStopAutoCompare,
        handleDismissCompare,
        handleChooseCompare,
    } = useZenVNextCompareController({
        seed,
        factors,
        reliabilityHint,
        preferenceModel,
        autoCompareMaxRounds,
        setAutoCompareMaxRounds,
        autoCompareStopReliability,
        comparePair,
        setComparePair,
        setSeed,
        setFactors,
        setReliabilityHint,
        setLatestOptimization,
        setAbTrialCount,
        setReliabilityState,
        setErrorState,
        setLoopActionMessage,
        workerClient,
        feedbackStore,
        resolvePreferenceProfile,
        trainPreferenceModel,
        constraints: DEFAULT_CONSTRAINTS,
        options: DEFAULT_OPTIONS,
    });
    const {
        loopPayloadText,
        setLoopPayloadText,
        isMaintainingLoop,
        handleResetPreferenceModel,
        handleClearFeedbackTrials,
        handleExportLoopState,
        handleImportLoopState,
        handleRefreshLoopState,
    } = useZenVNextLoopState({
        feedbackStore,
        preferenceModelStore,
        isAutoCompareRunning,
        loopActionMessage,
        setLoopActionMessage,
        seed,
        factors,
        reliabilityHint,
        setSeed,
        setFactors,
        setReliabilityHint,
        setAbTrialCount,
        setReliabilityState,
        setPreferenceModel,
        setComparePair,
        setLatestOptimization,
        setErrorState,
    });

    const handleReRoll = () => {
        if (isAutoCompareRunning) {
            return;
        }
        setErrorState(null);
        setComparePair(null);
        setSeed(Math.floor(Math.random() * 1000000));
    };

    const cards = [
        { label: 'Nodes', value: Number(result?.features?.nodeCount || 0) },
        { label: 'Steps', value: Number(result?.diagnostics?.stepCount || 0) },
        { label: 'Deadwood', value: `${Math.round(clamp01(Number(result?.features?.deadwoodRatio || 0)) * 100)}%` },
        { label: 'A/B Trials', value: abTrialCount },
        {
            label: 'Model',
            value: preferenceModel
                ? `${Math.max(0, Math.floor(Number(preferenceModel?.sampleCount || 0)))} @ ${(clamp01(Number(preferenceModel?.metrics?.accuracy || 0)) * 100).toFixed(0)}%`
                : 'Not trained',
        },
        { label: 'Reliability', value: `${Math.round(clamp01(reliabilityHint) * 100)}%` },
    ];
    const phaseSelectionCounts = result?.diagnostics?.phaseSelectionCounts || {};
    const phaseStats = [
        { key: 'trunk', label: 'Trunk' },
        { key: 'scaffold', label: 'Scaffold' },
        { key: 'twig', label: 'Twig' },
    ].map((item) => ({
        ...item,
        count: Math.max(0, Math.floor(Number(phaseSelectionCounts?.[item.key] || 0))),
    }));
    const phaseTotalSelections = phaseStats.reduce((acc, entry) => acc + entry.count, 0);
    const styleProfile = result?.diagnostics?.styleProfile || null;
    const inspectorReliability = reliabilityState || {
        sampleCount: abTrialCount,
        pairCount: 0,
        repeatPairCount: 0,
        consistency: reliabilityHint,
        freshness: 0,
        updatedAt: 0,
    };
    const latestGeneration = Array.isArray(latestOptimization?.generationLog)
        && latestOptimization.generationLog.length
        ? latestOptimization.generationLog[latestOptimization.generationLog.length - 1]
        : null;
    const activeSectionMeta = SECTION_TABS.find((entry) => entry.key === activeSection);
    if (!activeSectionMeta) {
        const error = new Error(
            `Zen VNext active section '${activeSection}' is not declared by SECTION_TABS.`,
        );
        error.code = 'ZEN_VNEXT_ACTIVE_SECTION_UNRESOLVED';
        throw error;
    }
    const compareDeltaHighlights = comparePair
        ? Object.keys(FACTOR_LABEL_BY_KEY)
            .map((key) => {
                const delta = toNumber(comparePair?.candidateB?.factors?.[key], 0) - toNumber(comparePair?.candidateA?.factors?.[key], 0);
                return {
                    key,
                    label: FACTOR_LABEL_BY_KEY[key] || key,
                    delta,
                };
            })
            .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
            .slice(0, 3)
        : [];

    return (
        <div className={`h-full w-full overflow-hidden flex flex-col font-sans ${experimental ? 'rounded-[40px] border border-[#E8DEC9] bg-[linear-gradient(180deg,#fdfbf7_0%,#f5efe3_100%)] p-2.5 sm:p-3 gap-3' : 'rounded-[28px] bg-[linear-gradient(180deg,#fdfbf7_0%,#f5efe3_100%)]'}`}>
            <div className="shrink-0 overflow-hidden rounded-[28px] border border-[#E8DEC9] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(248,243,235,0.96)_52%,rgba(239,230,212,0.96))] p-3 shadow-[0_20px_60px_rgba(99,76,44,0.08)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[#D7EBD0] bg-[#F3FAEF] px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-[#2D4F1E]">
                            {t('core_status.vnext_isolated') || 'vNext Isolated'}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-white/80 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-stone-700">
                            Seed {seed}
                        </span>
                        {comparePair && (
                            <span className="rounded-full border border-[#D5E1E9] bg-[#F8FBFD] px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-[#27506A]">
                                Compare Active
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleReRoll}
                            disabled={isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning}
                            className="h-9 rounded-xl border border-[#E3D6C0] bg-white/85 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-stone-700 shadow-[0_10px_28px_rgba(99,76,44,0.06)] transition hover:bg-white"
                        >
                            Re-roll
                        </button>
                        <button
                            type="button"
                            onClick={handlePrepareCompare}
                            disabled={isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning}
                            className={`h-9 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(39,80,106,0.12)] transition ${isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning
                                ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                                : 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                                }`}
                        >
                            {isPreparingCompare ? 'Preparing...' : 'Compare A/B'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowExtensions((prev) => !prev)}
                            className={`h-9 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(99,76,44,0.08)] transition ${showExtensions
                                ? 'border-[#27506A] bg-[#27506A] text-white hover:bg-[#1D3F53]'
                                : 'border-[#E3D6C0] bg-white/85 text-stone-700 hover:bg-white'
                                }`}
                        >
                            {showExtensions ? 'Hide Extensions' : 'Show Extensions'}
                        </button>
                    </div>
                </div>
                <ZenInlineErrorBanner errorState={errorState} />
                {experimental && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[20px] border border-[#EAE8E3] bg-white/92 px-3 py-2">
                        <div className="min-w-0 pr-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-600">
                                {t('core_status.experimental_pot_style_label')}
                            </p>
                            <p className="mt-0.5 text-[11px] text-stone-500">
                                {t('core_status.experimental_pot_style_hint')}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {EXPERIMENTAL_POT_STYLE_OPTIONS.map((option) => {
                                const isActive = experimentalPotStyle === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setExperimentalPotStyle(option.id)}
                                        className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${isActive
                                            ? 'border-[#2E5B4F] bg-[#2E5B4F] text-[#F6F1E8]'
                                            : 'border-stone-200 bg-[#F8F4EC] text-stone-600 hover:border-[#B7AA93] hover:text-stone-900'
                                            }`}
                                    >
                                        {t(option.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex flex-1 flex-col gap-3">
                {comparePair ? (
                    <ZenVNextCompareStage
                        comparePair={comparePair}
                        compareCanvasARef={compareCanvasATargetRef}
                        compareCanvasBRef={compareCanvasBTargetRef}
                        abWidthA={abWidthA}
                        abHeightA={abHeightA}
                        abWidthB={abWidthB}
                        abHeightB={abHeightB}
                        isSubmittingCompare={isSubmittingCompare}
                        handleDismissCompare={handleDismissCompare}
                        handleChooseCompare={handleChooseCompare}
                    />
                ) : (
                    <ZenVNextPreviewStage
                        containerRef={containerTargetRef}
                        canvasRef={canvasRef}
                        width={width}
                        height={height}
                        seed={seed}
                    />
                )}

                {showExtensions && (
                    <section className="shrink-0 overflow-hidden rounded-[28px] border border-[#E8DEC9] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,241,231,0.95))] shadow-[0_20px_60px_rgba(99,76,44,0.08)]">
                        <div className="border-b border-[#E8DEC9] p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-500">
                                        Extensions
                                    </p>
                                    <p className="mt-1 font-serif text-[16px] font-bold text-[#2A2218]">
                                        {activeSectionMeta.label}
                                    </p>
                                    <p className="mt-1 text-[8px] font-semibold text-stone-500">
                                        {activeSectionMeta.description}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleOptimize}
                                        disabled={isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning}
                                        className={`h-9 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[0.14em] shadow-[0_10px_28px_rgba(45,79,30,0.12)] transition ${isOptimizing || isPreparingCompare || isSubmittingCompare || isAutoCompareRunning
                                            ? 'cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500'
                                            : 'border-[#2D4F1E] bg-[#2D4F1E] text-white hover:bg-[#1A3012]'
                                            }`}
                                    >
                                        {isOptimizing ? `Evolving ${Math.round(optimizeProgress * 100)}%` : 'Evolve vNext'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
                                {cards.map((card) => (
                                    <div
                                        key={card.label}
                                        className="rounded-[18px] border border-[#E7DDCB] bg-white/72 px-2.5 py-2 shadow-[0_12px_32px_rgba(99,76,44,0.05)] backdrop-blur-[2px]"
                                    >
                                        <p className="font-mono text-[8px] font-black uppercase tracking-[0.14em] text-stone-500">{card.label}</p>
                                        <p className="mt-1 font-serif text-[15px] font-bold leading-none text-[#2A2218]">{card.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                                {SECTION_TABS.map((section, index) => (
                                    <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => setActiveSection(section.key)}
                                        aria-label={section.label}
                                        className={`rounded-[18px] border px-3 py-2 text-left transition ${activeSection === section.key
                                            ? 'border-[#27506A] bg-[#27506A] text-white shadow-[0_12px_30px_rgba(39,80,106,0.18)]'
                                            : 'border-[#E8DEC9] bg-white/82 text-stone-700 hover:bg-white'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[7px] font-mono font-black ${activeSection === section.key ? 'border-white/30 bg-white/12 text-white' : 'border-[#E7DDCB] bg-[#F7F2E9] text-stone-500'}`}>
                                                {index + 1}
                                            </span>
                                            <span className="block text-[8px] font-black uppercase tracking-[0.14em]">
                                                {section.label}
                                            </span>
                                        </span>
                                        <span className={`mt-1 block text-[8px] font-semibold leading-4 ${activeSection === section.key ? 'text-[#DCEAF1]' : 'text-stone-500'}`}>
                                            {section.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="max-h-[38vh] space-y-3 overflow-y-auto p-3">
                            <ZenVNextSidebarContent
                                activeSection={activeSection}
                                surfaceCardClass={SURFACE_CARD_CLASS}
                                coolSurfaceCardClass={COOL_SURFACE_CARD_CLASS}
                                basicFactorSliders={BASIC_FACTOR_SLIDERS}
                                advancedFactorSliders={ADVANCED_FACTOR_SLIDERS}
                                renderFactorSlider={renderFactorSlider}
                                result={result}
                                reliabilityHint={reliabilityHint}
                                phaseStats={phaseStats}
                                phaseTotalSelections={phaseTotalSelections}
                                styleProfile={styleProfile}
                                comparePair={comparePair}
                                compareDeltaHighlights={compareDeltaHighlights}
                                handleDismissCompare={handleDismissCompare}
                                isSubmittingCompare={isSubmittingCompare}
                                latestOptimization={latestOptimization}
                                inspectorReliability={inspectorReliability}
                                preferenceModel={preferenceModel}
                                isTrainingPreference={isTrainingPreference}
                                handlePrepareCompare={handlePrepareCompare}
                                isOptimizing={isOptimizing}
                                isPreparingCompare={isPreparingCompare}
                                isAutoCompareRunning={isAutoCompareRunning}
                                handleResetPreferenceModel={handleResetPreferenceModel}
                                handleClearFeedbackTrials={handleClearFeedbackTrials}
                                isMaintainingLoop={isMaintainingLoop}
                                handleStartAutoCompare={handleStartAutoCompare}
                                handleStopAutoCompare={handleStopAutoCompare}
                                autoCompareMaxRounds={autoCompareMaxRounds}
                                setAutoCompareMaxRounds={setAutoCompareMaxRounds}
                                autoCompareStopReliability={autoCompareStopReliability}
                                setAutoCompareStopReliability={setAutoCompareStopReliability}
                                autoCompareRound={autoCompareRound}
                                autoCompareCompleted={autoCompareCompleted}
                                latestGeneration={latestGeneration}
                                handleRefreshLoopState={handleRefreshLoopState}
                                handleExportLoopState={handleExportLoopState}
                                handleImportLoopState={handleImportLoopState}
                                loopPayloadText={loopPayloadText}
                                setLoopPayloadText={setLoopPayloadText}
                                loopActionMessage={loopActionMessage}
                            />
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
