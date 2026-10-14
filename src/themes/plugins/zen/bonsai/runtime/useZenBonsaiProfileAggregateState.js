import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
    ZEN_BONSAI_PROFILE_RESOURCE_STATUS,
    commitZenBonsaiProfileActiveIdentity,
    commitZenBonsaiProfileActiveIdentityPatch,
    getZenBonsaiProfileAggregateResourceState,
    readZenBonsaiProfileAggregateResource,
    subscribeZenBonsaiProfileAggregateResource,
} from '../state/ZenBonsaiProfileAggregateResource.js';

export function useZenBonsaiProfileAggregateState({ enabled = true } = {}) {
    const resource = useSyncExternalStore(
        subscribeZenBonsaiProfileAggregateResource,
        getZenBonsaiProfileAggregateResourceState,
        getZenBonsaiProfileAggregateResourceState,
    );

    useEffect(() => {
        if (!enabled) return undefined;
        void readZenBonsaiProfileAggregateResource().catch(() => undefined);
        return undefined;
    }, [enabled]);

    if (enabled && (
        resource.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.FAILED
        || resource.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.QUIESCED
    )) {
        throw resource.error;
    }

    const commitActiveIdentity = useCallback((activeIdentity) => (
        commitZenBonsaiProfileActiveIdentity({ activeIdentity })
    ), []);
    const commitActiveIdentityPatch = useCallback((patch) => (
        commitZenBonsaiProfileActiveIdentityPatch({ patch })
    ), []);
    const refresh = useCallback(() => (
        readZenBonsaiProfileAggregateResource({ force: true })
    ), []);

    return Object.freeze({
        ready: enabled
            && resource.status === ZEN_BONSAI_PROFILE_RESOURCE_STATUS.READY
            && resource.aggregate !== null,
        status: enabled ? resource.status : ZEN_BONSAI_PROFILE_RESOURCE_STATUS.IDLE,
        aggregate: enabled ? resource.aggregate : null,
        commitActiveIdentity,
        commitActiveIdentityPatch,
        refresh,
    });
}

export default useZenBonsaiProfileAggregateState;
