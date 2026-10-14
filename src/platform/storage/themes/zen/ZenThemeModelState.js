import {
    ZEN_THEME_MODEL_STATE_KEYS,
    isZenThemeModelStateDiscardableCacheKey,
    requireZenThemeModelStateKey,
    requireZenThemeModelStateValue,
} from './ZenThemeModelStateContract.js';
import {
    requireZenThemeProfileGeneration,
    requireZenThemeProfileGenerationLease,
} from './ZenThemeProfileGenerationLease.js';

export {
    ZEN_THEME_MODEL_STATE_CONTRACTS,
    ZEN_THEME_MODEL_STATE_KEYS,
    ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR,
    ZEN_THEME_MODEL_STATE_VALUE_CLASS,
    getZenThemeModelStateContract,
    isZenThemeModelStateDiscardableCacheKey,
    isZenThemeModelStateSnapshotIncluded,
    requireZenThemeModelStateKey,
    requireZenThemeModelStateSnapshotValue,
    requireZenThemeModelStateValue,
} from './ZenThemeModelStateContract.js';

const ZEN_MODEL_READ_METHODS = Object.freeze({
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG]: 'getSakuraV2TrainingLog',
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY]: 'getSakuraV2AbHistory',
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP]: 'getSakuraV2PairwiseGpState',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL]: 'getVNextPreferenceModel',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_AB_TRIALS]: 'getVNextAbTrials',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_RELIABILITY]: 'getVNextReliabilityState',
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER]: 'getBonsaiCultivationLedger',
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE]: 'getBonsaiProfileAggregate',
});

const ZEN_MODEL_WRITE_METHODS = Object.freeze({
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG]: 'setSakuraV2TrainingLog',
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY]: 'setSakuraV2AbHistory',
    [ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP]: 'setSakuraV2PairwiseGpState',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL]: 'setVNextPreferenceModel',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_AB_TRIALS]: 'setVNextAbTrials',
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_RELIABILITY]: 'setVNextReliabilityState',
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER]: 'setBonsaiCultivationLedger',
});

const ZEN_THEME_MODEL_STATE_MISSING = Symbol('zen_theme_model_state_missing');

const isProfileAggregateKey = (key) => (
    key === ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE
);

const rejectEpochBlindProfileAggregateRead = (key) => {
    if (isProfileAggregateKey(key)) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_READ_REQUIRED');
    }
};

const normalizeDefaults = (defaults = {}) => (
    defaults && typeof defaults === 'object' && !Array.isArray(defaults)
        ? Object.keys(defaults).reduce((acc, key) => {
            const normalizedKey = requireZenThemeModelStateKey(key);
            acc[normalizedKey] = defaults[key];
            return acc;
        }, {})
        : (() => {
            throw new Error('ZEN_THEME_MODEL_STATE_ENTRIES_INVALID');
        })()
);

const rejectCasOwnedDirectWrite = (entries) => {
    if (Object.prototype.hasOwnProperty.call(
        entries,
        ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
    )) {
        throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_REQUIRED');
    }
};

const validateReadValue = (key, value) => {
    if (value === null || value === undefined) {
        if (isZenThemeModelStateDiscardableCacheKey(key)) return null;
        throw new Error(`ZEN_THEME_MODEL_STATE_VALUE_INVALID:${key}`);
    }
    try {
        return requireZenThemeModelStateValue(key, value);
    } catch (error) {
        if (isZenThemeModelStateDiscardableCacheKey(key)) return null;
        throw error;
    }
};

const validateWriteEntries = (entries) => Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [
        key,
        value === null || value === undefined
            ? value
            : requireZenThemeModelStateValue(key, value),
    ]),
);

export class ZenThemeModelState {
    constructor({
        modelStateStore,
        profileGenerationLease,
    } = {}) {
        if (
            !modelStateStore
            || typeof modelStateStore.getWithProfileEpoch !== 'function'
            || typeof modelStateStore.setWithProfileEpoch !== 'function'
            || typeof modelStateStore.bootstrapValueWithProfileEpoch !== 'function'
        ) {
            throw new Error('ZEN_THEME_MODEL_STATE_STORE_REQUIRED');
        }
        this.modelStateStore = modelStateStore;
        this.profileGenerationLease = requireZenThemeProfileGenerationLease(
            profileGenerationLease,
        );
        this.profileGenerationPromise = Promise.resolve(this.profileGenerationLease.ready)
            .then(requireZenThemeProfileGeneration);
        void this.profileGenerationPromise.catch(() => undefined);
    }

    async requireProfileGenerationLease() {
        return requireZenThemeProfileGeneration(
            await this.profileGenerationLease.requireCurrent(),
        );
    }

    closeForProfileMutation() {
        return this.profileGenerationLease.close();
    }

