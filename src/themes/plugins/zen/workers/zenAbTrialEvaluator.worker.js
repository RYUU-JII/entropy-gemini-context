import {
    BonsaiStructuralCandidateEvaluator,
    buildSakuraSobolColdStartPool,
    CandidateScoreModel,
    compileSakuraPhenotypeFromLatent,
    SakuraAdditivePairwiseGPModel,
    SakuraStructuralABSpecies,
} from '@/themes/plugins/zen/api/structuralAB.js';
import ZenWorkerModelRepository from '@/themes/plugins/zen/state/ZenWorkerModelRepository.js';
import { createZenThemeModelRuntime } from '@/themes/plugins/zen/runtime/createZenThemeModelRuntime.js';
import { normalizeTrialBatchPayload } from '../contracts/TrialContract.js';
import {
    createZenWorkerProfileGenerationLease,
    createZenWorkerRequestProfileGenerationLease,
} from '../contracts/ZenWorkerProfileGenerationContract.js';
import { serializeZenWorkerError } from '../model/ZenWorkerError.js';
import {
    requireBonsaiMorphologyEvidenceV1,
} from '../model/bonsai/morphology/BonsaiMorphologyEvidenceContract.js';
import {
    requireBonsaiStructuralComparisonPlanV1,
} from '../model/bonsai/rendering/BonsaiStructuralComparisonPlan.js';
import {
    requireSakuraSingleRootFormCompositionProvenanceV1,
} from '../model/sakura/sakuraSingleRootFormCompositionAdapter.js';
import {
    SAKURA_AB_QUESTION_LANE,
} from '../model/SakuraABQuestionLanePolicy.js';

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);
const workerRequestProfileGenerationLease = createZenWorkerRequestProfileGenerationLease();
let workerModelRepository = null;
let workerModelProfileGenerationLease = null;
const admitWorkerProfileGeneration = async (
    profileGeneration,
    { modelRepositoryRequired = false } = {},
) => {
    const admittedProfileGeneration = workerRequestProfileGenerationLease.admit(
        profileGeneration,
    );
    if (!modelRepositoryRequired) {
        return admittedProfileGeneration;
    }
    if (workerModelRepository === null) {
        workerModelRepository = new ZenWorkerModelRepository({
            profileGeneration: admittedProfileGeneration,
        });
    }
    if (workerModelProfileGenerationLease === null) {
        workerModelProfileGenerationLease = createZenWorkerProfileGenerationLease({
            modelRepository: workerModelRepository,
        });
    }
    return workerModelProfileGenerationLease.admit(admittedProfileGeneration);
};
const safeInteger = (value, fallback = null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.floor(numeric);
};
const cloneObject = (value) => (isPlainObject(value) ? { ...value } : null);
const cloneRenderProvenance = (value = null) => {
    if (!isPlainObject(value)) {
        return null;
    }
    const formComposition = value?.formComposition
        ? requireSakuraSingleRootFormCompositionProvenanceV1(value.formComposition)
        : null;
    return {
        ...value,
        stage: isPlainObject(value.stage) ? { ...value.stage } : null,
        ...(isPlainObject(value.spineGuide) ? {
            spineGuide: {
                ...value.spineGuide,
                anchors: Array.isArray(value.spineGuide.anchors)
                    ? value.spineGuide.anchors.map((anchor) => ({ ...anchor }))
                    : [],
            },
        } : {}),
        ...(isPlainObject(value.spineReferenceFamily) ? {
            spineReferenceFamily: {
                ...value.spineReferenceFamily,
                ...(isPlainObject(value.spineReferenceFamily.referenceGuide) ? {
                    referenceGuide: {
                        ...value.spineReferenceFamily.referenceGuide,
                        anchors: Array.isArray(value.spineReferenceFamily.referenceGuide.anchors)
                            ? value.spineReferenceFamily.referenceGuide.anchors.map(
                                (anchor) => ({ ...anchor }),
                            )
                            : [],
                    },
                } : {}),
            },
        } : {}),
        ...(formComposition ? { formComposition: { ...formComposition } } : {}),
    };
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const cloneModelInput = (value = null) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const next = {
        ...value,
    };
    if (value?.features && typeof value.features === 'object') {
        next.features = { ...value.features };
    }
    if (value?.latent && typeof value.latent === 'object') {
        next.latent = { ...value.latent };
    }
    return next;
};

