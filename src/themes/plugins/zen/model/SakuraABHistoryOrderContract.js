export const SAKURA_AB_HISTORY_ORDER_CONTRACT_VERSION = 1;
export const SAKURA_AB_HISTORY_ORDER_CONTRACT_ID = (
    'sakura_ab_history_strict_newest_first_timestamp_id_v1'
);

const requireEntryOrderKey = (entry, index) => {
    if (!Number.isSafeInteger(entry?.id) || entry.id < 0) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_ORDER_ID_INVALID:index=${index}`);
    }
    if (typeof entry?.timestamp !== 'string') {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_ORDER_TIMESTAMP_INVALID:index=${index}`);
    }
    const timestampMs = Date.parse(entry.timestamp);
    if (
        !Number.isFinite(timestampMs)
        || new Date(timestampMs).toISOString() !== entry.timestamp
    ) {
        throw new Error(`ZEN_SAKURA_AB_HISTORY_ORDER_TIMESTAMP_INVALID:index=${index}`);
    }
    return Object.freeze({
        id: entry.id,
        timestamp: entry.timestamp,
        timestampMs,
    });
};

export const requireSakuraABHistoryNewestFirst = (history = []) => {
    if (!Array.isArray(history)) {
        throw new TypeError('ZEN_SAKURA_AB_HISTORY_ORDER_ARRAY_REQUIRED');
    }
    const seenIds = new Set();
    let previous = null;
    history.forEach((entry, index) => {
        const current = requireEntryOrderKey(entry, index);
        if (seenIds.has(current.id)) {
            throw new Error(`ZEN_SAKURA_AB_HISTORY_ORDER_ID_DUPLICATE:id=${current.id}`);
        }
        seenIds.add(current.id);
        if (
            previous
            && (
                current.timestampMs > previous.timestampMs
                || (
                    current.timestampMs === previous.timestampMs
                    && current.id >= previous.id
                )
            )
        ) {
            throw new Error(
                `ZEN_SAKURA_AB_HISTORY_ORDER_NOT_NEWEST_FIRST:index=${index}`,
            );
        }
        previous = current;
    });
    return history;
};

export const createSakuraABHistoryChronologicalReplay = (history = []) => (
    [...requireSakuraABHistoryNewestFirst(history)].reverse()
);
