import {
    createZenThemeModelState,
} from './ZenThemeModelState.js';

const requireProfileGeneration = (value) => {
    if (
        typeof value !== 'string'
        || !value.trim()
        || value.trim() !== value
    ) {
        throw new Error('ZEN_MODEL_PROFILE_GENERATION_REQUIRED');
    }
    return value;
};

export class ZenModelRepositoryCore {
    constructor({
        modelStateRepository,
        zenThemeModelState = null,
        profileGeneration = null,
        createProfileGenerationLease,
    } = {}) {
        if (!modelStateRepository) {
            throw new Error('ZEN_MODEL_STATE_REPOSITORY_REQUIRED');
        }
        if (
            !zenThemeModelState
            && typeof createProfileGenerationLease !== 'function'
        ) {
            throw new Error('ZEN_MODEL_PROFILE_GENERATION_LEASE_FACTORY_REQUIRED');
        }
        this.modelStateRepository = modelStateRepository;
        this.createProfileGenerationLease = createProfileGenerationLease;
        this.explicitProfileGeneration = profileGeneration === null
            ? null
            : requireProfileGeneration(profileGeneration);
        this.explicitProfileGenerationLeaseClosed = false;
        this.zenThemeModelState = zenThemeModelState || this.createModelState(
            this.explicitProfileGeneration,
        );
    }

    createModelState(profileGeneration) {
        if (typeof this.createProfileGenerationLease !== 'function') {
            throw new Error('ZEN_MODEL_PROFILE_GENERATION_LEASE_FACTORY_REQUIRED');
        }
        return createZenThemeModelState({
            modelStateStore: this.modelStateRepository,
            profileGenerationLease: this.createProfileGenerationLease({
                profileGeneration,
            }),
        });
    }

    get(defaults = {}) {
        return this.zenThemeModelState.get(defaults);
    }

    getValue(key, ...unsupportedDefaults) {
        return this.zenThemeModelState.getValue(key, ...unsupportedDefaults);
    }

    getValueForBootstrap(key) {
        return this.zenThemeModelState.getValueForBootstrap(key);
    }

    requireProfileGenerationLease() {
        if (typeof this.zenThemeModelState?.requireProfileGenerationLease !== 'function') {
            throw new Error('ZEN_MODEL_PROFILE_GENERATION_LEASE_REQUIRED');
        }
        return this.zenThemeModelState.requireProfileGenerationLease();
    }

    bindToProfileGeneration(profileGeneration) {
        const requestedProfileGeneration = requireProfileGeneration(profileGeneration);
        if (
            this.explicitProfileGeneration !== null
            && this.explicitProfileGeneration !== requestedProfileGeneration
        ) {
            const error = new Error('ZEN_MODEL_PROFILE_GENERATION_ALREADY_BOUND');
            error.code = 'ZEN_MODEL_PROFILE_GENERATION_ALREADY_BOUND';
            error.boundProfileGeneration = this.explicitProfileGeneration;
            error.requestedProfileGeneration = requestedProfileGeneration;
            throw error;
        }
        if (
            this.explicitProfileGeneration === requestedProfileGeneration
            && this.explicitProfileGenerationLeaseClosed !== true
        ) {
            return Object.freeze({
                bound: true,
                reused: true,
                profileGeneration: requestedProfileGeneration,
            });
        }
        this.closeForProfileMutation();
        this.zenThemeModelState = this.createModelState(requestedProfileGeneration);
        this.explicitProfileGeneration = requestedProfileGeneration;
        this.explicitProfileGenerationLeaseClosed = false;
        return Object.freeze({
            bound: true,
            profileGeneration: requestedProfileGeneration,
        });
    }

    closeForProfileMutation() {
        if (typeof this.zenThemeModelState?.closeForProfileMutation !== 'function') {
            throw new Error('ZEN_MODEL_PROFILE_GENERATION_LEASE_CLOSE_REQUIRED');
        }
        try {
            return this.zenThemeModelState.closeForProfileMutation();
        } finally {
            if (this.explicitProfileGeneration !== null) {
                this.explicitProfileGenerationLeaseClosed = true;
            }
        }
    }

    getBonsaiProfileAggregateSnapshot() {
        if (
            !this.zenThemeModelState
            || typeof this.zenThemeModelState.getBonsaiProfileAggregateSnapshot !== 'function'
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_SNAPSHOT_REQUIRED');
        }
        return this.zenThemeModelState.getBonsaiProfileAggregateSnapshot();
    }

    bootstrapValue(key, initialValue) {
        return this.zenThemeModelState.bootstrapValue(key, initialValue);
    }

    set(entries = {}) {
        return this.zenThemeModelState.set(entries);
    }

    setValue(key, value) {
        return this.zenThemeModelState.setValue(key, value);
    }

    clearValue(key) {
        return this.zenThemeModelState.clearValue(key);
    }

    compareAndSetBonsaiProfileAggregate(options) {
        if (
            !this.zenThemeModelState
            || typeof this.zenThemeModelState.compareAndSetBonsaiProfileAggregate !== 'function'
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_REQUIRED');
        }
        return this.zenThemeModelState.compareAndSetBonsaiProfileAggregate(options);
    }
}

export default ZenModelRepositoryCore;
