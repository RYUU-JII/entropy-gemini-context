import {
    ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION as DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    ZEN_BONSAI_STRUCTURE_MODE as STRUCTURE_MODE,
    ZEN_BONSAI_TOPOLOGY_REFERENCE_HEIGHT as TOPOLOGY_REFERENCE_HEIGHT,
    clampZenBonsaiCanopyDistribution as clampCanopyDistributionTuning,
} from '../contracts/ZenBonsaiProfileGenerationDefaults.js';
import {
    SAKURA_CANONICAL_LATENT_KEYS,
    SAKURA_V2_LATENT_VERSION,
    validateSakuraLatent,
} from './v2/SakuraLatentSchema.js';
import {
    normalizeZenBonsaiClassic2LineageState,
} from './classic2/ZenBonsaiClassic2LineageModel.js';
import {
    ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
    resolveZenBonsaiClassic2TreeIdentityFingerprint,
} from '../contracts/ZenBonsaiClassic2IdentityContract.js';
import {
    ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
} from '../contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
    validateSakuraSpineGenerationConditionIdV1,
} from '../contracts/SakuraSpineGenerationConditionContract.js';
import {
    ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
    ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
} from '@/platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js';
import {
    ZEN_BONSAI_INITIAL_PROFILE_EPOCH,
    createInitialZenBonsaiProfileActiveIdentityInput,
    createInitialZenBonsaiProfileGenerationAggregate,
} from './ZenBonsaiProfileGenerationGenesis.js';

export {
    ZEN_BONSAI_INITIAL_PROFILE_EPOCH,
    ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
    ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
    createInitialZenBonsaiProfileActiveIdentityInput,
    createInitialZenBonsaiProfileGenerationAggregate,
};
export const ZEN_BONSAI_PROFILE_ACTIVE_IDENTITY_CONTRACT = (
    ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT
);

const ACTIVE_IDENTITY_INPUT_KEYS = Object.freeze([
    'contract',
    'treeType',
    'treeSeed',
    'structureDepth',
    'structureMode',
    'topologyReferenceHeight',
    'candidateGraphContract',
    'canonicalLatent',
    'generationInputs',
]);
const ACTIVE_IDENTITY_KEYS = Object.freeze([
    ...ACTIVE_IDENTITY_INPUT_KEYS,
    'identityRevision',
]);
const AGGREGATE_KEYS = Object.freeze([
    'kind',
    'contract',
    'profileEpoch',
    'stateRevision',
    'identityRevision',
    'activeIdentity',
    'activeIdentityFingerprint',
    'lineageState',
]);
const CANOPY_DISTRIBUTION_KEYS = Object.freeze(
    Object.keys(DEFAULT_CANOPY_DISTRIBUTION_TUNING),
);
const STRUCTURE_DEPTH_RANGE_BY_MODE = Object.freeze({
    [STRUCTURE_MODE.BONSAI]: Object.freeze({ min: 1, max: 4 }),
    [STRUCTURE_MODE.TREE]: Object.freeze({ min: 3, max: 8 }),
});
const NORMALIZED_ACTIVE_IDENTITY_INPUTS = new WeakSet();
const NORMALIZED_ACTIVE_IDENTITIES = new WeakSet();
const NORMALIZED_AGGREGATES = new WeakSet();

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
);
const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const fail = (code, detail = '') => {
    throw new Error(
        `ZEN_BONSAI_PROFILE_AGGREGATE_${code}${detail ? `:${detail}` : ''}`,
    );
};
const requireRevision = (value, code) => {
    if (!Number.isSafeInteger(value) || value < 1) fail(code);
    return value;
};
const requireFiniteNumber = (value, code) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(code);
    return value;
};
const requireProfileEpoch = (value) => {
    if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
        fail('PROFILE_EPOCH_INVALID');
    }
    return value;
};
const requireRatio = (value, code) => {
    const numeric = requireFiniteNumber(value, code);
    if (numeric < 0 || numeric > 1) fail(code);
    return numeric;
};
const advanceRevision = (value, code) => {
    const next = requireRevision(value, code) + 1;
    if (!Number.isSafeInteger(next)) fail(`${code}_OVERFLOW`);
    return next;
};

