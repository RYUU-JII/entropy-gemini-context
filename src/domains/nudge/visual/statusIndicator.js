let statusIndicatorPromise = null;
let loadedStatusIndicator = null;
let lifecycleEpoch = 0;
const reasonEpoch = { video: 0, shortform: 0 };

function getStatusIndicator() {
  if (loadedStatusIndicator) {
    return Promise.resolve(loadedStatusIndicator);
  }
  const epoch = lifecycleEpoch;
  statusIndicatorPromise ||= import('../indicator/view.js')
    .then(({ default: StatusIndicator }) => StatusIndicator)
    .catch((error) => {
      statusIndicatorPromise = null;
      console.error('[StatusIndicator] Failed to load indicator view.', error);
      throw error;
    });
  return statusIndicatorPromise.then((StatusIndicator) => {
    if (epoch === lifecycleEpoch) loadedStatusIndicator = StatusIndicator;
    return StatusIndicator;
  });
}

function invokeStatusIndicator(method, args) {
  const epoch = lifecycleEpoch;
  void getStatusIndicator()
    .then((StatusIndicator) => {
      if (epoch !== lifecycleEpoch) return;
      if (typeof StatusIndicator?.[method] !== 'function') {
        throw new Error(`STATUS_INDICATOR_METHOD_MISSING:${method}`);
      }
      StatusIndicator[method](...args);
    })
    .catch((error) => {
      console.error(`[StatusIndicator] Failed to run ${method}.`, error);
    });
}

const StatusIndicator = {
  update(next = {}) {
    invokeStatusIndicator('update', [next]);
  },
  updateIfLoaded(next = {}) {
    if (!loadedStatusIndicator) return;
    loadedStatusIndicator.update(next);
  },
  setVideoTarget(target) {
    invokeStatusIndicator('setVideoTarget', [target]);
  },
  pulseVideo(options = {}) {
    invokeStatusIndicator('pulseVideo', [options]);
  },
  showAttemptReason(kind) {
    if (!Object.hasOwn(reasonEpoch, kind)) throw new Error('INDICATOR_ATTEMPT_KIND_INVALID');
    const epoch = ++reasonEpoch[kind];
    return getStatusIndicator().then((view) => {
      if (epoch === reasonEpoch[kind]) view.showAttemptReason(kind);
    });
  },
  clearAttemptReason(kind) {
    if (!Object.hasOwn(reasonEpoch, kind)) throw new Error('INDICATOR_ATTEMPT_KIND_INVALID');
    reasonEpoch[kind] += 1;
    loadedStatusIndicator?.clearAttemptReason(kind);
  },
  isLoaded() {
    return !!loadedStatusIndicator;
  },
  teardown() {
    lifecycleEpoch += 1;
    reasonEpoch.video += 1;
    reasonEpoch.shortform += 1;
    const previousIndicator = loadedStatusIndicator;
    loadedStatusIndicator = null;
    if (previousIndicator && typeof previousIndicator.teardown === 'function') {
      previousIndicator.teardown();
    }
  },
};

export default StatusIndicator;
