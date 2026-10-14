import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import ZenBonsaiProfileAggregateRepository from '../../bonsai/storage/ZenBonsaiProfileAggregateRepository.js';
import {
    ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES,
    bootstrapZenBonsaiClassic2LineageState,
    prepareZenBonsaiClassic2LineageCandidate,
    reconcileZenBonsaiClassic2LineageState,
    resolveZenBonsaiClassic2TreeIdentityFingerprint,
    reviseZenBonsaiClassic2PreparedCandidateIdentityRevision,
    summarizeZenBonsaiClassic2LineageState,
} from '../../model/classic2/ZenBonsaiClassic2LineageModel.js';
import {
    ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES,
    requireZenBonsaiClassic2LineageRuntimeMode,
} from './zenBonsaiClassic2LineageRuntimeMode.js';
import { emitZenMainBootTrace } from '../zenMainBootReadinessTrace.js';
import {
    ZEN_HOME_FIRST_VISUAL_MILESTONES,
    createZenHomeFirstVisualBonsaiMilestoneEvent,
} from '../zenHomeFirstVisualReadinessContract.js';

const serialize = (value) => JSON.stringify(value);

export const buildZenBonsaiClassic2LineageRequestSignature = ({
    mode = null,
    treeFingerprint = null,
    candidateCarrierFingerprint = null,
    treeIdentityFingerprint = null,
    identityRevision = null,
    profileEpoch = null,
    cultivationHistorySignature = null,
} = {}) => serialize({
    contract: 'zen_bonsai_classic2_lineage_request_v1',
    mode,
    treeFingerprint,
    candidateCarrierFingerprint,
    treeIdentityFingerprint,
    identityRevision,
    profileEpoch,
    cultivationHistorySignature,
});

const buildCultivationHistorySignature = (lifeState = null) => serialize({
    growth: lifeState?.growth ?? lifeState?.maturity?.growth ?? null,
    structuralImprint: lifeState?.structuralImprint ?? null,
    growthSegments: lifeState?.growthSegments ?? null,
});

const enqueueWrite = (queueRef, task) => {
    const queued = queueRef.current.then(task, task);
    queueRef.current = queued.catch(() => undefined);
    return queued;
};

export const resolveZenBonsaiClassic2DurableLineageUpdate = ({
    previousState,
    topology,
    treeIdentity,
    preparedCandidate = null,
    treeIdentityFingerprint = preparedCandidate?.treeIdentityFingerprint
        ?? resolveZenBonsaiClassic2TreeIdentityFingerprint(treeIdentity),
    lifeState,
} = {}) => {
    if (!previousState) {
        return bootstrapZenBonsaiClassic2LineageState({
            topology,
            treeIdentity,
            preparedCandidate,
            lifeState,
            source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_FIRST_RUN_BOOTSTRAP,
        });
    }
    if (previousState.treeIdentityFingerprint !== treeIdentityFingerprint) {
        return bootstrapZenBonsaiClassic2LineageState({
            topology,
            treeIdentity,
            preparedCandidate,
            lifeState,
            source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EXPLICIT_IDENTITY_ROTATION,
            rotatedFromTreeFingerprint: previousState.treeFingerprint,
            rotatedFromTreeIdentityFingerprint: previousState.treeIdentityFingerprint,
            rotatedFromIdentityRevision: previousState.identityRevision,
            rotatedFromStateRevision: previousState.stateRevision,
        });
    }
    return reconcileZenBonsaiClassic2LineageState({
        previousState,
        topology,
        treeIdentity,
        preparedCandidate,
        lifeState,
        source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.DURABLE_MAIN_RECONCILE,
    });
};

