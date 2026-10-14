import {
    createInitialZenBonsaiProfileActiveIdentityInput,
    normalizeZenBonsaiProfileActiveIdentityInput,
} from '../../model/ZenBonsaiProfileAggregateModel.js';
import ZenBonsaiProfileAggregateRepository from '../storage/ZenBonsaiProfileAggregateRepository.js';
import ProfileResetLifecycleRepository, {
    isProfileResetWriteAdmissionClosed,
    resolveProfileResetGeneration,
} from '@/platform/storage/runtime/ProfileResetLifecycleRepository.js';

const freeze = (value) => Object.freeze(value);

export const ZEN_BONSAI_PROFILE_RESOURCE_STATUS = freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
    QUIESCED: 'quiesced',
});

const listeners = new Set();
let hydrationPromise = null;
let writeTail = Promise.resolve();
let resourceGeneration = 0;
let writeAdmissionOpen = true;
let profileResetGeneration;
let profileResetRepositoryRef = null;
let unsubscribeProfileReset = null;
let profileResetFencePromise = null;
let profileResetCaptureChanged = false;
let quiescePromise = null;
let resourceState = freeze({
    status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.IDLE,
    aggregate: null,
    error: null,
    revision: 0,
});

const publish = ({ status, aggregate = null, error = null }) => {
    resourceState = freeze({
        status,
        aggregate,
        error,
        revision: resourceState.revision + 1,
    });
    listeners.forEach((listener) => listener());
    return resourceState;
};

const requireWriteAdmission = () => {
    if (!writeAdmissionOpen) {
        throw new Error('ZEN_BONSAI_PROFILE_RESOURCE_WRITE_ADMISSION_CLOSED');
    }
};

export { createInitialZenBonsaiProfileActiveIdentityInput };

const enqueueWrite = (task) => {
    const queued = writeTail.then(task, task);
    writeTail = queued.catch(() => undefined);
    return queued;
};

const resolveRepository = (repository) => (
    repository || ZenBonsaiProfileAggregateRepository.getInstance()
);

const resolveProfileResetRepository = (repository) => (
    repository || ProfileResetLifecycleRepository.getInstance()
);

const quiesceForProfileReset = (reason) => {
    if (!quiescePromise) {
        quiescePromise = quiesceZenBonsaiProfileAggregateResource({ reason });
    }
    return quiescePromise;
};

const ensureProfileResetFence = async (repository = null) => {
    const resolvedRepository = resolveProfileResetRepository(repository);
    if (
        profileResetRepositoryRef !== null
        && profileResetRepositoryRef !== resolvedRepository
    ) {
        throw new Error('ZEN_BONSAI_PROFILE_RESET_LIFECYCLE_OWNER_CHANGED');
    }
    if (profileResetGeneration === undefined) {
        profileResetFencePromise ||= (async () => {
            profileResetRepositoryRef = resolvedRepository;
            unsubscribeProfileReset = resolvedRepository.subscribe((
                nextLifecycle,
                previousLifecycle,
            ) => {
                const nextGeneration = resolveProfileResetGeneration(nextLifecycle);
                if (profileResetGeneration === undefined) {
                    profileResetCaptureChanged = true;
                    void quiesceForProfileReset(
                        `profile_reset_capture:${nextGeneration || 'none'}`,
                    );
                    return;
                }
                const previousGeneration = resolveProfileResetGeneration(previousLifecycle);
                if (
                    isProfileResetWriteAdmissionClosed(nextLifecycle)
                    || nextGeneration !== profileResetGeneration
                    || isProfileResetWriteAdmissionClosed(previousLifecycle)
                    || previousGeneration !== profileResetGeneration
                ) {
                    void quiesceForProfileReset(
                        `profile_reset_generation:${nextGeneration || 'none'}`,
                    );
                }
            });
            const lifecycle = await resolvedRepository.read();
            if (profileResetCaptureChanged) {
                throw new Error('ZEN_BONSAI_PROFILE_RESET_GENERATION_CAPTURE_STALE');
            }
            profileResetGeneration = resolveProfileResetGeneration(lifecycle);
            if (isProfileResetWriteAdmissionClosed(lifecycle)) {
                void quiesceForProfileReset(
                    `profile_reset_generation:${profileResetGeneration || 'none'}`,
                );
            }
        })();
        await profileResetFencePromise;
    }
    await resolvedRepository.assertWriteAdmission({
        expectedResetId: profileResetGeneration,
    });
    return resolvedRepository;
};

const requireSnapshotProfileEpoch = (snapshot) => {
    if (snapshot.profileEpoch === null) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_MISSING');
    }
    if (snapshot.profileEpoch !== profileResetGeneration) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_LIFECYCLE_EPOCH_MISMATCH');
    }
    return snapshot;
};

export const getZenBonsaiProfileAggregateResourceState = () => resourceState;

