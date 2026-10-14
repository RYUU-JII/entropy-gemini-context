import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createArtifactDisclosureNavCueSeenRecord,
  readArtifactDisclosureNavCueRecord,
  resolveArtifactDisclosureNavCueState,
  writeArtifactDisclosureNavCueRecord,
} from './artifactDisclosureNavCueState.js';
import { useArtifactDisclosureSnapshot } from './useArtifactDisclosureSnapshot.js';

export function useArtifactDisclosureNavCue({
  activeTabId = '',
  enabled = true,
  storage = null,
} = {}) {
  const {
    snapshot,
    error,
    loading,
    refresh,
  } = useArtifactDisclosureSnapshot({ enabled });
  const [seenRecord, setSeenRecord] = useState(() => readArtifactDisclosureNavCueRecord({ storage }));

  const markSeen = useCallback((nextSnapshot = null) => {
    if (!nextSnapshot) return null;
    const nextRecord = createArtifactDisclosureNavCueSeenRecord(nextSnapshot);
    writeArtifactDisclosureNavCueRecord(nextRecord, { storage });
    setSeenRecord(nextRecord);
    return nextRecord;
  }, [storage]);

  useEffect(() => {
    if (!enabled || activeTabId !== 'tools' || !snapshot) return;
    markSeen(snapshot);
  }, [
    activeTabId,
    enabled,
    markSeen,
    snapshot,
  ]);

  return useMemo(() => ({
    ...resolveArtifactDisclosureNavCueState({
      artifactDisclosureSnapshot: enabled ? snapshot : null,
      activeTabId,
      record: seenRecord,
    }),
    artifactDisclosureSnapshot: snapshot,
    artifactDisclosureSnapshotError: error,
    artifactDisclosureSnapshotLoading: loading,
    markSeen,
    refreshArtifactDisclosureSnapshot: refresh,
  }), [
    activeTabId,
    enabled,
    error,
    loading,
    markSeen,
    refresh,
    seenRecord,
    snapshot,
  ]);
}

export default useArtifactDisclosureNavCue;