    async get(selection = {}) {
        const normalizedSelection = normalizeDefaults(selection);
        if (!Object.keys(normalizedSelection).length) {
            return {};
        }
        const entries = await Promise.all(Object.keys(normalizedSelection).map(async (key) => [
            key,
            await this.getValue(key),
        ]));
        return Object.fromEntries(entries);
    }

    async readStoredValue(key) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        rejectEpochBlindProfileAggregateRead(normalizedKey);
        const expectedProfileEpoch = await this.requireProfileGenerationLease();
        const result = await this.modelStateStore.getWithProfileEpoch(
            { [normalizedKey]: ZEN_THEME_MODEL_STATE_MISSING },
            { expectedProfileEpoch },
        );
        if (
            !Object.prototype.hasOwnProperty.call(result || {}, normalizedKey)
            || result[normalizedKey] === ZEN_THEME_MODEL_STATE_MISSING
        ) {
            return ZEN_THEME_MODEL_STATE_MISSING;
        }
        return result[normalizedKey];
    }

    async readRawValue(key) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        const value = await this.readStoredValue(normalizedKey);
        if (value === ZEN_THEME_MODEL_STATE_MISSING) {
            if (isZenThemeModelStateDiscardableCacheKey(normalizedKey)) return null;
            throw new Error(`ZEN_THEME_MODEL_STATE_VALUE_MISSING:${normalizedKey}`);
        }
        return validateReadValue(normalizedKey, value);
    }

    async readRawValueForBootstrap(key) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        if (isZenThemeModelStateDiscardableCacheKey(normalizedKey)) {
            throw new Error(`ZEN_THEME_MODEL_STATE_CACHE_BOOTSTRAP_FORBIDDEN:${normalizedKey}`);
        }
        const value = await this.readStoredValue(normalizedKey);
        return value === ZEN_THEME_MODEL_STATE_MISSING
            ? null
            : validateReadValue(normalizedKey, value);
    }

    async writeRawValue(key, value) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        await this.set({
            [normalizedKey]: value,
        });
        return value;
    }

    async getValue(key, ...unsupportedDefaults) {
        if (unsupportedDefaults.length > 0) {
            throw new Error('ZEN_THEME_MODEL_STATE_READ_DEFAULT_FORBIDDEN');
        }
        const normalizedKey = requireZenThemeModelStateKey(key);
        const readMethod = ZEN_MODEL_READ_METHODS[normalizedKey];
        if (readMethod && typeof this[readMethod] === 'function') {
            return this[readMethod]();
        }
        return this.readRawValue(normalizedKey);
    }

    async getValueForBootstrap(key) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        if (isProfileAggregateKey(normalizedKey)) {
            const snapshot = await this.getBonsaiProfileAggregateSnapshot();
            return snapshot.found ? snapshot.value : null;
        }
        return this.readRawValueForBootstrap(normalizedKey);
    }

    async bootstrapValue(key, initialValue) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        if (isProfileAggregateKey(normalizedKey)) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_REQUIRED');
        }
        const canonicalInitialValue = requireZenThemeModelStateValue(normalizedKey, initialValue);
        const expectedProfileEpoch = await this.requireProfileGenerationLease();
        const value = await this.modelStateStore.bootstrapValueWithProfileEpoch(
            normalizedKey,
            canonicalInitialValue,
            { expectedProfileEpoch },
        );
        return validateReadValue(normalizedKey, value);
    }

    async set(entries = {}) {
        const normalizedEntries = normalizeDefaults(entries);
        if (!Object.keys(normalizedEntries).length) {
            return [];
        }
        rejectCasOwnedDirectWrite(normalizedEntries);
        const expectedProfileEpoch = await this.requireProfileGenerationLease();
        return this.modelStateStore.setWithProfileEpoch(
            validateWriteEntries(normalizedEntries),
            { expectedProfileEpoch },
        );
    }

    async setValue(key, value) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        const writeMethod = ZEN_MODEL_WRITE_METHODS[normalizedKey];
        if (writeMethod && typeof this[writeMethod] === 'function') {
            return this[writeMethod](value);
        }
        return this.writeRawValue(normalizedKey, value);
    }

    async clearValue(key) {
        const normalizedKey = requireZenThemeModelStateKey(key);
        await this.setValue(normalizedKey, null);
    }

    async getSakuraV2TrainingLog() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG);
    }

    async setSakuraV2TrainingLog(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_TRAINING_LOG,
            value,
        );
    }

    async getSakuraV2AbHistory() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY);
    }

    async setSakuraV2AbHistory(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_AB_HISTORY,
            value,
        );
    }

    async getSakuraV2PairwiseGpState() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP);
    }

    async setSakuraV2PairwiseGpState(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.SAKURA_V2_PAIRWISE_GP,
            value,
        );
    }

    async getVNextPreferenceModel() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL);
    }

    async setVNextPreferenceModel(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL,
            value,
        );
    }

    async getVNextAbTrials() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.VNEXT_AB_TRIALS);
    }

    async setVNextAbTrials(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.VNEXT_AB_TRIALS,
            value,
        );
    }

    async getVNextReliabilityState() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.VNEXT_RELIABILITY);
    }

    async setVNextReliabilityState(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.VNEXT_RELIABILITY,
            value,
        );
    }

    async getBonsaiCultivationLedger() {
        return this.readRawValue(ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER);
    }

    async setBonsaiCultivationLedger(value) {
        return this.writeRawValue(
            ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER,
            value,
        );
    }

    async getBonsaiProfileAggregate() {
        const snapshot = await this.getBonsaiProfileAggregateSnapshot();
        if (!snapshot.found) {
            throw new Error(
                `ZEN_THEME_MODEL_STATE_VALUE_MISSING:${ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE}`,
            );
        }
        return snapshot.value;
    }

    async getBonsaiProfileAggregateSnapshot() {
        if (
            !this.modelStateStore
            || typeof this.modelStateStore.getEntryWithProfileEpoch !== 'function'
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_SNAPSHOT_REQUIRED');
        }
        const expectedProfileEpoch = await this.requireProfileGenerationLease();
        const snapshot = await this.modelStateStore.getEntryWithProfileEpoch(
            ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
            { expectedProfileEpoch },
        );
        if (
            !snapshot
            || typeof snapshot !== 'object'
            || typeof snapshot.found !== 'boolean'
            || !Object.prototype.hasOwnProperty.call(snapshot, 'value')
            || !Object.prototype.hasOwnProperty.call(snapshot, 'profileEpoch')
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_EPOCH_SNAPSHOT_INVALID');
        }
        const value = snapshot.found
            ? validateReadValue(
                ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
                snapshot.value,
            )
            : null;
        if (value !== null && value.profileEpoch !== snapshot.profileEpoch) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_MISMATCH');
        }
        if (snapshot.profileEpoch === null) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_PROFILE_EPOCH_MISSING');
        }
        if (snapshot.profileEpoch !== expectedProfileEpoch) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_LIFECYCLE_EPOCH_MISMATCH');
        }
        if (!snapshot.found) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED');
        }
        return Object.freeze({
            found: snapshot.found,
            value,
            profileEpoch: snapshot.profileEpoch,
        });
    }

    async compareAndSetBonsaiProfileAggregate(options) {
        if (
            !this.modelStateStore
            || typeof this.modelStateStore.compareAndSetValueWithProfileEpoch !== 'function'
        ) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_CAS_REQUIRED');
        }
        const expectedProfileEpoch = await this.requireProfileGenerationLease();
        const requestedProfileEpoch = options?.expectedProfileEpoch;
        if (requestedProfileEpoch !== expectedProfileEpoch) {
            throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_LIFECYCLE_EPOCH_MISMATCH');
        }
        if (options?.nextValue !== null && options?.nextValue !== undefined) {
            requireZenThemeModelStateValue(
                ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
                options.nextValue,
            );
        }
        const result = await this.modelStateStore.compareAndSetValueWithProfileEpoch(
            ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
            options,
        );
        if (result?.latestValue !== null && result?.latestValue !== undefined) {
            requireZenThemeModelStateValue(
                ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
                result.latestValue,
            );
        }
        return result;
    }

}

