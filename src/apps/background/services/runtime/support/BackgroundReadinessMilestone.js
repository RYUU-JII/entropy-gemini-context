export function createBackgroundReadinessMilestone({ duplicateErrorCode } = {}) {
  if (typeof duplicateErrorCode !== 'string' || !duplicateErrorCode) {
    throw new Error('BACKGROUND_READINESS_MILESTONE_DUPLICATE_ERROR_CODE_REQUIRED');
  }

  let status = 'pending';
  let resolveMilestone;
  let rejectMilestone;
  const promise = new Promise((resolve, reject) => {
    resolveMilestone = resolve;
    rejectMilestone = reject;
  });
  void promise.catch(() => {});

  return Object.freeze({
    isPending: () => status === 'pending',
    report(metadata = null) {
      if (status !== 'pending') throw new Error(duplicateErrorCode);
      status = 'ready';
      resolveMilestone(metadata);
    },
    reject(error) {
      if (status !== 'pending') return false;
      status = 'failed';
      rejectMilestone(error);
      return true;
    },
    getPromise() {
      return promise;
    },
    getPendingPromise() {
      return status === 'ready' ? null : promise;
    },
  });
}

export default createBackgroundReadinessMilestone;
