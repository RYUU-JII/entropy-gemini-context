export const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};

export const smooth = (current, next, alpha) => {
    if (!Number.isFinite(current) || current <= 0) return next;
    return current + ((next - current) * alpha);
};

export const compactInPlace = (array, keepPredicate) => {
    let write = 0;
    for (let read = 0; read < array.length; read += 1) {
        const item = array[read];
        if (!keepPredicate(item, read)) continue;
        array[write] = item;
        write += 1;
    }
    array.length = write;
};