const cloneMorphologyEvidence = (value = null) => {
    if (!value) return null;
    const evidence = requireBonsaiMorphologyEvidenceV1(value);
    return {
        ...evidence,
        vector: { ...evidence.vector },
        classification: {
            ...evidence.classification,
            secondaryFormIds: [...evidence.classification.secondaryFormIds],
            memberships: evidence.classification.memberships.map((entry) => ({ ...entry })),
        },
    };
};

const cloneStructuralComparisonPlan = (value = null) => {
    if (!value) return null;
    const plan = requireBonsaiStructuralComparisonPlanV1(value);
    return {
        ...plan,
        sceneBounds: { ...plan.sceneBounds },
        trunkPoints: plan.trunkPoints.map((point) => ({ ...point })),
        scaffoldPoints: plan.scaffoldPoints.map((point) => ({ ...point })),
        sourceCounts: { ...plan.sourceCounts },
    };
};

const normalizeStageProfiles = (stageProfiles = []) => (
    (Array.isArray(stageProfiles) ? stageProfiles : [])
        .map((entry) => ({
            id: safeString(entry?.id, 'stage_bloom'),
            stage: cloneObject(entry?.stage),
            weight: Number.isFinite(Number(entry?.weight)) ? Math.max(0, Number(entry.weight)) : 1,
        }))
        .filter((entry) => entry.stage)
);

const buildCandidateGenerationOptions = (
    baseOptions,
    { formId = null, formVariantSeed = null } = {},
) => ({
    ...(baseOptions || {}),
    ...(formId ? { formId, formVariantSeed } : {}),
});

const summarizeCandidate = (candidate = null) => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    return {
        seed: Number.isFinite(Number(candidate?.seed))
            ? Math.floor(Number(candidate.seed))
            : null,
        dna: cloneObject(candidate?.dna),
        phenotype: cloneObject(candidate?.phenotype),
        metric: candidate?.analysis?.features ? cloneObject(candidate.analysis) : cloneObject(candidate.metric),
        modelInput: cloneModelInput(candidate?.modelInput),
        scores: isPlainObject(candidate?.scores) ? { ...candidate.scores } : null,
        feasibility: cloneObject(candidate?.feasibility),
        latent: cloneObject(candidate?.latent),
        render: cloneRenderProvenance(candidate?.render),
        morphologyEvidence: cloneMorphologyEvidence(candidate?.morphologyEvidence),
        structuralComparisonPlan: cloneStructuralComparisonPlan(
            candidate?.structuralComparisonPlan,
        ),
    };
};

const resolveSpecies = (treeType = 'sakura') => {
    if (treeType === 'sakura') {
        return SakuraStructuralABSpecies;
    }
    return null;
};
const buildRequestDiagnostics = (type, payload = {}) => {
    const details = {
        requestType: safeString(type, 'UNKNOWN'),
    };
    if (!isPlainObject(payload)) {
        return details;
    }
    if (type === 'BUILD_SOBOL_COLD_START_POOL') {
        return {
            ...details,
            phase: 'build_sobol_cold_start_pool',
            treeType: safeString(payload?.treeType, null),
            width: safeInteger(payload?.width, null),
            height: safeInteger(payload?.height, null),
            topologyHeight: Number.isFinite(Number(payload?.topologyHeight))
                ? Number(payload.topologyHeight)
                : null,
            stageProfileCount: Array.isArray(payload?.stageProfiles)
                ? payload.stageProfiles.length
                : 0,
            referenceFeatureCount: Array.isArray(payload?.referenceFeatures)
                ? payload.referenceFeatures.length
                : 0,
            sourceCount: safeInteger(payload?.sourceCount, null),
            survivorCount: safeInteger(payload?.survivorCount, null),
            learningKeyspaceProfile: safeString(payload?.learningKeyspaceProfile, null),
        };
    }
    if (type === 'EVALUATE_TRIAL_BATCH') {
        const questionLanes = Array.from(new Set([
            ...(Array.isArray(payload?.trials) ? payload.trials : []),
            ...(Array.isArray(payload?.candidates) ? payload.candidates : []),
        ].map((entry) => safeString(entry?.questionLane, null)).filter(Boolean)));
        return {
            ...details,
            phase: 'evaluate_trial_batch',
            treeType: safeString(payload?.treeType, null),
            width: safeInteger(payload?.width, null),
            height: safeInteger(payload?.height, null),
            topologyHeight: Number.isFinite(Number(payload?.topologyHeight))
                ? Number(payload.topologyHeight)
                : null,
            stageProfileCount: Array.isArray(payload?.stageProfiles)
                ? payload.stageProfiles.length
                : 0,
            referenceFeatureCount: Array.isArray(payload?.referenceFeatures)
                ? payload.referenceFeatures.length
                : 0,
            trialCount: Array.isArray(payload?.trials)
                ? payload.trials.length
                : 0,
            candidateCount: Array.isArray(payload?.candidates)
                ? payload.candidates.length
                : 0,
            questionLanes,
            learningKeyspaceProfile: safeString(payload?.learningKeyspaceProfile, null),
        };
    }
    return details;
};

