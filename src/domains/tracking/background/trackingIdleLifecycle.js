export function createTrackingIdleLifecycle({
  activeTabRuntimeState,
  recordActiveTabDuration,
  finalizeActiveSession,
  startActiveSession,
} = {}) {
  async function setActiveTabAudible(isAudible, now = Date.now(), settlementOptions = {}) {
    await activeTabRuntimeState.setActiveTabAudible(isAudible, now, {
      onAudibleStopWhileIdle: async (stoppedAt) => {
        await recordActiveTabDuration(stoppedAt, settlementOptions);
        await finalizeActiveSession(stoppedAt, settlementOptions);
      },
    });
  }

  async function onIdleStateChange({ prevState, nextState, timestamp }) {
    if (prevState === nextState) return;
    const now = timestamp || Date.now();
    const isIdle = nextState !== 'active';
    const wasIdle = prevState !== 'active';

    if (!wasIdle && isIdle) {
      await recordActiveTabDuration(now);
      await finalizeActiveSession(now);

      const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
      if (activeTabInfo) {
        await activeTabRuntimeState.setActiveTabSegmentStartedAt(
          activeTabInfo.audible ? now : null,
        );
      }
      return;
    }

    if (wasIdle && !isIdle) {
      const activeTabInfo = activeTabRuntimeState.getActiveTabInfo();
      if (activeTabInfo && activeTabInfo.hostname) {
        await activeTabRuntimeState.setActiveTabSegmentStartedAt(now);
        await startActiveSession(activeTabInfo.hostname, now);
      }
    }
  }

  return {
    onIdleStateChange,
    setActiveTabAudible,
  };
}
