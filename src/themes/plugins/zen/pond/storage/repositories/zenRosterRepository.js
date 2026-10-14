import ZenModelRepository from '@/themes/plugins/zen/state/ZenModelRepository.js';
import { ZEN_THEME_MODEL_STATE_KEYS } from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import {
    EMPTY_ZEN_KOI_ROSTER_MEMORY,
    normalizeZenKoiRosterMemory,
    requireZenKoiRosterMemory,
} from '../../roster/zenKoiRosterMemory.js';

const readRosterMemory = async () => {
    const repository = ZenModelRepository.getInstance();
    const value = await repository.getValue(ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY);
    if (value === null || value === undefined) {
        return EMPTY_ZEN_KOI_ROSTER_MEMORY;
    }
    return requireZenKoiRosterMemory(value);
};

const writeRosterMemory = async (candidate = null) => {
    const repository = ZenModelRepository.getInstance();
    const normalized = normalizeZenKoiRosterMemory(candidate);
    await repository.setValue(
        ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY,
        normalized,
    );
    return normalized;
};

const clearRosterMemory = async () => {
    return writeRosterMemory(EMPTY_ZEN_KOI_ROSTER_MEMORY);
};

export {
    readRosterMemory,
    writeRosterMemory,
    clearRosterMemory,
};
