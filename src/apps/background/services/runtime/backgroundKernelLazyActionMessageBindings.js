import { createBackgroundKernelActionMessageBindings } from './backgroundKernelActionMessageBindings.js';

export function createLazyBackgroundKernelActionMessageBindings(dependencies = {}) {
  let handlerPromise = null;
  let handlerInstance = null;

  function loadHandler() {
    if (handlerInstance) return Promise.resolve(handlerInstance);
    handlerPromise ||= Promise.resolve()
      .then(() => {
        handlerInstance = createBackgroundKernelActionMessageBindings(dependencies);
        return handlerInstance;
      })
      .catch((error) => {
        handlerPromise = null;
        console.error('[BackgroundKernelActionMessageBindings] Failed to load action message handler.', error);
        throw error;
      });
    return handlerPromise;
  }

  return function handleActionMessage(request, sender, sendResponse) {
    if (!request?.action) return false;

    loadHandler()
      .then((handler) => {
        let responded = false;
        const trackedSendResponse = (payload) => {
          responded = true;
          return sendResponse?.(payload);
        };
        const handled = handler(request, sender, trackedSendResponse);
        if (handled !== true && !responded) {
          sendResponse?.({ success: false, error: 'ACTION_MESSAGE_UNHANDLED' });
        }
      })
      .catch((error) => {
        sendResponse?.({
          success: false,
          error: error?.message || 'ACTION_MESSAGE_HANDLER_LOAD_FAILED',
        });
      });

    return true;
  };
}