const normalizeCanonicalLatent = (value) => {
    if (!hasExactKeys(value, ['version', 'values'])) {
        fail('ACTIVE_IDENTITY_CANONICAL_LATENT_SHAPE_INVALID');
    }
    if (value.version !== SAKURA_V2_LATENT_VERSION) {
        fail('ACTIVE_IDENTITY_CANONICAL_LATENT_VERSION_INVALID');
    }
    if (!hasExactKeys(value.values, SAKURA_CANONICAL_LATENT_KEYS)) {
        fail('ACTIVE_IDENTITY_CANONICAL_LATENT_VALUES_SHAPE_INVALID');
    }
    let values;
    try {
        values = validateSakuraLatent(value.values, {
            code: 'ZEN_BONSAI_PROFILE_AGGREGATE_ACTIVE_IDENTITY_CANONICAL_LATENT_INVALID',
            label: 'Zen bonsai profile aggregate active identity canonical latent',
        });
    } catch (error) {
        if (error?.code === 'ZEN_BONSAI_PROFILE_AGGREGATE_ACTIVE_IDENTITY_CANONICAL_LATENT_INVALID') {
            throw error;
        }
        fail('ACTIVE_IDENTITY_CANONICAL_LATENT_INVALID');
    }
    return Object.freeze({
        version: value.version,
        values: Object.freeze(values),
    });
};

const normalizeGenerationInputs = (value) => {
    if (!hasExactKeys(value, [
        'learningProgress',
        'canopyDistributionProfile',
        'spineGenerationConditionId',
    ])) {
        fail('ACTIVE_IDENTITY_GENERATION_INPUTS_SHAPE_INVALID');
    }
    if (!validateSakuraSpineGenerationConditionIdV1(
        value.spineGenerationConditionId,
    )) {
        fail('ACTIVE_IDENTITY_SPINE_GENERATION_CONDITION_ID_INVALID');
    }
    if (!hasExactKeys(value.canopyDistributionProfile, CANOPY_DISTRIBUTION_KEYS)) {
        fail('ACTIVE_IDENTITY_CANOPY_DISTRIBUTION_SHAPE_INVALID');
    }
    const normalizedCanopy = clampCanopyDistributionTuning(
        value.canopyDistributionProfile,
    );
    CANOPY_DISTRIBUTION_KEYS.forEach((key) => {
        requireFiniteNumber(
            value.canopyDistributionProfile[key],
            `ACTIVE_IDENTITY_CANOPY_DISTRIBUTION_INVALID:${key}`,
        );
        if (!Object.is(normalizedCanopy[key], value.canopyDistributionProfile[key])) {
            fail('ACTIVE_IDENTITY_CANOPY_DISTRIBUTION_INVALID', key);
        }
    });
    return Object.freeze({
        learningProgress: requireRatio(
            value.learningProgress,
            'ACTIVE_IDENTITY_LEARNING_PROGRESS_INVALID',
        ),
        canopyDistributionProfile: Object.freeze(normalizedCanopy),
        spineGenerationConditionId: value.spineGenerationConditionId,
    });
};

