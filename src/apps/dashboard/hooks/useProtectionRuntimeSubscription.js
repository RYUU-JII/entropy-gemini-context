import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { getProtectionRuntimeSubscriptionBridge } from './protectionRuntimeSubscriptionBridge.js';

const EMPTY_SUBSCRIBE = () => () => {};
const EMPTY_SNAPSHOT = () => null;
const EMPTY_ERROR = () => '';
const IDENTITY_SNAPSHOT = (snapshot) => snapshot;

export function useProtectionRuntimeSubscription({
  enabled = true,
  fallbackPollMs = 15_000,
  snapshotFreshnessMs = 15_000,
  selectSnapshot = IDENTITY_SNAPSHOT,
} = {}) {
  const bridge = useMemo(() => getProtectionRuntimeSubscriptionBridge(), []);
  const getSelectedSnapshot = useMemo(() => () => selectSnapshot(bridge.getSnapshot()), [bridge, selectSnapshot]);
  const snapshot = useSyncExternalStore(
    enabled ? bridge.subscribe : EMPTY_SUBSCRIBE,
    enabled ? getSelectedSnapshot : EMPTY_SNAPSHOT,
    EMPTY_SNAPSHOT,
  );
  const error = useSyncExternalStore(
    enabled ? bridge.subscribe : EMPTY_SUBSCRIBE,
    enabled ? bridge.getError : EMPTY_ERROR,
    EMPTY_ERROR,
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    return bridge.connect({ fallbackPollMs, snapshotFreshnessMs });
  }, [bridge, enabled, fallbackPollMs, snapshotFreshnessMs]);

  return {
    snapshot,
    error,
    readSnapshot: bridge.readSnapshot,
    refreshSnapshot: bridge.refreshSnapshot,
  };
}

export default useProtectionRuntimeSubscription;
