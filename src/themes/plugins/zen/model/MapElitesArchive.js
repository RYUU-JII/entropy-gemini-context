import { Phenotype_FACTOR_DEFS, clampPhenotype } from './BonsaiGenetics';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const normalizePhenotypeFactor = (phenotype, key, fallback = 0.5) => {
    const def = Phenotype_FACTOR_DEFS[key];
    if (!def) {
        return fallback;
    }
    const span = Math.max(1e-6, def.max - def.min);
    const normalizedPhenotype = clampPhenotype(phenotype || {});
    return clamp01((Number(normalizedPhenotype[key]) - def.min) / span);
};

export const deriveMapElitesDescriptor = (candidate) => {
    const phenotype = candidate?.phenotype || {};
    const factors = candidate?.analysis?.factors || {};
    const features = candidate?.analysis?.features || {};

    const trunkStyle = normalizePhenotypeFactor(phenotype, 'trunkStyle', 0.5);
    const curvatureStrength = normalizePhenotypeFactor(phenotype, 'curvatureStrength', 0.5);
    const branchChaos = normalizePhenotypeFactor(phenotype, 'branchChaos', 0.5);
    const branchAngleBase = normalizePhenotypeFactor(phenotype, 'branchAngleBase', 0.5);
    const silhouetteTarget = normalizePhenotypeFactor(phenotype, 'silhouetteTarget', 0.5);
    const canopyBloomDensity = normalizePhenotypeFactor(phenotype, 'canopyBloomDensity', 0.5);
    const canopyBloomRadius = normalizePhenotypeFactor(phenotype, 'canopyBloomRadius', 0.5);
    const bloomRatio = clamp01(Number(factors.bloomRatio ?? phenotype.flowerChance ?? 0.5));
    const foliageDistribution = clamp01(Number(features.foliageDistribution ?? phenotype.canopyLayerBalance ?? 0.5));
    const verticalFlow = clamp01(Number(features.verticalFlow ?? phenotype.verticalBias ?? 0.5));
    const asymmetryGrace = clamp01(Number(features.asymmetryGrace ?? phenotype.rootAsymmetry ?? 0.5));
    const trunkFlow = clamp01(Number(features.trunkFlow ?? phenotype.curvatureBase ?? 0.5));

    const x = clamp01(
        (trunkStyle * 0.26)
        + (curvatureStrength * 0.2)
        + (branchChaos * 0.14)
        + (branchAngleBase * 0.14)
        + (trunkFlow * 0.14)
        + (verticalFlow * 0.12),
    );
    const y = clamp01(
        (bloomRatio * 0.24)
        + (foliageDistribution * 0.2)
        + (silhouetteTarget * 0.18)
        + (canopyBloomDensity * 0.16)
        + (canopyBloomRadius * 0.12)
        + (asymmetryGrace * 0.1),
    );
    return { x, y };
};

export const descriptorToCell = (descriptor, binsX = 8, binsY = 8) => {
    const x = clamp01(Number(descriptor?.x ?? 0.5));
    const y = clamp01(Number(descriptor?.y ?? 0.5));
    const safeBinsX = Math.max(2, Math.floor(binsX));
    const safeBinsY = Math.max(2, Math.floor(binsY));
    const col = Math.min(safeBinsX - 1, Math.floor(x * safeBinsX));
    const row = Math.min(safeBinsY - 1, Math.floor(y * safeBinsY));
    return {
        row,
        col,
        key: `${row}:${col}`,
        binsX: safeBinsX,
        binsY: safeBinsY,
    };
};

export const scoreMapElitesQuality = (candidate) => {
    const scores = candidate?.scores || {};
    const objective = Number.isFinite(scores.objective) ? scores.objective : (scores.blended ?? 0);
    const rule = Number(scores.rule ?? 0);
    const novelty = Number(scores.novelty ?? 0.5);
    return clamp01(
        (objective * 0.75)
        + (rule * 0.15)
        + (novelty * 0.1),
    );
};

export const upsertMapElitesArchive = ({
    archive,
    candidate,
    binsX = 8,
    binsY = 8,
}) => {
    if (!archive || !candidate) {
        return false;
    }
    const descriptor = deriveMapElitesDescriptor(candidate);
    const cell = descriptorToCell(descriptor, binsX, binsY);
    const key = cell.key;
    const quality = scoreMapElitesQuality(candidate);
    const novelty = Number(candidate?.scores?.novelty ?? 0.5);
    const current = archive[key];
    const nextEntry = {
        ...candidate,
        descriptor,
        cell,
        quality: Number(quality.toFixed(4)),
    };

    if (!current) {
        archive[key] = nextEntry;
        return true;
    }

    const currentQuality = Number(current.quality ?? 0);
    const qualityGap = quality - currentQuality;
    if (qualityGap > 1e-6) {
        archive[key] = nextEntry;
        return true;
    }
    if (Math.abs(qualityGap) <= 1e-6) {
        const currentNovelty = Number(current?.scores?.novelty ?? 0.5);
        if (novelty > currentNovelty) {
            archive[key] = nextEntry;
            return true;
        }
    }
    return false;
};

export const getMapElitesEntries = (archive) => (
    Object.values(archive || {})
        .sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0))
);
