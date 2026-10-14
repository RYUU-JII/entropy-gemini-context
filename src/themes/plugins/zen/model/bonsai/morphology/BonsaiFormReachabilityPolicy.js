import { BONSAI_FORM_ID } from './BonsaiFormClassifier';

export const BONSAI_FORM_REACHABILITY_POLICY_VERSION = 1;

export const BONSAI_FORM_REACHABILITY_STATUS = Object.freeze({
    ESTABLISHED: 'established',
    RARE: 'rare',
    LATENT_ONLY: 'latent_only',
    UNREACHABLE: 'unreachable',
    UNSUPPORTED_TOPOLOGY: 'unsupported_topology',
});

export const BONSAI_FORM_REACHABILITY_THRESHOLDS = Object.freeze({
    establishedMinPrimaryRate: 0.05,
    establishedMinPrimaryCount: 3,
    latentOnlyMinP90Offset: 0,
    legacyObservedReachableP90Slack: 0.08,
});

export const BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS = Object.freeze([
    BONSAI_FORM_ID.FORMAL_UPRIGHT,
    BONSAI_FORM_ID.UMBRELLA_CROWN,
    BONSAI_FORM_ID.SLANTING,
    BONSAI_FORM_ID.INFORMAL_UPRIGHT,
    BONSAI_FORM_ID.LITERATI,
    BONSAI_FORM_ID.FULL_CASCADE,
    BONSAI_FORM_ID.SEMI_CASCADE,
    BONSAI_FORM_ID.WEEPING,
]);

export const BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS = Object.freeze([
    BONSAI_FORM_ID.TWIN_TRUNK,
    BONSAI_FORM_ID.MULTI_TRUNK,
]);

export const BONSAI_FORM_REACHABILITY_TOPOLOGY_CONTRACT = Object.freeze({
    id: 'single_root_v1',
    supportedTrunkCounts: Object.freeze([1]),
    supportedFormIds: BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
    unsupportedFormIds: BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS,
});

const VALID_FORM_IDS = new Set(Object.values(BONSAI_FORM_ID));
const VALID_STATUSES = new Set(Object.values(BONSAI_FORM_REACHABILITY_STATUS));
const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

const requireRateInput = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
        throw new Error(`ZEN_BONSAI_FORM_REACHABILITY_${label}_INVALID:${String(value)}`);
    }
    return number;
};

const requireCountInput = (value, label) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
        throw new Error(`ZEN_BONSAI_FORM_REACHABILITY_${label}_INVALID:${String(value)}`);
    }
    return number;
};

const resolveStatus = ({
    formId,
    primaryCount,
    primaryRate,
    p90Membership,
    classificationThreshold,
}) => {
    if (BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS.includes(formId)) {
        return {
            status: BONSAI_FORM_REACHABILITY_STATUS.UNSUPPORTED_TOPOLOGY,
            reason: 'current_single_root_topology_excludes_form',
        };
    }
    if (
        primaryCount >= BONSAI_FORM_REACHABILITY_THRESHOLDS.establishedMinPrimaryCount
        && primaryRate >= BONSAI_FORM_REACHABILITY_THRESHOLDS.establishedMinPrimaryRate
    ) {
        return {
            status: BONSAI_FORM_REACHABILITY_STATUS.ESTABLISHED,
            reason: 'primary_rate_and_count_meet_established_floor',
        };
    }
    if (primaryCount > 0) {
        return {
            status: BONSAI_FORM_REACHABILITY_STATUS.RARE,
            reason: 'primary_observed_below_established_floor',
        };
    }
    if (
        p90Membership >= classificationThreshold
            + BONSAI_FORM_REACHABILITY_THRESHOLDS.latentOnlyMinP90Offset
    ) {
        return {
            status: BONSAI_FORM_REACHABILITY_STATUS.LATENT_ONLY,
            reason: 'never_primary_but_p90_membership_meets_classifier_threshold',
        };
    }
    return {
        status: BONSAI_FORM_REACHABILITY_STATUS.UNREACHABLE,
        reason: 'no_primary_and_p90_membership_below_classifier_threshold',
    };
};