export const subscribeZenBonsaiProfileAggregateResource = (listener) => {
    if (typeof listener !== 'function') {
        throw new Error('ZEN_BONSAI_PROFILE_RESOURCE_LISTENER_REQUIRED');
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const readZenBonsaiProfileAggregateResource = ({
    force = false,
    repository = null,
    profileResetRepository = null,
} = {}) => {
    if (hydrationPromise) return hydrationPromise;
    if (
        resourceState.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY
        && force !== true
    ) {
        return Promise.resolve(resourceState.aggregate);
    }
    const resolvedRepository = resolveRepository(repository);
    const hydrationGeneration = resourceGeneration;
    publish({
        status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.LOADING,
        aggregate: resourceState.aggregate,
    });
    hydrationPromise = (async () => {
        await ensureProfileResetFence(profileResetRepository);
        const snapshot = requireSnapshotProfileEpoch(
            await resolvedRepository.getProfileAggregateSnapshot(),
        );
        const aggregate = snapshot.aggregate;
        if (aggregate === null) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED');
        }
        if (
            writeAdmissionOpen !== true
            || hydrationGeneration !== resourceGeneration
        ) {
            throw resourceState.error || new Error(
                'ZEN_BONSAI_PROFILE_RESOURCE_HYDRATION_GENERATION_STALE',
            );
        }
        publish({
            status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY,
            aggregate,
        });
        return aggregate;
    })().catch((error) => {
        const failure = error instanceof Error ? error : new Error(String(error));
        if (
            writeAdmissionOpen !== true
            || resourceState.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.QUIESCED
        ) {
            throw resourceState.error || failure;
        }
        publish({
            status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.FAILED,
            aggregate: resourceState.aggregate,
            error: failure,
        });
        throw failure;
    }).finally(() => {
        hydrationPromise = null;
    });
    return hydrationPromise;
};

const requireReadyAggregate = async (repository = null, profileResetRepository = null) => {
    if (resourceState.status !== ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY) {
        await readZenBonsaiProfileAggregateResource({
            repository,
            profileResetRepository,
        });
    }
    if (!resourceState.aggregate) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_STATE_REQUIRED');
    }
    return resourceState.aggregate;
};

export const commitZenBonsaiProfileActiveIdentity = ({
    activeIdentity,
    repository = null,
    profileResetRepository = null,
} = {}) => enqueueWrite(async () => {
    requireWriteAdmission();
    await ensureProfileResetFence(profileResetRepository);
    const current = await requireReadyAggregate(repository, profileResetRepository);
    const normalizedIdentity = normalizeZenBonsaiProfileActiveIdentityInput(activeIdentity);
    const committed = await resolveRepository(repository).commitActiveIdentity({
        expectedProfileEpoch: current.profileEpoch,
        expectedIdentityRevision: current.identityRevision,
        expectedIdentityFingerprint: current.activeIdentityFingerprint,
        activeIdentity: normalizedIdentity,
    });
    publish({
        status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY,
        aggregate: committed,
    });
    return committed;
});

export const commitZenBonsaiProfileActiveIdentityPatch = ({
    patch,
    repository = null,
    profileResetRepository = null,
} = {}) => enqueueWrite(async () => {
    requireWriteAdmission();
    await ensureProfileResetFence(profileResetRepository);
    const current = await requireReadyAggregate(repository, profileResetRepository);
    const resolvedPatch = typeof patch === 'function'
        ? patch(current.activeIdentity)
        : patch;
    if (!resolvedPatch || typeof resolvedPatch !== 'object' || Array.isArray(resolvedPatch)) {
        throw new Error('ZEN_BONSAI_PROFILE_ACTIVE_IDENTITY_PATCH_REQUIRED');
    }
    const { identityRevision: _discardedRevision, ...currentInput } = current.activeIdentity;
    const nextIdentity = normalizeZenBonsaiProfileActiveIdentityInput({
        ...currentInput,
        ...resolvedPatch,
    });
    const committed = await resolveRepository(repository).commitActiveIdentity({
        expectedProfileEpoch: current.profileEpoch,
        expectedIdentityRevision: current.identityRevision,
        expectedIdentityFingerprint: current.activeIdentityFingerprint,
        activeIdentity: nextIdentity,
    });
    publish({
        status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY,
        aggregate: committed,
    });
    return committed;
});

export const quiesceZenBonsaiProfileAggregateResource = async ({
    reason = 'profile_lifecycle_invalidated',
} = {}) => {
    if (
        writeAdmissionOpen === false
        && resourceState.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.QUIESCED
    ) return resourceState;
    writeAdmissionOpen = false;
    resourceGeneration += 1;
    const failure = new Error(`ZEN_BONSAI_PROFILE_RESOURCE_QUIESCED:${reason}`);
    failure.code = 'ZEN_BONSAI_PROFILE_RESOURCE_QUIESCED';
    failure.reason = reason;
    publish({
        status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.QUIESCED,
        aggregate: resourceState.aggregate,
        error: failure,
    });
    const pendingHydration = hydrationPromise;
    await writeTail;
    if (pendingHydration) {
        await pendingHydration.catch(() => undefined);
    }
    return resourceState;
};

export const resetZenBonsaiProfileAggregateResourceForTests = () => {
    if (typeof unsubscribeProfileReset === 'function') {
        unsubscribeProfileReset();
    }
    listeners.clear();
    hydrationPromise = null;
    writeTail = Promise.resolve();
    resourceGeneration = 0;
    writeAdmissionOpen = true;
    profileResetGeneration = undefined;
    profileResetRepositoryRef = null;
    unsubscribeProfileReset = null;
    profileResetFencePromise = null;
    profileResetCaptureChanged = false;
    quiescePromise = null;
    resourceState = freeze({
        status: ZEN_BONSAI_PROFILE_RESOURCE_STATUS.IDLE,
        aggregate: null,
        error: null,
        revision: 0,
    });
};
