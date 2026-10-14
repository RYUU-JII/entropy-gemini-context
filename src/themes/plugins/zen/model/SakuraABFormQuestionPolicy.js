import {
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
} from './bonsai/morphology/BonsaiFormReachabilityPolicy.js';
import {
    requireBonsaiMorphologyEvidenceV1,
} from './bonsai/morphology/BonsaiMorphologyEvidenceContract.js';
import {
    requireSakuraABQuestionLane,
    SAKURA_AB_QUESTION_LANE,
} from './SakuraABQuestionLanePolicy.js';

export const SAKURA_AB_FORM_QUESTION_POLICY_VERSION = 1;
export const SAKURA_AB_FORM_QUESTION_POLICY_ID = (
    'sakura_ab_form_balanced_coverage_and_within_form_preference_v1'
);

const SUPPORTED_FORM_SET = new Set(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS);

const requireNonNegativeInteger = (value, field) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new Error(`ZEN_SAKURA_AB_FORM_QUESTION_INTEGER_INVALID:${field}`);
    }
    return numeric;
};

const readEvidenceFormId = (candidate = null) => {
    if (!candidate?.morphologyEvidence) return null;
    return requireBonsaiMorphologyEvidenceV1(candidate.morphologyEvidence).targetFormId;
};

const resolveHistoryQuestionLane = (entry = null) => {
    const queryLane = entry?.query?.questionLane === undefined
        ? null
        : requireSakuraABQuestionLane(entry.query.questionLane);
    const contextLane = entry?.generationContext?.questionLane === undefined
        ? null
        : requireSakuraABQuestionLane(entry.generationContext.questionLane);
    if (queryLane && contextLane && queryLane !== contextLane) {
        throw new Error('ZEN_SAKURA_AB_FORM_QUESTION_HISTORY_LANE_MISMATCH');
    }
    return queryLane || contextLane;
};

const rotate = (values, offset) => {
    if (!values.length) return [];
    const start = offset % values.length;
    return [...values.slice(start), ...values.slice(0, start)];
};

export const summarizeSakuraABFormQuestionCoverage = (history = []) => {
    if (!Array.isArray(history)) {
        throw new TypeError('ZEN_SAKURA_AB_FORM_QUESTION_HISTORY_ARRAY_REQUIRED');
    }
    const proposalCounts = Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, 0]),
    );
    const withinFormQuestionCounts = Object.fromEntries(
        BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.map((formId) => [formId, 0]),
    );
    history.forEach((entry) => {
        const questionLane = resolveHistoryQuestionLane(entry);
        if (!questionLane) return;
        const formA = readEvidenceFormId(entry?.A);
        const formB = readEvidenceFormId(entry?.B);
        if (questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) {
            if (formA && SUPPORTED_FORM_SET.has(formA)) proposalCounts[formA] += 1;
            if (formB && SUPPORTED_FORM_SET.has(formB)) proposalCounts[formB] += 1;
            return;
        }
        if (
            (questionLane === SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN
                || questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START)
            && formA
            && formA === formB
        ) {
            withinFormQuestionCounts[formA] += 1;
        }
    });
    return Object.freeze({
        version: SAKURA_AB_FORM_QUESTION_POLICY_VERSION,
        policyId: SAKURA_AB_FORM_QUESTION_POLICY_ID,
        proposalCounts: Object.freeze(proposalCounts),
        withinFormQuestionCounts: Object.freeze(withinFormQuestionCounts),
    });
};

const orderFormsByCoverage = ({ counts, roundIndex }) => {
    const rotation = requireNonNegativeInteger(roundIndex, 'roundIndex')
        % BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.length;
    const stableOrder = rotate(BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS, rotation);
    const stableRank = new Map(stableOrder.map((formId, index) => [formId, index]));
    return [...BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS].sort((left, right) => (
        Number(counts[left] || 0) - Number(counts[right] || 0)
        || stableRank.get(left) - stableRank.get(right)
    ));
};

export const resolveSakuraABFormQuestionPlan = ({
    questionLane,
    trialIndex,
    roundIndex,
    sharedVariantSeed,
    history = [],
} = {}) => {
    const lane = requireSakuraABQuestionLane(questionLane);
    const trial = requireNonNegativeInteger(trialIndex, 'trialIndex');
    const round = requireNonNegativeInteger(roundIndex, 'roundIndex');
    const variantSeed = requireNonNegativeInteger(sharedVariantSeed, 'sharedVariantSeed');
    const coverage = summarizeSakuraABFormQuestionCoverage(history);
    const discovery = lane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY;
    const counts = discovery
        ? coverage.proposalCounts
        : coverage.withinFormQuestionCounts;
    const orderedForms = orderFormsByCoverage({ counts, roundIndex: round });

    let formIdA;
    let formIdB;
    if (discovery) {
        // Pair opposite halves of the coverage-ordered slate. Adjacent canonical
        // forms (for example formal/umbrella) can be too similar on a small card;
        // half-turn pairing preserves one-use-per-slate coverage while proposing
        // a stronger form contrast for the screen-distance gate to verify.
        const half = orderedForms.length / 2;
        const pairOffset = trial % half;
        formIdA = orderedForms[pairOffset];
        formIdB = orderedForms[pairOffset + half];
        if (formIdA === formIdB) {
            throw new Error('ZEN_SAKURA_AB_FORM_DISCOVERY_REQUIRES_DISTINCT_FORMS');
        }
    } else {
        formIdA = orderedForms[trial % orderedForms.length];
        formIdB = formIdA;
    }

    return Object.freeze({
        version: SAKURA_AB_FORM_QUESTION_POLICY_VERSION,
        policyId: SAKURA_AB_FORM_QUESTION_POLICY_ID,
        questionLane: lane,
        relation: discovery ? 'cross_form_coverage' : 'within_form_preference',
        formIdA,
        formIdB,
        formVariantSeedA: variantSeed,
        formVariantSeedB: variantSeed,
        coverage,
    });
};