export const normalizeZenBonsaiProfileActiveIdentityInput = (value) => {
    if (isPlainObject(value) && NORMALIZED_ACTIVE_IDENTITY_INPUTS.has(value)) return value;
    if (!isPlainObject(value)) {
        fail('ACTIVE_IDENTITY_INPUT_SHAPE_INVALID');
    }
    if (value?.candidateGraphContract !== ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT) {
        fail('ACTIVE_IDENTITY_CANDIDATE_GRAPH_CONTRACT_INVALID');
    }
    if (!hasExactKeys(value, ACTIVE_IDENTITY_INPUT_KEYS)) {
        fail('ACTIVE_IDENTITY_INPUT_SHAPE_INVALID');
    }
    if (value.contract !== ZEN_BONSAI_PROFILE_ACTIVE_IDENTITY_CONTRACT) {
        fail('ACTIVE_IDENTITY_CONTRACT_INVALID');
    }
    if (value.treeType !== 'sakura') fail('ACTIVE_IDENTITY_TREE_TYPE_INVALID');
    if (!Number.isSafeInteger(value.treeSeed) || value.treeSeed < 0) {
        fail('ACTIVE_IDENTITY_TREE_SEED_INVALID');
    }
    const depthRange = STRUCTURE_DEPTH_RANGE_BY_MODE[value.structureMode];
    if (!depthRange) fail('ACTIVE_IDENTITY_STRUCTURE_MODE_INVALID');
    if (
        !Number.isSafeInteger(value.structureDepth)
        || value.structureDepth < depthRange.min
        || value.structureDepth > depthRange.max
    ) {
        fail('ACTIVE_IDENTITY_STRUCTURE_DEPTH_INVALID');
    }
    if (value.topologyReferenceHeight !== TOPOLOGY_REFERENCE_HEIGHT) {
        fail('ACTIVE_IDENTITY_TOPOLOGY_REFERENCE_HEIGHT_INVALID');
    }
    const normalized = Object.freeze({
        contract: ZEN_BONSAI_PROFILE_ACTIVE_IDENTITY_CONTRACT,
        treeType: value.treeType,
        treeSeed: value.treeSeed,
        structureDepth: value.structureDepth,
        structureMode: value.structureMode,
        topologyReferenceHeight: value.topologyReferenceHeight,
        candidateGraphContract: ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
        canonicalLatent: normalizeCanonicalLatent(value.canonicalLatent),
        generationInputs: normalizeGenerationInputs(value.generationInputs),
    });
    NORMALIZED_ACTIVE_IDENTITY_INPUTS.add(normalized);
    return normalized;
};

const stampActiveIdentity = (identityInput, identityRevision) => {
    const normalizedInput = normalizeZenBonsaiProfileActiveIdentityInput(identityInput);
    const normalized = Object.freeze({
        ...normalizedInput,
        identityRevision: requireRevision(
            identityRevision,
            'IDENTITY_REVISION_INVALID',
        ),
    });
    NORMALIZED_ACTIVE_IDENTITIES.add(normalized);
    return normalized;
};

export const normalizeZenBonsaiProfileActiveIdentity = (value) => {
    if (isPlainObject(value) && NORMALIZED_ACTIVE_IDENTITIES.has(value)) return value;
    if (!hasExactKeys(value, ACTIVE_IDENTITY_KEYS)) {
        fail('ACTIVE_IDENTITY_SHAPE_INVALID');
    }
    const identityInput = Object.fromEntries(
        ACTIVE_IDENTITY_INPUT_KEYS.map((key) => [key, value[key]]),
    );
    return stampActiveIdentity(identityInput, value.identityRevision);
};

export const resolveZenBonsaiProfileActiveIdentityFingerprint = (value) => (
    resolveZenBonsaiClassic2TreeIdentityFingerprint(
        normalizeZenBonsaiProfileActiveIdentity(value),
    )
);

const normalizeLineageForIdentity = ({ lineageState, activeIdentity, activeIdentityFingerprint }) => {
    if (lineageState === null) return null;
    let lineage;
    try {
        lineage = normalizeZenBonsaiClassic2LineageState(lineageState);
    } catch (error) {
        if (error instanceof Error) throw error;
        fail('LINEAGE_STATE_INVALID');
    }
    if (lineage.identityRevision !== activeIdentity.identityRevision) {
        fail('LINEAGE_IDENTITY_REVISION_MISMATCH');
    }
    if (lineage.treeIdentityFingerprint !== activeIdentityFingerprint) {
        fail('LINEAGE_IDENTITY_FINGERPRINT_MISMATCH');
    }
    return lineage;
};

