const disabledRuntimeDebugger = Object.freeze({
  arm() {},
  teardown() {},
  releaseForcedArm() {
    return false;
  },
  isSessionActive() {
    return false;
  },
  isFeedObservationActive() {
    return false;
  },
  getSessionPayload() {
    return null;
  },
});

export const runtimeDebugger = disabledRuntimeDebugger;
export default disabledRuntimeDebugger;
