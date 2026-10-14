import { createZenThemeModelState } from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import {
    ZEN_VNEXT_PREFERENCE_MODEL_STORAGE_KEY,
    normalizeVNextPreferenceModel,
} from './VNextPreferenceModel';

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export class VNextPreferenceModelStore {
    constructor({
        storageKey,
        zenThemeModelState = null,
        modelStateStore = null,
        profileGenerationLease = null,
    } = {}) {
        if (storageKey !== undefined) {
            throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_STORAGE_KEY_OVERRIDE_FORBIDDEN');
        }
        this.storageKey = ZEN_VNEXT_PREFERENCE_MODEL_STORAGE_KEY;
        this.modelStateStore = zenThemeModelState || (
            modelStateStore && typeof modelStateStore.getValueForBootstrap === 'function'
                ? modelStateStore
                : createZenThemeModelState({
                    modelStateStore,
                    profileGenerationLease,
                })
        );
        if (
            typeof this.modelStateStore?.getValueForBootstrap !== 'function'
            || typeof this.modelStateStore?.setValue !== 'function'
        ) {
            throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_STATE_OWNER_REQUIRED');
        }
    }

    async readValueForBootstrap() {
        return this.modelStateStore.getValueForBootstrap(this.storageKey);
    }

    async writeValue(value) {
        if (typeof this.modelStateStore?.setValue === 'function') {
            return this.modelStateStore.setValue(this.storageKey, value);
        }
        await this.modelStateStore.set({
            [this.storageKey]: value,
        });
        return value;
    }

    async getModel() {
        const model = await this.readValueForBootstrap();
        if (model === null || model === undefined) {
            return null;
        }
        if (!isPlainObject(model)) {
            throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_STATE_INVALID');
        }
        return normalizeVNextPreferenceModel(model);
    }

    async setModel(model = null) {
        if (!isPlainObject(model)) {
            throw new Error('ZEN_VNEXT_PREFERENCE_MODEL_STATE_INVALID');
        }
        const normalized = normalizeVNextPreferenceModel(model);
        await this.writeValue(normalized);
        return normalized;
    }

    async clearModel() {
        await this.writeValue(null);
    }
}

export const createVNextPreferenceModelStore = (options = {}) => new VNextPreferenceModelStore(options);
