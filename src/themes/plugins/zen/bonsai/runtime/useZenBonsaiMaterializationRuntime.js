import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    buildZenBonsaiLifeSignature,
    normalizeZenBonsaiLifeState,
} from '../../model/ZenBonsaiLifecycle.js';
import {
    resolveZenBonsaiHabitSignal,
} from '../../model/ZenBonsaiHabitSignal.js';
import {
    isZenBonsaiEphemeralPresentationScene,
} from '../../model/ZenBonsaiPresentationPolicy.js';
import {
    emitZenMainBootTrace,
} from '../../runtime/zenMainBootReadinessTrace.js';
import ZenModelRepository from '../../state/ZenModelRepository.js';
import {
    resolveZenBonsaiEvidenceModel,
} from '../state/ZenBonsaiEvidenceModel.js';
import {
    resolveZenBonsaiTargetModel,
    usesZenBonsaiCultivationLedger,
} from '../state/ZenBonsaiTargetModel.js';
import {
    buildZenBonsaiMaterializationInputSignature,
} from '../state/ZenBonsaiMaterializationContract.js';
import ZenBonsaiCultivationRepository from '../storage/ZenBonsaiCultivationRepository.js';

export const ZEN_BONSAI_MATERIALIZATION_STATUS = Object.freeze({
    WAITING_FOR_EVIDENCE: 'waiting_for_evidence',
    MATERIALIZING_CURRENT: 'materializing_current',
    READY: 'ready',
});

const signatureLength = (value) => (
    typeof value === 'string' ? value.length : 0
);

const createMaterialization = ({
    inputSignature,
    evidence,
    targetLifeState,
    sourceKind,
} = {}) => {
    const lifeState = normalizeZenBonsaiLifeState(targetLifeState);
    const lifeSignature = buildZenBonsaiLifeSignature(lifeState);
    const value = Object.freeze({
        sourceKind,
        inputSignature,
        evidenceSignature: evidence.signature,
        siteSignature: evidence.siteSignature,
        lifeState,
        lifeSignature,
        materializationSignature: `${inputSignature}\u0000${evidence.signature}\u0000${lifeSignature}`,
    });
    return value;
};

