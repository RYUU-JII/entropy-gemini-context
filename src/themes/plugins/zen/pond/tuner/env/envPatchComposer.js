import { selectZenEnvCause } from '../../runtime/core/zenCauseModel.js';
import { pickZenEnvCausePatch } from './envCauseSchema.js';

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const hasOwnKeys = (value) => {
    return Object.keys(value).length > 0;
};

export const resolveNormalizedZenEnvCause = (tuning = null) => {
    return selectZenEnvCause(isPlainObject(tuning) ? tuning : {});
};

export const composeTuningWithZenCausePatch = (baseTuning = null, rawPatch = null) => {
    const safeBase = isPlainObject(baseTuning) ? baseTuning : {};
    const causePatch = pickZenEnvCausePatch(rawPatch);
    if (!hasOwnKeys(causePatch)) return safeBase;
    const baseCause = resolveNormalizedZenEnvCause(safeBase);
    const normalizedCause = selectZenEnvCause(
        {
            ...safeBase,
            ...causePatch,
        },
        baseCause,
    );
    return {
        ...safeBase,
        ...normalizedCause,
    };
};
