import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation';
import { useToast } from '@/ui-kit';
import { SeededRandom } from '../../model/SeededRandom';
import { TreeAnalyzer } from '../../model/TreeAnalyzer';
import { summarizePhenotype } from '../../model/BonsaiGenetics';
import {
    STAGES,
    validateStructureDepthForMode,
    withStructureDepth,
    TOPOLOGY_REFERENCE_HEIGHT,
    createAssetCache,
    ZEN_ASSET_CACHE_VERSION,
    resolveSpecies,
} from '../../model/ZenCoreConfig';
import { useZenLabTreeRenderer } from '../useZenLabTreeRenderer.js';
import {
    ZEN_BONSAI_MAIN_RENDER_OWNERS,
} from '../zenBonsaiMainRendererOwnership.js';
import { createBonsaiRepository } from '../../model/BonsaiRepository';
import { useZenBonsaiActiveProfileState } from '../../bonsai/runtime/useZenBonsaiActiveProfileState.js';
import { compileSakuraPhenotypeFromLatent } from '../../model/v2/SakuraCompiler';
import { SAKURA_V2_LATENT_VERSION } from '../../model/v2/SakuraLatentSchema.js';
import {
    MAIN_SNAPSHOT_SCHEMA,
    buildSakuraSnapshotTreePayload,
    parseSakuraMainSnapshotPayload,
} from '../../model/SakuraMainSnapshot';
import { deriveZenBonsaiPondBioticSignalFromAnalysis } from '../../model/zenBonsaiPondBioticSignal.js';
import { useZenBonsaiSceneStore } from '../../pond/state/stores/useZenBonsaiSceneStore.js';

const clampScore = (score) => Math.max(0, Math.min(100, Number(score) || 0));
const PREVIEW_LEARNING_PROGRESS = 1;

const createZenBonsaiPreviewError = (
    code = 'ZEN_BONSAI_PREVIEW_STATE_INVALID',
    message = 'Zen bonsai preview state is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const requireZenBonsaiPreviewLatent = (
    latent,
    {
        code = 'ZEN_BONSAI_PREVIEW_LATENT_REQUIRED',
        label = 'Zen bonsai preview latent',
        details = null,
    } = {},
) => {
    if (!latent || typeof latent !== 'object') {
        throw createZenBonsaiPreviewError(
            code,
            `${label} is required.`,
            details,
        );
    }
    return latent;
};

const resolveInitialPreviewState = (activeProfile) => {
    const initialTreeType = activeProfile.treeType;
    const initialMode = activeProfile.structureMode;
    const initialDepth = activeProfile.structureDepth;
    const initialSeed = activeProfile.treeSeed;
    const initialLatent = requireZenBonsaiPreviewLatent(activeProfile.sakuraV2Latent, {
        label: 'Zen bonsai preview active profile latent',
        details: { source: 'zen_bonsai_profile_aggregate_v1' },
    });
    const initialPhenotype = compileSakuraPhenotypeFromLatent(initialLatent);
    return {
        treeType: initialTreeType,
        treeSeed: initialSeed,
        structureMode: initialMode,
        structureDepth: initialDepth,
        currentLatent: initialLatent,
        currentPhenotype: initialPhenotype,
    };
};