export function useZenBonsaiMaterializationRuntime(input = null, {
    cultivationRepository = null,
    modelRepository = null,
    bootTraceContext = null,
} = {}) {
    const inputSignature = useMemo(
        () => buildZenBonsaiMaterializationInputSignature(input),
        [input],
    );
    // The canonical signature contains the complete renderer-facing request. Keep
    // one committed representative for an equivalent reconstructed input so parent
    // renders cannot repeat evidence/target/habit work for the same request. The
    // cache is committed in a layout effect so abandoned concurrent renders cannot
    // replace the representative observed by the mounted tree.
    const semanticInputCacheRef = useRef({ inputSignature, input });
    const semanticInput = semanticInputCacheRef.current.inputSignature === inputSignature
        ? semanticInputCacheRef.current.input
        : input;
    useLayoutEffect(() => {
        semanticInputCacheRef.current = { inputSignature, input: semanticInput };
    }, [inputSignature, semanticInput]);
    const evidence = useMemo(
        () => resolveZenBonsaiEvidenceModel(semanticInput),
        [semanticInput],
    );
    const ephemeralScene = useMemo(
        () => isZenBonsaiEphemeralPresentationScene(semanticInput),
        [semanticInput],
    );
    const ephemeralMaterialization = useMemo(() => {
        if (!evidence.authoritative || !ephemeralScene) {
            return null;
        }

        const targetModel = resolveZenBonsaiTargetModel({
            input: semanticInput,
            previousLedger: null,
            nowMs: 0,
        });
        if (targetModel.cultivationLedger !== null) {
            throw new Error('ZEN_BONSAI_EPHEMERAL_MATERIALIZATION_DURABLE_STATE_FORBIDDEN');
        }
        return createMaterialization({
            inputSignature,
            evidence,
            targetLifeState: targetModel.targetLifeState,
            sourceKind: 'ephemeral_presentation',
        });
    }, [ephemeralScene, evidence, inputSignature, semanticInput]);
    const [committedCurrentMaterialization, setCommittedCurrentMaterialization] = useState(null);
    const [runtimeError, setRuntimeError] = useState(null);
    const currentWorkRef = useRef(null);
    const committedCurrentMaterializationRef = useRef(committedCurrentMaterialization);
    const latestRequestSignatureRef = useRef(inputSignature);
    const latestInputRef = useRef(input);
    const latestEvidenceRef = useRef(evidence);
    const cultivationRepositoryRef = useRef(cultivationRepository);
    const modelRepositoryRef = useRef(modelRepository);
    const bootTraceContextRef = useRef(bootTraceContext);
    committedCurrentMaterializationRef.current = committedCurrentMaterialization;
    latestRequestSignatureRef.current = inputSignature;
    latestInputRef.current = semanticInput;
    latestEvidenceRef.current = evidence;
    cultivationRepositoryRef.current = cultivationRepository;
    modelRepositoryRef.current = modelRepository;
    bootTraceContextRef.current = bootTraceContext;

    if (runtimeError?.requestSignature === inputSignature) {
        throw runtimeError.error;
    }

    const selectedMaterialization = ephemeralScene
        ? ephemeralMaterialization
        : committedCurrentMaterialization;
    const materializationReady = Boolean(
        evidence.authoritative
        && selectedMaterialization?.inputSignature === inputSignature
    );
    const materialization = materializationReady
        ? selectedMaterialization
        : null;
    const materializationStatus = materializationReady
        ? ZEN_BONSAI_MATERIALIZATION_STATUS.READY
        : (evidence.authoritative && !ephemeralScene
            ? ZEN_BONSAI_MATERIALIZATION_STATUS.MATERIALIZING_CURRENT
            : ZEN_BONSAI_MATERIALIZATION_STATUS.WAITING_FOR_EVIDENCE);
    const habitSignal = useMemo(
        () => (materializationReady
            ? resolveZenBonsaiHabitSignal(semanticInput)
            : null),
        [materializationReady, semanticInput],
    );
    const hasInput = semanticInput !== null && semanticInput !== undefined;

    useEffect(() => {
        emitZenMainBootTrace('bonsai_materialization:evidence_state', bootTraceContextRef.current, {
            hasInput,
            authoritative: evidence.authoritative === true,
            inputSignatureLength: signatureLength(inputSignature),
            evidenceSignatureLength: signatureLength(evidence.signature),
            siteSignatureLength: signatureLength(evidence.siteSignature),
            ephemeralScene,
            materializationReady,
            materializationStatus,
            lifeSignatureLength: signatureLength(materialization?.lifeSignature),
            sourceKind: materialization?.sourceKind || null,
        });
    }, [
        ephemeralScene,
        evidence.authoritative,
        evidence.signature,
        evidence.siteSignature,
        hasInput,
        inputSignature,
        materialization?.lifeSignature,
        materialization?.sourceKind,
        materializationReady,
        materializationStatus,
    ]);

    useEffect(() => {
        if (
            !evidence.authoritative
            || ephemeralScene
            || committedCurrentMaterializationRef.current?.inputSignature === inputSignature
        ) {
            return undefined;
        }

        const requestSignature = inputSignature;
        const requestInput = latestInputRef.current;
        const requestEvidence = latestEvidenceRef.current;
        const nowMs = Date.now();
        let canceled = false;

        const materializeCurrent = async () => {
            if (canceled || latestRequestSignatureRef.current !== requestSignature) return;
            const useCultivationLedger = usesZenBonsaiCultivationLedger(requestInput);
            emitZenMainBootTrace('bonsai_materialization:current_start', bootTraceContextRef.current, {
                inputSignatureLength: signatureLength(requestSignature),
                evidenceSignatureLength: signatureLength(requestEvidence.signature),
                siteSignatureLength: signatureLength(requestEvidence.siteSignature),
                usesCultivationLedger: useCultivationLedger,
            });
            let resolvedCultivationRepository = null;
            let previousLedger = null;
            if (useCultivationLedger) {
                resolvedCultivationRepository = cultivationRepositoryRef.current;
                if (!resolvedCultivationRepository) {
                    const resolvedModelRepository = modelRepositoryRef.current
                        || ZenModelRepository.getInstance();
                    resolvedCultivationRepository = new ZenBonsaiCultivationRepository({
                        modelRepository: resolvedModelRepository,
                    });
                }
                previousLedger = await resolvedCultivationRepository.getCultivationLedger({ nowMs });
            }
            if (canceled || latestRequestSignatureRef.current !== requestSignature) return;

            const targetModel = resolveZenBonsaiTargetModel({
                input: requestInput,
                previousLedger,
                nowMs,
            });
            if (targetModel.cultivationLedger) {
                if (!resolvedCultivationRepository) {
                    throw new Error('ZEN_BONSAI_CURRENT_MATERIALIZATION_LEDGER_REPOSITORY_MISSING');
                }
                await resolvedCultivationRepository.setCultivationLedger(
                    targetModel.cultivationLedger,
                    { nowMs },
                );
            }
            if (canceled || latestRequestSignatureRef.current !== requestSignature) return;

            const nextMaterialization = createMaterialization({
                inputSignature: requestSignature,
                evidence: requestEvidence,
                targetLifeState: targetModel.targetLifeState,
                sourceKind: 'canonical_current',
            });
            setCommittedCurrentMaterialization(nextMaterialization);
            emitZenMainBootTrace('bonsai_materialization:current_ready', bootTraceContextRef.current, {
                inputSignatureLength: signatureLength(requestSignature),
                evidenceSignatureLength: signatureLength(requestEvidence.signature),
                siteSignatureLength: signatureLength(requestEvidence.siteSignature),
                lifeSignatureLength: signatureLength(nextMaterialization.lifeSignature),
                cultivationLedgerCommitted: targetModel.cultivationLedger !== null,
                sourceKind: nextMaterialization.sourceKind,
            });
        };
        // A new input must read the ledger only after an already admitted write
        // settles. Keep the complete read/derive/write transaction in order and
        // skip superseded waiting inputs before they touch storage.
        const previousWork = currentWorkRef.current;
        const work = (previousWork ? previousWork.then(materializeCurrent) : materializeCurrent()).catch((error) => {
            if (canceled || latestRequestSignatureRef.current !== requestSignature) return;
            setRuntimeError({
                requestSignature,
                error,
            });
        });
        currentWorkRef.current = work;
        void work.then(() => {
            if (currentWorkRef.current === work) currentWorkRef.current = null;
        });

        return () => {
            canceled = true;
        };
    }, [
        ephemeralScene,
        evidence.authoritative,
        inputSignature,
    ]);

    return Object.freeze({
        inputSignature,
        lifeState: materialization?.lifeState || null,
        lifeSignature: materialization?.lifeSignature || '',
        targetLifeState: materialization?.lifeState || null,
        targetSignature: materialization?.lifeSignature || '',
        materialization,
        materializationReady,
        materializationStatus,
        habitSignal,
    });
}

export default useZenBonsaiMaterializationRuntime;
