const TAB_TIME_TRACKER_SNAPSHOT_READERS = [
  ['lastActiveTabId', 'getLastActiveTabId'], ['focusedWindowId', 'getFocusedWindowId'],
  ['activeTabInfo', 'getActiveTabInfo'], ['lastPreviousTabSettlement', 'getLastPreviousTabSettlementDiagnostic'],
  ['lastTabActivityBatch', 'getLastTabActivityBatchSummary'],
];

const STATS_RUNTIME_SNAPSHOT_READERS = [
  ['statsDiagnostics', 'getStatsDiagnostics'], ['statsFactsCache', 'getStatsFactsCacheDiagnostics'],
  ['statsRuntimeHealth', 'getStatsRuntimeHealth'],
];

const requireTrackingRuntimeSnapshotFunction = (owner, functionName, errorCode) => {
  const fn = owner?.[functionName];
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn.bind(owner);
};

const readSnapshotFields = (owner, readers, errorCode) => Object.fromEntries(
  readers.map(([field, functionName]) => [field, requireTrackingRuntimeSnapshotFunction(owner, functionName, errorCode)()]),
);

export function buildBackgroundKernelTrackingRuntimeSnapshot({ statsRuntimeService, tabTimeTracker } = {}) {
  const tabTimeFields = readSnapshotFields(
    tabTimeTracker,
    TAB_TIME_TRACKER_SNAPSHOT_READERS,
    'TRACKING_RUNTIME_SNAPSHOT_TAB_TIME_TRACKER_REQUIRED',
  );
  const statsRuntimeFields = readSnapshotFields(
    statsRuntimeService,
    STATS_RUNTIME_SNAPSHOT_READERS,
    'TRACKING_RUNTIME_SNAPSHOT_STATS_RUNTIME_REQUIRED',
  );
  return { ...tabTimeFields, ...statsRuntimeFields };
}
