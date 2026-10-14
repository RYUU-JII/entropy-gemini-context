import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DEFAULT_SAKURA_V2_FLAGS,
    SAKURA_V2_MODE,
} from '../../../model/SakuraV2Runtime';
import {
    createRandomSakuraLatent,
    validateSakuraLatent,
} from '../../../model/v2/SakuraLatentSchema';
import {
    buildV2LearningLatentPair,
    describeSakuraLatentChanges,
} from '../../../model/v2/SakuraLatentAB';
import {
    createSakuraColdStartPlanningError,
    normalizeSakuraSobolColdStartCachePayload,
    normalizeSakuraSobolColdStartPool,
    SOBOL_COLD_START_CACHE_VERSION,
} from '../../../model/v2/SakuraSobolColdStartCache';
import {
    collectSakuraSobolColdStartPairSignatures,
    pickSakuraSobolColdStartPair,
} from '../../../model/v2/SakuraSobolColdStart';
import {
    compileSakuraPhenotypeFromLatent,
} from '../../../model/v2/SakuraCompiler';
import { ZenABTrialWorkerClient } from '../../../model/ZenABTrialWorkerClient';
import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';

const SOBOL_COLD_START_SOURCE_COUNT = 128;
const SOBOL_COLD_START_SURVIVOR_COUNT = 24;
const SOBOL_COLD_START_REQUEST_TAG_BASE = 'zen_sobol_cold_start';

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);
const cloneDetails = (value) => (isObject(value) ? { ...value } : null);
const buildColdStartCauseDiagnostics = (error) => {
    const workerErrorCode = safeString(error?.code, null);
    const workerErrorMessage = safeString(error?.message, null);
    const workerErrorDetails = cloneDetails(error?.details);
    if (!workerErrorCode && !workerErrorMessage && !workerErrorDetails) {
        return null;
    }
    return {
        ...(workerErrorCode ? { workerErrorCode } : {}),
        ...(workerErrorMessage ? { workerErrorMessage } : {}),
        ...(workerErrorDetails ? { workerErrorDetails } : {}),
    };
};
const mergeColdStartDetails = (...values) => {
    const next = {};
    values.forEach((value) => {
        if (isObject(value)) {
            Object.assign(next, value);
        }
    });
    return Object.keys(next).length ? next : null;
};
const shouldPreserveColdStartError = (error) => {
    const code = safeString(error?.code, null);
    return Boolean(
        error instanceof Error
        && code
        && code.startsWith('ZEN_SAKURA_')
    );
};

const toColdStartPlanningError = (
    error,
    {
        code = 'ZEN_SAKURA_COLD_START_FAILED',
        message = 'Sakura cold-start planning failed.',
        details = null,
    } = {},
) => {
    if (shouldPreserveColdStartError(error)) {
        return error;
    }
    const mergedDetails = mergeColdStartDetails(
        details,
        buildColdStartCauseDiagnostics(error),
    );
    return createSakuraColdStartPlanningError(
        code,
        message,
        mergedDetails,
        error instanceof Error ? error : null,
    );
};
const requireColdStartWorkspaceState = () => {
    if (zenDevelopmentWorkspaceState) {
        return zenDevelopmentWorkspaceState;
    }
    throw createSakuraColdStartPlanningError(
        'ZEN_SAKURA_COLD_START_DEVELOPMENT_WORKSPACE_NOT_AVAILABLE',
        'Sakura cold-start workspace state is available only in a development build.',
    );
};
const readCachedSobolPool = ({ learningKeyspaceProfile = null } = {}) => {
    const parsed = requireColdStartWorkspaceState().readSobolColdStartCache(null);
    return normalizeSakuraSobolColdStartCachePayload(parsed, {
        learningKeyspaceProfile,
    });
};
const persistCachedSobolPool = ({
    learningKeyspaceProfile = null,
    seed = null,
    pool = [],
} = {}) => {
    const normalizedPool = normalizeSakuraSobolColdStartPool(pool, {
        learningKeyspaceProfile,
    });
    const payload = {
        version: SOBOL_COLD_START_CACHE_VERSION,
        learningKeyspaceProfile: safeString(learningKeyspaceProfile, null),
        seed: Number.isInteger(Number(seed)) && Number(seed) >= 0
            ? Math.floor(Number(seed))
            : null,
        generatedAt: Date.now(),
        pool: normalizedPool,
    };
    requireColdStartWorkspaceState().writeSobolColdStartCache(payload);
};
const clearCachedSobolPool = () => {
    requireColdStartWorkspaceState().clearSobolColdStartCache();
};
const resolveColdStartRequestTag = ({
    treeType = 'sakura',
    learningKeyspaceProfile = null,
} = {}) => {
    const safeTreeType = safeString(treeType, 'sakura');
    const safeProfile = safeString(learningKeyspaceProfile, 'default');
    return `${SOBOL_COLD_START_REQUEST_TAG_BASE}:${safeTreeType}:${safeProfile}`;
};
const isQueueFullError = (error) => (
    String(error?.code || '') === 'WORKER_TASK_QUEUE_FULL'
);
const isTaskCanceledError = (error) => (
    String(error?.code || '') === 'WORKER_TASK_CANCELED'
);
const requireSakuraPlanningLatent = (
    latent = null,
    {
        code = 'ZEN_SAKURA_AB_PLAN_BASE_LATENT_INVALID',
        label = 'Sakura A/B planning base latent',
        details = null,
    } = {},
) => {
    try {
        return validateSakuraLatent(latent, {
            code,
            label,
            details,
        });
    } catch (error) {
        throw createSakuraColdStartPlanningError(
            error?.code || code,
            error?.message || `${label} is invalid.`,
            error?.details || details,
            error instanceof Error ? error : null,
        );
    }
};

