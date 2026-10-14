import { getLocalDateStr } from '../../lib/time.js';
import ClseRepository from '../../platform/storage/clse/ClseRepository.js';
import {
    createEmptyClseBaselineValue,
} from '../../platform/storage/clse/clseBaselineStorageContract.js';

const defaultClseRepository = ClseRepository.getInstance();

export async function loadOrCreateCanonicalCLSEBaseline({
    repository = defaultClseRepository,
    now = Date.now(),
} = {}) {
    await repository.init();
    const stored = await repository.getBaseline();
    if (stored !== null) return stored;
    const created = createEmptyClseBaselineValue({ now });
    await repository.setBaseline(created);
    return created;
}

export async function clearCLSEHistoricalData({
    repository = defaultClseRepository,
    now = Date.now(),
} = {}) {
    if (
        !Number.isSafeInteger(now)
        || now <= 0
        || now > Number.MAX_SAFE_INTEGER - 1000
    ) {
        throw new Error('CLSE_MAINTENANCE_NOW_INVALID');
    }
    const cutoffTs = now + 1000;
    return repository.pruneTiers({
        buckets60sBefore: cutoffTs,
        buckets5minBefore: cutoffTs,
        loopEventsBefore: cutoffTs,
        aggressionLogsBefore: cutoffTs,
        dailySummariesBefore: getLocalDateStr(cutoffTs),
    });
}

export async function clearAllCLSEStorage({
    repository = defaultClseRepository,
} = {}) {
    await repository.clear();
    return true;
}