export const normalizeZenBonsaiProfileAggregate = (value) => {
    if (isPlainObject(value) && NORMALIZED_AGGREGATES.has(value)) return value;
    if (!hasExactKeys(value, AGGREGATE_KEYS)) fail('STATE_SHAPE_INVALID');
    if (value.kind !== ZEN_BONSAI_PROFILE_AGGREGATE_KIND) fail('STATE_KIND_INVALID');
    if (value.contract !== ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT) {
        fail('STATE_CONTRACT_INVALID');
    }
    const stateRevision = requireRevision(value.stateRevision, 'STATE_REVISION_INVALID');
    const profileEpoch = requireProfileEpoch(value.profileEpoch);
    const identityRevision = requireRevision(
        value.identityRevision,
        'IDENTITY_REVISION_INVALID',
    );
    const activeIdentity = normalizeZenBonsaiProfileActiveIdentity(value.activeIdentity);
    if (activeIdentity.identityRevision !== identityRevision) {
        fail('ACTIVE_IDENTITY_REVISION_MISMATCH');
    }
    const activeIdentityFingerprint = resolveZenBonsaiProfileActiveIdentityFingerprint(
        activeIdentity,
    );
    if (value.activeIdentityFingerprint !== activeIdentityFingerprint) {
        fail('ACTIVE_IDENTITY_FINGERPRINT_MISMATCH');
    }
    const lineageState = normalizeLineageForIdentity({
        lineageState: value.lineageState,
        activeIdentity,
        activeIdentityFingerprint,
    });
    const normalized = Object.freeze({
        kind: ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
        contract: ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
        profileEpoch,
        stateRevision,
        identityRevision,
        activeIdentity,
        activeIdentityFingerprint,
        lineageState,
    });
    NORMALIZED_AGGREGATES.add(normalized);
    return normalized;
};

export const createInitialZenBonsaiProfileAggregate = ({
    activeIdentity,
    profileEpoch = ZEN_BONSAI_INITIAL_PROFILE_EPOCH,
    lineageState = null,
} = {}) => {
    const stampedIdentity = stampActiveIdentity(activeIdentity, 1);
    const activeIdentityFingerprint = resolveZenBonsaiProfileActiveIdentityFingerprint(
        stampedIdentity,
    );
    return normalizeZenBonsaiProfileAggregate({
        kind: ZEN_BONSAI_PROFILE_AGGREGATE_KIND,
        contract: ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT,
        profileEpoch: requireProfileEpoch(profileEpoch),
        stateRevision: 1,
        identityRevision: 1,
        activeIdentity: stampedIdentity,
        activeIdentityFingerprint,
        lineageState,
    });
};

export const bootstrapZenBonsaiProfileAggregate = createInitialZenBonsaiProfileAggregate;
export const createInitialProfileAggregate = createInitialZenBonsaiProfileAggregate;

export const commitZenBonsaiProfileIdentity = ({
    previousAggregate,
    activeIdentity,
} = {}) => {
    const previous = normalizeZenBonsaiProfileAggregate(previousAggregate);
    const nextIdentityRevision = advanceRevision(
        previous.identityRevision,
        'IDENTITY_REVISION_INVALID',
    );
    const nextActiveIdentity = stampActiveIdentity(activeIdentity, nextIdentityRevision);
    const nextFingerprint = resolveZenBonsaiProfileActiveIdentityFingerprint(
        nextActiveIdentity,
    );
    if (nextFingerprint === previous.activeIdentityFingerprint) {
        fail('IDENTITY_UNCHANGED');
    }
    return normalizeZenBonsaiProfileAggregate({
        ...previous,
        stateRevision: advanceRevision(
            previous.stateRevision,
            'STATE_REVISION_INVALID',
        ),
        identityRevision: nextIdentityRevision,
        activeIdentity: nextActiveIdentity,
        activeIdentityFingerprint: nextFingerprint,
        lineageState: null,
    });
};

export const commitZenBonsaiProfileLineage = ({
    previousAggregate,
    lineageState,
} = {}) => {
    const previous = normalizeZenBonsaiProfileAggregate(previousAggregate);
    const lineage = normalizeLineageForIdentity({
        lineageState,
        activeIdentity: previous.activeIdentity,
        activeIdentityFingerprint: previous.activeIdentityFingerprint,
    });
    if (lineage === null) fail('LINEAGE_STATE_REQUIRED');
    if (Object.is(lineage, previous.lineageState)) return previous;
    if (
        previous.lineageState !== null
        && lineage.stateRevision <= previous.lineageState.stateRevision
    ) {
        fail('LINEAGE_STATE_REVISION_MUST_ADVANCE');
    }
    return normalizeZenBonsaiProfileAggregate({
        ...previous,
        stateRevision: advanceRevision(
            previous.stateRevision,
            'STATE_REVISION_INVALID',
        ),
        lineageState: lineage,
    });
};
