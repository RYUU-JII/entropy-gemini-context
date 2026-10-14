import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';
import {
    DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
    sanitizeSakuraBlossomLabTuning,
} from './sakuraBlossomLabTuningContract.js';

export {
    DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
    SAKURA_BLOSSOM_LAB_TUNING_DEFS,
    applySakuraBlossomLabTuning,
    sanitizeSakuraBlossomLabTuning,
} from './sakuraBlossomLabTuningContract.js';

export const SAKURA_BLOSSOM_LAB_TUNING_STORAGE_KEY = 'zen_sakura_blossom_lab_tuning_v1';

export const readSakuraBlossomLabTuning = () => {
    if (!zenDevelopmentWorkspaceState) {
        return DEFAULT_SAKURA_BLOSSOM_LAB_TUNING;
    }
    const parsed = zenDevelopmentWorkspaceState.readJson(
        SAKURA_BLOSSOM_LAB_TUNING_STORAGE_KEY,
        DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
    );
    const normalized = sanitizeSakuraBlossomLabTuning(parsed || {});
    return normalized;
};

export const persistSakuraBlossomLabTuning = (value = {}) => {
    if (!zenDevelopmentWorkspaceState) {
        const error = new Error(
            'Sakura blossom lab tuning is available only in a development build.',
        );
        error.code = 'ZEN_BLOSSOM_LAB_DEVELOPMENT_WORKSPACE_NOT_AVAILABLE';
        throw error;
    }
    const normalized = sanitizeSakuraBlossomLabTuning(value);
    zenDevelopmentWorkspaceState.writeJson(
        SAKURA_BLOSSOM_LAB_TUNING_STORAGE_KEY,
        normalized,
    );
    return normalized;
};