export function useSakuraV2ABPlanning({
    treeType = 'sakura',
    _currentPhenotype = {},
    sakuraV2Latent = null,
    learningAnchorLatent = null,
    sakuraV2Flags = DEFAULT_SAKURA_V2_FLAGS,
    isSakuraV2Enabled = false,
    enableColdStart = false,
    activePairwiseTrainingCount = 0,
    abHistory = [],
    evaluationStageProfiles = [],
    width = 0,
    height = 0,
    topologyHeight = null,
    referenceFeatures = [],
    commitSakuraV2Latent = null,
    resetLearningCore = null,
    setTreeSeed = null,
    persistTreeSeed = null,
    setSakuraV2Flags = null,
    learningKeyspaceProfile = null,
} = {}) {
    const [sakuraSobolPool, setSakuraSobolPool] = useState([]);
    const [coldStartPreparing, setColdStartPreparing] = useState(false);
    const [coldStartError, setColdStartError] = useState(null);
    const coldStartEligible = Boolean(
        isSakuraV2Enabled
        && treeType === 'sakura'
        && activePairwiseTrainingCount < SOBOL_COLD_START_SURVIVOR_COUNT,
    );
    const coldStartNeeded = Boolean(coldStartEligible && enableColdStart);
    const coldStartBlocking = coldStartNeeded;
    const coldStartReady = !coldStartBlocking
        || (
            Array.isArray(sakuraSobolPool)
            && sakuraSobolPool.length >= 2
            && !coldStartPreparing
        );
    const activeColdStartTagRef = useRef(null);
    const coldStartJobRef = useRef({
        key: null,
        inFlight: false,
    });
    const coldStartWorkerRef = useRef(null);
    const getColdStartWorker = useCallback(() => {
        if (!coldStartWorkerRef.current) {
            coldStartWorkerRef.current = new ZenABTrialWorkerClient({
                requestTimeoutMs: 180000,
            });
        }
        return coldStartWorkerRef.current;
    }, []);
    const peekColdStartWorker = useCallback(() => coldStartWorkerRef.current, []);
    const disposeColdStartWorker = useCallback(() => {
        if (!coldStartWorkerRef.current) {
            return;
        }
        coldStartWorkerRef.current.dispose();
        coldStartWorkerRef.current = null;
    }, []);
    const coldStartRequestTag = useMemo(
        () => resolveColdStartRequestTag({
            treeType,
            learningKeyspaceProfile,
        }),
        [treeType, learningKeyspaceProfile],
    );
    const surfaceColdStartError = useCallback((error, options = {}) => {
        const nextError = toColdStartPlanningError(error, options);
        if (options?.fatal === false) {
            setColdStartError(null);
            if (typeof console !== 'undefined' && typeof console.error === 'function') {
                console.error(nextError);
            }
            return;
        }
        setColdStartError(nextError);
    }, []);
    const coldStartUsedPairSignatures = useMemo(
        () => collectSakuraSobolColdStartPairSignatures(abHistory, {
            learningKeyspaceProfile,
            windowSize: 96,
        }),
        [abHistory, learningKeyspaceProfile],
    );
    useEffect(() => () => {
        const activeTag = activeColdStartTagRef.current;
        const coldStartWorker = peekColdStartWorker();
        if (activeTag && coldStartWorker) {
            coldStartWorker.cancelTaggedRequests(activeTag, {
                reason: 'ZEN_COLD_START_UNMOUNT',
                hard: false,
            });
            activeColdStartTagRef.current = null;
        }
        coldStartJobRef.current = {
            key: null,
            inFlight: false,
        };
        disposeColdStartWorker();
    }, [disposeColdStartWorker, peekColdStartWorker]);
    const buildSakuraV2ABPlan = useCallback(({
        _basePhenotype = {},
        baseLatent = null,
        treeType: planTreeType = 'sakura',
        intensity = 0.2,
        roundIndex = 0,
        roundBase = 0,
        trialIndex = 0,
        attemptIndex = 0,
        forcePairType = null,
        focusKey = null,
        targetPairGapNorm = null,
        targetPairCenterNorm = null,
        preferenceLearning = null,
        availableFocusKeys = null,
        qualityProfile = null,
        diversityGuidance = null,
    } = {}) => {
        const shouldUseCanonicalLatentPlan = planTreeType === 'sakura';
        if (!shouldUseCanonicalLatentPlan) {
            return null;
        }

        const candidateCursor = Math.max(
            0,
            Math.floor(Number.isFinite(roundBase) ? roundBase : roundIndex),
        ) + (Math.max(0, Math.floor(Number(trialIndex) || 0)) * 3)
            + (Math.max(0, Math.floor(Number(attemptIndex) || 0)) * 11);
        const shouldUseSobolColdStart = Boolean(
            enableColdStart
            && activePairwiseTrainingCount < SOBOL_COLD_START_SURVIVOR_COUNT
            && Array.isArray(sakuraSobolPool)
            && sakuraSobolPool.length >= 2
        );
        if (shouldUseSobolColdStart) {
            const sobolPair = pickSakuraSobolColdStartPair({
                pool: sakuraSobolPool,
                cursor: candidateCursor,
                learningKeyspaceProfile,
                usedPairSignatures: coldStartUsedPairSignatures,
            });
            if (sobolPair?.latentA && sobolPair?.latentB) {
                const coldStartChangeDescription = describeSakuraLatentChanges({
                    latentA: sobolPair.latentA,
                    latentB: sobolPair.latentB,
                    learningKeyspaceProfile,
                });
                const controlledSobolContext = {
                    ...(sobolPair.context || {}),
                    latentSpace: 'canonical_v2',
                    sharedSeedPolicy: 'shared',
                    ...coldStartChangeDescription,
                };
                return {
                    strategy: 'discover',
                    sharedSeed: true,
                    roundIndex,
                    pairType: 'sobol_cold_start',
                    latentPair: {
                        latentA: sobolPair.latentA,
                        latentB: sobolPair.latentB,
                        context: {
                            ...controlledSobolContext,
                            coldStartPoolSize: sakuraSobolPool.length,
                            coldStartRemaining: Math.max(0, SOBOL_COLD_START_SURVIVOR_COUNT - activePairwiseTrainingCount),
                        },
                    },
                    phenotypePair: {
                        phenotypeA: {
                            ...compileSakuraPhenotypeFromLatent(sobolPair.latentA),
                        },
                        phenotypeB: {
                            ...compileSakuraPhenotypeFromLatent(sobolPair.latentB),
                        },
                        latentA: sobolPair.latentA,
                        latentB: sobolPair.latentB,
                        context: {
                            ...controlledSobolContext,
                            questionQuality: qualityProfile && typeof qualityProfile === 'object'
                                ? {
                                    stage: qualityProfile.stage || 'stable',
                                    pressure: Number(qualityProfile.pressure || 0),
                                    minScalarGap: Number(qualityProfile.minScalarGap || 0),
                                    forcePairType: forcePairType || null,
                                    availableFocusKeys: Array.isArray(availableFocusKeys)
                                        ? [...availableFocusKeys]
                                        : null,
                                }
                                : null,
                        },
                    },
                };
            }
        }

        const latentPlan = buildV2LearningLatentPair({
            baseLatent: requireSakuraPlanningLatent(
                baseLatent ?? learningAnchorLatent ?? sakuraV2Latent,
                {
                    code: 'ZEN_SAKURA_AB_PLAN_BASE_LATENT_INVALID',
                    label: 'Sakura A/B planning base latent',
                    details: {
                        learningKeyspaceProfile,
                        planTreeType,
                    },
                },
            ),
            intensity,
            roundIndex,
            forcePairType,
            focusKey,
            targetPairGapNorm,
            targetPairCenterNorm,
            preferenceLearning,
            availableFocusKeys,
            qualityProfile,
            diversityGuidance,
            learningKeyspaceProfile,
        });
        const latentPair = latentPlan?.latentPair;
        if (!latentPair?.latentA || !latentPair?.latentB) {
            return null;
        }

        const phenotypeA = {
            ...compileSakuraPhenotypeFromLatent(latentPair.latentA),
        };
        const phenotypeB = {
            ...compileSakuraPhenotypeFromLatent(latentPair.latentB),
        };

        return {
            ...latentPlan,
            phenotypePair: {
                phenotypeA,
                phenotypeB,
                latentA: latentPair.latentA,
                latentB: latentPair.latentB,
                context: {
                    ...(latentPair.context || {}),
                    latentSpace: 'canonical_v2',
                    questionQuality: qualityProfile && typeof qualityProfile === 'object'
                        ? {
                            stage: qualityProfile.stage || 'stable',
                            pressure: Number(qualityProfile.pressure || 0),
                            minScalarGap: Number(qualityProfile.minScalarGap || 0),
                            forcePairType: forcePairType || null,
                            focusKey,
                            targetPairGapNorm: targetPairGapNorm !== null
                                && targetPairGapNorm !== undefined
                                && Number.isFinite(Number(targetPairGapNorm))
                                ? Number(targetPairGapNorm)
                                : null,
                            availableFocusKeys: Array.isArray(availableFocusKeys)
                                ? [...availableFocusKeys]
                                : null,
                        }
                        : null,
                },
            },
        };
    }, [
        sakuraV2Latent,
        learningAnchorLatent,
        sakuraSobolPool,
        enableColdStart,
        activePairwiseTrainingCount,
        learningKeyspaceProfile,
        coldStartUsedPairSignatures,
    ]);

    const buildColdStartPoolViaWorker = useCallback(async ({
        seed,
        anchorLatent,
        requestTag = null,
    } = {}) => {
        const stageProfiles = Array.isArray(evaluationStageProfiles)
            ? evaluationStageProfiles
            : [];
        const numericWidth = Number(width || 0);
        const numericHeight = Number(height || 0);
        if (!stageProfiles.length || numericWidth <= 0 || numericHeight <= 0) {
            return null;
        }
        const safeWidth = Math.max(1, Math.floor(numericWidth));
        const safeHeight = Math.max(1, Math.floor(numericHeight));
        const safeTopologyHeight = Number.isFinite(Number(topologyHeight))
            ? Number(topologyHeight)
            : safeHeight;
        const requestSeed = Number.isFinite(Number(seed))
            ? Math.floor(Number(seed))
            : Math.floor(Date.now() % 1000000);
        const normalizedAnchorLatent = requireSakuraPlanningLatent(anchorLatent, {
            code: 'ZEN_SAKURA_COLD_START_ANCHOR_INVALID',
            label: 'Sakura cold-start anchor latent',
            details: {
                learningKeyspaceProfile,
                requestTag: safeString(requestTag, null),
            },
        });
        let workerResult = null;
        try {
            const coldStartWorker = getColdStartWorker();
            workerResult = await coldStartWorker.buildSobolColdStartPool(
                {
                    treeType,
                    width: safeWidth,
                    height: safeHeight,
                    topologyHeight: safeTopologyHeight,
                    stageProfiles,
                    referenceFeatures: Array.isArray(referenceFeatures) ? referenceFeatures : [],
                    sourceCount: SOBOL_COLD_START_SOURCE_COUNT,
                    survivorCount: SOBOL_COLD_START_SURVIVOR_COUNT,
                    seed: requestSeed,
                    anchorLatent: normalizedAnchorLatent,
                    learningKeyspaceProfile,
                    skipModelLoad: true,
                },
                {
                    requestTag: safeString(requestTag, null),
                },
            );
        } catch (error) {
            if (isTaskCanceledError(error)) {
                return null;
            }
            if (isQueueFullError(error)) {
                throw createSakuraColdStartPlanningError(
                    'ZEN_SAKURA_COLD_START_WORKER_QUEUE_FULL',
                    'Sakura cold-start worker queue is full.',
                    {
                        learningKeyspaceProfile,
                        requestTag: safeString(requestTag, null),
                    },
                    error,
                );
            }
            throw toColdStartPlanningError(error, {
                code: 'ZEN_SAKURA_COLD_START_WORKER_FAILED',
                message: 'Sakura cold-start worker execution failed.',
                details: {
                    learningKeyspaceProfile,
                    requestTag: safeString(requestTag, null),
                },
            });
        }
        const coldStartWorker = peekColdStartWorker();
        if (requestTag && coldStartWorker?.isRequestTagCanceled(requestTag)) {
            return null;
        }
        if (!isObject(workerResult)) {
            throw createSakuraColdStartPlanningError(
                'ZEN_SAKURA_COLD_START_WORKER_UNAVAILABLE',
                'Sakura cold-start worker did not return a pool result.',
                {
                    learningKeyspaceProfile,
                    requestTag: safeString(requestTag, null),
                    workerResult,
                },
            );
        }
        return normalizeSakuraSobolColdStartPool(workerResult.pool, {
            learningKeyspaceProfile,
            label: 'Worker Sobol cold-start pool',
        });
    }, [
        getColdStartWorker,
        peekColdStartWorker,
        treeType,
        width,
        height,
        topologyHeight,
        evaluationStageProfiles,
        referenceFeatures,
        learningKeyspaceProfile,
    ]);

    useEffect(() => {
        if (!coldStartNeeded) {
            setColdStartPreparing(false);
            setColdStartError(null);
            const activeTag = activeColdStartTagRef.current;
            const coldStartWorker = peekColdStartWorker();
            if (activeTag && coldStartWorker) {
                coldStartWorker.cancelTaggedRequests(activeTag, {
                    reason: 'ZEN_COLD_START_NOT_NEEDED',
                    hard: false,
                });
                activeColdStartTagRef.current = null;
            }
            coldStartJobRef.current = {
                key: null,
                inFlight: false,
            };
            disposeColdStartWorker();
            return;
        }
        if (Array.isArray(sakuraSobolPool) && sakuraSobolPool.length >= 2) {
            const activeTag = activeColdStartTagRef.current;
            const coldStartWorker = peekColdStartWorker();
            if (activeTag && coldStartWorker) {
                coldStartWorker.cancelTaggedRequests(activeTag, {
                    reason: 'ZEN_COLD_START_ALREADY_READY',
                    hard: false,
                });
                activeColdStartTagRef.current = null;
            }
            coldStartJobRef.current = {
                key: null,
                inFlight: false,
            };
            disposeColdStartWorker();
            return;
        }

        let cached = null;
        try {
            cached = readCachedSobolPool({ learningKeyspaceProfile });
        } catch (error) {
            surfaceColdStartError(error, {
                code: 'ZEN_SAKURA_COLD_START_CACHE_INVALID',
                message: 'Stored Sakura cold-start cache payload is invalid.',
                details: {
                    learningKeyspaceProfile,
                },
                fatal: coldStartBlocking,
            });
            return;
        }
        if (cached?.pool?.length >= 2) {
            setColdStartError(null);
            setSakuraSobolPool(cached.pool);
            if (!sakuraV2Flags?.coldStartDone && typeof setSakuraV2Flags === 'function') {
                setSakuraV2Flags((prev) => ({
                    ...(prev || DEFAULT_SAKURA_V2_FLAGS),
                    enabled: true,
                    mode: SAKURA_V2_MODE.LEARN,
                    coldStartDone: true,
                    lastColdStartAt: Number.isFinite(Number(cached?.seed))
                        ? Math.floor(Number(cached.seed))
                        : Date.now(),
                }));
            }
            disposeColdStartWorker();
            return;
        }

        const jobKey = `${treeType}:${safeString(learningKeyspaceProfile, 'default')}`;
        if (coldStartJobRef.current.inFlight && coldStartJobRef.current.key === jobKey) {
            return;
        }
        const previousTag = activeColdStartTagRef.current;
        const coldStartWorker = peekColdStartWorker();
        if (previousTag && coldStartWorker) {
            coldStartWorker.cancelTaggedRequests(previousTag, {
                reason: 'ZEN_COLD_START_SUPERSEDED',
                hard: false,
            });
        }
        coldStartJobRef.current = {
            key: jobKey,
            inFlight: true,
        };
        activeColdStartTagRef.current = coldStartRequestTag;
        setColdStartPreparing(true);
        void (async () => {
            try {
                const initialBootstrap = !sakuraV2Flags?.coldStartDone;
                const seedSource = Number.isFinite(Number(sakuraV2Flags?.lastColdStartAt))
                    ? Math.floor(Number(sakuraV2Flags.lastColdStartAt))
                    : Math.floor(Math.random() * 1000000);
                const shouldApplyBootstrapTransition = Boolean(initialBootstrap && enableColdStart);
                const chaosLatent = shouldApplyBootstrapTransition
                    ? createRandomSakuraLatent()
                    : null;
                if (shouldApplyBootstrapTransition && typeof commitSakuraV2Latent === 'function') {
                    commitSakuraV2Latent(chaosLatent, {
                        syncLearningAnchor: true,
                    });
                }
                const anchorLatent = shouldApplyBootstrapTransition
                    ? chaosLatent
                    : requireSakuraPlanningLatent(
                        learningAnchorLatent ?? sakuraV2Latent,
                        {
                            code: 'ZEN_SAKURA_COLD_START_ANCHOR_INVALID',
                            label: 'Sakura cold-start anchor latent',
                            details: {
                                learningKeyspaceProfile,
                                requestTag: coldStartRequestTag,
                            },
                        },
                    );
                const pool = await buildColdStartPoolViaWorker({
                    seed: seedSource,
                    anchorLatent,
                    requestTag: coldStartRequestTag,
                });
                if (coldStartJobRef.current.key !== jobKey) {
                    return;
                }
                if (pool === null) {
                    setColdStartPreparing(false);
                    return;
                }
                const nextPool = normalizeSakuraSobolColdStartPool(pool, {
                    learningKeyspaceProfile,
                    label: 'Generated Sobol cold-start pool',
                });
                setColdStartError(null);
                setSakuraSobolPool(nextPool);
                persistCachedSobolPool({
                    learningKeyspaceProfile,
                    seed: seedSource,
                    pool: nextPool,
                });
                if (shouldApplyBootstrapTransition) {
                    if (typeof setTreeSeed === 'function') {
                        setTreeSeed(seedSource);
                    }
                    if (typeof persistTreeSeed === 'function') {
                        persistTreeSeed(treeType, seedSource);
                    }
                    if (typeof resetLearningCore === 'function') {
                        resetLearningCore();
                    }
                }
                if (initialBootstrap && typeof setSakuraV2Flags === 'function') {
                    setSakuraV2Flags((prev) => ({
                        ...(prev || DEFAULT_SAKURA_V2_FLAGS),
                        enabled: true,
                        mode: SAKURA_V2_MODE.LEARN,
                        coldStartDone: true,
                        lastColdStartAt: seedSource,
                    }));
                }
                setColdStartPreparing(false);
            } catch (error) {
                if (coldStartJobRef.current.key === jobKey) {
                    setColdStartPreparing(false);
                    surfaceColdStartError(error, {
                        code: 'ZEN_SAKURA_COLD_START_FAILED',
                        message: 'Cold-start pool generation failed.',
                        details: {
                            learningKeyspaceProfile,
                            treeType,
                        },
                        fatal: coldStartBlocking,
                    });
                }
            } finally {
                const ownsJob = coldStartJobRef.current.key === jobKey;
                if (ownsJob) {
                    coldStartJobRef.current = {
                        key: null,
                        inFlight: false,
                    };
                }
                if (activeColdStartTagRef.current === coldStartRequestTag) {
                    activeColdStartTagRef.current = null;
                }
                if (ownsJob) {
                    disposeColdStartWorker();
                }
            }
        })();
    }, [
        coldStartNeeded,
        enableColdStart,
        sakuraSobolPool,
        sakuraV2Flags?.coldStartDone,
        sakuraV2Flags?.lastColdStartAt,
        learningKeyspaceProfile,
        commitSakuraV2Latent,
        learningAnchorLatent,
        sakuraV2Latent,
        buildColdStartPoolViaWorker,
        setTreeSeed,
        persistTreeSeed,
        resetLearningCore,
        setSakuraV2Flags,
        treeType,
        peekColdStartWorker,
        disposeColdStartWorker,
        coldStartRequestTag,
        surfaceColdStartError,
        coldStartBlocking,
    ]);

    const clearSakuraSobolPool = useCallback(() => {
        setSakuraSobolPool([]);
        setColdStartError(null);
        clearCachedSobolPool();
    }, []);

    return {
        buildSakuraV2ABPlan,
        clearSakuraSobolPool,
        coldStartEligible,
        coldStartPreparing,
        coldStartReady,
        coldStartPoolSize: Array.isArray(sakuraSobolPool) ? sakuraSobolPool.length : 0,
        coldStartError,
    };
}
