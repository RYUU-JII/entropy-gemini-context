export function runAsyncHandler(
  sendResponse,
  work,
  onError = (error) => ({
    success: false,
    error: error?.code || error?.message || 'RUNTIME_ACTION_FAILED',
  }),
  afterResponse = null,
) {
  const responseTask = Promise.resolve()
    .then(work)
    .then(
      (payload) => {
        const response = payload ?? null;
        sendResponse(response);
        if (afterResponse !== null) {
          if (typeof afterResponse !== 'function') {
            throw new Error('RUNTIME_ACTION_AFTER_RESPONSE_OWNER_INVALID');
          }
          afterResponse(response);
        }
      },
      (error) => {
        sendResponse(onError(error));
      },
    );
  void responseTask.catch((error) => {
    console.error(
      `[RuntimeAction] ${error?.code || error?.message || 'RUNTIME_ACTION_AFTER_RESPONSE_FAILED'}`,
      error,
    );
  });
  return true;
}
