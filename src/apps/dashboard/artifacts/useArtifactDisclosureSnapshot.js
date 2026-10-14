import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import {
  getArtifactDisclosureSnapshotResourceState,
  connectArtifactDisclosureSnapshotResource,
  readArtifactDisclosureSnapshotResource,
  subscribeArtifactDisclosureSnapshotResource,
} from './artifactDisclosureSnapshotResource.js';

const EMPTY_SUBSCRIBE = () => () => {};

export function useArtifactDisclosureSnapshot({
  enabled = true,
  revalidateOnEnable = false,
  revalidateFreshnessMs = 0,
} = {}) {
  // Retain only the last committed presentation while parked. Reentry selects
  // the current shared resource before its existing freshness/revalidation read.
  const retainedStateRef = useRef(null);
  if (retainedStateRef.current === null) retainedStateRef.current = getArtifactDisclosureSnapshotResourceState();
  const getSnapshot = useCallback(() => enabled
    ? getArtifactDisclosureSnapshotResourceState() : retainedStateRef.current, [enabled]);
  const resourceState = useSyncExternalStore(
    enabled ? subscribeArtifactDisclosureSnapshotResource : EMPTY_SUBSCRIBE,
    getSnapshot,
    getSnapshot,
  );
  useLayoutEffect(() => { if (enabled) retainedStateRef.current = resourceState; }, [enabled, resourceState]);

  const refresh = useCallback(async () => {
    return readArtifactDisclosureSnapshotResource({ force: true });
  }, []);

  useEffect(() => enabled ? connectArtifactDisclosureSnapshotResource() : undefined, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // The resource publishes failures to every consumer; the hook does not
    // convert a rejected canonical read into an empty snapshot.
    void readArtifactDisclosureSnapshotResource({
      maxAgeMs: revalidateOnEnable ? revalidateFreshnessMs : null,
    })
      .catch(() => undefined);
  }, [enabled, revalidateFreshnessMs, revalidateOnEnable]);

  return {
    snapshot: resourceState.snapshot,
    error: resourceState.error,
    loading: enabled && (
      resourceState.status === 'idle'
      || resourceState.status === 'loading'
    ),
    refresh,
  };
}

export default useArtifactDisclosureSnapshot;
