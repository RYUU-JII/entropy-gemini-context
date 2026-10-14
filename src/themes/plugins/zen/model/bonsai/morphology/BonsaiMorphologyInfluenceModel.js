import { BONSAI_FORM_ID } from './BonsaiFormClassifier';

export const BONSAI_MORPHOLOGY_INFLUENCE_VERSION = 1;

const MIN_SAMPLE_COUNT = 8;
const EPS = 1e-10;
const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const requireSample = (sample, index) => {
    if (!sample || typeof sample !== 'object') {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_SAMPLE_INVALID:${index}`);
    }
    if (!sample.latent || typeof sample.latent !== 'object' || Array.isArray(sample.latent)) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_SAMPLE_LATENT_REQUIRED:${index}`);
    }
    const memberships = sample?.structuralMorphology?.classification?.memberships;
    if (!Array.isArray(memberships)) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_SAMPLE_CLASSIFICATION_REQUIRED:${index}`);
    }
};

const resolveFormScores = (sample, index) => {
    const scores = new Map(
        sample.structuralMorphology.classification.memberships.map((entry) => (
            [entry?.id, Number(entry?.score)]
        )),
    );
    Object.values(BONSAI_FORM_ID).forEach((formId) => {
        if (!Number.isFinite(scores.get(formId))) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_FORM_SCORE_REQUIRED:${index}:${formId}`);
        }
    });
    return scores;
};

const resolveFactorKeys = (samples, explicitFactorKeys) => {
    const keys = Array.isArray(explicitFactorKeys) && explicitFactorKeys.length
        ? [...new Set(explicitFactorKeys)]
        : Object.keys(samples[0].latent).filter((key) => Number.isFinite(Number(samples[0].latent[key])));
    if (!keys.length) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_FACTOR_KEYS_REQUIRED');
    }
    samples.forEach((sample, sampleIndex) => {
        keys.forEach((key) => {
            if (!Number.isFinite(Number(sample.latent[key]))) {
                throw new Error(`ZEN_BONSAI_MORPHOLOGY_FACTOR_VALUE_REQUIRED:${sampleIndex}:${key}`);
            }
        });
    });
    return keys;
};

const pearson = (pairs) => {
    if (pairs.length < 3) return 0;
    const xs = pairs.map((pair) => pair.x);
    const ys = pairs.map((pair) => pair.y);
    const meanX = mean(xs);
    const meanY = mean(ys);
    let covariance = 0;
    let varianceX = 0;
    let varianceY = 0;
    pairs.forEach((pair) => {
        const dx = pair.x - meanX;
        const dy = pair.y - meanY;
        covariance += dx * dy;
        varianceX += dx * dx;
        varianceY += dy * dy;
    });
    if (varianceX <= EPS || varianceY <= EPS) return 0;
    return covariance / Math.sqrt(varianceX * varianceY);
};

const residualizeBySeed = (rows) => {
    const groups = new Map();
    rows.forEach((row) => {
        const key = Number.isFinite(Number(row.seed)) ? String(Math.floor(Number(row.seed))) : 'unseeded';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });
    const repeatedGroups = [...groups.values()].filter((group) => group.length >= 2);
    if (!repeatedGroups.length) {
        return {
            method: 'global_association',
            pairs: rows.map(({ x, y }) => ({ x, y })),
            seedBlockCount: 0,
        };
    }
    return {
        method: 'seed_blocked_association',
        pairs: repeatedGroups.flatMap((group) => {
            const meanX = mean(group.map((row) => row.x));
            const meanY = mean(group.map((row) => row.y));
            return group.map((row) => ({ x: row.x - meanX, y: row.y - meanY }));
        }),
        seedBlockCount: repeatedGroups.length,
    };
};

const quartileContrast = (rows) => {
    const ordered = [...rows].sort((left, right) => left.x - right.x);
    const lowThreshold = ordered[Math.floor((ordered.length - 1) * 0.25)].x;
    const highThreshold = ordered[Math.ceil((ordered.length - 1) * 0.75)].x;
    const low = ordered.filter((row) => row.x <= lowThreshold);
    const high = ordered.filter((row) => row.x >= highThreshold);
    return mean(high.map((row) => row.y)) - mean(low.map((row) => row.y));
};