const loadModels = async (payload = {}) => {
    if (workerModelRepository === null) {
        throw new Error('ZEN_AB_TRIAL_WORKER_MODEL_REPOSITORY_REQUIRED');
    }
    const lanes = [
        ...(Array.isArray(payload?.trials) ? payload.trials : []),
        ...(Array.isArray(payload?.candidates) ? payload.candidates : []),
    ].map((entry) => safeString(entry?.questionLane, null)).filter(Boolean);
    const structuralCoverageOnly = lanes.length > 0 && lanes.every((lane) => (
        lane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY
    ));
    const objectiveMode = structuralCoverageOnly ? 'neutral' : 'pairwise';
    const skipModelLoad = payload?.skipModelLoad === true;
    const zenThemeModelRuntime = createZenThemeModelRuntime({
        modelStateStore: workerModelRepository,
    });
    const { zenThemeModelState, modelSaveCoordinator } = zenThemeModelRuntime;
    let pairwiseBrain = null;

    if (!skipModelLoad && !structuralCoverageOnly) {
        pairwiseBrain = new SakuraAdditivePairwiseGPModel({
            learningKeyspaceProfile: safeString(payload?.learningKeyspaceProfile),
            zenThemeModelState,
            modelSaveCoordinator,
        });
        await pairwiseBrain.load();
    }

    return {
        brain: null,
        pairwiseBrain,
        objectiveMode,
        acquisitionObjective: structuralCoverageOnly
            ? 'morphology_coverage'
            : 'latent_and_morphology_preference',
    };
};

