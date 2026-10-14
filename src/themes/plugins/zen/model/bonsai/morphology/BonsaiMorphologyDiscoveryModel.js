import { BONSAI_FORM_ID } from './BonsaiFormClassifier';
import { BonsaiFormReachabilityPolicy } from './BonsaiFormReachabilityPolicy';
import { BonsaiMorphologyInfluenceModel } from './BonsaiMorphologyInfluenceModel';

export const BONSAI_MORPHOLOGY_DISCOVERY_VERSION = 1;

const UNCLASSIFIED_ID = 'unclassified';
const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const quantile = (values, ratio) => {
    const ordered = [...values].sort((left, right) => left - right);
    const position = (ordered.length - 1) * ratio;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return ordered[lower];
    const weight = position - lower;
    return ordered[lower] + ((ordered[upper] - ordered[lower]) * weight);
};

const cloneFactorLatent = (latent, factorKeys) => Object.fromEntries(
    factorKeys.map((key) => [key, Number(latent[key])]),
);

const requireDiscoverySamples = (samples, factorKeys) => {
    if (!Array.isArray(samples) || samples.length < 8) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_DISCOVERY_SAMPLE_COUNT_INSUFFICIENT:${samples?.length || 0}`);
    }
    if (!Array.isArray(factorKeys) || !factorKeys.length) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_DISCOVERY_FACTOR_KEYS_REQUIRED');
    }
    samples.forEach((sample, index) => {
        const classification = sample?.structuralMorphology?.classification;
        if (!classification || !Array.isArray(classification.memberships)) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_DISCOVERY_CLASSIFICATION_REQUIRED:${index}`);
        }
        if (!Number.isFinite(Number(classification.threshold))) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_DISCOVERY_THRESHOLD_REQUIRED:${index}`);
        }
        factorKeys.forEach((key) => {
            if (!Number.isFinite(Number(sample?.latent?.[key]))) {
                throw new Error(`ZEN_BONSAI_MORPHOLOGY_DISCOVERY_FACTOR_VALUE_REQUIRED:${index}:${key}`);
            }
        });
    });
};

export class BonsaiMorphologyDiscoveryModel {
    static analyze(samples = [], { factorKeys = null, maxDriversPerForm = 6 } = {}) {
        const resolvedFactorKeys = Array.isArray(factorKeys)
            ? [...new Set(factorKeys)]
            : [];
        requireDiscoverySamples(samples, resolvedFactorKeys);
        const thresholds = new Set(samples.map((sample) => (
            Number(sample.structuralMorphology.classification.threshold)
        )));
        if (thresholds.size !== 1) {
            throw new Error('ZEN_BONSAI_MORPHOLOGY_DISCOVERY_THRESHOLD_DRIFT');
        }
        const classificationThreshold = [...thresholds][0];
        const influence = BonsaiMorphologyInfluenceModel.analyze(samples, {
            factorKeys: resolvedFactorKeys,
            maxDriversPerForm,
        });
        const primaryFormCounts = {
            [UNCLASSIFIED_ID]: 0,
            ...Object.fromEntries(Object.values(BONSAI_FORM_ID).map((formId) => [formId, 0])),
        };
        samples.forEach((sample) => {
            const formId = sample.structuralMorphology.classification.primaryFormId;
            primaryFormCounts[formId || UNCLASSIFIED_ID] += 1;
        });

        const byForm = {};
        Object.values(BONSAI_FORM_ID).forEach((formId) => {
            const rows = samples.map((sample) => {
                const membership = sample.structuralMorphology.classification.memberships
                    .find((entry) => entry.id === formId);
                if (!membership || !Number.isFinite(Number(membership.score))) {
                    throw new Error(`ZEN_BONSAI_MORPHOLOGY_DISCOVERY_MEMBERSHIP_REQUIRED:${formId}`);
                }
                return {
                    sample,
                    score: Number(membership.score),
                };
            });
            const ordered = [...rows].sort((left, right) => (
                right.score - left.score
                || Number(left.sample.seed) - Number(right.sample.seed)
            ));
            const scores = rows.map((row) => row.score);
            const top = ordered[0];
            const p90 = quantile(scores, 0.9);
            const classifiedPrimaryCount = primaryFormCounts[formId];
            const reachability = BonsaiFormReachabilityPolicy.evaluate({
                formId,
                sampleCount: samples.length,
                classifiedPrimaryCount,
                p90Membership: p90,
                maxMembership: top.score,
                classificationThreshold,
            });
            byForm[formId] = {
                meanMembership: round(mean(scores)),
                p90Membership: round(p90),
                maxMembership: round(top.score),
                classifiedPrimaryCount,
                primaryRate: reachability.primaryRate,
                status: reachability.status,
                statusReason: reachability.reason,
                topologySupported: reachability.topologySupported,
                // Compatibility-only projection. Canonical consumers must use
                // status and reachabilitySummary instead of this broad legacy flag.
                observedReachable: reachability.observedReachable,
                topSample: {
                    seed: Number(top.sample.seed),
                    latent: cloneFactorLatent(top.sample.latent, resolvedFactorKeys),
                },
                drivers: influence.byForm[formId].drivers,
            };
        });
        const reachabilitySummary = BonsaiFormReachabilityPolicy.summarize(byForm, {
            sampleCount: samples.length,
            classificationThreshold,
        });

        const observedReachableFormIds = Object.entries(byForm)
            .filter(([, value]) => value.observedReachable)
            .map(([formId]) => formId);

        return {
            version: BONSAI_MORPHOLOGY_DISCOVERY_VERSION,
            sampleCount: samples.length,
            factorKeys: resolvedFactorKeys,
            classificationThreshold,
            canonicalReachabilityRule: reachabilitySummary.canonicalRule,
            reachabilitySummary,
            // Legacy compatibility rule for observedReachable* consumers.
            reachabilityRule: 'primary_count_positive_or_p90_membership_at_least_threshold_minus_0_08',
            primaryFormCounts,
            observedReachableFormIds,
            observedUnreachableFormIds: Object.values(BONSAI_FORM_ID).filter(
                (formId) => !observedReachableFormIds.includes(formId),
            ),
            design: influence.design,
            causalClaim: false,
            byForm,
        };
    }
}
