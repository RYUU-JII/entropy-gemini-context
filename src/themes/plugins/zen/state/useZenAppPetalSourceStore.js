import { create } from 'zustand';

const SOURCE_FIELDS = Object.freeze([
    'petalCapacity',
    'bloomRatio',
    'petalFallLimit',
    'previewPetalRate',
]);

// Ambient presentation only: retain the last Home publication while Home is
// parked. No storage, polling, renderer admission or cultivation writes.
export const useZenAppPetalSourceStore = create(() => ({
    owner: null,
    sourceSignal: null,
    signature: '',
}));

export const publishZenAppPetalSource = (owner, signal) => {
    if (!owner || !signal || typeof signal !== 'object') {
        throw new Error('ZEN_APP_PETAL_SOURCE_REQUIRED');
    }
    const projection = {};
    for (const field of SOURCE_FIELDS) {
        const value = signal[field];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`ZEN_APP_PETAL_SOURCE_INVALID:${field}`);
        }
        // Small biological fluctuations do not need to rerender an app effect.
        projection[field] = Math.round(value * 50) / 50;
    }
    const signature = SOURCE_FIELDS.map((field) => projection[field]).join('|');
    const current = useZenAppPetalSourceStore.getState();
    if (current.owner === owner && current.signature === signature) return;
    useZenAppPetalSourceStore.setState({
        owner,
        sourceSignal: Object.freeze(projection),
        signature,
    });
};

export const clearZenAppPetalSource = (owner) => {
    if (useZenAppPetalSourceStore.getState().owner !== owner) return;
    useZenAppPetalSourceStore.setState({ owner: null, sourceSignal: null, signature: '' });
};
