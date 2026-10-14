import ZenModelRepository from '../../state/ZenModelRepository.js';
import {
    commitZenBonsaiProfileIdentity,
    commitZenBonsaiProfileLineage,
    normalizeZenBonsaiProfileAggregate,
} from '../../model/ZenBonsaiProfileAggregateModel.js';
const AGGREGATE_CAS_MAX_ATTEMPTS = 4;
const AGGREGATE_CAS_OUTCOMES = Object.freeze({
    COMMITTED: 'committed',
    VERIFIED: 'verified',
    CONFLICT: 'conflict',
});
const AGGREGATE_CAS_OUTCOME_VALUES = new Set(Object.values(AGGREGATE_CAS_OUTCOMES));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeRequiredAggregate = (value) => {
    if (value === null || value === undefined) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_STATE_REQUIRED');
    }
    return normalizeZenBonsaiProfileAggregate(value);
};

const normalizeStoredAggregate = (value) => (
    value === null ? null : normalizeRequiredAggregate(value)
);

const requireProfileEpoch = (value, code = 'ZEN_BONSAI_PROFILE_EPOCH_REQUIRED') => {
    if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
        throw new Error(code);
    }
    return value;
};

const normalizeProfileEpoch = (value) => (
    value === null ? null : requireProfileEpoch(value)
);

const normalizeAggregateSnapshot = (value) => {
    if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
        || typeof value.found !== 'boolean'
        || !hasOwn(value, 'value')
        || !hasOwn(value, 'profileEpoch')
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_SNAPSHOT_INVALID');
    }
    const aggregate = value.found ? normalizeRequiredAggregate(value.value) : null;
    const profileEpoch = normalizeProfileEpoch(value.profileEpoch);
    if (aggregate !== null && aggregate.profileEpoch !== profileEpoch) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_MISMATCH');
    }
    return Object.freeze({ aggregate, profileEpoch });
};

const resolveStateRevision = (aggregate) => {
    if (aggregate === null) return null;
    if (
        !hasOwn(aggregate, 'stateRevision')
        || !Number.isSafeInteger(aggregate.stateRevision)
        || aggregate.stateRevision < 1
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_STATE_REVISION_REQUIRED');
    }
    return aggregate.stateRevision;
};

const requireCasResult = (value, expectedRevision, expectedProfileEpoch) => {
    if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
        || !AGGREGATE_CAS_OUTCOME_VALUES.has(value.outcome)
        || !Object.is(value.expectedRevision, expectedRevision)
        || !hasOwn(value, 'matched')
        || !hasOwn(value, 'written')
        || !hasOwn(value, 'observedRevision')
        || !hasOwn(value, 'latestRevision')
        || !hasOwn(value, 'latestValue')
        || !hasOwn(value, 'expectedProfileEpoch')
        || !hasOwn(value, 'observedProfileEpoch')
        || !hasOwn(value, 'latestProfileEpoch')
        || !Object.is(value.expectedProfileEpoch, expectedProfileEpoch)
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
    }
    const committedRevisionAdvanced = Number.isSafeInteger(value.latestRevision)
        && value.latestRevision >= 1
        && (expectedRevision === null || value.latestRevision > expectedRevision);
    const observedEpochMatches = Object.is(
        value.observedProfileEpoch,
        expectedProfileEpoch,
    );
    const outcomeConsistent = (
        value.outcome === AGGREGATE_CAS_OUTCOMES.COMMITTED
            ? value.matched === true
                && value.written === true
                && Object.is(value.observedRevision, expectedRevision)
                && committedRevisionAdvanced
                && observedEpochMatches
                && typeof value.latestProfileEpoch === 'string'
            : value.outcome === AGGREGATE_CAS_OUTCOMES.VERIFIED
                ? value.matched === true
                    && value.written === false
                    && Object.is(value.observedRevision, expectedRevision)
                    && Object.is(value.latestRevision, expectedRevision)
                    && observedEpochMatches
                    && Object.is(value.latestProfileEpoch, expectedProfileEpoch)
                : value.matched === false
                    && value.written === false
                    && (
                        !Object.is(value.observedRevision, expectedRevision)
                        || !observedEpochMatches
                    )
                    && Object.is(value.latestRevision, value.observedRevision)
                    && Object.is(value.latestProfileEpoch, value.observedProfileEpoch)
    );
    if (!outcomeConsistent) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
    }
    return value;
};

