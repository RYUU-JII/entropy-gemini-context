import {
    SAKURA_GENERATION_SEMANTICS_ID,
} from './v2/SakuraLearningSemantics.js';

export const SAKURA_AB_QUESTION_LANE_POLICY_VERSION = 1;
export const SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE = 5;

export const SAKURA_AB_QUESTION_LANE = Object.freeze({
    PREFERENCE_BASIN: 'preference_basin',
    STRUCTURAL_DISCOVERY: 'structural_discovery',
    SOBOL_COLD_START: 'sobol_cold_start',
});

export const SAKURA_AB_QUESTION_PAIR_TYPE = Object.freeze({
    ISOLATION: 'isolation_pair',
    FORM_DISCOVERY: 'form_discovery_pair',
    SOBOL_COLD_START: 'sobol_cold_start',
});

const QUESTION_LANES = new Set(Object.values(SAKURA_AB_QUESTION_LANE));

const hasOwn = (value, key) => Boolean(
    value
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key)
);

const requireRoundIndex = (value) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new Error(`ZEN_SAKURA_AB_QUESTION_LANE_ROUND_INVALID:${String(value)}`);
    }
    return numeric;
};

const requireDiscoveryOrdinal = (value) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new Error(`ZEN_SAKURA_AB_QUESTION_LANE_DISCOVERY_ORDINAL_INVALID:${String(value)}`);
    }
    return numeric;
};

export const requireSakuraABQuestionLane = (value) => {
    if (typeof value !== 'string' || !QUESTION_LANES.has(value)) {
        throw new Error(`ZEN_SAKURA_AB_QUESTION_LANE_INVALID:${String(value)}`);
    }
    return value;
};

export const resolveSakuraABQuestionLaneHistoryCursor = (abHistory = []) => {
    if (!Array.isArray(abHistory)) {
        throw new TypeError('ZEN_SAKURA_AB_QUESTION_LANE_HISTORY_ARRAY_REQUIRED');
    }

    let roundOrdinal = 0;
    let discoveryOrdinal = 0;
    abHistory.forEach((entry) => {
        const query = entry?.query;
        const context = entry?.generationContext;
        if (context?.generationSemantics !== SAKURA_GENERATION_SEMANTICS_ID) {
            return;
        }
        const queryLane = hasOwn(query, 'questionLane')
            ? requireSakuraABQuestionLane(query.questionLane)
            : null;
        const contextLane = hasOwn(context, 'questionLane')
            ? requireSakuraABQuestionLane(context.questionLane)
            : null;
        if (queryLane && contextLane && queryLane !== contextLane) {
            throw new Error('ZEN_SAKURA_AB_QUESTION_LANE_HISTORY_MISMATCH');
        }
        const questionLane = queryLane || contextLane;
        if (!questionLane) {
            return;
        }
        const queryKind = String(query?.kind || context?.queryKind || '').trim().toLowerCase();
        if (queryKind === 'anchor') {
            return;
        }
        roundOrdinal += 1;
        if (questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) {
            discoveryOrdinal += 1;
        }
    });

    return Object.freeze({
        roundOrdinal,
        discoveryOrdinal,
    });
};

export const resolveSakuraABQuestionLanePolicy = ({
    roundIndex = 0,
    coldStart = false,
    discoveryOrdinal = null,
} = {}) => {
    const resolvedRoundIndex = requireRoundIndex(roundIndex);
    if (coldStart) {
        return {
            version: SAKURA_AB_QUESTION_LANE_POLICY_VERSION,
            questionLane: SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START,
            pairType: SAKURA_AB_QUESTION_PAIR_TYPE.SOBOL_COLD_START,
            strategy: 'discover',
            sharedSeed: true,
            controlledAttribution: true,
            discoveryOrdinal: null,
            cadence: SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE,
        };
    }

    const structuralDiscovery = resolvedRoundIndex > 0
        && resolvedRoundIndex % SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE === 0;
    if (!structuralDiscovery) {
        return {
            version: SAKURA_AB_QUESTION_LANE_POLICY_VERSION,
            questionLane: SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN,
            pairType: SAKURA_AB_QUESTION_PAIR_TYPE.ISOLATION,
            strategy: 'isolate',
            sharedSeed: true,
            controlledAttribution: true,
            discoveryOrdinal: null,
            cadence: SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE,
        };
    }

    const resolvedDiscoveryOrdinal = discoveryOrdinal === null
        ? Math.floor(
            (resolvedRoundIndex - 1) / SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE,
        )
        : requireDiscoveryOrdinal(discoveryOrdinal);
    return {
        version: SAKURA_AB_QUESTION_LANE_POLICY_VERSION,
        questionLane: SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY,
        pairType: SAKURA_AB_QUESTION_PAIR_TYPE.FORM_DISCOVERY,
        strategy: 'discover',
        sharedSeed: true,
        controlledAttribution: false,
        discoveryOrdinal: resolvedDiscoveryOrdinal,
        cadence: SAKURA_AB_STRUCTURAL_DISCOVERY_CADENCE,
    };
};
