import { useEffect } from 'react';
import { useDocumentVisibility } from '../../../ui-kit/hooks/useDocumentVisibility.js';
import { useAnalysisStore } from '../stores/useAnalysisStore.js';

// A demand lease owns refresh admission only. Facts and projection cache ownership
// stay in the background query services and the dashboard analysis store.
export function useAnalysisProjectionDemand(projections, enabled = true) {
    const documentVisible = useDocumentVisibility();
    const subscribeProjectionDemand = useAnalysisStore((state) => state.subscribeProjectionDemand);
    const loaded = useAnalysisStore((state) => state.loaded);
    const key = projections.join('|');
    useEffect(() => {
        if (!enabled || !documentVisible || !loaded || !key) return undefined;
        return subscribeProjectionDemand(key.split('|'));
    }, [documentVisible, enabled, key, loaded, subscribeProjectionDemand]);
    return enabled && documentVisible;
}