const normalizeCasLatestSnapshot = (result) => {
    const latestAggregate = normalizeStoredAggregate(result.latestValue);
    if (!Object.is(result.latestRevision, resolveStateRevision(latestAggregate))) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
    }
    const latestProfileEpoch = normalizeProfileEpoch(result.latestProfileEpoch);
    if (
        latestAggregate !== null
        && latestAggregate.profileEpoch !== latestProfileEpoch
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
    }
    return Object.freeze({
        aggregate: latestAggregate,
        profileEpoch: latestProfileEpoch,
    });
};

const requireExpectedProfileEpoch = (actual, expected) => {
    const normalizedExpected = requireProfileEpoch(
        expected,
        'ZEN_BONSAI_PROFILE_AGGREGATE_EXPECTED_PROFILE_EPOCH_REQUIRED',
    );
    if (actual !== null && actual !== normalizedExpected) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_STALE');
    }
    return normalizedExpected;
};

const requireExpectedIdentity = ({
    aggregate,
    expectedIdentityRevision,
    expectedIdentityFingerprint,
}) => {
    if (!Number.isSafeInteger(expectedIdentityRevision) || expectedIdentityRevision < 1) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EXPECTED_IDENTITY_REVISION_REQUIRED');
    }
    if (
        typeof expectedIdentityFingerprint !== 'string'
        || !expectedIdentityFingerprint.startsWith('classic2_identity_v1:')
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EXPECTED_IDENTITY_FINGERPRINT_REQUIRED');
    }
    if (
        aggregate.identityRevision !== expectedIdentityRevision
        || aggregate.activeIdentityFingerprint !== expectedIdentityFingerprint
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_ACTIVE_IDENTITY_STALE');
    }
};

export class ZenBonsaiProfileAggregateRepository {
    constructor({
        modelRepository = ZenModelRepository.getInstance(),
    } = {}) {
        if (
            !modelRepository
            || typeof modelRepository.getBonsaiProfileAggregateSnapshot !== 'function'
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_REPOSITORY_MODEL_STORE_REQUIRED');
        }
        if (typeof modelRepository.compareAndSetBonsaiProfileAggregate !== 'function') {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_REQUIRED');
        }
        this.modelRepository = modelRepository;
    }

    static getInstance() {
        if (!ZenBonsaiProfileAggregateRepository.instance) {
            ZenBonsaiProfileAggregateRepository.instance = (
                new ZenBonsaiProfileAggregateRepository()
            );
        }
        return ZenBonsaiProfileAggregateRepository.instance;
    }

    async getProfileAggregateSnapshot() {
        return normalizeAggregateSnapshot(
            await this.modelRepository.getBonsaiProfileAggregateSnapshot(),
        );
    }

    async getProfileAggregate() {
        return (await this.getProfileAggregateSnapshot()).aggregate;
    }

    async updateProfileAggregate(resolver, { expectedProfileEpoch } = {}) {
        return this.updateProfileAggregateInternal(resolver, { expectedProfileEpoch });
    }

