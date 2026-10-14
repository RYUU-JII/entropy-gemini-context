import { SeededRandom } from '../../SeededRandom';
import { BonsaiFormClassifier } from '../morphology/BonsaiFormClassifier';
import { BonsaiStructuralDescriptorModel } from '../morphology/BonsaiStructuralDescriptorModel';

export const BONSAI_STRUCTURAL_SCOUT_VERSION = 1;

const requireSeed = (value) => {
    const seed = Number(value);
    if (!Number.isFinite(seed)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_SEED_REQUIRED');
    }
    return Math.floor(seed);
};

const requirePhenotype = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_PHENOTYPE_REQUIRED');
    }
    return value;
};

const cloneLatent = (value) => {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_LATENT_INVALID');
    }
    return { ...value };
};

export class BonsaiStructuralScoutEvaluator {
    constructor({
        treeType,
        species,
        stage,
        topologyHeight,
    } = {}) {
        if (!treeType || typeof treeType !== 'string') {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_TREE_TYPE_REQUIRED');
        }
        if (!species || typeof species.generateStructuralTopology !== 'function') {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_GENERATOR_REQUIRED');
        }
        if (typeof species.getPotDimensions !== 'function') {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_POT_DIMENSIONS_REQUIRED');
        }
        if (!stage || typeof stage !== 'object') {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_STAGE_REQUIRED');
        }
        const resolvedTopologyHeight = Number(topologyHeight);
        if (!Number.isFinite(resolvedTopologyHeight) || resolvedTopologyHeight <= 0) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_HEIGHT_REQUIRED');
        }
        this.treeType = treeType;
        this.species = species;
        this.stage = stage;
        this.topologyHeight = resolvedTopologyHeight;
    }

    evaluate({ seed, phenotype, latent = null, generationOptions = null } = {}) {
        const resolvedSeed = requireSeed(seed);
        const resolvedPhenotype = requirePhenotype(phenotype);
        const resolvedLatent = cloneLatent(latent);
        if (
            generationOptions !== null
            && (
                !generationOptions
                || typeof generationOptions !== 'object'
                || Array.isArray(generationOptions)
            )
        ) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_GENERATION_OPTIONS_INVALID');
        }
        const potDimensions = this.species.getPotDimensions(resolvedPhenotype);
        const potHeight = Number(potDimensions?.height);
        if (!Number.isFinite(potHeight) || potHeight <= 0) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_POT_HEIGHT_INVALID');
        }
        const topology = this.species.generateStructuralTopology(
            new SeededRandom(resolvedSeed),
            this.stage,
            this.topologyHeight,
            resolvedPhenotype,
            generationOptions || {},
        );
        const descriptor = BonsaiStructuralDescriptorModel.analyze(topology, { potHeight });
        const classification = BonsaiFormClassifier.classify(descriptor);
        return {
            version: BONSAI_STRUCTURAL_SCOUT_VERSION,
            source: 'bonsai_structural_scout_v1',
            treeType: this.treeType,
            seed: resolvedSeed,
            latent: resolvedLatent,
            phenotype: resolvedPhenotype,
            topology,
            structuralMorphology: {
                descriptor,
                classification,
            },
        };
    }

    evaluateBatch(samples = []) {
        if (!Array.isArray(samples) || !samples.length) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_SCOUT_BATCH_REQUIRED');
        }
        return samples.map((sample) => this.evaluate(sample));
    }
}