const evaluateTrialBatch = async (payload = {}) => {
    const normalizedPayload = normalizeTrialBatchPayload(payload);
    const treeType = safeString(normalizedPayload?.treeType, 'sakura');
    const species = resolveSpecies(treeType);
    const height = Math.max(1, Math.floor(Number(normalizedPayload?.height || 0)));
    const topologyHeight = Number.isFinite(Number(normalizedPayload?.topologyHeight))
        ? Number(normalizedPayload.topologyHeight)
        : height;
    const stageProfiles = normalizeStageProfiles(normalizedPayload?.stageProfiles);
    const trials = Array.isArray(normalizedPayload?.trials) ? normalizedPayload.trials : [];
    const candidates = Array.isArray(normalizedPayload?.candidates)
        ? normalizedPayload.candidates
        : [];
    const generationOptions = normalizedPayload?.spineGuide
        ? { spineGuide: normalizedPayload.spineGuide }
        : normalizedPayload?.spineReferenceFamily
            ? { spineReferenceFamily: normalizedPayload.spineReferenceFamily }
            : null;

    if (!species || (!trials.length && !candidates.length) || !stageProfiles.length) {
        return { entries: [], candidates: [] };
    }

    const {
        brain,
        pairwiseBrain,
        objectiveMode,
        acquisitionObjective,
    } = await loadModels(normalizedPayload);
    const scoreModel = new CandidateScoreModel({
        brain,
        pairwiseBrain,
        continuityEnabled: false,
        objectiveMode,
    });
    const evaluator = new BonsaiStructuralCandidateEvaluator({
        treeType,
        species,
        stageProfiles,
        topologyHeight,
        scoreModel,
    });

    const candidateEntries = [];
    candidates.forEach((candidateSpec, index) => {
        const seed = Math.floor(Number(candidateSpec?.seed || 0));
        const latent = cloneObject(candidateSpec?.latent);
        if (!latent || !Number.isFinite(seed)) {
            return;
        }
        const phenotype = compileSakuraPhenotypeFromLatent(latent);
        const modelInput = { latent: { ...latent } };
        const candidate = evaluator.evaluate({
            seed,
            phenotype,
            modelInput,
            generationOptions: buildCandidateGenerationOptions(generationOptions, candidateSpec),
        });
        if (!candidate || candidate?.feasibility?.pass === false) {
            return;
        }
        candidate.render.acquisitionObjective = acquisitionObjective;
        candidate.latent = { ...latent };
        candidate.modelInput = {
            ...(candidate.modelInput || {}),
            latent: { ...latent },
        };
        candidateEntries.push({
            candidateIndex: Number.isFinite(Number(candidateSpec?.candidateIndex))
                ? Math.max(0, Math.floor(Number(candidateSpec.candidateIndex)))
                : index,
            sourceTrialIndex: Number.isFinite(Number(candidateSpec?.sourceTrialIndex))
                ? Math.max(0, Math.floor(Number(candidateSpec.sourceTrialIndex)))
                : null,
            questionLane: safeString(candidateSpec?.questionLane, null),
            side: safeString(candidateSpec?.side, null),
            strategy: safeString(candidateSpec?.strategy, 'discover'),
            sharedSeedApplied: Boolean(candidateSpec?.sharedSeedApplied),
            context: cloneObject(candidateSpec?.context),
            candidate: summarizeCandidate(candidate),
        });
    });

    if (candidates.length) {
        return {
            entries: [],
            candidates: candidateEntries,
        };
    }

    const entries = [];
    trials.forEach((trial, index) => {
        const seedA = Math.floor(Number(trial?.seedA || 0));
        const seedB = Math.floor(Number(trial?.seedB || 0));
        const latentA = cloneObject(trial?.latentA);
        const latentB = cloneObject(trial?.latentB);
        if (!latentA || !latentB || !Number.isFinite(seedA) || !Number.isFinite(seedB)) {
            return;
        }
        const phenotypeA = compileSakuraPhenotypeFromLatent(latentA);
        const phenotypeB = compileSakuraPhenotypeFromLatent(latentB);
        const modelInputA = latentA ? { latent: { ...latentA } } : null;
        const modelInputB = latentB ? { latent: { ...latentB } } : null;
        const candidateA = evaluator.evaluate({
            seed: seedA,
            phenotype: phenotypeA,
            modelInput: modelInputA,
            generationOptions: buildCandidateGenerationOptions(generationOptions, {
                formId: trial?.formIdA,
                formVariantSeed: trial?.formVariantSeedA,
            }),
        });
        const candidateB = evaluator.evaluate({
            seed: seedB,
            phenotype: phenotypeB,
            modelInput: modelInputB,
            generationOptions: buildCandidateGenerationOptions(generationOptions, {
                formId: trial?.formIdB,
                formVariantSeed: trial?.formVariantSeedB,
            }),
        });
        if (!candidateA || !candidateB) {
            return;
        }
        if (candidateA?.feasibility?.pass === false || candidateB?.feasibility?.pass === false) {
            return;
        }
        candidateA.render.acquisitionObjective = acquisitionObjective;
        candidateB.render.acquisitionObjective = acquisitionObjective;
        if (latentA) {
            candidateA.latent = { ...latentA };
            candidateA.modelInput = {
                ...(candidateA.modelInput || {}),
                latent: { ...latentA },
            };
        }
        if (latentB) {
            candidateB.latent = { ...latentB };
            candidateB.modelInput = {
                ...(candidateB.modelInput || {}),
                latent: { ...latentB },
            };
        }
        entries.push({
            trialIndex: Number.isFinite(Number(trial?.trialIndex))
                ? Math.max(0, Math.floor(Number(trial.trialIndex)))
                : index,
            questionLane: safeString(trial?.questionLane, null),
            strategy: safeString(trial?.strategy, 'isolate'),
            sharedSeedApplied: Boolean(trial?.sharedSeedApplied),
            context: cloneObject(trial?.context),
            candidateA: summarizeCandidate(candidateA),
            candidateB: summarizeCandidate(candidateB),
        });
    });

    return {
        entries,
        candidates: [],
    };
};