export const createZenThemeModelState = ({
    modelStateStore,
    profileGenerationLease,
} = {}) => {
    if (!modelStateStore) {
        throw new Error('ZEN_THEME_MODEL_STATE_STORE_REQUIRED');
    }
    return new ZenThemeModelState({
        modelStateStore,
        profileGenerationLease,
    });
};

export const createZenThemeModelStateAdapter = ({
    zenThemeModelState = null,
    modelStateStore = null,
    profileGenerationLease = null,
} = {}) => {
    const resolvedZenThemeModelState = zenThemeModelState || (
        modelStateStore
            ? createZenThemeModelState({
                modelStateStore,
                profileGenerationLease,
            })
            : null
    );
    if (!resolvedZenThemeModelState) {
        throw new Error('ZEN_THEME_MODEL_STATE_ADAPTER_OWNER_REQUIRED');
    }
    return {
        async get(key) {
            return resolvedZenThemeModelState.getValue(key);
        },
        async getForBootstrap(key) {
            return resolvedZenThemeModelState.getValueForBootstrap(key);
        },
        async bootstrap(key, initialValue) {
            return resolvedZenThemeModelState.bootstrapValue(key, initialValue);
        },
        async set(key, value) {
            await resolvedZenThemeModelState.setValue(key, value);
        },
    };
};

export default ZenThemeModelState;
