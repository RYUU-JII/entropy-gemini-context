import {
    readZenWorkspaceStorageItem,
    writeZenWorkspaceStorageItem,
} from '@/themes/plugins/zen/state/ZenProductionUiState.js';
import {
    buildZenPondVisualProfileSnapshot,
    DEFAULT_ZEN_POND_VISUAL_PROFILE,
    requireZenPondVisualProfileSnapshot,
} from '../../contracts/zenPondVisualProfile.js';

export const ZEN_POND_VISUAL_PROFILE_STORAGE_KEY = 'zen_pond_visual_profile_v1';

export const readZenPondVisualProfile = () => {
    const raw = readZenWorkspaceStorageItem(
        ZEN_POND_VISUAL_PROFILE_STORAGE_KEY,
        null,
    );
    if (raw === null) {
        return DEFAULT_ZEN_POND_VISUAL_PROFILE;
    }
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('ZEN_POND_VISUAL_PROFILE_STORAGE_INVALID:serialized_snapshot_required');
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            'ZEN_POND_VISUAL_PROFILE_STORAGE_INVALID:json',
            { cause: error },
        );
    }
    return requireZenPondVisualProfileSnapshot(parsed).profile;
};

export const writeZenPondVisualProfile = (candidate) => {
    const snapshot = buildZenPondVisualProfileSnapshot(candidate);
    writeZenWorkspaceStorageItem(
        ZEN_POND_VISUAL_PROFILE_STORAGE_KEY,
        JSON.stringify(snapshot),
    );
    return snapshot.profile;
};