const buildColdStartPool = async (payload = {}) => {
    const treeType = safeString(payload?.treeType, 'sakura');
    const species = resolveSpecies(treeType);
    const height = Math.max(1, Math.floor(Number(payload?.height || 0)));
    const topologyHeight = Number.isFinite(Number(payload?.topologyHeight))
        ? Number(payload.topologyHeight)
        : height;
    const stageProfiles = normalizeStageProfiles(payload?.stageProfiles);
    const sourceCount = clamp(Math.floor(Number(payload?.sourceCount || 128)), 8, 512);
    const survivorCount = clamp(Math.floor(Number(payload?.survivorCount || 64)), 2, Math.min(256, sourceCount));
    const seed = Number.isFinite(Number(payload?.seed))
        ? Math.floor(Number(payload.seed))
        : Math.floor(Date.now() % 1000000);
    const anchorLatent = cloneObject(payload?.anchorLatent);
    const learningKeyspaceProfile = safeString(payload?.learningKeyspaceProfile, null);

    if (!species || !stageProfiles.length) {
        throw new Error('Sobol cold-start worker requires a supported species and non-empty stageProfiles.');
    }

    const evaluator = new BonsaiStructuralCandidateEvaluator({
        treeType,
        species,
        stageProfiles,
        topologyHeight,
    });
    const pool = buildSakuraSobolColdStartPool({
        sourceCount,
        survivorCount,
        seed,
        anchorLatent,
        learningKeyspaceProfile,
        evaluateLatent: (latent, index) => {
            const phenotype = compileSakuraPhenotypeFromLatent(latent);
            const candidate = evaluator.evaluate(
                {
                    seed: (seed + ((index + 1) * 7919)) % 1000000,
                    phenotype,
                    modelInput: { latent },
                },
            );
            return Boolean(candidate && candidate?.feasibility?.pass !== false);
        },
    });
    return {
        pool,
        sourceCount,
        survivorCount,
        seed,
        admissionSource: 'bonsai_structural_candidate_evaluator_v1',
    };
};

self.onmessage = async (event) => {
    const message = event?.data || {};
    const type = message?.type;
    const id = Number(message?.id);
    let admittedProfileGeneration = null;
    try {
        if (type === 'PING') {
            self.postMessage({ type: 'READY' });
            return;
        }
        if (type !== 'EVALUATE_TRIAL_BATCH' && type !== 'BUILD_SOBOL_COLD_START_POOL') {
            self.postMessage({
                type: 'ERROR',
                id,
                error: serializeZenWorkerError({
                    code: 'ZEN_AB_TRIAL_WORKER_MESSAGE_TYPE_INVALID',
                    message: `Unknown worker message type: ${String(type || 'UNKNOWN')}`,
                    details: {
                        receivedType: safeString(type, 'UNKNOWN'),
                    },
                }),
            });
            return;
        }
        admittedProfileGeneration = await admitWorkerProfileGeneration(
            message?.payload?.profileGeneration,
            { modelRepositoryRequired: type === 'EVALUATE_TRIAL_BATCH' },
        );
        const result = type === 'BUILD_SOBOL_COLD_START_POOL'
            ? await buildColdStartPool(message?.payload || {})
            : await evaluateTrialBatch(message?.payload || {});
        self.postMessage({
            type: 'RESULT',
            id,
            profileGeneration: admittedProfileGeneration,
            result,
        });
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            id,
            profileGeneration: admittedProfileGeneration
                || safeString(message?.payload?.profileGeneration, null),
            error: serializeZenWorkerError(error, {
                fallbackCode: type === 'BUILD_SOBOL_COLD_START_POOL'
                    ? 'ZEN_AB_TRIAL_WORKER_COLD_START_FAILED'
                    : 'ZEN_AB_TRIAL_WORKER_EVALUATION_FAILED',
                fallbackMessage: type === 'BUILD_SOBOL_COLD_START_POOL'
                    ? 'Zen A/B trial worker cold-start request failed.'
                    : 'Zen A/B trial worker evaluation request failed.',
                details: buildRequestDiagnostics(type, message?.payload || {}),
            }),
        });
    }
};

self.postMessage({ type: 'READY' });