export class BonsaiFormReachabilityPolicy {
    static evaluate({
        formId,
        sampleCount,
        classifiedPrimaryCount,
        p90Membership,
        maxMembership,
        classificationThreshold,
    } = {}) {
        if (!VALID_FORM_IDS.has(formId)) {
            throw new Error(`ZEN_BONSAI_FORM_REACHABILITY_FORM_ID_INVALID:${String(formId)}`);
        }
        const resolvedSampleCount = requireCountInput(sampleCount, 'SAMPLE_COUNT');
        if (resolvedSampleCount < 1) {
            throw new Error('ZEN_BONSAI_FORM_REACHABILITY_SAMPLE_COUNT_INSUFFICIENT');
        }
        const primaryCount = requireCountInput(
            classifiedPrimaryCount,
            'PRIMARY_COUNT',
        );
        if (primaryCount > resolvedSampleCount) {
            throw new Error(
                `ZEN_BONSAI_FORM_REACHABILITY_PRIMARY_COUNT_EXCEEDS_SAMPLES:${primaryCount}:${resolvedSampleCount}`,
            );
        }
        const resolvedP90Membership = requireRateInput(p90Membership, 'P90_MEMBERSHIP');
        const resolvedMaxMembership = requireRateInput(maxMembership, 'MAX_MEMBERSHIP');
        const resolvedClassificationThreshold = requireRateInput(
            classificationThreshold,
            'CLASSIFICATION_THRESHOLD',
        );
        if (resolvedP90Membership > resolvedMaxMembership) {
            throw new Error('ZEN_BONSAI_FORM_REACHABILITY_P90_EXCEEDS_MAX');
        }

        const primaryRate = primaryCount / resolvedSampleCount;
        const resolvedStatus = resolveStatus({
            formId,
            primaryCount,
            primaryRate,
            p90Membership: resolvedP90Membership,
            classificationThreshold: resolvedClassificationThreshold,
        });
        const observedReachable = primaryCount > 0
            || resolvedP90Membership >= resolvedClassificationThreshold
                - BONSAI_FORM_REACHABILITY_THRESHOLDS.legacyObservedReachableP90Slack;

        return {
            ...resolvedStatus,
            primaryRate: round(primaryRate),
            topologySupported: resolvedStatus.status
                !== BONSAI_FORM_REACHABILITY_STATUS.UNSUPPORTED_TOPOLOGY,
            observedReachable,
        };
    }

    static summarize(byForm = {}, { sampleCount, classificationThreshold } = {}) {
        const resolvedSampleCount = requireCountInput(sampleCount, 'SUMMARY_SAMPLE_COUNT');
        if (resolvedSampleCount < 1) {
            throw new Error('ZEN_BONSAI_FORM_REACHABILITY_SUMMARY_SAMPLE_COUNT_INSUFFICIENT');
        }
        const resolvedClassificationThreshold = requireRateInput(
            classificationThreshold,
            'SUMMARY_CLASSIFICATION_THRESHOLD',
        );
        const entries = Object.values(BONSAI_FORM_ID).map((formId) => {
            const result = byForm?.[formId];
            if (!result || !VALID_STATUSES.has(result.status)) {
                throw new Error(`ZEN_BONSAI_FORM_REACHABILITY_STATUS_REQUIRED:${formId}`);
            }
            return [formId, result];
        });
        const byStatus = Object.fromEntries(
            Object.values(BONSAI_FORM_REACHABILITY_STATUS).map((status) => {
                const formIds = entries
                    .filter(([, result]) => result.status === status)
                    .map(([formId]) => formId);
                return [status, {
                    count: formIds.length,
                    formIds,
                }];
            }),
        );
        const primaryObservedFormIds = entries
            .filter(([, result]) => (
                result.status === BONSAI_FORM_REACHABILITY_STATUS.ESTABLISHED
                || result.status === BONSAI_FORM_REACHABILITY_STATUS.RARE
            ))
            .map(([formId]) => formId);

        return {
            version: BONSAI_FORM_REACHABILITY_POLICY_VERSION,
            canonicalRule: 'primary_rate_with_explicit_topology_support_v1',
            primaryRateDefinition: 'classifiedPrimaryCount/sampleCount',
            sampleCount: resolvedSampleCount,
            classificationThreshold: resolvedClassificationThreshold,
            thresholds: BONSAI_FORM_REACHABILITY_THRESHOLDS,
            topologyContract: BONSAI_FORM_REACHABILITY_TOPOLOGY_CONTRACT,
            primaryObservedFormIds,
            byStatus,
        };
    }
}