export default function ZenBonsaiPreviewRuntime({ integrityScore = 100, solarLocationProfile = null }) {
    const { t } = useAppTranslation('main');
    const toast = useToast();
    const activeProfile = useZenBonsaiActiveProfileState();
    const appliedProfileFingerprintRef = useRef(null);
    const publishPondBioticSignal = useZenBonsaiSceneStore((state) => state.publishPondBioticSignal);
    const mainTargetFps = 60;
    const [previewState, setPreviewState] = useState(() => (
        resolveInitialPreviewState(activeProfile)
    ));

    useEffect(() => {
        if (
            !activeProfile.profileReady
            || !activeProfile.activeIdentityFingerprint
            || appliedProfileFingerprintRef.current
                === activeProfile.activeIdentityFingerprint
        ) return;
        appliedProfileFingerprintRef.current = activeProfile.activeIdentityFingerprint;
        setPreviewState(resolveInitialPreviewState(activeProfile));
    }, [
        activeProfile.activeIdentityFingerprint,
        activeProfile.profileReady,
        activeProfile.sakuraV2Latent,
        activeProfile.structureDepth,
        activeProfile.structureMode,
        activeProfile.treeSeed,
        activeProfile.treeType,
    ]);
    const treeType = previewState.treeType;
    const treeSeed = previewState.treeSeed;
    const structureMode = previewState.structureMode;
    const structureDepth = previewState.structureDepth;
    const currentLatent = previewState.currentLatent;
    const currentPhenotype = previewState.currentPhenotype;
    const species = useMemo(() => resolveSpecies(treeType), [treeType]);
    const assetCache = useMemo(() => createAssetCache(), [ZEN_ASSET_CACHE_VERSION]);
    const bonsaiRepository = useMemo(() => createBonsaiRepository(), []);

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const viewportRef = useRef(null);
    const frameIdRef = useRef(null);
    const staticCacheRef = useRef(null);
    const treeCacheRef = useRef(null);
    const lastCacheKeyRef = useRef('');
    const abCanvasRefA = useRef(null);
    const abCanvasRefB = useRef(null);

    const {
        width: containerWidth,
        height: containerHeight,
        targetRef: containerTargetRef,
    } = useResizeObserver(containerRef);
    const {
        width: viewportWidth,
        height: viewportHeight,
        targetRef: viewportTargetRef,
    } = useResizeObserver(viewportRef);

    const renderWidth = Math.max(1, Math.floor(viewportWidth || containerWidth || 1));
    const renderHeight = Math.max(1, Math.floor(viewportHeight || containerHeight || 1));

    const currentStage = useMemo(() => {
        const score = clampScore(integrityScore);
        if (score >= STAGES.BLOOM.min) return STAGES.BLOOM;
        if (score >= STAGES.HEALTHY.min) return STAGES.HEALTHY;
        if (score >= STAGES.WEAK.min) return STAGES.WEAK;
        return STAGES.DEAD;
    }, [integrityScore]);

    const currentGrowthStage = useMemo(
        () => ({
            ...withStructureDepth(currentStage, structureDepth),
            learningProgress: PREVIEW_LEARNING_PROGRESS,
        }),
        [currentStage, structureDepth]
    );

    const analysisStage = useMemo(
        () => ({
            ...withStructureDepth(STAGES.BLOOM, structureDepth),
            learningProgress: PREVIEW_LEARNING_PROGRESS,
        }),
        [structureDepth]
    );

    const copyText = useCallback(async (text, successMessage) => {
        const payload = typeof text === 'string' ? text : String(text ?? '');
        if (!payload.trim()) return;

        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(payload);
                toast.success(successMessage, { dedupeKey: `zen-preview-copy:${successMessage}` });
                return;
            } catch {
                // Continue to the synchronous clipboard path.
            }
        }

        if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
            const textarea = document.createElement('textarea');
            textarea.value = payload;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (copied) {
                toast.success(successMessage, { dedupeKey: `zen-preview-copy:${successMessage}` });
                return;
            }
        }

        toast.error(t('core_status.toast.copy_failed'), { dedupeKey: 'zen-preview-copy-failed' });
    }, [t, toast]);

    const handleCopyPondMain = useCallback(() => {
        const snapshotTree = buildSakuraSnapshotTreePayload({
            seed: treeSeed,
            latent: currentLatent,
        });
        const payload = {
            schema: MAIN_SNAPSHOT_SCHEMA,
            copiedAt: new Date().toISOString(),
            source: 'zen_bonsai_preview_pond',
            tree: snapshotTree.tree,
            structure: {
                mode: structureMode,
                depth: Number(structureDepth),
            },
            stage: {
                min: Number(currentGrowthStage?.min ?? 0),
                max: Number(currentGrowthStage?.max ?? 0),
                leafChance: Number(currentGrowthStage?.leafChance ?? 0),
                flowerChance: Number(currentGrowthStage?.flowerChance ?? 0),
                depth: Number(currentGrowthStage?.depth ?? structureDepth),
                integrityScore: clampScore(integrityScore),
            },
            render: {
                width: Number(renderWidth),
                height: Number(renderHeight),
                topologyReferenceHeight: TOPOLOGY_REFERENCE_HEIGHT,
            },
            reproducibility: {
                deterministicInputs: ['seed', 'latent', 'structureDepth'],
                note: 'Copied from koi-pond main preview.',
            },
        };
        void copyText(JSON.stringify(payload, null, 2), t('core_status.toast.pond_snapshot_copied'));
    }, [
        treeSeed,
        currentLatent,
        structureMode,
        structureDepth,
        currentGrowthStage,
        integrityScore,
        renderWidth,
        renderHeight,
        copyText,
        t,
    ]);

    const handlePastePondMain = useCallback(async () => {
        const applySnapshot = async (snapshot) => {
            const snapshotLatent = requireZenBonsaiPreviewLatent(snapshot?.latent ?? null, {
                code: 'ZEN_BONSAI_PREVIEW_SNAPSHOT_LATENT_REQUIRED',
                label: 'Zen bonsai preview imported snapshot latent',
                details: {
                    source: 'pond_snapshot_import',
                },
            });
            const snapshotPhenotype = compileSakuraPhenotypeFromLatent(snapshotLatent);
            setPreviewState({
                treeType: snapshot.treeType,
                treeSeed: snapshot.seed,
                structureMode: snapshot.structureMode,
                structureDepth: snapshot.structureDepth,
                currentLatent: snapshotLatent,
                currentPhenotype: snapshotPhenotype,
            });
            try {
                const saveResult = await bonsaiRepository.saveBonsaiRepositoryEntry({
                    treeType: snapshot.treeType,
                    seed: snapshot.seed,
                    latent: snapshotLatent,
                    phenotype: snapshotPhenotype,
                    structureMode: snapshot.structureMode,
                    structureDepth: snapshot.structureDepth,
                    score: null,
                    phenotypeSummary: summarizePhenotype(snapshotPhenotype),
                    source: 'pond_snapshot_import',
                    label: 'POND-IMPORT',
                }, {
                    expectedProfileGeneration: activeProfile.profileEpoch,
                });
                if (!saveResult?.entry) return false;
                await activeProfile.commitActiveIdentityPatch({
                    treeType: snapshot.treeType,
                    treeSeed: snapshot.seed,
                    structureMode: snapshot.structureMode,
                    structureDepth: validateStructureDepthForMode(
                        snapshot.structureMode,
                        snapshot.structureDepth,
                        { storageKey: 'pond_snapshot_import.structureDepth' },
                    ),
                    canonicalLatent: {
                        version: SAKURA_V2_LATENT_VERSION,
                        values: snapshotLatent,
                    },
                });
                return true;
            } catch (error) {
                console.warn('[ZenBonsaiPreview] Failed to persist imported bonsai artifact.', error);
                return false;
            }
        };

        let parsed = null;
        let lastError = null;
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
            try {
                const text = await navigator.clipboard.readText();
                parsed = parseSakuraMainSnapshotPayload(JSON.parse(text));
            } catch (error) {
                lastError = error;
            }
        }
        if (!parsed) {
            const input = window.prompt(t('core_status.dialog.pond_snapshot_prompt'), '');
            if (typeof input !== 'string' || !input.trim()) {
                return;
            }
            try {
                parsed = parseSakuraMainSnapshotPayload(JSON.parse(input));
            } catch (error) {
                lastError = error;
            }
        }
        if (!parsed) {
            const message = lastError instanceof Error
                ? lastError.message
                : t('core_status.toast.pond_apply_failed_default');
            toast.error(t('core_status.toast.pond_apply_failed', { message }), { dedupeKey: 'zen-pond-apply-failed' });
            return;
        }
        const applied = await applySnapshot(parsed);
        if (!applied) {
            toast.error(t('core_status.toast.pond_apply_failed_default'), { dedupeKey: 'zen-pond-apply-failed' });
            return;
        }
        toast.success(t('core_status.toast.pond_snapshot_applied'), { dedupeKey: 'zen-pond-applied' });
    }, [
        activeProfile.commitActiveIdentityPatch,
        activeProfile.profileEpoch,
        bonsaiRepository,
        t,
        toast,
    ]);

    const treeTopology = useMemo(() => {
        const rng = new SeededRandom(treeSeed);
        return species.generateTopology(rng, currentGrowthStage, TOPOLOGY_REFERENCE_HEIGHT, currentPhenotype);
    }, [species, treeSeed, currentGrowthStage, currentPhenotype]);
    const previewAnalysis = useMemo(() => {
        return TreeAnalyzer.analyze(treeTopology, 420, 420, {
            species: treeType,
            referenceFeatures: [],
        });
    }, [treeTopology, treeType]);

    useEffect(() => {
        const signal = deriveZenBonsaiPondBioticSignalFromAnalysis({
            analysis: previewAnalysis,
            source: 'zen_preview_widget',
            engine: 'preview',
            stageId: 'bloom',
            seasonSpanDays: 7,
        });
        if (signal) {
            publishPondBioticSignal(signal);
        }
    }, [publishPondBioticSignal, previewAnalysis]);

    const previewRendererInputSignature = useMemo(() => (
        `zen_bonsai_preview_renderer_input_v1:${JSON.stringify({
            treeType,
            treeSeed,
            structureMode,
            structureDepth,
            integrityScore: clampScore(integrityScore),
            currentLatent,
        })}`
    ), [
        currentLatent,
        integrityScore,
        structureDepth,
        structureMode,
        treeSeed,
        treeType,
    ]);
    const previewBonsaiMaterializationKey = useMemo(() => (
        `zen_bonsai_preview_materialization_v1:${previewRendererInputSignature}`
    ), [previewRendererInputSignature]);

    useZenLabTreeRenderer({
        mainRendererOwner: ZEN_BONSAI_MAIN_RENDER_OWNERS.LAB_PREVIEW,
        bonsaiMaterializationKey: previewBonsaiMaterializationKey,
        inputSignature: previewRendererInputSignature,
        canvasRef,
        width: renderWidth,
        height: renderHeight,
        frameIdRef,
        staticCacheRef,
        treeCacheRef,
        lastCacheKeyRef,
        treeType,
        treeSeed,
        currentPhenotype,
        currentStage: currentGrowthStage,
        treeTopology,
        species,
        assetCache,
        mainTargetFps,
        isCollectionMode: false,
        abPair: null,
        abCanvasRefA,
        abCanvasRefB,
        abWidthA: 0,
        abHeightA: 0,
        abWidthB: 0,
        abHeightB: 0,
        minABRenderSize: 8,
        analysisStage,
        mainRenderVersion: 0,
        abRenderVersion: 0,
        onRenderDebugEvent: null,
        cameraPreset: 'preview',
        solarLocationProfile,
    });

    return (
        <div
            ref={containerTargetRef}
            className="relative h-full w-full min-h-0 overflow-hidden rounded-[24px]"
            style={{
                background: 'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.22), rgba(0,0,0,0) 48%), #f1ede5',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
            }}
        >
            <div ref={viewportTargetRef} className="relative h-full w-full min-h-0">
                <canvas
                    ref={canvasRef}
                    width={renderWidth}
                    height={renderHeight}
                    className="block h-full w-full"
                />
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
                    <button
                        onClick={handleCopyPondMain}
                        className="h-7 rounded-lg border border-sky-300 bg-sky-50 px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-sky-700 hover:bg-sky-100"
                    >
                        Copy Pond
                    </button>
                    <button
                        onClick={handlePastePondMain}
                        className="h-7 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-700 hover:bg-cyan-100"
                    >
                        Paste Pond
                    </button>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_24px_48px_rgba(255,255,255,0.22),inset_0_-28px_56px_rgba(0,0,0,0.08)]" />
            </div>
        </div>
    );
}
