import {
    MODEL_STATE_INITIAL_PROFILE_EPOCH,
    requireModelStateProfileEpochId,
} from '@/platform/storage/model/ProfileEpochContract.js';
import {
    ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
    ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
    requireZenBonsaiProfileAggregateStorageValue,
} from '@/platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js';
import {
    ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
    resolveZenBonsaiClassic2TreeIdentityFingerprint,
} from '../contracts/ZenBonsaiClassic2IdentityContract.js';
import {
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
} from '../contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
    ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION,
    ZEN_BONSAI_STRUCTURE_MODE,
    ZEN_BONSAI_TOPOLOGY_REFERENCE_HEIGHT,
} from '../contracts/ZenBonsaiProfileGenerationDefaults.js';
import {
    SAKURA_V2_LATENT_VERSION,
    getDefaultSakuraLatent,
} from './v2/SakuraLatentSchema.js';

export const ZEN_BONSAI_INITIAL_PROFILE_EPOCH = MODEL_STATE_INITIAL_PROFILE_EPOCH;

const createRandomTreeSeed = () => Math.floor(Math.random() * 100000);

const requireTreeSeed = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(
            'ZEN_BONSAI_PROFILE_AGGREGATE_ACTIVE_IDENTITY_TREE_SEED_INVALID',
        );
    }
    return value;
};
const requireProfileEpoch = (value) => {
    try {
        return requireModelStateProfileEpochId(value);
    } catch (cause) {
        const error = new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_INVALID');
        error.cause = cause;
        throw error;
    }
};

export const createInitialZenBonsaiProfileActiveIdentityInput = ({
    treeSeed = createRandomTreeSeed(),
} = {}) => Object.freeze({
    contract: ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
    treeType: 'sakura',
    treeSeed: requireTreeSeed(treeSeed),
    structureMode: ZEN_BONSAI_STRUCTURE_MODE.TREE,
    structureDepth: 6,
    topologyReferenceHeight: ZEN_BONSAI_TOPOLOGY_REFERENCE_HEIGHT,
    candidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
    canonicalLatent: Object.freeze({
        version: SAKURA_V2_LATENT_VERSION,
        values: Object.freeze(getDefaultSakuraLatent()),
    }),
    generationInputs: Object.freeze({
        learningProgress: 0,
        canopyDistributionProfile: ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION,
        spineGenerationConditionId: null,
    }),
});

export const createInitialZenBonsaiProfileGenerationAggregate = ({
    profileEpoch = ZEN_BONSAI_INITIAL_PROFILE_EPOCH,
    treeSeed,
} = {}) => {
    const activeIdentity = Object.freeze({
        ...createInitialZenBonsaiProfileActiveIdentityInput({ treeSeed }),
        identityRevision: 1,
    });
    return Object.freeze(requireZenBonsaiProfileAggregateStorageValue({
        kind: ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
        contract: ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
        profileEpoch: requireProfileEpoch(profileEpoch),
        stateRevision: 1,
        identityRevision: 1,
        activeIdentity,
        activeIdentityFingerprint: resolveZenBonsaiClassic2TreeIdentityFingerprint(
            activeIdentity,
        ),
        lineageState: null,
    }));
};
