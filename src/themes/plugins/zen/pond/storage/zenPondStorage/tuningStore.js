import {
    isPlainObject,
    safeReadLocalStorage,
    safeWriteLocalStorage,
} from './localUtils.js';
import {
    ZEN_POND_TUNING_CONTRACT_VERSION,
    projectZenPondTuningV1,
    requireZenPondTuningV1,
} from '../../contracts/zenPondTuningContract.js';

const ZEN_POND_TUNING_STORAGE_KEY = 'zen_pond_tuning_v1';
const TUNING_WRITE_DEBOUNCE_MS = 120;
const TUNING_WRITE_IDLE_TIMEOUT_MS = 800;

let memoryPondTuningCache = null;

const resolveTuningSnapshot = projectZenPondTuningV1;

const mergeTuningPatchWithBaseline = (baseline, patch) => {
    if (!isPlainObject(patch)) return baseline;
    const patchPhysics = isPlainObject(patch.physics) ? patch.physics : {};
    return {
        ...(isPlainObject(baseline) ? baseline : {}),
        ...patch,
        physics: {
            ...((isPlainObject(baseline) && isPlainObject(baseline.physics)) ? baseline.physics : {}),
            ...patchPhysics,
        },
    };
};

const readZenPondTuning = () => {
    if (memoryPondTuningCache) {
        return resolveTuningSnapshot(memoryPondTuningCache);
    }
    const raw = safeReadLocalStorage(ZEN_POND_TUNING_STORAGE_KEY);
    if (!raw) {
        const fallback = resolveTuningSnapshot(null);
        memoryPondTuningCache = fallback;
        return fallback;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error('ZEN_POND_TUNING_STATE_JSON_INVALID', { cause: error });
    }
    const snapshot = resolveTuningSnapshot(requireZenPondTuningV1(parsed));
    memoryPondTuningCache = snapshot;
    return snapshot;
};

const writeZenPondTuning = (candidate) => {
    const snapshot = resolveTuningSnapshot(candidate);
    memoryPondTuningCache = snapshot;
    safeWriteLocalStorage(ZEN_POND_TUNING_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
};

export {
    ZEN_POND_TUNING_STORAGE_KEY,
    TUNING_WRITE_DEBOUNCE_MS,
    TUNING_WRITE_IDLE_TIMEOUT_MS,
    mergeTuningPatchWithBaseline,
    readZenPondTuning,
    resolveTuningSnapshot,
    writeZenPondTuning,
};