    async updateProfileAggregateInternal(
        resolver,
        { expectedProfileEpoch } = {},
    ) {
        if (typeof resolver !== 'function') {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_UPDATE_RESOLVER_REQUIRED');
        }

        const requiredProfileEpoch = requireExpectedProfileEpoch(
            null,
            expectedProfileEpoch,
        );
        let snapshot = await this.getProfileAggregateSnapshot();
        let current = snapshot.aggregate;
        if (
            snapshot.profileEpoch !== null
            && snapshot.profileEpoch !== requiredProfileEpoch
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_STALE');
        }
        if (current === null) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED');
        }
        for (let attempt = 1; attempt <= AGGREGATE_CAS_MAX_ATTEMPTS; attempt += 1) {
            const expectedRevision = resolveStateRevision(current);
            const next = resolver(current);
            if (next && typeof next.then === 'function') {
                throw new Error(
                    'ZEN_BONSAI_PROFILE_AGGREGATE_UPDATE_RESOLVER_MUST_BE_SYNCHRONOUS',
                );
            }
            if (next === null || next === undefined) {
                throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_STATE_REQUIRED');
            }

            const verifyOnly = current !== null && Object.is(next, current);
            const prepared = verifyOnly ? null : normalizeRequiredAggregate(next);
            if (prepared) resolveStateRevision(prepared);
            if (prepared && prepared.profileEpoch !== requiredProfileEpoch) {
                throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_MISMATCH');
            }
            const casResult = requireCasResult(
                await this.modelRepository.compareAndSetBonsaiProfileAggregate(
                    verifyOnly
                        ? {
                            expectedProfileEpoch: snapshot.profileEpoch,
                            expectedRevision,
                            verifyOnly: true,
                        }
                        : {
                            expectedProfileEpoch: snapshot.profileEpoch,
                            expectedRevision,
                            nextValue: prepared,
                        },
                ),
                expectedRevision,
                snapshot.profileEpoch,
            );

            if (casResult.outcome === AGGREGATE_CAS_OUTCOMES.CONFLICT) {
                snapshot = normalizeCasLatestSnapshot(casResult);
                current = snapshot.aggregate;
                if (snapshot.profileEpoch !== requiredProfileEpoch) {
                    throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_STALE');
                }
                if (current === null) {
                    throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED');
                }
                if (attempt === AGGREGATE_CAS_MAX_ATTEMPTS) {
                    throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RETRY_EXHAUSTED');
                }
                continue;
            }

            if (verifyOnly) {
                if (casResult.outcome !== AGGREGATE_CAS_OUTCOMES.VERIFIED) {
                    throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
                }
                return normalizeCasLatestSnapshot(casResult).aggregate;
            }

            if (
                casResult.outcome !== AGGREGATE_CAS_OUTCOMES.COMMITTED
                || !Object.is(casResult.latestValue, prepared)
            ) {
                throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RESULT_INVALID');
            }
            return normalizeCasLatestSnapshot(casResult).aggregate;
        }

        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_RETRY_EXHAUSTED');
    }

    async commitActiveIdentity({
        expectedProfileEpoch,
        expectedIdentityRevision,
        expectedIdentityFingerprint,
        activeIdentity,
    } = {}) {
        return this.updateProfileAggregate((current) => {
            const aggregate = normalizeRequiredAggregate(current);
            requireExpectedIdentity({
                aggregate,
                expectedIdentityRevision,
                expectedIdentityFingerprint,
            });
            return commitZenBonsaiProfileIdentity({
                previousAggregate: aggregate,
                activeIdentity,
            });
        }, { expectedProfileEpoch });
    }

    async updateActiveLineageState({
        expectedProfileEpoch,
        expectedIdentityRevision,
        expectedIdentityFingerprint,
        resolveLineage,
    } = {}) {
        if (typeof resolveLineage !== 'function') {
            throw new Error(
                'ZEN_BONSAI_PROFILE_AGGREGATE_LINEAGE_UPDATE_RESOLVER_REQUIRED',
            );
        }
        const committedAggregate = await this.updateProfileAggregate((current) => {
            const aggregate = normalizeRequiredAggregate(current);
            requireExpectedIdentity({
                aggregate,
                expectedIdentityRevision,
                expectedIdentityFingerprint,
            });
            const nextLineage = resolveLineage(aggregate.lineageState, aggregate);
            if (nextLineage && typeof nextLineage.then === 'function') {
                throw new Error(
                    'ZEN_BONSAI_PROFILE_AGGREGATE_LINEAGE_UPDATE_RESOLVER_MUST_BE_SYNCHRONOUS',
                );
            }
            return commitZenBonsaiProfileLineage({
                previousAggregate: aggregate,
                lineageState: nextLineage,
            });
        }, { expectedProfileEpoch });
        return committedAggregate.lineageState;
    }
}

export default ZenBonsaiProfileAggregateRepository;