export function useZenBonsaiClassic2LineageRuntime({
    enabled = false,
    mode = null,
    topology = null,
    treeIdentity = null,
    profileEpoch = null,
    lifeState = null,
    repository = null,
    bootTraceContext = null,
    onFirstVisualMilestone = null,
} = {}) {
    const resolvedMode = enabled
        ? requireZenBonsaiClassic2LineageRuntimeMode(mode)
        : null;
    if (
        enabled
        && resolvedMode === ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.DURABLE_MAIN
        && (typeof profileEpoch !== 'string' || !profileEpoch.trim())
    ) {
        throw new Error('ZEN_BONSAI_CLASSIC2_PROFILE_EPOCH_REQUIRED');
    }
    const preparedCandidate = useMemo(() => (
        enabled
            ? prepareZenBonsaiClassic2LineageCandidate({
                topology,
                treeIdentity,
            })
            : null
    ), [enabled, topology, treeIdentity]);
    const treeFingerprint = preparedCandidate?.treeFingerprint ?? null;
    const candidateCarrierFingerprint = preparedCandidate?.candidateCarrierFingerprint ?? null;
    const renderBinding = preparedCandidate?.renderBinding ?? null;
    const treeIdentityFingerprint = preparedCandidate?.treeIdentityFingerprint ?? null;
    const identityRevision = preparedCandidate?.identityRevision ?? null;
    const cultivationHistorySignature = useMemo(
        () => buildCultivationHistorySignature(lifeState),
        [lifeState],
    );
    const lineageRequestSignature = useMemo(() => (
        enabled
            ? buildZenBonsaiClassic2LineageRequestSignature({
                mode: resolvedMode,
                treeFingerprint,
                candidateCarrierFingerprint,
                treeIdentityFingerprint,
                identityRevision,
                profileEpoch,
                cultivationHistorySignature,
            })
            : null
    ), [
        candidateCarrierFingerprint,
        cultivationHistorySignature,
        enabled,
        identityRevision,
        profileEpoch,
        resolvedMode,
        treeFingerprint,
        treeIdentityFingerprint,
    ]);
    const committedEphemeralStateRef = useRef(null);
    // The request signature already binds candidate topology/identity and the
    // complete cultivation history consumed by lineage reconciliation. Object
    // reconstruction alone must not become another ephemeral reconcile.
    const ephemeralState = useMemo(() => {
        if (
            !enabled
            || resolvedMode !== ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
        ) {
            return null;
        }
        const previousState = committedEphemeralStateRef.current;
        let nextState;
        if (!previousState) {
            nextState = bootstrapZenBonsaiClassic2LineageState({
                preparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_BOOTSTRAP,
            });
        } else if (previousState.treeIdentityFingerprint !== treeIdentityFingerprint) {
            const effectivePreparedCandidate = identityRevision > previousState.identityRevision
                ? preparedCandidate
                : reviseZenBonsaiClassic2PreparedCandidateIdentityRevision(
                    preparedCandidate,
                    previousState.identityRevision + 1,
                );
            nextState = bootstrapZenBonsaiClassic2LineageState({
                preparedCandidate: effectivePreparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_IDENTITY_ROTATION,
                rotatedFromTreeFingerprint: previousState.treeFingerprint,
                rotatedFromTreeIdentityFingerprint: previousState.treeIdentityFingerprint,
                rotatedFromIdentityRevision: previousState.identityRevision,
                rotatedFromStateRevision: previousState.stateRevision,
            });
        } else {
            nextState = reconcileZenBonsaiClassic2LineageState({
                previousState,
                preparedCandidate,
                lifeState,
                source: ZEN_BONSAI_CLASSIC2_LINEAGE_SOURCES.EPHEMERAL_PREVIEW_RECONCILE,
            });
        }
        return nextState;
    }, [
        enabled,
        lineageRequestSignature,
        resolvedMode,
    ]);
    useLayoutEffect(() => {
        if (
            !enabled
            || resolvedMode !== ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
        ) {
            committedEphemeralStateRef.current = null;
            return;
        }
        if (ephemeralState) {
            committedEphemeralStateRef.current = ephemeralState;
        }
    }, [enabled, ephemeralState, resolvedMode]);
    const [durableSnapshot, setDurableSnapshot] = useState(() => ({
        state: null,
        status: 'idle',
        committedRequestSignature: null,
    }));
    const [runtimeError, setRuntimeError] = useState(null);
    const requestEpochRef = useRef(0);
    const writeQueueRef = useRef(Promise.resolve());
    const repositoryRef = useRef(repository);
    const durableStateRef = useRef(durableSnapshot.state);
    const bootTraceContextRef = useRef(bootTraceContext);
    const onFirstVisualMilestoneRef = useRef(onFirstVisualMilestone);
    useLayoutEffect(() => {
        repositoryRef.current = repository;
        durableStateRef.current = durableSnapshot.state;
        bootTraceContextRef.current = bootTraceContext;
        onFirstVisualMilestoneRef.current = onFirstVisualMilestone;
    }, [
        bootTraceContext,
        durableSnapshot.state,
        onFirstVisualMilestone,
        repository,
    ]);

    if (runtimeError) {
        throw runtimeError;
    }

    // Durable writes are owned by the exact lineage request, not by React object
    // identity. Equivalent reconstructed topology/life objects therefore keep
    // the committed request ready without queueing another repository update.
    useEffect(() => {
        if (
            !enabled
            || resolvedMode !== ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.DURABLE_MAIN
        ) {
            return undefined;
        }

        const requestEpoch = requestEpochRef.current + 1;
        requestEpochRef.current = requestEpoch;
        let canceled = false;
        const committedState = durableStateRef.current;
        const committedIdentityMatches = (
            committedState?.treeIdentityFingerprint === treeIdentityFingerprint
            && committedState?.identityRevision >= identityRevision
        );
        const committedTreeMatches = committedState?.treeFingerprint === treeFingerprint;
        const committedCandidateMatches = committedIdentityMatches && committedTreeMatches;
        emitZenMainBootTrace('bonsai_lineage:reconcile_start', bootTraceContextRef.current, {
            mode: resolvedMode,
            phase: committedCandidateMatches ? 'reconciling' : 'hydrating',
            treeFingerprintLength: typeof treeFingerprint === 'string' ? treeFingerprint.length : 0,
            treeIdentityFingerprintLength: typeof treeIdentityFingerprint === 'string'
                ? treeIdentityFingerprint.length
                : 0,
            committedDecisionCount: Object.keys(committedState?.decisions || {}).length,
            identityRevision,
        });
        if (!committedCandidateMatches && typeof onFirstVisualMilestoneRef.current === 'function') {
            onFirstVisualMilestoneRef.current(createZenHomeFirstVisualBonsaiMilestoneEvent(
                ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_LINEAGE_WAIT,
                {
                    lineageMode: resolvedMode,
                    treeFingerprintLength: typeof treeFingerprint === 'string' ? treeFingerprint.length : 0,
                },
            ));
        }
        setDurableSnapshot((previous) => ({
            ...previous,
            status: committedCandidateMatches ? 'reconciling' : 'hydrating',
        }));

        void (async () => {
            const resolvedRepository = repositoryRef.current
                || ZenBonsaiProfileAggregateRepository.getInstance();
            const nextState = await enqueueWrite(writeQueueRef, () =>
                resolvedRepository.updateActiveLineageState({
                    expectedProfileEpoch: profileEpoch,
                    expectedIdentityRevision: identityRevision,
                    expectedIdentityFingerprint: treeIdentityFingerprint,
                    resolveLineage: (previousState) => (
                        resolveZenBonsaiClassic2DurableLineageUpdate({
                            previousState,
                            preparedCandidate,
                            lifeState,
                            treeIdentityFingerprint,
                        })
                    ),
                })
            );
            if (canceled || requestEpoch !== requestEpochRef.current) return;
            setDurableSnapshot({
                state: nextState,
                status: 'ready',
                committedRequestSignature: lineageRequestSignature,
            });
            emitZenMainBootTrace('bonsai_lineage:ready', bootTraceContextRef.current, {
                mode: resolvedMode,
                treeFingerprintLength: typeof treeFingerprint === 'string' ? treeFingerprint.length : 0,
                decisionCount: Object.keys(nextState?.decisions || {}).length,
                maxObservedGrowth: nextState?.maxObservedGrowth ?? null,
                identityRevision: nextState?.identityRevision ?? null,
                stateRevision: nextState?.stateRevision ?? null,
                bootstrapSource: nextState?.bootstrap?.source || null,
            });
            if (typeof onFirstVisualMilestoneRef.current === 'function') {
                onFirstVisualMilestoneRef.current(createZenHomeFirstVisualBonsaiMilestoneEvent(
                    ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_LINEAGE_READY,
                    {
                        lineageMode: resolvedMode,
                        decisionCount: Object.keys(nextState?.decisions || {}).length,
                    },
                ));
            }
        })().catch((error) => {
            if (canceled || requestEpoch !== requestEpochRef.current) return;
            const errorCode = String(error?.message || error || 'ZEN_BONSAI_CLASSIC2_LINEAGE_UNKNOWN_ERROR');
            emitZenMainBootTrace('bonsai_lineage:failed', bootTraceContextRef.current, {
                mode: resolvedMode,
                errorCode,
                treeFingerprintLength: typeof treeFingerprint === 'string' ? treeFingerprint.length : 0,
            });
            if (typeof onFirstVisualMilestoneRef.current === 'function') {
                onFirstVisualMilestoneRef.current(createZenHomeFirstVisualBonsaiMilestoneEvent(
                    ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_LINEAGE_FAILED,
                    {
                        lineageMode: resolvedMode,
                        errorCode,
                    },
                ));
            }
            setRuntimeError(error);
        });

        return () => {
            canceled = true;
        };
    }, [
        enabled,
        lineageRequestSignature,
        resolvedMode,
    ]);

    const state = resolvedMode === ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
        ? ephemeralState
        : durableSnapshot.state;
    const committedRequestSignature = (
        resolvedMode === ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
            ? lineageRequestSignature
            : durableSnapshot.committedRequestSignature
    );
    const ready = !enabled || (
        state?.treeIdentityFingerprint === treeIdentityFingerprint
        && state?.identityRevision >= identityRevision
        && state?.treeFingerprint === treeFingerprint
        && committedRequestSignature === lineageRequestSignature
    );
    const materializationReady = (() => {
        // `ready` intentionally treats a disabled lineage runtime as settled;
        // materialization identity requires a committed, revisioned lineage.
        if (!enabled || !ready) {
            return false;
        }
        if (!Number.isSafeInteger(state?.stateRevision) || state.stateRevision < 1) {
            throw new Error('ZEN_BONSAI_CLASSIC2_LINEAGE_STATE_REVISION_INVALID');
        }
        return true;
    })();
    const diagnostics = useMemo(
        () => (state ? summarizeZenBonsaiClassic2LineageState(state) : null),
        [state],
    );

    return Object.freeze({
        state,
        ready,
        materializationReady,
        status: !enabled
            ? 'disabled'
            : (resolvedMode === ZEN_BONSAI_CLASSIC2_LINEAGE_RUNTIME_MODES.EPHEMERAL_PREVIEW
                ? 'ready'
                : durableSnapshot.status),
        mode: resolvedMode,
        treeFingerprint,
        candidateCarrierFingerprint,
        renderBinding,
        physicalNodeCount: renderBinding?.physicalNodeCount ?? null,
        physicalTrunkSpanCount: renderBinding?.physicalTrunkSpanCount ?? null,
        treeIdentityFingerprint,
        identityRevision,
        profileEpoch,
        stateRevision: state?.stateRevision ?? null,
        cultivationHistorySignature,
        requestSignature: lineageRequestSignature,
        committedRequestSignature,
        diagnostics,
    });
}

export default useZenBonsaiClassic2LineageRuntime;
