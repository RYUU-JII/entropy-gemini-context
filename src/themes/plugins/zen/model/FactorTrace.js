import { LEARNING_Phenotype_FACTOR_KEYS } from './BonsaiGenetics';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 4) => Number(toNumber(value).toFixed(digits));

const getMetric = (candidate) => candidate?.metric || candidate?.analysis || null;

const buildDeltaRows = (winnerMap, loserMap, keys) => (
    keys.map((key) => {
        const winner = toNumber(winnerMap?.[key]);
        const loser = toNumber(loserMap?.[key]);
        return {
            id: key,
            winner: round(winner),
            loser: round(loser),
            delta: round(winner - loser),
        };
    })
);

const topByMagnitude = (rows, top = 8) => (
    [...rows]
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, top)
);

const buildComponentDeltaRows = (winnerMetric, loserMetric) => {
    const winnerComponents = Array.isArray(winnerMetric?.evaluation?.components)
        ? winnerMetric.evaluation.components
        : [];
    const loserComponents = Array.isArray(loserMetric?.evaluation?.components)
        ? loserMetric.evaluation.components
        : [];

    const winnerById = new Map(winnerComponents.map((component) => [component.id, component]));
    const loserById = new Map(loserComponents.map((component) => [component.id, component]));
    const componentIds = Array.from(new Set([...winnerById.keys(), ...loserById.keys()]));

    return componentIds.map((id) => {
        const winner = winnerById.get(id);
        const loser = loserById.get(id);
        const winnerContribution = toNumber(winner?.contribution);
        const loserContribution = toNumber(loser?.contribution);
        return {
            id,
            label: winner?.label || loser?.label || id,
            winnerScore: round(winner?.score),
            loserScore: round(loser?.score),
            deltaScore: round(toNumber(winner?.score) - toNumber(loser?.score)),
            winnerContribution: round(winnerContribution),
            loserContribution: round(loserContribution),
            deltaContribution: round(winnerContribution - loserContribution),
        };
    });
};

export const createABFactorTrace = ({ roundIndex, picked, winner, loser, pair }) => {
    if (!winner || !loser) {
        return null;
    }

    const winnerMetric = getMetric(winner);
    const loserMetric = getMetric(loser);
    const winnerFeatures = winnerMetric?.features || {};
    const loserFeatures = loserMetric?.features || {};
    const winnerLatent = winner?.latent || {};
    const loserLatent = loser?.latent || {};
    const featureKeys = Array.from(new Set([
        ...Object.keys(winnerFeatures),
        ...Object.keys(loserFeatures),
    ]));
    const latentKeys = Array.from(new Set([
        ...Object.keys(winnerLatent),
        ...Object.keys(loserLatent),
    ]));

    const featureDeltas = topByMagnitude(
        buildDeltaRows(winnerFeatures, loserFeatures, featureKeys),
        8,
    );
    const latentDeltas = topByMagnitude(
        buildDeltaRows(winnerLatent, loserLatent, latentKeys),
        8,
    );
    const phenotypeDeltas = topByMagnitude(
        buildDeltaRows(winner?.phenotype, loser?.phenotype, LEARNING_Phenotype_FACTOR_KEYS),
        8,
    );
    const componentDeltas = [...buildComponentDeltaRows(winnerMetric, loserMetric)]
        .sort((a, b) => Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution))
        .slice(0, 8);

    const winnerScores = winner?.scores || {};
    const loserScores = loser?.scores || {};

    return {
        id: `trace_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
        round: Number.isFinite(roundIndex) ? roundIndex : 0,
        picked,
        timestamp: new Date().toISOString(),
        seeds: {
            A: pair?.A?.seed ?? null,
            B: pair?.B?.seed ?? null,
            winner: winner.seed,
            loser: loser.seed,
        },
        generationContext: pair?.generationContext || null,
        scoreDelta: {
            rule: round(toNumber(winnerScores.rule) - toNumber(loserScores.rule)),
            neural: round(toNumber(winnerScores.neural) - toNumber(loserScores.neural)),
            pairwise: round(toNumber(winnerScores.pairwise) - toNumber(loserScores.pairwise)),
            novelty: round(toNumber(winnerScores.novelty) - toNumber(loserScores.novelty)),
            blended: round(toNumber(winnerScores.blended) - toNumber(loserScores.blended)),
        },
        topFeatureDeltas: featureDeltas,
        topLatentDeltas: latentDeltas,
        topPhenotypeDeltas: phenotypeDeltas,
        topComponentDeltas: componentDeltas,
    };
};
