export const ZEN_RENDERER_WORK_JOURNAL_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);
export const ZEN_RENDERER_WORK_JOURNAL_CAPACITY = 16;
export const ZEN_POND_FRAME_SPIKE_THRESHOLD_MS = 50;

// A retained snapshot travels only with existing metrics responses. Sequence
// numbers and droppedCount make a slow observer's evidence loss explicit.
export const createZenRendererWorkJournal = ({
    enabled = ZEN_RENDERER_WORK_JOURNAL_ENABLED,
    timeOrigin = performance.timeOrigin,
} = {}) => {
    if (enabled && !Number.isFinite(timeOrigin)) {
        throw new Error('ZEN_RENDERER_WORK_JOURNAL_TIME_ORIGIN_INVALID');
    }
    const entries = [];
    let sequence = 0;
    let droppedCount = 0;
    return Object.freeze({
        append(entry) {
            if (!enabled) return;
            if (!entry || !Number.isFinite(entry.atMs) || entry.atMs < 0) {
                throw new Error('ZEN_RENDERER_WORK_JOURNAL_ENTRY_INVALID');
            }
            entries.push(Object.freeze({ ...entry, sequence: ++sequence }));
            if (entries.length > ZEN_RENDERER_WORK_JOURNAL_CAPACITY) {
                entries.shift();
                droppedCount += 1;
            }
        },
        snapshot() {
            if (!enabled) return null;
            return {
                capacity: ZEN_RENDERER_WORK_JOURNAL_CAPACITY,
                timeOrigin,
                sequence,
                droppedCount,
                entries: entries.slice(),
            };
        },
    });
};

export const normalizeZenRendererWorkJournal = (value, normalizeEntry) => {
    if (value === null || value === undefined) return null;
    if (
        value.capacity !== ZEN_RENDERER_WORK_JOURNAL_CAPACITY
        || !Number.isFinite(value.timeOrigin)
        || !Number.isInteger(value.sequence) || value.sequence < 0
        || !Number.isInteger(value.droppedCount) || value.droppedCount < 0
        || !Array.isArray(value.entries)
        || value.entries.length > ZEN_RENDERER_WORK_JOURNAL_CAPACITY
    ) {
        throw new Error('ZEN_RENDERER_WORK_JOURNAL_INVALID');
    }
    let previousSequence = value.droppedCount;
    const entries = value.entries.map((entry) => {
        if (
            !entry || !Number.isInteger(entry.sequence)
            || entry.sequence !== previousSequence + 1
            || !Number.isFinite(entry.atMs) || entry.atMs < 0
        ) {
            throw new Error('ZEN_RENDERER_WORK_JOURNAL_ENTRY_INVALID');
        }
        previousSequence = entry.sequence;
        return { ...normalizeEntry(entry), sequence: entry.sequence, atMs: entry.atMs };
    });
    if (previousSequence !== value.sequence) {
        throw new Error('ZEN_RENDERER_WORK_JOURNAL_SEQUENCE_INVALID');
    }
    return {
        capacity: value.capacity,
        timeOrigin: value.timeOrigin,
        sequence: value.sequence,
        droppedCount: value.droppedCount,
        entries,
    };
};
