import { useEffect, useState } from 'react';

import {
    getActivityProfileStorageError,
    hydrateActivityProfileMap,
    subscribeActivityProfileStorageErrors,
} from '../../storage/repositories/zenActivityProfileRepository.js';
import {
    getAppearanceStorageError,
    hydrateAppearanceMap,
    subscribeAppearanceStorageErrors,
} from '../../storage/repositories/zenAppearanceRepository.js';

export function useZenPondModelDataRuntime({
    isolatedDataMode,
    bindAppearancePersistenceEvents,
} = {}) {
    if (typeof isolatedDataMode !== 'boolean') {
        throw new Error('ZEN_POND_MODEL_DATA_ISOLATION_MODE_INVALID');
    }
    if (typeof bindAppearancePersistenceEvents !== 'function') {
        throw new Error('ZEN_POND_APPEARANCE_PERSISTENCE_BINDER_REQUIRED');
    }
    const [hydrationState, setHydrationState] = useState(() => ({
        status: 'idle',
        error: null,
    }));

    useEffect(() => {
        if (isolatedDataMode) return undefined;
        let active = true;
        setHydrationState({ status: 'hydrating', error: null });
        const reportRuntimeError = (error) => {
            if (!active) return;
            setHydrationState((current) => (
                current.error
                    ? current
                    : { status: 'failed', error }
            ));
        };
        const unsubscribeAppearance = subscribeAppearanceStorageErrors(reportRuntimeError);
        const unsubscribeActivity = subscribeActivityProfileStorageErrors(reportRuntimeError);
        const existingError = getAppearanceStorageError()
            || getActivityProfileStorageError();
        const unbindAppearancePersistenceEvents = bindAppearancePersistenceEvents();
        if (existingError) {
            reportRuntimeError(existingError);
        } else {
            void Promise.all([
                hydrateAppearanceMap(),
                hydrateActivityProfileMap(),
            ]).then(() => {
                if (!active) return;
                setHydrationState({ status: 'ready', error: null });
            }).catch(reportRuntimeError);
        }
        return () => {
            active = false;
            unbindAppearancePersistenceEvents();
            unsubscribeAppearance();
            unsubscribeActivity();
        };
    }, [bindAppearancePersistenceEvents, isolatedDataMode]);

    return Object.freeze({
        ready: isolatedDataMode || hydrationState.status === 'ready',
        status: isolatedDataMode ? 'isolated_ready' : hydrationState.status,
        error: isolatedDataMode ? null : hydrationState.error,
    });
}

export default useZenPondModelDataRuntime;
