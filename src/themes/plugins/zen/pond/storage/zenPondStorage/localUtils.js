import {
    readZenWorkspaceStorageItem,
    removeZenWorkspaceStorageItem,
    writeZenWorkspaceStorageItem,
} from '@/themes/plugins/zen/state/ZenProductionUiState.js';

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const safeReadLocalStorage = (key) => readZenWorkspaceStorageItem(key, null);

const safeWriteLocalStorage = (key, value) => writeZenWorkspaceStorageItem(key, value);

const safeRemoveLocalStorage = (key) => removeZenWorkspaceStorageItem(key);

export {
    isPlainObject,
    safeReadLocalStorage,
    safeWriteLocalStorage,
    safeRemoveLocalStorage,
};