const buildQuadraticRows = (rows) => {
    const center = mean(rows.map((row) => row.x));
    return rows.map((row) => ({
        ...row,
        x: (row.x - center) ** 2,
    }));
};

export class BonsaiMorphologyInfluenceModel {
    static analyze(samples = [], { factorKeys = null, maxDriversPerForm = 8 } = {}) {
        if (!Array.isArray(samples) || samples.length < MIN_SAMPLE_COUNT) {
            throw new Error(`ZEN_BONSAI_MORPHOLOGY_SAMPLE_COUNT_INSUFFICIENT:${samples.length}`);
        }
        samples.forEach(requireSample);
        const resolvedFactorKeys = resolveFactorKeys(samples, factorKeys);
        const formScores = samples.map(resolveFormScores);
        const byForm = {};
        let seedBlockedEstimateCount = 0;

        Object.values(BONSAI_FORM_ID).forEach((formId) => {
            const drivers = resolvedFactorKeys.map((factorId) => {
                const rows = samples.map((sample, index) => ({
                    seed: sample.seed,
                    x: Number(sample.latent[factorId]),
                    y: formScores[index].get(formId),
                }));
                const xValues = rows.map((row) => row.x);
                const xSpan = Math.max(...xValues) - Math.min(...xValues);
                if (xSpan <= EPS) {
                    return {
                        factorId,
                        direction: 'neutral',
                        association: 0,
                        nonlinearAssociation: 0,
                        quartileEffect: 0,
                        strength: 0,
                        support: rows.length,
                        method: 'constant_factor',
                        seedBlockCount: 0,
                    };
                }
                const residual = residualizeBySeed(rows);
                const quadraticResidual = residualizeBySeed(buildQuadraticRows(rows));
                if (residual.method === 'seed_blocked_association') {
                    seedBlockedEstimateCount += 1;
                }
                const association = pearson(residual.pairs);
                const nonlinearAssociation = pearson(quadraticResidual.pairs);
                const effect = quartileContrast(rows);
                const supportWeight = Math.sqrt(rows.length / (rows.length + 20));
                const nonlinearDominant = Math.abs(nonlinearAssociation) > Math.abs(association) * 1.1;
                const strongestAssociation = nonlinearDominant
                    ? nonlinearAssociation
                    : association;
                const strength = Math.abs(strongestAssociation) * supportWeight;
                return {
                    factorId,
                    direction: nonlinearDominant && nonlinearAssociation > 0.08
                        ? 'u_shaped'
                        : nonlinearDominant && nonlinearAssociation < -0.08
                            ? 'inverted_u'
                            : association > 0.08
                                ? 'positive'
                                : (association < -0.08 ? 'negative' : 'neutral'),
                    association: round(association),
                    nonlinearAssociation: round(nonlinearAssociation),
                    quartileEffect: round(effect),
                    strength: round(strength),
                    support: residual.pairs.length,
                    method: residual.method,
                    seedBlockCount: residual.seedBlockCount,
                };
            }).sort((left, right) => (
                right.strength - left.strength
                || Math.abs(right.quartileEffect) - Math.abs(left.quartileEffect)
                || left.factorId.localeCompare(right.factorId)
            ));
            byForm[formId] = {
                drivers: drivers.slice(0, Math.max(1, Math.floor(maxDriversPerForm))),
                evaluatedFactorCount: drivers.length,
            };
        });

        return {
            version: BONSAI_MORPHOLOGY_INFLUENCE_VERSION,
            sampleCount: samples.length,
            factorKeys: resolvedFactorKeys,
            design: seedBlockedEstimateCount > 0
                ? 'seed_blocked'
                : 'unblocked_observational',
            causalClaim: false,
            byForm,
        };
    }
}
