let loadedRuntime = null;
let loadingRuntime = null;
let revision = 0;

// Share the same lazy module instance used by Enso. A late import cannot revive
// a revoked history demand, and OFF never imports the observation graph.
export async function updateFeedObservationHistory(allowed) {
  if (typeof allowed !== 'boolean') throw new Error('FEED_HISTORY_POLICY_INVALID');
  const currentRevision = ++revision;
  if (!loadedRuntime && !allowed) return true;
  if (!loadedRuntime) {
    loadingRuntime ||= import('../../../nudge/feed-flow/FeedObservationRuntime.js')
      .then(({ default: runtime }) => {
        loadedRuntime = runtime;
        return runtime;
      }).catch((error) => {
        loadingRuntime = null;
        throw error;
      });
    await loadingRuntime;
  }
  if (currentRevision !== revision) return false;
  loadedRuntime.setHistoryAllowed(allowed);
  return true;
}

export function stopFeedObservationHistory() {
  revision += 1;
  if (loadedRuntime) loadedRuntime.setHistoryAllowed(false);
}
